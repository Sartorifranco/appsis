'use strict'

/**
 * IT Ops Hub – Proxy local multi-NVR (Hikvision ISAPI / Dahua CGI)
 *
 * Soporta hasta 7 NVRs configurados en .env como NVR_1_*, NVR_2_*, etc.
 * Corre en localhost:3001; las credenciales NUNCA llegan al browser.
 *
 * Uso:  cd server && npm start
 */

require('dotenv').config({ path: '../.env' })

const express = require('express')
const cors    = require('cors')
const axios   = require('axios')
const https   = require('https')
const crypto  = require('crypto')

const app  = express()
const PORT = parseInt(process.env.NVR_PROXY_PORT || '3001', 10)

app.use(cors())
app.use(express.json())

const httpsAgent = new https.Agent({ rejectUnauthorized: false })

// ── Utilidades compartidas ────────────────────────────────────────────────────

function md5(s) { return crypto.createHash('md5').update(s).digest('hex') }

/** Extrae el primer valor de una etiqueta XML */
function xml(text, tag) {
  const m = text.match(new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`, 'i'))
  return m ? m[1].trim() : null
}

/** Extrae todos los bloques de una etiqueta XML */
function xmlBlocks(text, tag) {
  const re = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi')
  return [...text.matchAll(re)].map(m => m[0])
}

/** Parsea respuestas multiline de Dahua: "table.prop=val\r\n..." */
function dahuaParse(text) {
  const obj = {}
  String(text).split(/[\r\n]+/).forEach(line => {
    const eq = line.indexOf('=')
    if (eq > 0) obj[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  })
  return obj
}

/**
 * Expande canales desde string como "1-16,33,34" → [1,2,...,16,33,34]
 */
function parseChannels(str) {
  const channels = []
  String(str || '1,2,3,4').split(',').forEach(part => {
    part = part.trim()
    const range = part.match(/^(\d+)-(\d+)$/)
    if (range) {
      const from = parseInt(range[1], 10)
      const to   = parseInt(range[2], 10)
      for (let i = from; i <= to; i++) channels.push(i)
    } else {
      const n = parseInt(part, 10)
      if (!isNaN(n)) channels.push(n)
    }
  })
  return channels
}

// ══════════════════════════════════════════════════════════════════════════════
// FACTORY: crea una instancia completa de NVR con estado aislado
// ══════════════════════════════════════════════════════════════════════════════

function createNvrInstance({ id, name, url, user, pass, brand, channelStr }) {
  const channels = parseChannels(channelStr)

  // ── Estado por instancia ─────────────────────────────────────────────────
  let digestNc  = 0
  const cap     = { rpc2: null, recordMgrCgi: null }  // null=sin probar
  let rpc2Session = null
  let rpc2Ts      = 0
  const RPC2_TTL_MS   = 270_000
  const motionLastSeen = new Map()
  const MOTION_KEEP_MS = 30_000
  let channelCache   = null
  let channelCacheTs = 0
  const CACHE_TTL_MS = 8_000

  // ── Digest Auth ─────────────────────────────────────────────────────────
  function buildDigestHeader(method, urlPath, wwwAuth) {
    const p = {}
    wwwAuth.replace(/(\w+)=(?:"([^"]*)"|([^\s,]+))/g, (_, k, v1, v2) => {
      p[k.toLowerCase()] = (v1 ?? v2 ?? '').trim()
    })
    const realm  = p['realm']     || ''
    const nonce  = p['nonce']     || ''
    const qop    = p['qop']       || ''
    const opaque = p['opaque']    || ''
    const alg    = p['algorithm'] || 'MD5'
    const cnonce = crypto.randomBytes(4).toString('hex')
    digestNc++
    const nc = digestNc.toString(16).padStart(8, '0')
    const ha1 = md5(`${user}:${realm}:${pass}`)
    const ha2 = md5(`${method}:${urlPath}`)
    const response = qop
      ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
      : md5(`${ha1}:${nonce}:${ha2}`)
    const parts = [
      `Digest username="${user}"`, `realm="${realm}"`, `nonce="${nonce}"`,
      `uri="${urlPath}"`, `algorithm=${alg}`, `response="${response}"`,
    ]
    if (qop)    parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`)
    if (opaque) parts.push(`opaque="${opaque}"`)
    return parts.join(', ')
  }

  // ── Cliente HTTP ─────────────────────────────────────────────────────────
  const client = axios.create({
    baseURL:    url,
    httpsAgent,
    timeout:    8000,
    headers:    { Accept: 'application/xml, text/plain, text/html, */*' },
  })

  client.interceptors.response.use(
    res => res,
    async err => {
      const res    = err.response
      const config = err.config
      if (!res || res.status !== 401 || config._digestRetry) throw err
      const wwwAuth = res.headers['www-authenticate'] || ''
      if (wwwAuth.toLowerCase().startsWith('basic')) {
        config._digestRetry = true
        config.headers['Authorization'] = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
        return client(config)
      }
      if (!wwwAuth.toLowerCase().startsWith('digest')) throw err
      config._digestRetry = true
      const fullUrl = config.url || ''
      const urlPath = fullUrl.startsWith('http')
        ? new URL(fullUrl).pathname + (new URL(fullUrl).search || '')
        : fullUrl.replace(url, '') || fullUrl
      config.headers['Authorization'] = buildDigestHeader(
        (config.method || 'GET').toUpperCase(), urlPath, wwwAuth)
      return client(config)
    },
  )

  // ══════════════════════════════════════════════════════════════════════════
  // HIKVISION
  // ══════════════════════════════════════════════════════════════════════════

  async function hikGetHdd() {
    const { data } = await client.get('/ISAPI/System/storage/hdd')
    const blocks = xmlBlocks(data, 'hdd')
    if (!blocks.length) {
      return [{
        id: xml(data, 'id') || '1',
        status: xml(data, 'status') || 'unknown',
        capacityMB: parseInt(xml(data, 'capacity')  || '0', 10),
        freeMB:     parseInt(xml(data, 'freeSpace') || '0', 10),
      }]
    }
    return blocks.map(b => ({
      id:         xml(b, 'id')     || '?',
      status:     xml(b, 'status') || 'unknown',
      capacityMB: parseInt(xml(b, 'capacity')  || '0', 10),
      freeMB:     parseInt(xml(b, 'freeSpace') || '0', 10),
    }))
  }

  async function hikGetInputProxyStatus() {
    const { data } = await client.get(
      '/ISAPI/ContentMgmt/InputProxy/channels/status', { timeout: 8000 })
    const blocks = xmlBlocks(data, 'InputProxyChannelStatus')
    if (!blocks.length) {
      return Promise.all(channels.map(ch =>
        hikGetChannelStatus(ch).catch(err => ({
          id: ch, videoStatus: 'error', recording: false, online: false,
          recordMode: 'unknown', bitRate: 0, error: err.message,
        }))
      ))
    }
    return blocks
      .map(b => {
        const chId    = parseInt(xml(b, 'id') || '0', 10)
        const online  = xml(b, 'online') === 'true'
        const bitRate = parseInt(xml(b, 'inboundBitRate') || xml(b, 'bitRate') || '0', 10)
        const recRaw  = xml(b, 'recording')
        const recording = recRaw === 'true' || bitRate > 0
        return {
          id: chId, name: xml(b, 'name') || `Canal ${chId}`,
          videoStatus: online ? 'ok' : 'noVideo',
          recordMode: recording ? 'always' : 'other',
          recording, online, bitRate,
        }
      })
      .filter(ch => !channels.length || channels.includes(ch.id))
  }

  async function hikGetChannelStatus(ch) {
    let videoOk = false, videoStatus = 'unknown'
    try {
      const { data } = await client.get(`/ISAPI/System/Video/inputs/channels/${ch}/status`)
      videoStatus = xml(data, 'videoInputStatus') || 'unknown'
      videoOk = videoStatus === 'ok'
    } catch {}
    let recordMode = 'unknown', isRecording = false
    if (videoOk) {
      try {
        const { data } = await client.get('/ISAPI/ContentMgmt/record/tracks')
        const trackId = ch * 100 + 1
        const track = xmlBlocks(data, 'Track').find(b => {
          const tId = parseInt(xml(b, 'id') || '0', 10)
          const tCh = parseInt(xml(b, 'Channel') || xml(b, 'channel') || '0', 10)
          return tId === trackId || tCh === ch
        })
        if (track) {
          recordMode = xml(track, 'DefaultRecordingMode') || xml(track, 'recordingMode') || 'unknown'
          isRecording = recordMode === 'always'
        }
      } catch {}
    }
    return { id: ch, videoStatus, recordMode, recording: isRecording, online: videoOk }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DAHUA
  // ══════════════════════════════════════════════════════════════════════════

  async function dahuaGetHdd() {
    try {
      const { data } = await client.get(
        '/cgi-bin/storageDevice.cgi?action=getDeviceAllInfo', { timeout: 10000 })
      const rawPreview = String(data).replace(/\r?\n/g, ' | ').slice(0, 400)
      console.log(`[NVR ${id}] HDD raw: ${rawPreview}`)
      const props = dahuaParse(data)
      const diskMap = {}
      for (let i = 0; i < 64; i++) {
        const key = `list.info[0].Detail[${i}].TotalBytes`
        if (props[key] === undefined) break
        const total  = parseFloat(props[key] || '0')
        const used   = parseFloat(props[`list.info[0].Detail[${i}].UsedBytes`]  || '0')
        const isErr  = props[`list.info[0].Detail[${i}].IsError`] === 'true'
        const path   = props[`list.info[0].Detail[${i}].Path`] || ''
        const diskM  = path.match(/\/dev\/([a-z]+)\d*/)
        const diskId = diskM ? diskM[1] : `disk${i}`
        if (!diskMap[diskId]) diskMap[diskId] = { total: 0, used: 0, error: false }
        diskMap[diskId].total += total
        diskMap[diskId].used  += used
        diskMap[diskId].error  = diskMap[diskId].error || isErr
      }
      const disks = Object.keys(diskMap).sort()
      if (disks.length > 0) {
        console.log(`[NVR ${id}] ✅ ${disks.length} disco(s): ${disks.join(', ')}`)
        return disks.map((dk, idx) => ({
          id:         String(idx + 1),
          status:     diskMap[dk].error ? 'error' : 'ok',
          capacityMB: Math.round(diskMap[dk].total / (1024 * 1024)),
          freeMB:     Math.round((diskMap[dk].total - diskMap[dk].used) / (1024 * 1024)),
        }))
      }
    } catch (e) {
      console.warn(`[NVR ${id}] storageDevice: ${e.response?.status ?? e.message}`)
    }
    try {
      const { data } = await client.get('/cgi-bin/sysInfo.cgi?action=getStorageInfo')
      const props = dahuaParse(data)
      const total = parseFloat(props['info[0].TotalBytes'] || props['TotalBytes'] || '0')
      const used  = parseFloat(props['info[0].UsedBytes']  || props['UsedBytes']  || '0')
      if (total > 0) {
        return [{ id: '1', status: 'ok',
          capacityMB: Math.round(total / (1024 * 1024)),
          freeMB:     Math.round((total - used) / (1024 * 1024)) }]
      }
    } catch {}
    return []
  }

  async function dahuaFetchChannelNames() {
    try {
      const { data } = await client.get(
        '/cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle')
      const props = dahuaParse(data)
      const names = {}
      Object.entries(props).forEach(([k, v]) => {
        const m = k.match(/table\.ChannelTitle\[(\d+)\]\.Name/)
        if (m) names[parseInt(m[1], 10) + 1] = v
      })
      return names
    } catch { return {} }
  }

  async function dahuaFetchRecordModes() {
    try {
      const { data } = await client.get(
        '/cgi-bin/configManager.cgi?action=getConfig&name=RecordMode')
      return dahuaParse(data)
    } catch { return {} }
  }

  async function dahuaFetchRecordSchedule() {
    try {
      const { data } = await client.get(
        '/cgi-bin/configManager.cgi?action=getConfig&name=Record')
      return dahuaParse(data)
    } catch { return {} }
  }

  function getActiveScheduleType(schedProps, chIdx) {
    for (let day = 0; day < 7; day++) {
      for (let seg = 0; seg < 6; seg++) {
        const val = schedProps[`table.Record[${chIdx}].TimeSection[${day}][${seg}]`]
        if (!val) continue
        const type = parseInt(val.trim().split(/\s+/)[0], 10)
        if (type > 0) return type
      }
    }
    return 0
  }

  function motionWasRecent(channelId) {
    const ts = motionLastSeen.get(channelId)
    return ts !== undefined && (Date.now() - ts) < MOTION_KEEP_MS
  }

  async function dahuaGetActiveMotionChannels() {
    try {
      const { data } = await client.get(
        '/cgi-bin/eventManager.cgi?action=getEventIndexes&code=VideoMotion',
        { timeout: 8000 })
      const rawPreview = String(data).replace(/\r?\n/g, ' | ').slice(0, 400)
      console.log(`[NVR ${id}] Motion raw: ${rawPreview}`)
      const props  = dahuaParse(data)
      const active = new Set()

      // Formato confirmado: "channels[N]=channelId" (base-0)
      Object.entries(props).forEach(([k, v]) => {
        const m = k.match(/^channels\[(\d+)\]$/i)
        if (m) {
          const ch = parseInt(String(v).trim(), 10)
          if (!isNaN(ch) && ch >= 0) active.add(ch + 1)
        }
      })
      // Formato alternativo: "indexes=0,2,5"
      if (active.size === 0 && props['indexes'] !== undefined) {
        const val = String(props['indexes']).trim()
        if (val !== '' && val !== '-1') {
          val.split(',').forEach(s => {
            const n = parseInt(s.trim(), 10)
            if (!isNaN(n) && n >= 0) active.add(n + 1)
          })
        }
      }
      // Formato alternativo: "count=N" + "result[i].Channel=X"
      const count = parseInt(props['count'] || '0', 10)
      for (let i = 0; i < count; i++) {
        const chRaw = props[`result[${i}].Channel`] || props[`EventIndex[${i}].Channel`]
        if (chRaw !== undefined) {
          const ch = parseInt(chRaw, 10)
          if (!isNaN(ch)) active.add(ch + 1)
        }
      }

      console.log(`[NVR ${id}] Motion: ${active.size} canal(es)` +
        (active.size > 0 ? `: ${[...active].join(', ')}` : ''))
      active.forEach(ch => motionLastSeen.set(ch, Date.now()))
      return active
    } catch (e) {
      console.warn(`[NVR ${id}] eventManager: ${e.response?.status ?? e.message}`)
      return new Set()
    }
  }

  // RPC2 JSON API
  async function rpc2Login() {
    if (rpc2Session && Date.now() - rpc2Ts < RPC2_TTL_MS) return rpc2Session
    const { data: challenge } = await client.post('/RPC2', {
      method: 'global.login',
      params: { userName: user, password: '', clientType: 'Web3.0', authorityType: 'Default' },
      id: 1,
    }, { timeout: 5000 })
    const realm  = challenge?.params?.realm  || ''
    const random = challenge?.params?.random || ''
    const pwHash = md5(`${user}:${realm}:${pass}`)
    const authVal = md5(`${user}:${random}:${pwHash}`)
    const { data: loginRes } = await client.post('/RPC2', {
      method: 'global.login',
      params: { userName: user, password: authVal, clientType: 'Web3.0', authorityType: 'Default' },
      id: 2,
    }, { timeout: 5000 })
    if (!loginRes?.result) throw new Error('RPC2 login failed')
    rpc2Session = loginRes.session
    rpc2Ts = Date.now()
    return rpc2Session
  }

  async function dahuaRpc2GetRecordingChannels() {
    if (cap.rpc2 === false) return null
    const methods = ['record.getStatus', 'RecordUpdater.getStatus',
                     'recordUpdater.status.getStatus', 'VideoInput.getStatus']
    for (const method of methods) {
      try {
        const session = await rpc2Login()
        const { data } = await client.post('/RPC2',
          { method, params: null, session, id: 10 }, { timeout: 5000 })
        if (!data?.result) continue
        const arr = data.params?.Status || data.params?.status || data.params?.info || []
        if (!Array.isArray(arr) || arr.length === 0) continue
        const recording = new Set()
        arr.forEach(item => {
          const chIdx = item.Channel ?? item.channel ?? item.Index ?? -1
          const state = item.State ?? item.Status ?? item.state ?? 0
          const isRec = state === 1 || String(state).toLowerCase() === 'recording'
          if (isRec && chIdx >= 0) recording.add(chIdx + 1)
        })
        cap.rpc2 = true
        return recording
      } catch (e) {
        const msg = String(e.message)
        if (msg.includes('hang up') || msg.includes('ECONNRESET') || msg.includes('ECONNREFUSED')) {
          cap.rpc2 = false
          console.log(`[NVR ${id}] RPC2 desactivado (${msg.slice(0, 40)})`)
          return null
        }
      }
    }
    cap.rpc2 = false
    return null
  }

  async function dahuaGetRecordStatusCgi() {
    if (cap.recordMgrCgi === false) return null
    const actions = ['getRecordStatus', 'getAllChannelRecordStatus', 'getChannelRecordStatus']
    for (const action of actions) {
      try {
        const { data } = await client.get(
          `/cgi-bin/recordManager.cgi?action=${action}`, { timeout: 8000 })
        const props     = dahuaParse(data)
        const recording = new Set()
        for (let i = 0; i < 64; i++) {
          const ch    = props[`RecordStatus[${i}].Channel`] ?? props[`status[${i}].Channel`]
          const state = props[`RecordStatus[${i}].State`]   ?? props[`status[${i}].State`]
          if (ch === undefined || state === undefined) break
          if (state === '1' || /^record/i.test(state)) recording.add(parseInt(ch, 10) + 1)
        }
        Object.entries(props).forEach(([k, v]) => {
          const m = k.match(/channel[\[.]?(\d+)/i)
          if (m && (v === '1' || /^record/i.test(String(v)))) recording.add(parseInt(m[1], 10) + 1)
        })
        cap.recordMgrCgi = true
        return recording
      } catch (e) {
        if (e.response?.status === 400) continue
        console.warn(`[NVR ${id}] recordManager.${action}: ${e.response?.status ?? e.message}`)
      }
    }
    if (cap.recordMgrCgi === null) {
      cap.recordMgrCgi = false
      console.log(`[NVR ${id}] recordManager CGI desactivado`)
    }
    return null
  }

  async function dahuaGetAllChannels() {
    const [channelNames, recordModeProps, scheduleProps, activeMotion, rpc2Recording, cgiRecording] =
      await Promise.all([
        dahuaFetchChannelNames(),
        dahuaFetchRecordModes(),
        dahuaFetchRecordSchedule(),
        dahuaGetActiveMotionChannels(),
        dahuaRpc2GetRecordingChannels(),
        dahuaGetRecordStatusCgi(),
      ])

    const realtimeRecording = rpc2Recording ?? cgiRecording
    const hasRealtime       = realtimeRecording !== null

    if (hasRealtime) {
      console.log(`[NVR ${id}] ✅ Grabación en tiempo real (${rpc2Recording !== null ? 'RPC2' : 'recordMgr'})`)
    } else {
      const motionCount = activeMotion ? activeMotion.size : 0
      console.log(`[NVR ${id}] 📡 eventManager (${motionCount} mov. activos) + configuración estática`)
    }

    return channels.map(ch => {
      const idx      = ch - 1
      const name     = channelNames[ch] || `Canal ${ch}`
      const modeMain = parseInt(recordModeProps[`table.RecordMode[${idx}].Mode`]       || '0', 10)
      const modeE1   = parseInt(recordModeProps[`table.RecordMode[${idx}].ModeExtra1`] || '0', 10)
      const modeE2   = parseInt(recordModeProps[`table.RecordMode[${idx}].ModeExtra2`] || '0', 10)
      const mode     = Math.max(modeMain, modeE1, modeE2)

      const schedType     = getActiveScheduleType(scheduleProps, idx)
      const isContinuous  = schedType === 1
      const isMotionSched = schedType >= 2
      const motionNow     = activeMotion.has(ch)
      const motionRecent  = motionWasRecent(ch)

      let recording = false, motionReady = false, recordModeStr = 'closed'

      if (hasRealtime) {
        recording = realtimeRecording.has(ch)
        if (mode === 0)          { recordModeStr = 'closed' }
        else if (mode === 1)     { recordModeStr = 'manual' }
        else if (isMotionSched)  { recordModeStr = 'motion'; if (!recording) motionReady = true }
        else                     { recordModeStr = mode === 2 ? 'timed' : 'alarm' }
      } else {
        if (mode === 1) {
          recording = true; recordModeStr = 'manual'
        } else if (mode === 2) {
          if (isContinuous) {
            recording = true; recordModeStr = 'timed'
          } else if (isMotionSched) {
            recordModeStr = 'motion'
            if (motionNow || motionRecent) { recording = true }
            else                           { motionReady = true }
          } else {
            recordModeStr = 'timed'
          }
        } else if (mode >= 3) {
          recordModeStr = 'alarm'
          if (motionNow || motionRecent) { recording = true }
          else                           { motionReady = true }
        }
      }

      const online = (channelNames[ch] != null) || mode > 0

      return { id: ch, name, videoStatus: online ? (motionNow ? 'motion' : 'ok') : 'notConfigured',
               recordMode: recordModeStr, recording, motionReady, online, bitRate: 0 }
    })
  }

  // ── Caché de canales (evita llamadas duplicadas en window corto) ─────────
  async function getCachedChannels() {
    const now = Date.now()
    if (!channelCache || now - channelCacheTs > CACHE_TTL_MS) {
      channelCache   = dahuaGetAllChannels()
      channelCacheTs = now
    }
    return channelCache
  }

  // ── API pública del NVR ──────────────────────────────────────────────────
  async function getHdd() {
    return brand === 'dahua' ? dahuaGetHdd() : hikGetHdd()
  }

  async function getChannels() {
    if (brand === 'dahua') return getCachedChannels()
    try { return await hikGetInputProxyStatus() } catch {
      return Promise.all(channels.map(ch =>
        hikGetChannelStatus(ch).catch(err => ({
          id: ch, videoStatus: 'error', recording: false, online: false,
          recordMode: 'unknown', error: err.message,
        }))
      ))
    }
  }

  async function getStatus() {
    const [hddsResult, channelsResult] = await Promise.allSettled([
      getHdd(),
      getChannels(),
    ])
    return {
      nvrId:        id,
      nvrName:      name,
      configured:   true,
      brand,
      hdds:         hddsResult.status     === 'fulfilled' ? hddsResult.value     : [],
      channels:     channelsResult.status === 'fulfilled' ? channelsResult.value : [],
      hddError:     hddsResult.status     === 'rejected'  ? hddsResult.reason?.message  : null,
      channelError: channelsResult.status === 'rejected'  ? channelsResult.reason?.message : null,
    }
  }

  async function getRecording() {
    const chs = await getChannels()
    return chs.map(ch => ({
      ...ch,
      status: !ch.online
        ? 'offline'
        : (ch.recording || (ch.bitRate > 0))
          ? 'recording'
          : ch.motionReady
            ? 'motion'
            : 'online',
    }))
  }

  async function healthCheck() {
    const endpoint = brand === 'dahua'
      ? '/cgi-bin/magicBox.cgi?action=getSystemInfo'
      : '/ISAPI/System/deviceInfo'
    await client.get(endpoint, { timeout: 5000 })
    return { ok: true, brand, url }
  }

  return { id, name, brand, url, channels, getStatus, getRecording, getHdd, getChannels, healthCheck }
}

// ══════════════════════════════════════════════════════════════════════════════
// CARGA DE CONFIGURACIÓN MULTI-NVR
// ══════════════════════════════════════════════════════════════════════════════

function loadNvrConfigs() {
  const nvrs = []
  for (let n = 1; n <= 7; n++) {
    const urlKey  = `NVR_${n}_BASE_URL`
    const baseUrl = (process.env[urlKey] || '').replace(/\/$/, '')
    if (!baseUrl) continue  // NVR no configurado → saltar

    nvrs.push(createNvrInstance({
      id:         n,
      name:       process.env[`NVR_${n}_NAME`]     || `NVR ${n}`,
      url:        baseUrl,
      user:       process.env[`NVR_${n}_USERNAME`]  || 'admin',
      pass:       process.env[`NVR_${n}_PASSWORD`]  || '',
      brand:      (process.env[`NVR_${n}_BRAND`]    || 'dahua').toLowerCase(),
      channelStr: process.env[`NVR_${n}_CHANNELS`]  || '1-16',
    }))
  }
  return nvrs
}

const NVRS = loadNvrConfigs()

// ══════════════════════════════════════════════════════════════════════════════
// ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/nvrs — lista todos los NVRs configurados */
app.get('/api/nvrs', (_req, res) => {
  res.json({
    nvrs: NVRS.map(n => ({ id: n.id, name: n.name, brand: n.brand, url: n.url,
                           channelCount: n.channels.length }))
  })
})

// ── Rutas con segmento fijo ANTES que las de parámetro /:id ──────────────────
// IMPORTANTE: /api/nvr/all/status debe ir antes de /api/nvr/:id/status
// para que Express no interprete "all" como un :id

/** GET /api/nvr/all/status — estado de TODOS los NVRs en una sola llamada */
app.get('/api/nvr/all/status', async (_req, res) => {
  const results = await Promise.allSettled(NVRS.map(n => n.getStatus()))
  res.json({
    nvrs: results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { nvrId: NVRS[i].id, nvrName: NVRS[i].name, configured: true,
            error: r.reason?.message, hdds: [], channels: [] }
    )
  })
})

