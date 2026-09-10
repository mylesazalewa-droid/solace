import type { Note } from '../lib/notes'
import { useStore } from '../store'
import type { Route } from '../store'

function fmt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function preview(n: Note): string {
  if (n.summary) return n.summary
  const t = n.body
    .replace(/^#.*$/gm, '')
    .replace(/[#>*_`[\]-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return t.slice(0, 160) || 'No preview yet.'
}

export function NoteCard({ n, from }: { n: Note; from: Route }): JSX.Element {
  const go = useStore((s) => s.go)
  return (
    <button className="ncard" onClick={() => go({ name: 'note', id: n.id, from })}>
      {n.pinned && <span className="ncard-star">★</span>}
      <h3>{n.title}</h3>
      <p className="sum">{preview(n)}</p>
      <div className="foot">
        {n.tags.slice(0, 3).map((t) => (
          <span key={t} className="tag-pill">
            {t}
          </span>
        ))}
        <span className="date">{fmt(n.updated)}</span>
      </div>
    </button>
  )
}
