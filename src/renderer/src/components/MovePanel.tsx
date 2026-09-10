import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Cover } from './Cover'
import { Icon } from './Icon'

export function MovePanel(): JSX.Element | null {
  const target = useStore((s) => s.moveTarget)
  const snapshot = useStore((s) => s.snapshot)
  const route = useStore((s) => s.route)
  const go = useStore((s) => s.go)
  const close = (): void => useStore.setState({ moveTarget: null })
  const [nb, setNb] = useState<string | null>(null)
  const [folder, setFolder] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const current = useMemo(() => {
    if (!target || !snapshot) return null
    return snapshot.notes.find((n) => n.id === target.noteId) ?? null
  }, [target, snapshot])

  if (!target || !snapshot) return null

  const pickedNb = nb ?? current?.notebookId ?? null
  const nbMeta = snapshot.notebooks.find((n) => n.id === pickedNb)

  const move = async (): Promise<void> => {
    if (!pickedNb) return
    setBusy(true)
    try {
      const { snapshot: snap, newId } = await window.solace.moveNote(target.noteId, pickedNb, folder)
      useStore.setState({ snapshot: snap })
      if (route.name === 'note' && route.noteId === target.noteId) {
        go({ name: 'note', noteId: newId, backTo: route.backTo })
      }
      close()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not move note')
      setBusy(false)
    }
  }

  const unchanged =
    pickedNb === current?.notebookId && (folder ?? null) === (current?.folderId ?? null)

  return (
    <div className="prompt-scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="settings-card move-card" role="dialog" aria-modal="true" aria-label="Move note">
        <div className="settings-head">
          <h2>Move “{target.title}”</h2>
          <button className="iconbtn" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="move-body">
          <div className="move-nbs">
            {snapshot.notebooks.map((n) => (
              <button
                key={n.id}
                className={`move-nb ${pickedNb === n.id ? 'on' : ''}`}
                onClick={() => {
                  setNb(n.id)
                  setFolder(null)
                }}
              >
                <Cover cover={n.cover} className="move-cover" />
                <span className="move-nb-name">{n.name}</span>
                {current?.notebookId === n.id && <span className="move-here">current</span>}
              </button>
            ))}
          </div>

          {nbMeta && nbMeta.folders.length > 0 && (
            <div className="move-folders">
              <div className="side-label">Series in {nbMeta.name}</div>
              <button
                className={`move-folder ${folder === null ? 'on' : ''}`}
                onClick={() => setFolder(null)}
              >
                <Icon name="inbox" size={15} /> Not in a series
              </button>
              {nbMeta.folders.map((f) => (
                <button
                  key={f.id}
                  className={`move-folder ${folder === f.id ? 'on' : ''}`}
                  onClick={() => setFolder(f.id)}
                >
                  <Icon name="folder" size={15} /> {f.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="prompt-actions">
          <button className="btn ghost" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button className="btn accent" onClick={move} disabled={busy || unchanged}>
            {busy ? 'Moving…' : 'Move note'}
          </button>
        </div>
      </div>
    </div>
  )
}