/** GET /api/nvr/:id/health */
app.get('/api/nvr/:id/health', async (req, res) => {
  const nvr = NVRS.find(n => n.id === parseInt(req.params.id, 10))
  if (!nvr) return res.status(404).json({ ok: false, error: 'NVR no encontrado' })
  try { res.json(await nvr.healthCheck()) }
  catch (e) { res.status(503).json({ ok: false, error: e.message }) }
})

/** GET /api/nvr/:id/status — HDD + canales de un NVR */
app.get('/api/nvr/:id/status', async (req, res) => {
  const nvr = NVRS.find(n => n.id === parseInt(req.params.id, 10))
  if (!nvr) return res.status(404).json({ configured: false, error: 'NVR no encontrado', hdds: [], channels: [] })
  try { res.json(await nvr.getStatus()) }
  catch (e) { res.status(502).json({ configured: true, error: e.message, hdds: [], channels: [] }) }
})

/** GET /api/nvr/:id/recording — estado de grabación liviano */
app.get('/api/nvr/:id/recording', async (req, res) => {
  const nvr = NVRS.find(n => n.id === parseInt(req.params.id, 10))
  if (!nvr) return res.status(404).json({ error: 'NVR no encontrado', channels: [] })
  try { res.json({ channels: await nvr.getRecording() }) }
  catch (e) { res.status(502).json({ error: e.message, channels: [] }) }
})

