import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { Rail } from './Rail'
import { Icon } from './Icon'
import { canPublish, unpublishNote } from '../publish'

export function PublishedView(): JSX.Element {
  const go = useStore((s) => s.go)
  const snapshot = useStore((s) => s.snapshot)
  const published = useStore((s) => s.published)
  const refreshPublished = useStore((s) => s.refreshPublished)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const available = canPublish()

  useEffect(() => {
    if (!available) {
      setLoading(false)
      return
    }
    refreshPublished().finally(() => setLoading(false))
  }, [available, refreshPublished])

  const notebookOf = (noteId: string): string =>
    snapshot?.notes.find((n) => n.id === noteId)?.notebookId ?? ''

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return Object.values(published)
      .filter((p) => !s || p.title.toLowerCase().includes(s) || notebookOf(p.noteId).toLowerCase().includes(s))
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [published, q, snapshot])

  const copy = (p: (typeof list)[number]): void => {
    void navigator.clipboard.writeText(p.url)
    setCopiedId(p.pageId)
    setTimeout(() => setCopiedId(null), 1600)
  }

  const remove = async (noteId: string): Promise<void> => {
    setBusy(noteId)
    try {
      await unpublishNote(noteId)
      await refreshPublished()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="cal-page">
      <Rail active="published" />
      <div className="cal-main agenda-main">
        <div className="cal-top">
          <h2>Published</h2>
          <span className="nb-count">{list.length} live link{list.length === 1 ? '' : 's'}</span>
          <span className="grow" />
          {list.length > 0 && (
            <input
              className="passage-filter"
              placeholder="Filter…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          )}
        </div>

        <div className="agenda-body">
          {!available ? (
            <div className="empty-state">
              <div className="es-big">Sync isn’t on</div>
              Turn on sync in Settings and sign in to publish notes and see them here.
            </div>
          ) : loading ? (
            <p className="cdp-empty">Checking what’s published…</p>
          ) : list.length === 0 ? (
            <div className="empty-state">
              <div className="es-big">Nothing published yet</div>
              Open a note’s ⋯ menu and choose “Publish as a link…” to share it.
            </div>
          ) : (
            <ul className="agenda-list published-list">
              {list.map((p) => (
                <li key={p.pageId} className="agenda-item published-row">
                  <button
                    className="passage-note pub-row-main"
                    onClick={() => go({ name: 'note', noteId: p.noteId, backTo: { name: 'published' } })}
                  >
                    <Icon name="globe" size={14} />
                    <span className="passage-note-title">{p.title}</span>
                    {notebookOf(p.noteId) && (
                      <span className="pub-row-nb">{notebookOf(p.noteId)}</span>
                    )}
                  </button>
                  <button className="btn subtle sm" onClick={() => copy(p)}>
                    {copiedId === p.pageId ? 'Copied' : 'Copy link'}
                  </button>
                  <button
                    className="btn ghost danger sm"
                    onClick={() => remove(p.noteId)}
                    disabled={busy === p.noteId}
                  >
                    {busy === p.noteId ? 'Working…' : 'Unpublish'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
