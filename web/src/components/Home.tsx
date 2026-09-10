import { useMemo } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useStore } from '../store'

function when(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const day = 86400_000
  if (diff < day) return 'today'
  if (diff < 2 * day) return 'yesterday'
  if (diff < 7 * day) return `${Math.round(diff / day)}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function Home(): JSX.Element {
  const notes = useStore((s) => s.notes)
  const covers = useStore((s) => s.covers)
  const query = useStore((s) => s.query)
  const notebook = useStore((s) => s.notebook)
  const setQuery = useStore((s) => s.setQuery)
  const setNotebook = useStore((s) => s.setNotebook)
  const go = useStore((s) => s.go)

  const notebooks = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of notes) counts.set(n.notebook, (counts.get(n.notebook) ?? 0) + 1)
    for (const k of Object.keys(covers)) if (!counts.has(k)) counts.set(k, 0)
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [notes, covers])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes.filter((n) => {
      if (notebook && n.notebook !== notebook) return false
      if (!q) return true
      return (
        n.title.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [notes, query, notebook])

  return (
    <div className="home">
      <header className="topbar">
        <div className="tb-title">
          <span className="mark sm">▲</span> Solace
        </div>
        <button className="tb-link" onClick={() => signOut(auth)}>
          Sign out
        </button>
      </header>

      <div className="search-wrap">
        <input
          className="search"
          placeholder="Search all notes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="chips">
        <button className={`chip ${!notebook ? 'on' : ''}`} onClick={() => setNotebook(null)}>
          All
        </button>
        {notebooks.map(([id, count]) => (
          <button
            key={id}
            className={`chip ${notebook === id ? 'on' : ''}`}
            onClick={() => setNotebook(notebook === id ? null : id)}
            style={
              covers[id]
                ? ({ ['--dot' as string]: covers[id].c1 } as React.CSSProperties)
                : undefined
            }
          >
            <i className="chip-dot" />
            {id}
            <span className="chip-n">{count}</span>
          </button>
        ))}
      </div>

      <div className="list">
        {visible.length === 0 ? (
          <div className="empty">
            {query ? 'Nothing matches.' : 'No notes here yet — tap ＋ to make one.'}
          </div>
        ) : (
          visible.map((n) => (
            <button key={n.id} className="card" onClick={() => go({ name: 'note', id: n.id })}>
              <div className="card-top">
                {n.pinned && <span className="pin">★</span>}
                <span className="card-title">{n.title}</span>
              </div>
              <span className="card-sum">{n.summary || n.body.replace(/[#>*_`-]/g, '').slice(0, 120) || 'Empty note'}</span>
              <div className="card-foot">
                <span className="card-nb">{n.notebook}</span>
                {n.tags.slice(0, 3).map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
                <span className="card-date">{when(n.updated)}</span>
              </div>
            </button>
          ))
        )}
      </div>

      <button className="fab" onClick={() => go({ name: 'new' })} aria-label="New note">
        ＋
      </button>
    </div>
  )
}
