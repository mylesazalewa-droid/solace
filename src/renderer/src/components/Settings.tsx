import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { HotkeyInput } from './HotkeyInput'
import { SyncSettings } from './SyncSettings'
import type { AppConfig, HelperEngine, HelperStatus } from '../../../shared/types'

export function Settings({ onClose }: { onClose: () => void }): JSX.Element {
  const config = useStore((s) => s.config)
  const [draft, setDraft] = useState<AppConfig | null>(config)
  const [status, setStatus] = useState<HelperStatus | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    setDraft(config)
  }, [config])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!draft) return <div />

  const patch = async (p: Partial<AppConfig>): Promise<void> => {
    const next = { ...draft, ...p }
    setDraft(next)
    const saved = await window.solace.setConfig(p)
    useStore.setState({ config: saved })
  }

  const check = async (): Promise<void> => {
    setChecking(true)
    setStatus(null)
    try {
      setStatus(await window.solace.helperStatus())
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="prompt-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-card" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="settings-head">
          <h3>Settings</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="settings-body">
          <section className="settings-sec">
            <div className="sec-label">Appearance</div>
            <div className="setting-row">
              <span>Theme</span>
              <div className="seg">
                {(['system', 'light', 'dark'] as const).map((t) => (
                  <button
                    key={t}
                    className={draft.theme === t ? 'on' : ''}
                    onClick={async () => {
                      await window.solace.setTheme(t)
                      const root = document.documentElement
                      if (t === 'system') root.removeAttribute('data-theme')
                      else root.setAttribute('data-theme', t)
                      const saved = await window.solace.getConfig()
                      useStore.setState({ config: saved })
                      setDraft(saved)
                    }}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <SyncSettings draft={draft} patch={patch} />

          <section className="settings-sec">
            <div className="sec-label">Scripture</div>
            <div className="setting-row">
              <span>Show verses in</span>
              <div className="seg">
                <button
                  className={draft.bibleTranslation === 'kjv' ? 'on' : ''}
                  onClick={() => patch({ bibleTranslation: 'kjv' })}
                >
                  KJV
                </button>
                <button
                  className={draft.bibleTranslation === 'bbe' ? 'on' : ''}
                  onClick={() => patch({ bibleTranslation: 'bbe' })}
                >
                  Plain English
                </button>
              </div>
            </div>
            <p className="sec-note">
              References like <code>Mark 6:31</code> in a note become links — hover to read the
              passage. KJV is the traditional wording; Plain English (BBE) is simpler. Both are
              bundled and work offline.
            </p>
          </section>

          <section className="settings-sec">
            <div className="sec-label">The helper</div>
            <p className="sec-note">
              Small AI tasks — tidying notes, writing the one-line summaries, suggesting tags.
              Nothing is sent anywhere until you use one of those.
            </p>

            <div className="setting-row">
              <span>Run</span>
              <div className="seg">
                {(['local', 'cloud'] as HelperEngine[]).map((e) => (
                  <button
                    key={e}
                    className={draft.engine === e ? 'on' : ''}
                    onClick={() => patch({ engine: e })}
                  >
                    {e === 'local' ? 'On my Mac' : 'Free online'}
                  </button>
                ))}
              </div>
            </div>

            {draft.engine === 'local' ? (
              <>
                <p className="sec-note">
                  Free, private, works offline. Needs <b>Ollama</b> and a model pulled:{' '}
                  <code>ollama pull {draft.ollamaModel}</code>
                </p>
                <button
                  className="btn subtle"
                  style={{ marginBottom: 12 }}
                  onClick={() => window.solace.openUrl('https://ollama.com/download')}
                >
                  Get Ollama →
                </button>
                <label className="field">
                  <span>Model</span>
                  <input
                    value={draft.ollamaModel}
                    onChange={(e) => setDraft({ ...draft, ollamaModel: e.target.value })}
                    onBlur={() => patch({ ollamaModel: draft.ollamaModel.trim() })}
                    placeholder="llama3.2"
                  />
                </label>
                <label className="field">
                  <span>Ollama address</span>
                  <input
                    value={draft.ollamaUrl}
                    onChange={(e) => setDraft({ ...draft, ollamaUrl: e.target.value })}
                    onBlur={() => patch({ ollamaUrl: draft.ollamaUrl.trim() })}
                  />
                </label>
                <label className="field">
                  <span>Embedding model (for “Ask your notes”)</span>
                  <input
                    value={draft.ollamaEmbedModel}
                    onChange={(e) => setDraft({ ...draft, ollamaEmbedModel: e.target.value })}
                    onBlur={() => patch({ ollamaEmbedModel: draft.ollamaEmbedModel.trim() })}
                    placeholder="nomic-embed-text"
                  />
                </label>
                <p className="sec-note">
                  Needs its own pull: <code>ollama pull {draft.ollamaEmbedModel}</code>
                </p>
              </>
            ) : (
              <>
                <p className="sec-note">
                  Google's free Gemini tier — better quality, needs internet. Only the note text
                  of the action you trigger is sent.
                </p>
                <button
                  className="btn subtle"
                  style={{ marginBottom: 12 }}
                  onClick={() => window.solace.openUrl('https://aistudio.google.com/apikey')}
                >
                  Get a free API key →
                </button>
                <label className="field">
                  <span>API key</span>
                  <input
                    type="password"
                    value={draft.geminiKey}
                    onChange={(e) => setDraft({ ...draft, geminiKey: e.target.value })}
                    onBlur={() => patch({ geminiKey: draft.geminiKey.trim() })}
                    placeholder="AIza…"
                  />
                </label>
                <label className="field">
                  <span>Model</span>
                  <input
                    value={draft.geminiModel}
                    onChange={(e) => setDraft({ ...draft, geminiModel: e.target.value })}
                    onBlur={() => patch({ geminiModel: draft.geminiModel.trim() })}
                  />
                </label>
              </>
            )}

            <div className="setting-row">
              <button className="btn subtle" onClick={check} disabled={checking}>
                {checking ? 'Checking…' : 'Check connection'}
              </button>
              {status && (
                <span className={`helper-status ${status.ready ? 'ok' : 'bad'}`}>
                  {status.ready ? '● ' : '○ '}
                  {status.detail}
                </span>
              )}
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                checked={draft.autoSummary}
                onChange={(e) => patch({ autoSummary: e.target.checked })}
              />
              <span>
                <b>Write summaries automatically</b>
                <br />
                <span className="sec-note">
                  After you finish a note, the helper writes its one-line summary and suggests
                  tags. Turn off to do it by hand.
                </span>
              </span>
            </label>
          </section>

          <section className="settings-sec">
            <div className="sec-label">Quick capture</div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={draft.quickCapture}
                onChange={(e) => patch({ quickCapture: e.target.checked })}
              />
              <span>
                <b>Global capture hotkey</b>
                <br />
                <span className="sec-note">
                  Press the hotkey from any app to jot a thought straight into your Inbox
                  notebook — Solace doesn’t even need to be in front.
                </span>
              </span>
            </label>
            {draft.quickCapture && (
              <div className="field">
                <span>Hotkey</span>
                <HotkeyInput
                  value={draft.quickCaptureHotkey}
                  onChange={(accel) => patch({ quickCaptureHotkey: accel })}
                />
                <span className="sec-note">
                  Click the box, then press the keys you want. Needs at least one of ⌘ / ⌃ / ⌥
                  plus another key.
                </span>
              </div>
            )}
          </section>

          <section className="settings-sec">
            <div className="sec-label">Templates</div>
            <div className="setting-row">
              <span className="sec-note">
                Reusable note layouts — sermon prep, meeting notes, your own. Pick one when you
                make a new note.
              </span>
            </div>
            <div className="setting-row">
              <button
                className="btn subtle"
                onClick={() => {
                  onClose()
                  useStore.setState({ templatesOpen: true })
                }}
              >
                Manage templates
              </button>
            </div>
          </section>

          <section className="settings-sec">
            <div className="sec-label">Your notes</div>
            <div className="setting-row">
              <span className="path-text">{config?.vaultPath ?? 'No folder chosen'}</span>
              <button className="btn subtle" onClick={() => window.solace.reveal()}>
                Show in Finder
              </button>
            </div>
            <div className="setting-row">
              <button className="btn subtle" onClick={() => useStore.getState().chooseVault()}>
                Choose a different folder
              </button>
            </div>
          </section>

          <AboutSection />
        </div>
      </div>
    </div>
  )
}

function AboutSection(): JSX.Element {
  const [version, setVersion] = useState('')
  const [state, setState] = useState<'idle' | 'checking' | 'done'>('idle')
  const [result, setResult] = useState<{
    latest: string | null
    url: string | null
    notes: string | null
    updateAvailable: boolean
  } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    window.solace.appVersion?.().then(setVersion)
  }, [])

  const check = async (): Promise<void> => {
    setState('checking')
    setErr(null)
    try {
      const r = await window.solace.checkForUpdate()
      setResult(r)
      setState('done')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Check failed')
      setState('idle')
    }
  }

  return (
    <section className="settings-sec">
      <div className="sec-label">About</div>
      <div className="setting-row">
        <span className="sec-note">Solace {version && `v${version}`}</span>
        <button className="btn subtle" onClick={check} disabled={state === 'checking'}>
          {state === 'checking' ? 'Checking…' : 'Check for updates'}
        </button>
      </div>
      {err && <span className="helper-status bad">○ {err}</span>}
      {state === 'done' && result && (
        <div className="setting-row">
          {result.updateAvailable ? (
            <span className="sec-note">
              <b style={{ color: 'var(--ink)' }}>Version {result.latest} is available.</b>
              {result.notes ? ` ${result.notes}` : ''}{' '}
              {result.url && (
                <button className="link-btn" onClick={() => window.solace.openUrl(result.url as string)}>
                  Download
                </button>
              )}
            </span>
          ) : (
            <span className="helper-status ok">● You’re on the latest version.</span>
          )}
        </div>
      )}
    </section>
  )
}
