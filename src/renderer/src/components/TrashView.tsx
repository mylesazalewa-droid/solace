import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Icon } from './Icon'
import { askConfirm } from '../prompt'
import type { TrashItem } from '../../../shared/types'

function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const days = Math.floor((Date.now() - d.getTime()) / 86400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function TrashView(): JSX.Element {
  const go = useStore((s) => s.go)
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = async (): Promise<void> => {
    setLoading(true)
    setItems(await window.solace.trashList())
    setLoading(false)
  }
  useEffect(() => {
    void load()
  }, [])

  const restore = async (it: TrashItem): Promise<void> => {
    const snap = await window.solace.trashRestore(it.id)
    useStore.setState({ snapshot: snap })
    void load()
  }
  const purge = async (it: TrashItem): Promise<void> => {
    const ok = await askConfirm({
      title: `Delete “${it.name}” forever?`,
      label: 'This cannot be undone.',
      confirmText: 'Delete forever',
      danger: true
    })
    if (!ok) return
    setItems(await window.solace.trashPurge(it.id))
  }
  const empty = async (): Promise<void> => {
    const ok = await askConfirm({
      title: 'Empty the trash?',
      label: `All ${items.length} item${items.length === 1 ? '' : 's'} will be gone for good.`,
      confirmText: 'Empty trash',
      danger: true
    })
    if (!ok) return
    setItems(await window.solace.trashEmpty())
  }

  return (
    <div className="body-scroll">
      <div className="trash-page">
        <header className="trash-head">
          <button className="back-btn" onClick={() => go({ name: 'shelf' })}>
            <span className="chev">‹</span> Library
          </button>
          <h2>Trash</h2>
          <span className="grow" />
          {items.length > 0 && (
            <button className="btn ghost sm" onClick={empty}>
              Empty trash
            </button>
          )}
        </header>

        {loading ? (
          <p className="trash-empty">Loading…</p>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="es-big">Trash is empty</div>
            Deleted notes and notebooks land here first — nothing is gone for good until you say so.
          </div>
        ) : (
          <div className="trash-list">
            {items.map((it) => (
              <div key={it.id} className="trash-row">
                <span className={`trash-kind k-${it.kind}`}>
                  <Icon name={it.kind === 'note' ? 'note' : 'book'} size={15} />
                </span>
                <div className="trash-main">
                  <span className="trash-name">{it.name}</span>
                  <span className="trash-sub">
                    {it.kind !== 'note' ? `${it.kind} · ` : ''}
                    {it.blurb || it.originalPath}
                  </span>
                </div>
                <span className="trash-when">{when(it.deletedAt)}</span>
                <button className="btn subtle sm" onClick={() => restore(it)}>
                  Restore
                </button>
                <button className="icon-x" title="Delete forever" onClick={() => purge(it)}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
