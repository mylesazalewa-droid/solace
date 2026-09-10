import { useState } from 'react'
import { useStore } from '../store'
import { startSync, signIn, signInWithGoogle, signOut, syncNow, forceSync } from '../sync'
import { hasSharedSync } from '../../../shared/appConfig'
import type { AppConfig } from '../../../shared/types'

const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}`

function ago(iso?: string): string {
  if (!iso) return 'never'
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`
  return new Date(iso).toLocaleString()
}

export function SyncSettings({
  draft,
  patch
}: {
  draft: AppConfig
  patch: (p: Partial<AppConfig>) => Promise<void>
}): JSX.Element {
  const status = useStore((s) => s.sync)
  const shared = hasSharedSync()
  const [cfgText, setCfgText] = useState(draft.firebaseConfig)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState<'' | 'google' | 'email' | 'force'>('')
  const [advOpen, setAdvOpen] = useState(!shared && !draft.firebaseConfig.trim())
  const [setupOpen, setSetupOpen] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  const saveConfig = async (): Promise<void> => {
    await patch({ firebaseConfig: cfgText, syncEnabled: true })
    await startSync()
  }

  const toggle = async (on: boolean): Promise<void> => {
    await patch({ syncEnabled: on })
    await startSync()
  }

  const run = async (
    kind: 'google' | 'email' | 'force',
    fn: () => Promise<void>
  ): Promise<void> => {
    setBusy(kind)
    setLocalErr(null)
    try {
      await fn()
      if (kind === 'email') setPw('')
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy('')
    }
  }

  const byoConfigured = draft.firebaseConfig.trim().length > 0
  const canAuth = draft.syncEnabled && (shared || byoConfigured) && status.state !== 'off'
  const signedIn = status.state === 'idle' || status.state === 'syncing'

  return (
    <section className="settings-sec">
      <div className="sec-label">Sync across devices</div>
      <p className="sec-note">
        Your notes stay as plain Markdown on every Mac. Sync keeps them in step through the
        cloud — nothing leaves your machine until you turn it on.
      </p>

      <div className="setting-row">
        <label className="check-row">
          <input
            type="checkbox"
            checked={draft.syncEnabled}
            onChange={(e) => toggle(e.target.checked)}
          />
          <span>
            <b>Turn on sync</b>
          </span>
        </label>
      </div>

      {status.state === 'error' && status.error && (
        <span className="helper-status bad">○ {status.error}</span>
      )}

      {/* ---- signed out: how to get in ---- */}
      {!signedIn && draft.syncEnabled && (
        <div className="sync-auth">
          {shared && (
            <>
              <button
                className="btn accent gbtn"
                onClick={() => run('google', signInWithGoogle)}
                disabled={busy !== '' || !canAuth}
              >
                {busy === 'google' ? 'Opening browser…' : 'Continue with Google'}
              </button>
              <span className="sec-note">
                A browser tab opens for Google, then you come back here. Use the same Google
                account on your other devices.
              </span>
            </>
          )}

          {(byoConfigured || !shared) && (
            <>
              {shared && <div className="sync-or">or use your own account</div>}
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  autoComplete="username"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  value={pw}
                  autoComplete="current-password"
                  onChange={(e) => setPw(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && run('email', () => signIn(email, pw))}
                />
              </label>
              <button
                className="btn subtle"
                onClick={() => run('email', () => signIn(email, pw))}
                disabled={busy !== '' || !canAuth || !email || pw.length < 6}
              >
                {busy === 'email' ? 'Working…' : 'Sign in / Create account'}
              </button>
            </>
          )}

          {localErr && <span className="helper-status bad">○ {localErr}</span>}
        </div>
      )}

      {/* ---- signed in: status + controls ---- */}
      {signedIn && (
        <div className="sync-live">
          <span className={`helper-status ${status.state === 'syncing' ? '' : 'ok'}`}>
            {status.state === 'syncing' ? '↻ Syncing…' : '● Synced'}
            {status.email ? ` · ${status.email}` : ''}
          </span>
          <div className="sec-note">
            Last sync {ago(status.lastSync)}
            {status.lastResult &&
              ` · ${status.lastResult.pulled} in, ${status.lastResult.pushed} out` +
                (status.lastResult.conflicts
                  ? `, ${status.lastResult.conflicts} conflict copies`
                  : '')}
          </div>
          {localErr && <span className="helper-status bad">○ {localErr}</span>}
          <div className="setting-row sync-btns">
            <button
              className="btn subtle"
              onClick={() => syncNow('manual')}
              disabled={status.state === 'syncing' || busy !== ''}
            >
              Sync now
            </button>
            <button
              className="btn subtle"
              onClick={() => run('force', forceSync)}
              disabled={status.state === 'syncing' || busy !== ''}
              title="Re-check every note against the cloud from scratch"
            >
              {busy === 'force' ? 'Rebuilding…' : 'Force full sync'}
            </button>
            <button className="btn subtle" onClick={() => signOut()} disabled={busy !== ''}>
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* ---- advanced: bring your own Firebase ---- */}
      <button className="link-btn sync-adv-toggle" onClick={() => setAdvOpen((v) => !v)}>
        {advOpen ? 'Hide' : shared ? 'Use my own Firebase instead' : 'Set up Firebase'}
      </button>

      {advOpen && (
        <div className="sync-adv">
          <button className="link-btn" onClick={() => setSetupOpen((v) => !v)}>
            {setupOpen ? 'Hide setup steps' : 'Show Firebase setup steps'}
          </button>
          {setupOpen && (
            <ol className="sync-steps">
              <li>
                In the{' '}
                <button
                  className="link-btn"
                  onClick={() => window.solace.openUrl('https://console.firebase.google.com/')}
                >
                  Firebase console
                </button>{' '}
                create a project.
              </li>
              <li>
                <b>Build → Firestore Database → Create database</b> (Production mode).
              </li>
              <li>
                <b>Build → Authentication → Get started → Email/Password → Enable.</b>
              </li>
              <li>
                <b>Project settings → Your apps → Web (&lt;/&gt;)</b> — register and copy the{' '}
                <code>firebaseConfig</code>.
              </li>
              <li>
                <b>Firestore → Rules</b> — paste, then Publish:
                <pre className="sync-rules">{RULES}</pre>
              </li>
            </ol>
          )}
          <label className="field">
            <span>Firebase config</span>
            <textarea
              className="tpl-textarea sync-cfg"
              value={cfgText}
              placeholder={'{\n  "apiKey": "…",\n  "authDomain": "…",\n  "projectId": "…",\n  "appId": "…"\n}'}
              onChange={(e) => setCfgText(e.target.value)}
            />
          </label>
          <button
            className="btn subtle"
            onClick={saveConfig}
            disabled={cfgText.trim() === draft.firebaseConfig.trim()}
          >
            Save config
          </button>
        </div>
      )}
    </section>
  )
}
