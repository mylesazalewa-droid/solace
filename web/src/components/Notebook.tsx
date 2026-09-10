import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Rail } from './Rail'
import { Cover, coverFor } from './Cover'
import { NoteCard } from './NoteCard'

export function Notebook({ id }: { id: string }): JSX.Element {
  const notes = useStore((s) => s.notes)
  const covers = useStore((s) => s.covers)
  const go = useStore((s) => s.go)
  const [q, setQ] = useState('')

  const cover = coverFor(id, covers[id])
  const mine = useMemo(() => {
    const query = q.trim().toLowerCase()
    return notes
      .filter((n) => n.notebook === id)
      .filter(
        (n) =>
          !query ||
          n.title.toLowerCase().includes(query) ||
          n.body.toLowerCase().includes(query) ||
          n.tags.some((t) => t.toLowerCase().includes(query))
      )
  }, [notes, id, q])

  return (
    <div className="page">
      <Rail active="library" />
      <main className="nb-main">
        <header className="nb-head">
          <button className="back" onClick={() => go({ name: 'home' })}>
            ‹ Library
          </button>
          <Cover cover={cover} className="nb-head-cover" />
          <div>
            <h1>{id}</h1>
            <span className="lib-meta">
              {notes.filter((n) => n.notebook === id).length} note
              {notes.filter((n) => n.notebook === id).length === 1 ? '' : 's'}
            </span>
          </div>
          <button className="pill" onClick={() => go({ name: 'new', notebook: id })}>
            ＋ New note
          </button>
        </header>

        <div className="nb-search">
          <input
            className="field"
            placeholder={`Search ${id}`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {mine.length === 0 ? (
          <div className="lib-empty">{q ? 'Nothing matches.' : 'No notes here yet.'}</div>
        ) : (
          <div className="card-grid">
            {mine.map((n) => (
              <NoteCard key={n.id} n={n} from={{ name: 'notebook', id }} />
            ))}
          </div>
        )}
      </main>
      <button
        className="fab"
        onClick={() => go({ name: 'new', notebook: id })}
        aria-label="New note"
      >
        ＋
      </button>
    </div>
  )
}
