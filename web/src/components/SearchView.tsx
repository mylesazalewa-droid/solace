import { useMemo } from 'react'
import { useStore } from '../store'
import { Rail } from './Rail'
import { NoteCard } from './NoteCard'

export function SearchView(): JSX.Element {
  const notes = useStore((s) => s.notes)
  const query = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const go = useStore((s) => s.go)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const terms = q.split(/\s+/)
    return notes
      .map((n) => {
        const hay = `${n.title}\n${n.tags.join(' ')}\n${n.summary}\n${n.body}`.toLowerCase()
        let score = 0
        for (const t of terms) {
          if (n.title.toLowerCase().includes(t)) score += 10
          if (hay.includes(t)) score += 1
          else return { n, score: -1 }
        }
        return { n, score }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || b.n.updated.localeCompare(a.n.updated))
      .map((r) => r.n)
  }, [notes, query])

  return (
    <div className="page">
      <Rail active="search" />
      <main className="nb-main">
        <header className="nb-head">
          <button className="back" onClick={() => go({ name: 'home' })}>
            ‹ Library
          </button>
          <h1>Search</h1>
        </header>
        <div className="nb-search">
          <input
            className="field"
            autoFocus
            placeholder="Search all notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {query.trim() === '' ? (
          <div className="lib-empty">Type to search every note.</div>
        ) : results.length === 0 ? (
          <div className="lib-empty">Nothing matches “{query}”.</div>
        ) : (
          <div className="card-grid">
            {results.map((n) => (
              <NoteCard key={n.id} n={n} from={{ name: 'search' }} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
