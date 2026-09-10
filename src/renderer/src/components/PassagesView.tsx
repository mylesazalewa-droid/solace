import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { Rail } from './Rail'
import { Icon } from './Icon'
import type { PassageGroup } from '../../../shared/types'

export function PassagesView(): JSX.Element {
  const go = useStore((s) => s.go)
  const snapshot = useStore((s) => s.snapshot)
  const [groups, setGroups] = useState<PassageGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    window.solace.scripturePassages().then((g) => {
      setGroups(g)
      setLoading(false)
    })
  }, [])

  const notebookColor = (id: string): string =>
    snapshot?.notebooks.find((n) => n.id === id)?.cover.c1 ?? 'var(--muted)'

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return groups
    return groups.filter(
      (g) =>
        g.label.toLowerCase().includes(s) ||
        g.notes.some((n) => n.title.toLowerCase().includes(s))
    )
  }, [groups, q])

  return (
    <div className="cal-page">
      <Rail active="passages" />
      <div className="cal-main agenda-main">
        <div className="cal-top">
          <h2>Passages</h2>
          <span className="nb-count">{groups.length} referenced</span>
          <span className="grow" />
          <input
            className="passage-filter"
            placeholder="Filter…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="agenda-body">
          {loading ? (
            <p className="cdp-empty">Reading through every note…</p>
          ) : visible.length === 0 ? (
            <div className="empty-state">
              <div className="es-big">No passages yet</div>
              Write a reference like <code>Mark 6:31</code> in a note and it shows up here.
            </div>
          ) : (
            visible.map((g) => (
              <section key={g.key} className="agenda-group">
                <div className="passage-head">
                  <Icon name="book" size={15} />
                  <span className="passage-label">{g.label}</span>
                  <span className="passage-count">
                    {g.count} note{g.count === 1 ? '' : 's'}
                  </span>
                </div>
                <ul className="agenda-list">
                  {g.notes.map((n, i) => (
                    <li key={i} className="agenda-item">
                      <button
                        className="passage-note"
                        onClick={() => go({ name: 'note', noteId: n.id, backTo: { name: 'passages' } })}
                      >
                        <i style={{ background: notebookColor(n.notebookId) }} />
                        <span className="passage-note-title">{n.title}</span>
                        <span className="passage-note-ref">{n.ref}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
