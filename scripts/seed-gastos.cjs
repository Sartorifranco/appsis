'use strict'
/**
 * Carga inicial de gastos en Firestore (colección: itops_gastos)
 * Extraídos de las facturas provistas.
 *
 * Uso:  node scripts/seed-gastos.cjs
 */

const admin = require('../functions/node_modules/firebase-admin')
const path  = require('path')

const KEY_PATH = path.resolve(__dirname, '../secrets/legajosonline-959f6-firebase-adminsdk-fbsvc-ebe8b1c8ea.json')

admin.initializeApp({
  credential: admin.credential.cert(KEY_PATH),
})

const db = admin.firestore()

// ── Datos extraídos de las facturas ─────────────────────────────────────────

const gastos = [
  {
    servicio:           'Starlink – Itinerante Ilimitado',
    descripcion:        '2 kits (KIT405316802T28 + KIT4M03896344VFZ) · Factura INV-DF-ARG-4879574-50127-8',
    monto:              175000,
    moneda:             'ARS',
    proximaRenovacion:  '2026-03-28',
    categoria:          'comunicaciones',
    frecuencia:         'mensual',
    activo:             true,
  },
  {
    servicio:           'Claude.ai – Team Plan (5 seats)',
    descripcion:        '5 usuarios × US$240 · Recibo 2555-8543-5484 · Anthropic PBC',
    monto:              1200,
    moneda:             'USD',
    proximaRenovacion:  '2027-02-27',
    categoria:          'software',
    frecuencia:         'anual',
    activo:             true,
  },
  {
    servicio:           'Cursor – Uso de tokens (Feb ciclo 1)',
    descripcion:        'Factura DPAP7LSM-0003 · Ciclo desde 11 Feb 2026 · Anysphere Inc.',
    monto:              79.23,
    moneda:             'USD',
    proximaRenovacion:  '2026-03-11',
    categoria:          'software',
    frecuencia:         'mensual',
    activo:             true,
  },
  {
    servicio:           'Cursor – Uso de tokens (Feb ciclo 2)',
    descripcion:        'Factura DPAP7LSM-0004 · Mid-month usage desde 11 Feb 2026 · Anysphere Inc.',
    monto:              100.31,
    moneda:             'USD',
    proximaRenovacion:  '2026-03-11',
    categoria:          'software',
    frecuencia:         'mensual',
    activo:             true,
  },
  {
    servicio:           'Cloud Pro-1 – Yearly (Paddle)',
    descripcion:        'Suscripción anual via Paddle.com · Amex 1003 · Feb 2026 – Feb 2027',
    monto:              600,
    moneda:             'EUR',
    proximaRenovacion:  '2027-02-26',
    categoria:          'software',
    frecuencia:         'anual',
    activo:             true,
  },
]

// ── Carga ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`\n📦 Cargando ${gastos.length} gastos en Firestore (itops_gastos)...\n`)

  for (const g of gastos) {
    const ref = await db.collection('itops_gastos').add({
      ...g,
      _createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    console.log(`  ✅ ${g.servicio}  →  ${ref.id}`)
  }

  console.log('\n🎉 Listo! Abrí el módulo Finanzas en el Hub para verlos.')
  process.exit(0)
}

seed().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
