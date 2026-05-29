/**
 * NVR Service para Cloud Functions (Hikvision ISAPI / Dahua CGI)
 *
 * NOTA: Cloud Functions corren en la nube de Google y NO pueden acceder a
 * NVRs en red local directamente. Este servicio es útil cuando:
 *   a) El NVR está expuesto a internet (no recomendado sin VPN)
 *   b) Hay una VPN entre el servidor de Cloud Functions y la red del NVR
 *   c) Se usa un relay MQTT/WebSocket como intermediario
 *
 * Para uso en red local → usar server/nvr-proxy.cjs en su lugar.
 */

import * as https from "https";
import * as http from "http";

// Tipos compartidos con el frontend
export interface NvrChannel {
  id: number;
  videoStatus: string;
  recordMode: string;
  recording: boolean;
  online: boolean;
  error?: string;
}

export interface NvrHdd {
  id: string;
  status: string;
  capacityMB: number;
  freeMB: number;
}

export interface NvrStatusResult {
  hdds: NvrHdd[];
  channels: NvrChannel[];
  brand: string;
  hddError?: string | null;
  channelError?: string | null;
}

// ── Utilidades XML ──────────────────────────────────────────────────────────

function xmlVal(text: string, tag: string): string | null {
  const m = text.match(new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : null;
}

function xmlBlocks(text: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, "gi");
  return [...text.matchAll(re)].map((m) => m[0]);
}

// ── HTTP client con Basic Auth (acepta self-signed certs) ───────────────────

function makeRequest(
  url: string, user: string, pass: string, timeoutMs = 8000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const agent  = parsed.protocol === "https:"
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined;

    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === "https:" ? "443" : "80"),
      path:     parsed.pathname + parsed.search,
      method:   "GET",
      headers: {
        Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
        Accept: "application/xml, text/xml, */*",
      },
      agent,
      timeout: timeoutMs,
    };

    const mod = parsed.protocol === "https:" ? https : http;
    const req = mod.request(options, (res) => {
      let data = "";
      res.on("data", (c: Buffer) => { data += c.toString(); });
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`NVR HTTP ${res.statusCode}`));
        } else {
          resolve(data);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("NVR timeout")); });
    req.end();
  });
}

// ── Hikvision ISAPI ─────────────────────────────────────────────────────────

async function hikHdd(base: string, user: string, pass: string): Promise<NvrHdd[]> {
  const xml   = await makeRequest(`${base}/ISAPI/System/storage/hdd`, user, pass);
  const blocks = xmlBlocks(xml, "hdd");
  const parse  = (b: string): NvrHdd => ({
    id:         xmlVal(b, "id")        || "1",
    status:     xmlVal(b, "status")    || "unknown",
    capacityMB: parseInt(xmlVal(b, "capacity")  || "0", 10),
    freeMB:     parseInt(xmlVal(b, "freeSpace") || "0", 10),
  });
  return blocks.length ? blocks.map(parse) : [parse(xml)];
}

async function hikChannel(
  base: string, user: string, pass: string, ch: number
): Promise<NvrChannel> {
  let online = false;
  let videoStatus = "unknown";
  try {
    const xml   = await makeRequest(`${base}/ISAPI/System/Video/inputs/channels/${ch}/status`, user, pass);
    videoStatus = xmlVal(xml, "videoInputStatus") || "unknown";
    online      = videoStatus === "ok";
  } catch { /* channel may not exist */ }

  let recordMode  = "unknown";
  let recording   = false;
  if (online) {
    try {
      const xml    = await makeRequest(`${base}/ISAPI/ContentMgmt/record/tracks`, user, pass);
      const blocks = xmlBlocks(xml, "Track");
      const track  = blocks.find((b) => {
        const tId = parseInt(xmlVal(b, "id") || "0", 10);
        const tCh = parseInt(xmlVal(b, "Channel") || xmlVal(b, "channel") || "0", 10);
        return tId === ch * 100 + 1 || tCh === ch;
      });
      if (track) {
        recordMode = xmlVal(track, "DefaultRecordingMode") || xmlVal(track, "recordingMode") || "unknown";
        recording  = recordMode === "always";
      }
    } catch { /* tracks API optional */ }
  }

  return { id: ch, videoStatus, recordMode, recording, online };
}

