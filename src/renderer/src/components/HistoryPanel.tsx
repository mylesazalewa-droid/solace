import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { askConfirm } from '../prompt'
import type { HistoryEntry } from '../../../shared/types'

function whenLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const now = Date.now()
  const diff = now - d.getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hr ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function HistoryPanel(): JSX.Element | null {
  const target = useStore((s) => s.historyFor)
  const close = (): void => useStore.setState({ historyFor: null })
  const [list, setList] = useState<HistoryEntry[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ title: string; body: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!target) return
    setLoading(true)
    window.solace.historyList(target.noteId).then((l) => {
      setList(l)
      setLoading(false)
      if (l[0]) pick(l[0].id, target.noteId)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.noteId])

  if (!target) return null

  const pick = (id: string, noteId = target.noteId): void => {
    setSel(id)
    window.solace.historyRead(noteId, id).then(setPreview)
  }

  const restore = async (): Promise<void> => {
    if (!sel) return
    const ok = await askConfirm({
      title: 'Restore this version?',
      label: 'Your current text is saved to history first, so you can undo this.',
      confirmText: 'Restore'
    })
    if (!ok) return
    const { snapshot } = await window.solace.historyRestore(target.noteId, sel)
    useStore.setState({ snapshot })
    close()
  }

  return (
    <div className="prompt-scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="settings-card hist-card" role="dialog" aria-modal="true" aria-label="Version history">
        <div className="settings-head">
          <h2>History — “{target.title}”</h2>
          <button className="iconbtn" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="hist-body">
          <div className="hist-list">
            {loading ? (
              <p className="sec-note">Loading…</p>
            ) : list.length === 0 ? (
              <p className="sec-note">
                No earlier versions yet. Solace snapshots a note as you edit it, tidy it, or
                restore it.
              </p>
            ) : (
              list.map((h) => (
                <button
                  key={h.id}
                  className={`hist-row ${sel === h.id ? 'on' : ''}`}
                  onClick={() => pick(h.id)}
                >
                  <span className="hist-when">{whenLabel(h.at)}</span>
                  <span className="hist-prev">{h.preview || '(empty)'}</span>
                </button>
              ))
            )}
          </div>
          <div className="hist-preview">
            {preview ? (
              <>
                <div className="hist-prev-title">{preview.title}</div>
                <pre className="hist-prev-body">{preview.body}</pre>
              </>
            ) : (
              <p className="sec-note">Pick a version to preview it.</p>
            )}
          </div>
        </div>
        <div className="prompt-actions">
          <button className="btn ghost" onClick={close}>
            Close
          </button>
          <button className="btn accent" onClick={restore} disabled={!sel}>
            Restore this version
          </button>
        </div>
      </div>
    </div>
  )
}
