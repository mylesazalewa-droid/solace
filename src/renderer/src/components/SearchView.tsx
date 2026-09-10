import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { Cover } from './Cover'
import type { SearchHit } from '../../../shared/types'

export function SearchView(): JSX.Element {
  const snapshot = useStore((s) => s.snapshot)
  const route = useStore((s) => s.route)
  const go = useStore((s) => s.go)

  const initialQuery = route.name === 'search' ? route.query : ''
  const initialScope = route.name === 'search' ? route.scope : 'all'

  const [query, setQuery] = useState(initialQuery)
  const [scope, setScope] = useState(initialScope)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [ran, setRan] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (!query.trim()) {
      setHits([])
      setRan(false)
      return
    }
    debounce.current = setTimeout(async () => {
      const all = await window.solace.search(query.trim())
      setHits(all)
      setRan(true)
    }, 220)
  }, [query])

  const filtered = useMemo(
    () => (scope === 'all' ? hits : hits.filter((h) => h.note.notebookId === scope)),
    [hits, scope]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>()
    for (const h of filtered) {
      const arr = map.get(h.note.notebookId) ?? []
      arr.push(h)
      map.set(h.note.notebookId, arr)
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <div className="search-view">
      <div className="searchfield big">
        <span className="mag">🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your notes…"
        />
      </div>

      <div className="scope-row">
        <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>
          Everywhere
        </button>
        {snapshot?.notebooks.map((nb) => (
          <button key={nb.id} className={scope === nb.id ? 'on' : ''} onClick={() => setScope(nb.id)}>
            {nb.name}
          </button>
        ))}
      </div>

      {!query.trim() ? (
        <p className="search-empty">Type to search every note — title, tags, and body.</p>
      ) : ran && filtered.length === 0 ? (
        <p className="search-empty">No matches for “{query.trim()}”.</p>
      ) : (
        grouped.map(([nbId, list]) => {
          const nb = snapshot?.notebooks.find((n) => n.id === nbId)
          return (
            <div key={nbId}>
              <div className="grp">
                {nb && <Cover cover={nb.cover} className="mc" />}
                {nbId} · {list.length}
              </div>
              {list.map((h) => (
                <button
                  key={h.note.id}
                  className="sr"
                  onClick={() =>
                    go({ name: 'note', noteId: h.note.id, backTo: route })
                  }
                >
                  <span className="st">{h.note.title}</span>
                  <span className="sx" dangerouslySetInnerHTML={{ __html: h.snippet }} />
                </button>
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}
