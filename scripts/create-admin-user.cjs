'use strict'
/**
 * Crea o actualiza un usuario admin para IT Ops Hub (Firebase Auth – BacarPass).
 * Uso: node scripts/create-admin-user.cjs
 * Variables opcionales: ITOPS_ADMIN_EMAIL, ITOPS_ADMIN_PASS
 */

const admin = require('../functions/node_modules/firebase-admin')
const path = require('path')

const KEY_PATH = path.resolve(__dirname, '../secrets/legajosonline-959f6-firebase-adminsdk-fbsvc-ebe8b1c8ea.json')
const EMAIL = (process.env.ITOPS_ADMIN_EMAIL || 'admin@admin.com').trim().toLowerCase()
const PASS = process.env.ITOPS_ADMIN_PASS || 'admin1'

admin.initializeApp({ credential: admin.credential.cert(KEY_PATH) })

async function main() {
  const auth = admin.auth()
  try {
    const user = await auth.createUser({
      email: EMAIL,
      password: PASS,
      emailVerified: true,
      displayName: 'Admin IT Ops',
    })
    console.log(`✅ Usuario creado: ${EMAIL} (uid: ${user.uid})`)
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      const existing = await auth.getUserByEmail(EMAIL)
      await auth.updateUser(existing.uid, { password: PASS, emailVerified: true })
      console.log(`✅ Usuario existente — contraseña actualizada: ${EMAIL}`)
    } else {
      throw e
    }
  }
  console.log(`\n   Ingresá en http://localhost:5173/login`)
  console.log(`   Email: ${EMAIL}`)
  console.log(`   Contraseña: ${PASS}\n`)
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
