import { useEffect, useState } from 'react'
import { useStore } from '../store'
import {
  canPublish,
  getPublicState,
  publishNote,
  unpublishNote,
  type PublicState
} from '../publish'

export function PublishDialog(): JSX.Element | null {
  const target = useStore((s) => s.publishTarget)
  const close = (): void => useStore.setState({ publishTarget: null })

  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<PublicState | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const available = canPublish()

  useEffect(() => {
    if (!target || !available) {
      setLoading(false)
      return
    }
    let live = true
    getPublicState(target.noteId, target.body, target.title)
      .then((s) => live && setState(s))
      .catch((e) => live && setErr(e instanceof Error ? e.message : 'Could not check publish status'))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [target, available])

  if (!target) return null

  const doPublish = async (): Promise<void> => {
    setBusy(true)
    setErr(null)
    try {
      setState(await publishNote(target.noteId, target.title, target.body))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not publish')
    } finally {
      setBusy(false)
    }
  }

  const doUnpublish = async (): Promise<void> => {
    setBusy(true)
    setErr(null)
    try {
      await unpublishNote(target.noteId)
      setState(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not unpublish')
    } finally {
      setBusy(false)
    }
  }

  const copy = (): void => {
    if (!state) return
    void navigator.clipboard.writeText(state.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="prompt-scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="settings-card publish-card" role="dialog" aria-modal="true" aria-label="Publish note">
        <div className="settings-head">
          <h2>Publish “{target.title}”</h2>
          <button className="iconbtn" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="publish-body">
          {!available ? (
            <p className="publish-note">
              Publishing needs sync turned on — that’s what hosts the page. Open{' '}
              <button
                className="linkish"
                onClick={() => {
                  close()
                  useStore.setState({ settingsOpen: true })
                }}
              >
                Settings → Sync
              </button>{' '}
              and sign in, then try again.
            </p>
          ) : loading ? (
            <p className="publish-note">Checking…</p>
          ) : state ? (
            <>
              <p className="publish-note">
                Anyone with this link can read a snapshot of this note — no account needed. It
                won’t update on its own.
              </p>
              <div className="publish-link">
                <input readOnly value={state.url} onFocus={(e) => e.currentTarget.select()} />
                <button className="btn subtle" onClick={copy}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              {state.stale && (
                <p className="publish-stale">
                  You’ve edited the note since publishing.{' '}
                  <button className="linkish" onClick={doPublish} disabled={busy}>
                    Update the public copy
                  </button>
                </p>
              )}
            </>
          ) : (
            <p className="publish-note">
              Create a public web page for this note — good for sharing a study or an order of
              service. You can unpublish any time.
            </p>
          )}

          {err && <p className="publish-err">{err}</p>}
        </div>

        <div className="prompt-actions">
          {state ? (
            <>
              <button className="btn ghost danger" onClick={doUnpublish} disabled={busy}>
                {busy ? 'Working…' : 'Unpublish'}
              </button>
              <button className="btn ghost" onClick={close} disabled={busy}>
                Done
              </button>
            </>
          ) : (
            <>
              <button className="btn ghost" onClick={close} disabled={busy}>
                Cancel
              </button>
              <button
                className="btn accent"
                onClick={doPublish}
                disabled={busy || !available || loading}
              >
                {busy ? 'Publishing…' : 'Publish'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