// ── Dahua CGI ───────────────────────────────────────────────────────────────

function dahuaParse(text: string): Record<string, string> {
  const obj: Record<string, string> = {};
  text.split(/[\r\n]+/).forEach((line) => {
    const eq = line.indexOf("=");
    if (eq > 0) obj[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  });
  return obj;
}

async function dahuaHdd(base: string, user: string, pass: string): Promise<NvrHdd[]> {
  const text  = await makeRequest(`${base}/cgi-bin/storageManager.cgi?action=getDeviceAllStorageInfo`, user, pass);
  const props = dahuaParse(text);
  const hdds: NvrHdd[] = [];
  for (let i = 0; ; i++) {
    const st = props[`hdd.${i}.Status`];
    if (!st) break;
    hdds.push({
      id:         String(i + 1),
      status:     st.toLowerCase() === "normal" ? "ok" : st.toLowerCase(),
      capacityMB: parseInt(props[`hdd.${i}.TotalSpace`] || "0", 10),
      freeMB:     parseInt(props[`hdd.${i}.FreeSpace`]  || "0", 10),
    });
  }
  return hdds.length ? hdds : [{ id: "1", status: "unknown", capacityMB: 0, freeMB: 0 }];
}

async function dahuaChannel(
  base: string, user: string, pass: string, ch: number
): Promise<NvrChannel> {
  let online = false;
  let videoStatus = "unknown";
  try {
    const text  = await makeRequest(`${base}/cgi-bin/devVideoInput.cgi?action=getStatus&channel=${ch}`, user, pass);
    const props = dahuaParse(text);
    const s     = (props[`videoInput.${ch - 1}.Status`] || "").toLowerCase();
    videoStatus = s || "unknown";
    online      = s === "normal" || s === "ok";
  } catch {
    /* canal sin respuesta ISAPI */
  }

  let recording = false;
  if (online) {
    try {
      const text = await makeRequest(`${base}/cgi-bin/recordManager.cgi?action=getRecordPlanInfo&channel=${ch}`, user, pass);
      recording  = text.toLowerCase().includes("enable=true") || text.toLowerCase().includes("always");
    } catch {
      /* plan de grabación no disponible */
    }
  }

  return {
    id: ch, videoStatus,
    recordMode: recording ? "always" : "other",
    recording, online,
  };
}

// ── Entry point ─────────────────────────────────────────────────────────────

export async function getNvrStatus(
  nvrUrl: string,
  nvrUser: string,
  nvrPass: string,
  brand: "hikvision" | "dahua",
  channelIds: number[]
): Promise<NvrStatusResult> {
  const base = nvrUrl.replace(/\/$/, "");

  const [hddsRes, channelsRes] = await Promise.allSettled([
    brand === "dahua" ? dahuaHdd(base, nvrUser, nvrPass) : hikHdd(base, nvrUser, nvrPass),
    Promise.all(channelIds.map((ch) =>
      (brand === "dahua"
        ? dahuaChannel(base, nvrUser, nvrPass, ch)
        : hikChannel(base, nvrUser, nvrPass, ch)
      ).catch((e) => ({
        id: ch, videoStatus: "error", recordMode: "unknown",
        recording: false, online: false, error: (e as Error).message,
      }))
    )),
  ]);

  return {
    brand,
    hdds:         hddsRes.status     === "fulfilled" ? hddsRes.value     : [],
    channels:     channelsRes.status === "fulfilled" ? channelsRes.value : [],
    hddError:     hddsRes.status     === "rejected"  ? (hddsRes.reason as Error).message     : null,
    channelError: channelsRes.status === "rejected"  ? (channelsRes.reason as Error).message : null,
  };
}