/** GET /api/nvr/:id/hdd */
app.get('/api/nvr/:id/hdd', async (req, res) => {
  const nvr = NVRS.find(n => n.id === parseInt(req.params.id, 10))
  if (!nvr) return res.status(404).json({ error: 'NVR no encontrado' })
  try { res.json({ hdds: await nvr.getHdd() }) }
  catch (e) { res.status(502).json({ error: e.message }) }
})

// ══════════════════════════════════════════════════════════════════════════════
// PROXY SISTEMA DE TICKETS (JWT cacheado server-side)
// ══════════════════════════════════════════════════════════════════════════════

const TICKETS_URL   = (process.env.TICKETS_API_URL  || '').replace(/\/$/, '')
const TICKETS_EMAIL = process.env.TICKETS_ADMIN_EMAIL || ''
const TICKETS_PASS  = process.env.TICKETS_ADMIN_PASS  || ''

let _ticketsToken      = null
let _ticketsTokenExp   = 0   // timestamp ms cuando expira

/** Login al sistema de tickets → devuelve el JWT */
async function ticketsLogin() {
  if (!TICKETS_URL || !TICKETS_EMAIL || !TICKETS_PASS) {
    throw new Error('TICKETS_API_URL, TICKETS_ADMIN_EMAIL o TICKETS_ADMIN_PASS no configurados en .env')
  }
  const { data } = await axios.post(
    `${TICKETS_URL}/api/auth/login`,
    { email: TICKETS_EMAIL, password: TICKETS_PASS },
    { timeout: 8000, headers: { 'Content-Type': 'application/json' } },
  )
  if (!data.token) throw new Error('Login al sistema de tickets falló: sin token en respuesta')
  return data.token
}

