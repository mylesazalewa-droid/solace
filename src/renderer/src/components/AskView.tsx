import { useEffect, useState } from 'react'
import { marked } from 'marked'
import { useStore } from '../store'
import { Rail } from './Rail'
import { Icon } from './Icon'
import type { AskAnswer, IndexStatus } from '../../../shared/types'

export function AskView(): JSX.Element {
  const go = useStore((s) => s.go)
  const [status, setStatus] = useState<IndexStatus | null>(null)
  const [building, setBuilding] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState<AskAnswer | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshStatus = (): void => {
    window.solace.embedStatus().then(setStatus).catch(() => setStatus(null))
  }

  useEffect(() => {
    refreshStatus()
    return window.solace.onEmbedProgress?.((p) => setProgress(p))
  }, [])

  const build = async (): Promise<void> => {
    setBuilding(true)
    setProgress(null)
    setError(null)
    try {
      const s = await window.solace.embedBuild()
      setStatus(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the index')
    } finally {
      setBuilding(false)
      setProgress(null)
    }
  }

  const ask = async (): Promise<void> => {
    const q = question.trim()
    if (!q || asking) return
    setAsking(true)
    setError(null)
    setAnswer(null)
    try {
      const res = await window.solace.askNotes(q)
      setAnswer(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get an answer')
    } finally {
      setAsking(false)
    }
  }

  const hasIndex = !!status && status.indexed > 0
  const stale = !!status && status.indexed < status.total

  return (
    <div className="cal-page">
      <Rail active="ask" />
      <div className="cal-main agenda-main ask-main">
        <div className="cal-top">
          <h2>Ask your notes</h2>
          {status && (
            <span className="nb-count">
              {status.indexed} of {status.total} notes indexed
            </span>
          )}
          <span className="grow" />
          <button className="btn subtle sm" onClick={build} disabled={building}>
            {building
              ? progress
                ? `Indexing ${progress.done}/${progress.total}…`
                : 'Indexing…'
              : hasIndex
                ? stale
                  ? 'Update index'
                  : 'Rebuild index'
                : 'Build index'}
          </button>
        </div>

        <div className="ask-body">
          {!hasIndex && !building ? (
            <div className="empty-state">
              <div className="es-big">Nothing indexed yet</div>
              Build a search index once, and you can ask things like “what have I said about
              rest?” and get an answer pulled from across your notes — not just keyword matches.
              Uses whichever helper you’ve set up in Settings (Ollama stays local and free;
              Gemini needs your API key).
            </div>
          ) : (
            <>
              <form
                className="ask-box"
                onSubmit={(e) => {
                  e.preventDefault()
                  void ask()
                }}
              >
                <Icon name="message" size={16} />
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question about your notes…"
                  disabled={asking}
                />
                <button className="btn accent sm" type="submit" disabled={asking || !question.trim()}>
                  {asking ? 'Thinking…' : 'Ask'}
                </button>
              </form>

              {error && <p className="export-error">{error}</p>}

              {answer && (
                <div className="ask-answer">
                  <div
                    className="ask-answer-text"
                    dangerouslySetInnerHTML={{ __html: marked.parse(answer.answer, { async: false }) as string }}
                  />
                  {answer.sources.length > 0 && (
                    <div className="ask-sources">
                      <div className="side-label">From these notes</div>
                      {answer.sources.map((s) => (
                        <button
                          key={s.noteId}
                          className="passage-note"
                          onClick={() => go({ name: 'note', noteId: s.noteId, backTo: { name: 'ask' } })}
                        >
                          <Icon name="note" size={14} />
                          <span className="passage-note-title">{s.title}</span>
                          <span className="pub-row-nb">{s.notebookId}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
