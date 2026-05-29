import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getAuth, type Auth } from 'firebase/auth'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const BACARPASS_APP_NAME = 'bacarpass'

const bacarpassConfig = {
  projectId: import.meta.env.VITE_BACARPASS_PROJECT_ID ?? 'legajosonline-959f6',
  appId: import.meta.env.VITE_BACARPASS_APP_ID ?? '1:753392336661:web:b2d23e3cc6aae7a0c4331c',
  apiKey: import.meta.env.VITE_BACARPASS_API_KEY ?? 'AIzaSyCEaVNk-ccwOZ3mzDiITAztK0l4Qq6Cu2Y',
  authDomain: import.meta.env.VITE_BACARPASS_AUTH_DOMAIN ?? 'legajosonline-959f6.firebaseapp.com',
  storageBucket:
    import.meta.env.VITE_BACARPASS_STORAGE_BUCKET ?? 'legajosonline-959f6.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_BACARPASS_MESSAGING_SENDER_ID ?? '753392336661',
}

let _app: FirebaseApp | null = null
let _auth: Auth | null = null
let _db: Firestore | null = null
let _storage: FirebaseStorage | null = null

export function getBacarPassFirebase(): {
  app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage
} {
  if (_app && _auth && _db && _storage) return { app: _app, auth: _auth, db: _db, storage: _storage }
  const existing = getApps().find((a) => a.name === BACARPASS_APP_NAME)
  _app = existing ?? initializeApp(bacarpassConfig, BACARPASS_APP_NAME)
  _auth = getAuth(_app)
  _db = getFirestore(_app)
  _storage = getStorage(_app)
  return { app: _app, auth: _auth, db: _db, storage: _storage }
}