/** Devuelve un JWT válido, renueva si expiró o faltan menos de 5 min */
async function ticketsGetToken() {
  if (_ticketsToken && Date.now() < _ticketsTokenExp - 300_000) return _ticketsToken
  _ticketsToken    = await ticketsLogin()
  // JWT del sistema tiene exp embebido; asumimos 24 h si no lo parseamos
  _ticketsTokenExp = Date.now() + 23 * 60 * 60 * 1000
  console.log('[Tickets] ✅ JWT obtenido correctamente')
  return _ticketsToken
}

/** Hace una request autenticada al sistema de tickets, renueva JWT en 401 */
async function ticketsRequest(method, path, body) {
  const token = await ticketsGetToken()
  const opts  = {
    method,
    url:     `${TICKETS_URL}${path}`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: 10_000,
    ...(body ? { data: body } : {}),
  }
  try {
    return await axios(opts)
  } catch (e) {
    if (e.response?.status === 401) {
      // Token expirado → forzar renovación y reintentar
      _ticketsToken = null
      const fresh = await ticketsGetToken()
      opts.headers.Authorization = `Bearer ${fresh}`
      return axios(opts)
    }
    throw e
  }
}

/** GET /api/tickets-proxy/dashboard — métricas del admin */
app.get('/api/tickets-proxy/dashboard', async (_req, res) => {
  if (!TICKETS_URL) return res.status(503).json({ error: 'Sistema de tickets no configurado' })
  try {
    const { data } = await ticketsRequest('get', '/api/dashboard/admin')
    res.json(data)
  } catch (e) {
    console.error('[Tickets dashboard]', e.response?.data ?? e.message)
    res.status(502).json({ error: e.response?.data?.message ?? e.message })
  }
})

