import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  type Auth,
  type User
} from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { getFirebase } from './firebase'
import { runSync } from './engine'
import { setSyncHandle } from './handle'
import { useStore } from '../store'
import { SHARED } from '../../../shared/appConfig'
import type { SyncStatus } from '../../../shared/types'

let auth: Auth | null = null
let db: Firestore | null = null
let user: User | null = null
let device = 'this device'
let timer: ReturnType<typeof setInterval> | null = null
let running = false
let queued = false
let lastAuto = 0
let boundAuth: Auth | null = null
let focusHooked = false

function set(patch: Partial<SyncStatus>): void {
  useStore.setState((s) => ({ sync: { ...s.sync, ...patch } }))
}

function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  if (code.includes('invalid-credential') || code.includes('wrong-password'))
    return 'Wrong email or password.'
  if (code.includes('email-already-in-use')) return 'That email already has an account — sign in instead.'
  if (code.includes('weak-password')) return 'Password should be at least 6 characters.'
  if (code.includes('invalid-email')) return 'That doesn’t look like an email address.'
  if (code.includes('network')) return 'Can’t reach Firebase — check your connection.'
  if (code.includes('api-key-not-valid')) return 'That Firebase config looks wrong.'
  return (e as Error)?.message ?? 'Something went wrong.'
}

/** Call once from the app shell. Safe to call again after config/toggle changes. */
export async function startSync(): Promise<void> {
  const cfg = await window.solace.getConfig()
  device = (await window.solace.syncDevice?.().catch(() => '')) || 'this device'

  const byo = cfg.firebaseConfig.trim()
  const configJson = byo || (SHARED.firebase ? JSON.stringify(SHARED.firebase) : '')

  if (!cfg.syncEnabled || !configJson) {
    teardown()
    set({ state: 'off' })
    return
  }

  const fb = await getFirebase(configJson)
  if (!fb) {
    set({ state: 'error', error: 'The sync backend config could not be read.' })
    return
  }
  auth = fb.auth
  db = fb.db
  if (useStore.getState().sync.state === 'off') set({ state: 'signed-out' })

  if (!focusHooked) {
    focusHooked = true
    window.addEventListener('focus', () => void syncNow('auto'))
  }

  if (boundAuth !== auth) {
    boundAuth = auth
    onAuthStateChanged(auth, (u) => {
      user = u
      setSyncHandle(db && u ? { db, uid: u.uid } : null)
      if (u) {
        set({ state: 'idle', email: u.email ?? undefined, error: undefined })
        void syncNow('auto')
        if (!timer) timer = setInterval(() => void syncNow('auto'), 5 * 60 * 1000)
      } else {
        set({ state: 'signed-out', email: undefined })
        if (timer) {
          clearInterval(timer)
          timer = null
        }
      }
    })
  } else {
    set({ state: user ? 'idle' : 'signed-out', email: user?.email ?? undefined })
  }
}

function teardown(): void {
  setSyncHandle(null)
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

export async function signInWithGoogle(): Promise<void> {
  if (!auth) throw new Error('Sync is not configured yet.')
  try {
    const { idToken, accessToken } = await window.solace.googleSignIn()
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken))
  } catch (e) {
    throw new Error(friendlyError(e))
  }
}

/** One button for both: makes the account the first time, signs in after. */
export async function signIn(email: string, password: string): Promise<void> {
  if (!auth) throw new Error('Sync is not configured yet.')
  const em = email.trim()
  try {
    await createUserWithEmailAndPassword(auth, em, password)
  } catch (e) {
    const code = (e as { code?: string })?.code ?? ''
    if (code.includes('email-already-in-use')) {
      try {
        await signInWithEmailAndPassword(auth, em, password)
        return
      } catch (e2) {
        throw new Error(friendlyError(e2))
      }
    }
    throw new Error(friendlyError(e))
  }
}

export async function signOut(): Promise<void> {
  if (auth) await fbSignOut(auth)
}

/** Wipe local sync bookkeeping and reconcile everything from scratch. */
export async function forceSync(): Promise<void> {
  await window.solace.syncStateClear().catch(() => {})
  await syncNow('manual')
}

export async function syncNow(reason: 'auto' | 'manual' = 'manual'): Promise<void> {
  if (!db || !user) return
  if (reason === 'auto') {
    if (Date.now() - lastAuto < 15_000) return
    lastAuto = Date.now()
  }
  if (running) {
    queued = true
    return
  }
  running = true
  set({ state: 'syncing', error: undefined })
  try {
    const res = await runSync(db, user.uid, device)
    set({
      state: 'idle',
      lastSync: new Date().toISOString(),
      lastResult: res,
      error: undefined
    })
    void useStore.getState().refreshPublished()
  } catch (e) {
    set({ state: 'error', error: friendlyError(e) })
  } finally {
    running = false
    if (queued) {
      queued = false
      void syncNow('manual')
    }
  }
}
