import { useState } from 'react'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'

function friendly(e: unknown): string {
  const c = (e as { code?: string })?.code ?? ''
  if (c.includes('invalid-credential') || c.includes('wrong-password')) return 'Wrong email or password.'
  if (c.includes('email-already-in-use')) return 'That email already has an account — just sign in.'
  if (c.includes('weak-password')) return 'Password needs at least 6 characters.'
  if (c.includes('invalid-email')) return 'That doesn’t look like an email.'
  if (c.includes('popup-closed') || c.includes('cancelled-popup')) return ''
  return (e as Error)?.message ?? 'Something went wrong.'
}

export function SignIn(): JSX.Element {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const google = async (): Promise<void> => {
    setBusy(true)
    setErr('')
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      setErr(friendly(e))
    } finally {
      setBusy(false)
    }
  }

  const emailAuth = async (): Promise<void> => {
    setBusy(true)
    setErr('')
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), pw)
    } catch (e) {
      const c = (e as { code?: string })?.code ?? ''
      if (c.includes('email-already-in-use')) {
        try {
          await signInWithEmailAndPassword(auth, email.trim(), pw)
        } catch (e2) {
          setErr(friendly(e2))
        }
      } else {
        setErr(friendly(e))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="signin">
      <div className="signin-card">
        <div className="mark">▲</div>
        <h1>Solace</h1>
        <p className="muted">Sign in to reach your notes.</p>

        <button className="btn google" onClick={google} disabled={busy}>
          Continue with Google
        </button>

        <div className="divider">or</div>

        <input
          className="in"
          type="email"
          placeholder="Email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="in"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && emailAuth()}
        />
        <button
          className="btn"
          onClick={emailAuth}
          disabled={busy || !email || pw.length < 6}
        >
          {busy ? 'Working…' : 'Sign in / Create account'}
        </button>

        {err && <p className="err">{err}</p>}
        <p className="fine">Use the same account as the Solace desktop app.</p>
      </div>
    </div>
  )
}
