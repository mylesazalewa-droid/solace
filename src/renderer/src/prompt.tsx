import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'

interface Req {
  kind: 'text' | 'confirm'
  title: string
  label?: string
  initial?: string
  confirmText?: string
  placeholder?: string
  danger?: boolean
  resolve: (value: string | null) => void
}

interface PromptState {
  req: Req | null
}
const usePromptStore = create<PromptState>(() => ({ req: null }))

/** Promise-based text prompt — replaces window.prompt (disabled in Electron). */
export function askText(opts: {
  title: string
  label?: string
  initial?: string
  confirmText?: string
  placeholder?: string
}): Promise<string | null> {
  return new Promise((resolve) => {
    usePromptStore.setState({ req: { kind: 'text', ...opts, resolve } })
  })
}

/** Promise-based confirm dialog. Resolves 'ok' or null. */
export function askConfirm(opts: {
  title: string
  label?: string
  confirmText?: string
  danger?: boolean
}): Promise<'ok' | null> {
  return new Promise((resolve) => {
    usePromptStore.setState({
      req: { kind: 'confirm', ...opts, resolve: (v) => resolve(v ? 'ok' : null) }
    })
  })
}

export function PromptHost(): JSX.Element | null {
  const req = usePromptStore((s) => s.req)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!req) return
    setValue(req.initial ?? '')
    requestAnimationFrame(() => {
      if (req.kind === 'text') {
        inputRef.current?.focus()
        inputRef.current?.select()
      } else {
        okRef.current?.focus()
      }
    })
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        req.resolve(null)
        usePromptStore.setState({ req: null })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [req])

  if (!req) return null
  const isConfirm = req.kind === 'confirm'

  const close = (result: string | null): void => {
    req.resolve(result)
    usePromptStore.setState({ req: null })
  }
  const submit = (): void => {
    if (isConfirm) return close('ok')
    const v = value.trim()
    close(v ? v : null)
  }

  return (
    <div
      className="prompt-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close(null)
      }}
    >
      <div className="prompt-card" role="dialog" aria-modal="true" aria-label={req.title}>
        <h3>{req.title}</h3>
        {req.label && <p className="prompt-label">{req.label}</p>}
        {!isConfirm && (
          <input
            ref={inputRef}
            value={value}
            placeholder={req.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') close(null)
            }}
          />
        )}
        <div className="prompt-actions">
          <button className="btn ghost" onClick={() => close(null)}>
            Cancel
          </button>
          <button
            ref={okRef}
            className={`btn ${req.danger ? 'danger' : 'grass'}`}
            onClick={submit}
            disabled={!isConfirm && !value.trim()}
          >
            {req.confirmText ?? (isConfirm ? 'Confirm' : 'OK')}
          </button>
        </div>
      </div>
    </div>
  )
}
