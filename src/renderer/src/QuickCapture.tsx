import { useEffect, useRef, useState } from 'react'

export function QuickCapture(): JSX.Element {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
    const off = window.solace.onCaptureReset(() => {
      setText('')
      setSaved(false)
      setError(null)
      setSaving(false)
      setTimeout(() => ref.current?.focus(), 20)
    })
    return off
  }, [])

  const submit = async (): Promise<void> => {
    const t = text.trim()
    if (!t || saving) return
    setSaving(true)
    setError(null)
    try {
      await window.solace.saveCapture(t)
      setSaved(true)
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setSaving(false)
    }
  }

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      window.solace.dismissCapture()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="qc" onKeyDown={onKey}>
      <div className="qc-bar">
        <span className="qc-dot" />
        <span className="qc-title">Quick note</span>
        <span className="qc-to">→ Inbox</span>
      </div>
      {saved ? (
        <div className="qc-done">
          <span className="qc-check">✓</span> Added to your Inbox
        </div>
      ) : (
        <textarea
          ref={ref}
          className="qc-input"
          value={text}
          placeholder="What's on your mind?"
          onChange={(e) => setText(e.target.value)}
          disabled={saving}
        />
      )}
      <div className="qc-foot">
        {error ? (
          <span className="qc-error">{error}</span>
        ) : (
          <span className="qc-hint">
            <kbd>⌘↵</kbd> save · <kbd>esc</kbd> close
          </span>
        )}
        <span className="qc-grow" />
        {!saved && (
          <button className="qc-save" onClick={submit} disabled={saving || !text.trim()}>
            {saving ? 'Saving…' : 'Add to Inbox'}
          </button>
        )}
      </div>
    </div>
  )
}
