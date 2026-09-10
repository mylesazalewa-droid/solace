import { useEffect } from 'react'
import { useStore } from '../store'
import { Icon } from './Icon'

export function ImportToast(): JSX.Element | null {
  const job = useStore((s) => s.importJob)
  const dismiss = useStore((s) => s.dismissImportJob)
  const go = useStore((s) => s.go)

  const done = job && !job.running
  const failed = done ? job.outcomes.filter((o) => !o.ok) : []
  const ok = done ? job.outcomes.filter((o) => o.ok) : []

  useEffect(() => {
    if (done && failed.length === 0) {
      const t = setTimeout(dismiss, 5000)
      return () => clearTimeout(t)
    }
  }, [done, failed.length, dismiss])

  if (!job) return null

  const current = job.names.find((n) => job.step[n] && job.step[n] !== 'Done')
  const doneCount = job.names.filter((n) => job.step[n] === 'Done').length

  return (
    <div className={`import-toast ${done ? 'done' : ''}`} role="status">
      {job.running ? (
        <>
          <span className="it-spin" />
          <div className="it-text">
            <b>Importing…</b>
            <span>
              {doneCount}/{job.names.length}
              {current ? ` · ${job.step[current]} ${current}` : ''}
            </span>
          </div>
        </>
      ) : failed.length > 0 ? (
        <>
          <Icon name="x" size={16} className="it-ico err" />
          <div className="it-text">
            <b>
              {ok.length > 0 ? `${ok.length} added, ` : ''}
              {failed.length} couldn&apos;t be read
            </b>
            <span>{failed[0].error}</span>
          </div>
          <button className="it-x" onClick={dismiss} aria-label="Dismiss">
            <Icon name="x" size={13} />
          </button>
        </>
      ) : (
        <>
          <Icon name="check" size={16} className="it-ico ok" />
          <div className="it-text">
            <b>
              {ok.length} note{ok.length === 1 ? '' : 's'} added
            </b>
            <button
              className="it-link"
              onClick={() => {
                dismiss()
                go({ name: 'notebook', notebookId: job.notebookId, folderId: job.folderId })
              }}
            >
              View in {job.notebookId} →
            </button>
          </div>
          <button className="it-x" onClick={dismiss} aria-label="Dismiss">
            <Icon name="x" size={13} />
          </button>
        </>
      )}
    </div>
  )
}
