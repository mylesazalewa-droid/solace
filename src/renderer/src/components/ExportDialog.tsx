import { useState } from 'react'
import { useStore } from '../store'
import type { ExportFormat } from '../../../shared/types'

const FORMATS: { id: ExportFormat; label: string; note: string }[] = [
  { id: 'pdf', label: 'PDF', note: 'Formatted for printing or sharing' },
  { id: 'docx', label: 'Word', note: 'Editable .docx document' },
  { id: 'md', label: 'Markdown', note: 'Plain text with formatting marks' },
  { id: 'json', label: 'JSON', note: 'Structured data — titles, tags, dates' }
]

export function ExportDialog(): JSX.Element | null {
  const target = useStore((s) => s.exportTarget)
  const close = (): void => useStore.setState({ exportTarget: null })
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!target) return null

  const run = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const res = await window.solace.exportNotes({
        noteIds: target.noteIds,
        format,
        name: target.name
      })
      if (res) setDone(res.path)
      else close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const count = target.noteIds.length

  return (
    <div
      className="prompt-scrim"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="prompt-card" role="dialog" aria-modal="true" aria-label="Export">
        {done ? (
          <>
            <h3>Exported</h3>
            <p className="prompt-label">
              Saved {count} note{count === 1 ? '' : 's'} to{' '}
              <span style={{ color: 'var(--ink)' }}>{done.split('/').pop()}</span>.
            </p>
            <div className="prompt-actions">
              <button className="btn subtle" onClick={() => window.solace.reveal()}>
                Show in Finder
              </button>
              <button className="btn accent" onClick={close}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>Export {target.name}</h3>
            <p className="prompt-label">
              {count} note{count === 1 ? '' : 's'} · choose a format
            </p>
            <div className="export-formats">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  className={`export-fmt ${format === f.id ? 'on' : ''}`}
                  onClick={() => setFormat(f.id)}
                >
                  <span className="ef-label">{f.label}</span>
                  <span className="ef-note">{f.note}</span>
                </button>
              ))}
            </div>
            {error && <p className="export-error">{error}</p>}
            <div className="prompt-actions">
              <button className="btn ghost" onClick={close} disabled={busy}>
                Cancel
              </button>
              <button className="btn accent" onClick={run} disabled={busy}>
                {busy ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