/** GET /api/tickets-proxy/tickets — lista de tickets con filtros */
app.get('/api/tickets-proxy/tickets', async (req, res) => {
  if (!TICKETS_URL) return res.status(503).json({ error: 'Sistema de tickets no configurado' })
  try {
    const qs = new URLSearchParams(req.query).toString()
    const { data } = await ticketsRequest('get', `/api/tickets${qs ? '?' + qs : ''}`)
    res.json(data)
  } catch (e) {
    console.error('[Tickets list]', e.response?.data ?? e.message)
    res.status(502).json({ error: e.response?.data?.message ?? e.message })
  }
})

/** PUT /api/tickets-proxy/tickets/:id/status — actualizar estado */
app.put('/api/tickets-proxy/tickets/:id/status', async (req, res) => {
  if (!TICKETS_URL) return res.status(503).json({ error: 'Sistema de tickets no configurado' })
  try {
    const { data } = await ticketsRequest(
      'put', `/api/tickets/${req.params.id}/status`, req.body)
    res.json(data)
  } catch (e) {
    console.error('[Tickets status]', e.response?.data ?? e.message)
    res.status(e.response?.status ?? 502).json({ error: e.response?.data?.message ?? e.message })
  }
})

/** PUT /api/tickets-proxy/tickets/:id/reassign — reasignar agente */
app.put('/api/tickets-proxy/tickets/:id/reassign', async (req, res) => {
  if (!TICKETS_URL) return res.status(503).json({ error: 'Sistema de tickets no configurado' })
  try {
    const { data } = await ticketsRequest(
      'put', `/api/tickets/${req.params.id}/reassign`, req.body)
    res.json(data)
  } catch (e) {
    res.status(e.response?.status ?? 502).json({ error: e.response?.data?.message ?? e.message })
  }
})

