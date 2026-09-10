import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { createNote, ensureNotebook } from '../lib/notes'

export function NewNote({ notebook: initNb }: { notebook?: string }): JSX.Element {
  const notes = useStore((s) => s.notes)
  const covers = useStore((s) => s.covers)
  const user = useStore((s) => s.user)
  const go = useStore((s) => s.go)

  const notebooks = useMemo(() => {
    const set = new Set<string>([...notes.map((n) => n.notebook), ...Object.keys(covers)])
    return [...set].sort()
  }, [notes, covers])

  const [notebook, setNotebook] = useState(initNb || notebooks[0] || 'Inbox')
  const [newNb, setNewNb] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async (): Promise<void> => {
    if (!user || busy) return
    const nb = (newNb.trim() || notebook || 'Inbox').replace(/[/\\:*?"<>|]/g, '').trim()
    if (!nb) return
    setBusy(true)
    try {
      if (!notebooks.includes(nb)) await ensureNotebook(user.uid, nb)
      const paths = new Set(notes.map((n) => n.path))
      const id = await createNote(user.uid, nb, title.trim() || 'Untitled note', paths)
      go({ name: 'note', id, from: { name: 'notebook', id: nb } })
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="editor">
      <div className="editor-bar">
        <button className="back" onClick={() => go({ name: 'home' })}>
          ‹ Cancel
        </button>
        <span className="grow" />
        <span className="save-state">New note</span>
      </div>

      <div className="editor-scroll">
        <div className="editor-inner new-form">
          <label className="lbl">Title</label>
          <input
            className="field"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="e.g. Sunday sermon idea"
          />

          <label className="lbl">Notebook</label>
          <div className="nb-chips">
            {notebooks.map((nb) => (
              <button
                key={nb}
                className={`chip ${!newNb && notebook === nb ? 'on' : ''}`}
                onClick={() => {
                  setNotebook(nb)
                  setNewNb('')
                }}
              >
                {nb}
              </button>
            ))}
          </div>
          <input
            className="field"
            value={newNb}
            onChange={(e) => setNewNb(e.target.value)}
            placeholder="…or a new notebook"
          />

          <button className="btn wide" onClick={create} disabled={busy}>
            {busy ? 'Creating…' : 'Create note'}
          </button>
        </div>
      </div>
    </div>
  )
}
