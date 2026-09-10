import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { Icon } from './Icon'
import { askText } from '../prompt'

export function ImportPanel(): JSX.Element | null {
  const open = useStore((s) => s.importOpen)
  const snapshot = useStore((s) => s.snapshot)
  const route = useStore((s) => s.route)
  const startImport = useStore((s) => s.startImport)

  const startNotebook =
    route.name === 'notebook' ? route.notebookId : snapshot?.notebooks[0]?.id ?? ''

  const [files, setFiles] = useState<string[]>([])
  const [pasted, setPasted] = useState('')
  const [notebookId, setNotebookId] = useState(startNotebook)
  const [folderId, setFolderId] = useState<string>('')
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setFiles([])
      setPasted('')
      setNotebookId(startNotebook)
      setFolderId('')
    }
  }, [open, startNotebook])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') useStore.setState({ importOpen: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const nb = useMemo(
    () => snapshot?.notebooks.find((n) => n.id === notebookId),
    [snapshot, notebookId]
  )

  if (!open || !snapshot) return null
  const close = (): void => useStore.setState({ importOpen: false })

  const pick = async (): Promise<void> => {
    const picked = await window.solace.pickImportFiles()
    if (picked.length) setFiles((f) => [...new Set([...f, ...picked])])
  }

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files)
      .map((f) => (f as File & { path?: string }).path)
      .filter((p): p is string => Boolean(p))
    if (dropped.length) setFiles((f) => [...new Set([...f, ...dropped])])
  }

  const total = files.length + (pasted.trim() ? 1 : 0)

  const run = (): void => {
    if (!total || !notebookId) return
    void startImport({
      files,
      pasted: pasted.trim() ? pasted : null,
      notebookId,
      folderId: folderId || null
    })
    close()
  }

  return (
    <div className="prompt-scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="settings-card" role="dialog" aria-modal="true" aria-label="Import">
        <div className="settings-head">
          <h3>Add to your notes</h3>
          <button className="iconbtn" onClick={close} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </div>

        <div className="settings-body">
          <div
            ref={dropRef}
            className="import-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={pick}
          >
            <Icon name="import" size={22} />
            <div className="id-big">Drop files here, or click to choose</div>
            <div className="id-small">PDF · Word · Markdown · plain text</div>
          </div>

          {files.length > 0 && (
            <div className="import-files">
              {files.map((f) => (
                <div key={f} className="import-file">
                  <Icon name="note" size={15} />
                  <span>{f.split('/').pop()}</span>
                  <button onClick={() => setFiles((x) => x.filter((y) => y !== f))}>
                    <Icon name="x" size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="sec-label" style={{ marginTop: 14 }}>
            Or paste text
          </div>
          <textarea
            className="import-paste"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Paste a thought, a transcript, an article…"
            rows={4}
          />

          <div className="sec-label" style={{ marginTop: 14 }}>
            Put it in
          </div>
          <div className="setting-row">
            <select
              value={notebookId}
              onChange={(e) => setNotebookId(e.target.value)}
              className="import-select"
            >
              {snapshot.notebooks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
            <select
              value={folderId}
              onChange={async (e) => {
                if (e.target.value === '__new__') {
                  const name = await askText({
                    title: `New folder in ${nb?.name ?? 'this notebook'}`,
                    placeholder: 'e.g. Sermons 2026',
                    confirmText: 'Create'
                  })
                  if (name && nb) {
                    try {
                      const snap = await window.solace.createFolder(nb.id, name)
                      useStore.setState({ snapshot: snap })
                      setFolderId(name.trim())
                    } catch {
                      setFolderId('')
                    }
                  }
                  return
                }
                setFolderId(e.target.value)
              }}
              className="import-select"
            >
              <option value="">— no folder —</option>
              {nb?.folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
              <option value="__new__">＋ New folder…</option>
            </select>
          </div>

          <p className="sec-note">
            Each item is read, tidied, summarised and saved as its own note — this runs in the
            background, so you can keep working. The helper does the tidying and summary if it&apos;s
            set up; otherwise the raw text is saved. Original files are copied in, never moved.
          </p>

          <div className="prompt-actions">
            <button className="btn ghost" onClick={close}>
              Cancel
            </button>
            <button className="btn accent" onClick={run} disabled={!total}>
              {total ? `Import ${total} item${total === 1 ? '' : 's'}` : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
