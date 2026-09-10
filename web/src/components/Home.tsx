import { useMemo } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useStore } from '../store'
import { Rail } from './Rail'
import { Cover, coverFor } from './Cover'
import { SyncBadge } from './SyncBadge'

interface ShelfItem {
  key: string
  book: React.ReactNode
  caption: React.ReactNode
}

function Shelf({ items }: { items: ShelfItem[] }): JSX.Element {
  return (
    <div className="shelf-grid">
      {items.map((it) => (
        <div key={it.key} className="slot">
          <div className="slot-book">{it.book}</div>
          {it.caption}
        </div>
      ))}
    </div>
  )
}

export function Home(): JSX.Element {
  const notes = useStore((s) => s.notes)
  const covers = useStore((s) => s.covers)
  const go = useStore((s) => s.go)

  const notebooks = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of notes) counts.set(n.notebook, (counts.get(n.notebook) ?? 0) + 1)
    for (const k of Object.keys(covers)) if (!counts.has(k)) counts.set(k, 0)
    return [...counts.entries()]
      .map(([id, count]) => ({ id, count, cover: coverFor(id, covers[id]) }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }, [notes, covers])

  const pinned = useMemo(() => notes.filter((n) => n.pinned).slice(0, 10), [notes])

  return (
    <div className="page lib">
      <Rail active="library" />

      <main className="lib-main">
        <header className="lib-head">
          <div>
            <h1>My library</h1>
            <span className="lib-meta">
              {notebooks.length} notebook{notebooks.length === 1 ? '' : 's'} ·{' '}
              {notes.length} note{notes.length === 1 ? '' : 's'}
            </span>
          </div>
          <SyncBadge compact />
          <button className="pill" onClick={() => go({ name: 'search' })}>
            Search
          </button>
          <button className="pill mobile-only" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </header>

        <div className="parchment">
          {notebooks.length === 0 ? (
            <div className="lib-empty">Your library is empty. Tap ＋ to make your first note.</div>
          ) : (
            <>
              {pinned.length > 0 && (
                <section className="shelf-section">
                  <div className="ss-head">
                    <h3>Pinned</h3>
                  </div>
                  <Shelf
                    items={pinned.map((n) => ({
                      key: n.id,
                      book: (
                        <button
                          className="pin-book"
                          onClick={() => go({ name: 'note', id: n.id, from: { name: 'home' } })}
                        >
                          <span className="pb-cover">
                            <span className="pb-title">{n.title}</span>
                            <span className="pb-nb">{n.notebook}</span>
                          </span>
                        </button>
                      ),
                      caption: <span className="bc-count">{n.notebook}</span>
                    }))}
                  />
                </section>
              )}

              <section className="shelf-section">
                <div className="ss-head">
                  <h3>Notebooks</h3>
                  <button className="ss-add" onClick={() => go({ name: 'new' })}>
                    ＋ New note
                  </button>
                </div>
                <Shelf
                  items={notebooks.map((nb) => ({
                    key: nb.id,
                    book: (
                      <button className="book" onClick={() => go({ name: 'notebook', id: nb.id })}>
                        <Cover cover={nb.cover} />
                      </button>
                    ),
                    caption: (
                      <button
                        className="slot-caption"
                        onClick={() => go({ name: 'notebook', id: nb.id })}
                      >
                        <span className="bc-name">{nb.id}</span>
                        <span className="bc-count">
                          {nb.count} note{nb.count === 1 ? '' : 's'}
                        </span>
                      </button>
                    )
                  }))}
                />
              </section>
            </>
          )}
        </div>
      </main>

      <button className="fab" onClick={() => go({ name: 'new' })} aria-label="New note">
        ＋
      </button>
    </div>
  )
}