/** GET /api/tickets-proxy/health — verifica conexión con el sistema de tickets */
app.get('/api/tickets-proxy/health', async (_req, res) => {
  if (!TICKETS_URL) return res.json({ ok: false, error: 'No configurado' })
  try {
    await ticketsGetToken()
    res.json({ ok: true, url: TICKETS_URL })
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// PROXY OMADA SDN CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════

const OMADA_URL  = (process.env.OMADA_URL  || '').replace(/\/$/, '')
const OMADA_USER = process.env.OMADA_USER  || ''
const OMADA_PASS = process.env.OMADA_PASS  || ''
const OMADA_SITE = process.env.OMADA_SITE_ID || 'Default'

// Instancia axios dedicada con SSL permisivo (certificados self-signed)
const omadaHttp = axios.create({
  httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
  timeout: 12_000,
})

let _omadaToken    = null
let _omadaCookie   = ''
let _omadaTokenExp = 0
let _omadacId      = null   // null = no descubierto aún; '' = API legacy v4
let _omadaSiteId   = null   // ID hash real del sitio (v5+)

/** Normaliza lista de sites: Omada devuelve `result` como array o `{ data: [], totalRows }`. */
function omadaSitesFromData(data) {
  const r = data?.result
  if (Array.isArray(r)) return r
  return r?.data ?? []
}

/**
 * Descubre el omadacId del controlador (Omada v5.13+).
 * Si el endpoint /api/info no existe usa la API legacy sin prefijo.
 */
async function omadaDiscover() {
  if (_omadacId !== null) return  // ya se intentó
  try {
    const { data } = await omadaHttp.get(`${OMADA_URL}/api/info`, { timeout: 6000 })
    _omadacId = data?.result?.omadacId ?? ''
    if (_omadacId) console.log(`[Omada] Controller ID: ${_omadacId} | ver: ${data?.result?.controllerVer}`)
  } catch {
    _omadacId = ''  // API legacy — sin prefijo
  }
}

/** Construye la URL de API con o sin el prefijo omadacId */
function omadaApiUrl(path) {
  return _omadacId ? `${OMADA_URL}/${_omadacId}${path}` : `${OMADA_URL}${path}`
}

/**
 * Resuelve el ID real del sitio (hash) desde el nombre OMADA_SITE.
 * En Omada v5.x las rutas de device/client usan el ID hash, no el nombre.
 */
async function omadaResolveSite() {
  if (_omadaSiteId) return _omadaSiteId
  try {
    const { data } = await omadaHttp({
      method: 'get',
      url: omadaApiUrl('/api/v2/sites'),
      headers: { 'Csrf-Token': _omadaToken, Cookie: _omadaCookie },
      params: { currentPage: 1, currentPageSize: 100 },
    })
    const sites = omadaSitesFromData(data)
    const match = sites.find(s => s.name === OMADA_SITE || s.id === OMADA_SITE)
    if (match) {
      _omadaSiteId = match.id
      console.log(`[Omada] Site "${match.name}" → ID: ${_omadaSiteId}`)
    } else if (sites.length > 0) {
      _omadaSiteId = sites[0].id
      console.log(`[Omada] Site "${OMADA_SITE}" no encontrado, usando el primero: ${sites[0].name} (${_omadaSiteId})`)
    } else {
      _omadaSiteId = OMADA_SITE
      console.log(`[Omada] Lista de sites vacía, usando "${OMADA_SITE}" como siteId`)
    }
  } catch (e) {
    // Si falla (API legacy), usar OMADA_SITE directamente como ID
    _omadaSiteId = OMADA_SITE
    console.log(`[Omada] No se pudo listar sites, usando "${OMADA_SITE}" como siteId`)
  }
  return _omadaSiteId
}

/** Login al controlador Omada → token + cookie de sesión */
async function omadaLogin() {
  if (!OMADA_URL || !OMADA_USER || !OMADA_PASS) {
    throw new Error('OMADA_URL, OMADA_USER o OMADA_PASS no configurados en .env')
  }
  await omadaDiscover()
  const loginUrl = omadaApiUrl('/api/v2/login')
  console.log(`[Omada] Login → ${loginUrl}`)
  const { data, headers } = await omadaHttp.post(
    loginUrl,
    { username: OMADA_USER, password: OMADA_PASS },
    { headers: { 'Content-Type': 'application/json' } },
  )
  if (data.errorCode !== 0) {
    throw new Error(`Omada login: ${data.msg ?? data.errorCode}`)
  }
  _omadaToken    = data.result.token
  const cookies  = headers['set-cookie'] ?? []
  _omadaCookie   = cookies.map(c => c.split(';')[0]).join('; ')
  _omadaTokenExp = Date.now() + 50 * 60 * 1000   // refresh cada 50 min
  _omadaSiteId   = null  // resetear siteId para que se resuelva con el nuevo token
  console.log('[Omada] ✅ Autenticado correctamente')
  // Resolver site ID inmediatamente
  await omadaResolveSite()
  return _omadaToken
}

/** Devuelve un token válido; renueva si expiró */
async function omadaGetToken() {
  if (_omadaToken && Date.now() < _omadaTokenExp) return _omadaToken
  return omadaLogin()
}

/** Request autenticada; reintenta tras re-login en 401/-1006/-1007 */
async function omadaReq(method, path, params) {
  const token = await omadaGetToken()
  const cfg   = {
    method,
    url:     omadaApiUrl(path),
    headers: { 'Csrf-Token': token, Cookie: _omadaCookie },
    params:  params ?? undefined,
  }
  try {
    return await omadaHttp(cfg)
  } catch (e) {
    const ec = e.response?.data?.errorCode
    if (e.response?.status === 401 || ec === -1006 || ec === -1007) {
      _omadaToken = null
      await omadaLogin()
      cfg.headers['Csrf-Token'] = _omadaToken
      cfg.headers.Cookie        = _omadaCookie
      return omadaHttp(cfg)
    }
    throw e
  }
}

// ── /api/omada/probe ─────────────────────────────────────────────────────────
// Diagnóstico completo: prueba HTTP y HTTPS en varios puertos y rutas
app.get('/api/omada/probe', async (_, res) => {
  if (!OMADA_URL) return res.json({ ok: false, error: 'OMADA_URL no configurado' })

  const host      = OMADA_URL.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const httpBase  = `http://${host}`
  const httpsBase = `https://${host}`
  const ports     = ['8043', '8088', '443', '8080']
  const paths     = ['/api/info', '/api/v2/login', '/', '/web/login']

  const results = []

  // Probar URL configurada exacta
  for (const path of paths) {
    try {
      const { data, status } = await omadaHttp.get(`${OMADA_URL}${path}`, { timeout: 5000 })
      results.push({ url: OMADA_URL + path, status, preview: JSON.stringify(data).slice(0, 200), ok: true })
    } catch (e) {
      results.push({ url: OMADA_URL + path, status: e.response?.status ?? 0, error: e.message.split('\n')[0] })
    }
  }

  // Probar HTTPS en puertos comunes
  for (const port of ports) {
    for (const path of ['/api/info', '/']) {
      const url = `${httpsBase}:${port}${path}`
      try {
        const { data, status } = await omadaHttp.get(url, { timeout: 4000 })
        results.push({ url, status, preview: JSON.stringify(data).slice(0, 150), ok: true })
      } catch (e) {
        if (e.response?.status) {
          results.push({ url, status: e.response.status, error: e.message.split('\n')[0], hadResponse: true })
        }
        // silenciar timeouts y connection refused
      }
    }
  }

  const working = results.filter(r => r.ok || r.hadResponse)
  res.json({ configuredUrl: OMADA_URL, omadacId: _omadacId, working, all: results })
})

// ── /api/omada/health ─────────────────────────────────────────────────────────
app.get('/api/omada/health', async (_, res) => {
  if (!OMADA_URL) return res.json({ ok: false, error: 'No configurado' })
  try {
    await omadaGetToken()
    const siteId = await omadaResolveSite()
    res.json({ ok: true, url: OMADA_URL, site: OMADA_SITE, siteId, omadacId: _omadacId })
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message })
  }
})

// ── /api/omada/site ───────────────────────────────────────────────────────────
// Devuelve datos completos del site activo (clientes cableados/inalámbricos, etc.)
app.get('/api/omada/site', async (_, res) => {
  if (!OMADA_URL) return res.status(503).json({ error: 'Omada no configurado' })
  try {
    await omadaGetToken()
    const siteId = await omadaResolveSite()
    const { data } = await omadaHttp({
      method: 'get',
      url: omadaApiUrl('/api/v2/sites'),
      headers: { 'Csrf-Token': _omadaToken, Cookie: _omadaCookie },
      params: { currentPage: 1, currentPageSize: 100 },
    })
    const sites = omadaSitesFromData(data)
    const site  = sites.find(s => s.id === siteId || s.name === OMADA_SITE)
    res.json({ ok: true, site: site ?? null })
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// ── /api/omada/sites ──────────────────────────────────────────────────────────
// Lista todos los sites disponibles (diagnóstico)
app.get('/api/omada/sites', async (_, res) => {
  if (!OMADA_URL) return res.status(503).json({ error: 'Omada no configurado' })
  try {
    await omadaGetToken()
    const { data } = await omadaHttp({
      method: 'get',
      url: omadaApiUrl('/api/v2/sites'),
      headers: { 'Csrf-Token': _omadaToken, Cookie: _omadaCookie },
      params: { currentPage: 1, currentPageSize: 100 },
    })
    const list = omadaSitesFromData(data)
    const total = data?.result?.totalRows ?? list.length
    res.json({ errorCode: data.errorCode, sites: list, total })
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// ── /api/omada/devices ────────────────────────────────────────────────────────
// Devuelve todos los dispositivos del sitio (APs, Switches, Gateways)
app.get('/api/omada/devices', async (_, res) => {
  if (!OMADA_URL) return res.status(503).json({ error: 'Omada no configurado' })
  try {
    await omadaGetToken()
    const siteId = await omadaResolveSite()
    const { data } = await omadaReq('get', `/api/v2/sites/${siteId}/devices`, {
      currentPage: 1, currentPageSize: 200,
    })
    if (data.errorCode !== 0) throw new Error(data.msg ?? `Error ${data.errorCode}`)
    // Omada v5: result puede ser array directo o { data: [...], totalRows: N }
    const list = Array.isArray(data.result) ? data.result : (data.result?.data ?? [])
    res.json({ success: true, data: list, total: list.length })
  } catch (e) {
    console.error('[Omada devices]', e.response?.data ?? e.message)
    res.status(502).json({ error: e.response?.data?.msg ?? e.message })
  }
})

// ── /api/omada/clients ────────────────────────────────────────────────────────
// Lista de clientes conectados + total
app.get('/api/omada/clients', async (_, res) => {
  if (!OMADA_URL) return res.status(503).json({ error: 'Omada no configurado' })
  try {
    await omadaGetToken()
    const siteId = await omadaResolveSite()
    const { data } = await omadaReq('get', `/api/v2/sites/${siteId}/clients`, {
      currentPage: 1, currentPageSize: 500,
    })
    if (data.errorCode !== 0) throw new Error(data.msg ?? `Error ${data.errorCode}`)
    const list = Array.isArray(data.result) ? data.result : (data.result?.data ?? [])
    let download = 0, upload = 0
    list.forEach(c => {
      download += c.download ?? c.activity ?? 0
      upload   += c.upload   ?? 0
    })
    res.json({
      success: true,
      data:    list,
      total:   data.result?.totalRows ?? list.length,
      traffic: { download, upload },
    })
  } catch (e) {
    console.error('[Omada clients]', e.response?.data ?? e.message)
    res.status(502).json({ error: e.response?.data?.msg ?? e.message })
  }
})

// ── /api/omada/stat ───────────────────────────────────────────────────────────
// Estadísticas de tráfico del sitio (best-effort; no todos los firmwares lo soportan)
app.get('/api/omada/stat', async (_, res) => {
  if (!OMADA_URL) return res.status(503).json({ error: 'Omada no configurado' })
  try {
    await omadaGetToken()
    const siteId = await omadaResolveSite()
    const { data } = await omadaReq('get', `/api/v2/sites/${siteId}/stat/traffic`)
    res.json({ success: true, data: data.result ?? {}, available: data.errorCode === 0 })
  } catch {
    res.json({ success: true, data: {}, available: false })
  }
})

// ── /api/omada/devices/full ───────────────────────────────────────────────────
// Igual que /devices pero con todos los campos (CPU, mem, radio, uplink)
app.get('/api/omada/devices/full', async (_, res) => {
  if (!OMADA_URL) return res.status(503).json({ error: 'Omada no configurado' })
  try {
    await omadaGetToken()
    const siteId = await omadaResolveSite()
    const { data } = await omadaReq('get', `/api/v2/sites/${siteId}/devices`, {
      currentPage: 1, currentPageSize: 200,
    })
    if (data.errorCode !== 0) throw new Error(data.msg ?? `Error ${data.errorCode}`)
    const list = Array.isArray(data.result) ? data.result : (data.result?.data ?? [])
    res.json({ success: true, data: list, total: list.length })
  } catch (e) {
    console.error('[Omada devices/full]', e.message)
    res.status(502).json({ error: e.message })
  }
})

// ── /api/omada/switch/:mac/ports ─────────────────────────────────────────────
// Devuelve todos los puertos de un switch con estado, velocidad y tráfico
app.get('/api/omada/switch/:mac/ports', async (req, res) => {
  if (!OMADA_URL) return res.status(503).json({ error: 'Omada no configurado' })
  const { mac } = req.params
  try {
    await omadaGetToken()
    const siteId = await omadaResolveSite()
    const { data } = await omadaReq('get',
      `/api/v2/sites/${siteId}/switches/${mac}/ports`,
      { currentPage: 1, currentPageSize: 200 },
    )
    if (data.errorCode !== 0) throw new Error(data.msg ?? `Error ${data.errorCode}`)
    const ports = Array.isArray(data.result) ? data.result : (data.result?.data ?? [])
    res.json({ success: true, data: ports, total: ports.length })
  } catch (e) {
    console.error(`[Omada switch ${mac} ports]`, e.message)
    res.status(502).json({ error: e.message })
  }
})

// ── Startup ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🟢 IT Ops Hub – NVR Proxy en http://localhost:${PORT}`)
  if (NVRS.length === 0) {
    console.log('   ⚠️  Sin NVRs configurados. Completá NVR_1_BASE_URL en .env')
  } else {
    NVRS.forEach(n => {
      console.log(`   📹 NVR ${n.id}: ${n.name} | ${n.brand} | ${n.url} | ${n.channels.length} canales`)
    })
  }
  console.log(`\n   Endpoints globales:`)
  console.log(`   GET /api/nvrs`)
  console.log(`   GET /api/nvr/all/status`)
  console.log(`   GET /api/nvr/:id/status`)
  console.log(`   GET /api/nvr/:id/recording`)
  console.log(`   GET /api/nvr/:id/hdd`)
  if (OMADA_URL && OMADA_USER) {
    console.log(`\n   🌐 Omada: ${OMADA_URL} | sitio: ${OMADA_SITE}`)
    omadaLogin().catch(e => console.warn(`   ⚠️  Omada: ${e.message}`))
  } else {
    console.log(`\n   🌐 Omada: No configurado (completá OMADA_URL/USER/PASS en .env)`)
  }
  if (TICKETS_URL && TICKETS_EMAIL) {
    console.log(`\n   🎫 Tickets: ${TICKETS_URL} (usuario: ${TICKETS_EMAIL})`)
    // Pre-login en background para detectar problemas de configuración al arranque
    ticketsGetToken().catch(e => console.warn(`   ⚠️  Tickets: ${e.message}`))
  } else {
    console.log(`\n   🎫 Tickets: No configurado (completá TICKETS_* en .env)`)
  }
})
