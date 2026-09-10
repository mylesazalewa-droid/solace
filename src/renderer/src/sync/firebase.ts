import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  type Auth
} from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

let current: { app: FirebaseApp; auth: Auth; db: Firestore; key: string } | null = null

export function parseConfig(json: string): Record<string, string> | null {
  const raw = json.trim()
  if (!raw) return null
  try {
    // tolerate a pasted `const firebaseConfig = { ... };` blob
    const body = raw.replace(/^[^{]*/, '').replace(/;[\s]*$/, '')
    const obj = JSON.parse(
      body
        .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
        .replace(/'/g, '"')
        .replace(/,(\s*[}\]])/g, '$1')
    )
    return obj && obj.apiKey && obj.projectId ? obj : null
  } catch {
    return null
  }
}

export async function getFirebase(
  configJson: string
): Promise<{ auth: Auth; db: Firestore } | null> {
  const cfg = parseConfig(configJson)
  if (!cfg) return null
  const key = JSON.stringify(cfg)

  if (current && current.key === key) return { auth: current.auth, db: current.db }

  // config changed — tear down the old app
  if (current) {
    await deleteApp(current.app).catch(() => {})
    current = null
  }
  for (const a of getApps()) await deleteApp(a).catch(() => {})

  const app = initializeApp(cfg)
  const auth = getAuth(app)
  await setPersistence(auth, indexedDBLocalPersistence).catch(() =>
    setPersistence(auth, browserLocalPersistence).catch(() => {})
  )
  const db = getFirestore(app)
  current = { app, auth, db, key }
  return { auth, db }
}
