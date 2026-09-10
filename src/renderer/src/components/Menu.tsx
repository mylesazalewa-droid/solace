import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  trigger: (open: () => void, isOpen: boolean) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
}

/** A small popover menu with click-outside + Escape to close. */
export function Menu({ trigger, children, align = 'right' }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="nb-menu-wrap" ref={wrapRef}>
      {trigger(() => setOpen((v) => !v), open)}
      {open && (
        <div className="menu" style={align === 'left' ? { right: 'auto', left: 0 } : undefined}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
