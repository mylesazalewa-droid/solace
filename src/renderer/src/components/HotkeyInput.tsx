import { useState } from 'react'

function keyName(e: React.KeyboardEvent): string | null {
  const c = e.code
  if (/^Key([A-Z])$/.test(c)) return c.slice(3)
  if (/^Digit([0-9])$/.test(c)) return c.slice(5)
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(c)) return c
  if (/^Arrow(Up|Down|Left|Right)$/.test(c)) return c.slice(5)
  const map: Record<string, string> = {
    Space: 'Space',
    Enter: 'Return',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Escape: 'Escape',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Semicolon: ';',
    Quote: "'",
    Backquote: '`',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backslash: '\\'
  }
  return map[c] ?? null
}

export function toAccelerator(e: React.KeyboardEvent): string | null {
  const mods: string[] = []
  if (e.metaKey) mods.push('CommandOrControl')
  if (e.ctrlKey && !e.metaKey) mods.push('Control')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  const k = keyName(e)
  if (!k) return null
  if (!mods.some((m) => m !== 'Shift')) return null
  return [...mods, k].join('+')
}

const isMac = navigator.platform.toLowerCase().includes('mac')

export function prettyAccelerator(accel: string): string {
  if (!accel) return 'None'
  return accel
    .split('+')
    .map((p) => {
      if (p === 'CommandOrControl') return isMac ? '⌘' : 'Ctrl'
      if (p === 'Command' || p === 'Cmd' || p === 'Super') return isMac ? '⌘' : 'Win'
      if (p === 'Control') return isMac ? '⌃' : 'Ctrl'
      if (p === 'Alt' || p === 'Option') return isMac ? '⌥' : 'Alt'
      if (p === 'Shift') return '⇧'
      return p
    })
    .join(isMac ? '' : '+')
}

export function HotkeyInput({
  value,
  onChange
}: {
  value: string
  onChange: (accel: string) => void
}): JSX.Element {
  const [recording, setRecording] = useState(false)

  return (
    <div className="hk-row">
      <button
        type="button"
        className={`hk-field ${recording ? 'rec' : ''}`}
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={(e) => {
          if (!recording) return
          e.preventDefault()
          if (e.key === 'Escape') {
            setRecording(false)
            return
          }
          const accel = toAccelerator(e)
          if (accel) {
            onChange(accel)
            setRecording(false)
          }
        }}
      >
        {recording ? 'Press a key combination…' : prettyAccelerator(value)}
      </button>
      <button
        type="button"
        className="btn subtle sm"
        onClick={() => onChange('CommandOrControl+Shift+Space')}
      >
        Reset
      </button>
    </div>
  )
}
