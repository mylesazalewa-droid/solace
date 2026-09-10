import { useState } from 'react'
import { Icon } from './Icon'

interface Props {
  tags: string[]
  suggestions?: string[]
  onChange: (tags: string[]) => void
}

function clean(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 24)
}

export function TagEditor({ tags, suggestions = [], onChange }: Props): JSX.Element {
  const [input, setInput] = useState('')

  const add = (raw: string): void => {
    const t = clean(raw)
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInput('')
  }
  const remove = (t: string): void => onChange(tags.filter((x) => x !== t))

  const unused = suggestions.filter((s) => !tags.includes(s)).slice(0, 4)

  return (
    <div className="tag-editor">
      <Icon name="tag" size={15} className="te-ico" />
      {tags.map((t) => (
        <span key={t} className="te-chip">
          {t}
          <button onClick={() => remove(t)} aria-label={`Remove ${t}`}>
            <Icon name="x" size={11} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add(input)
          } else if (e.key === 'Backspace' && !input && tags.length) {
            remove(tags[tags.length - 1])
          }
        }}
        onBlur={() => input.trim() && add(input)}
        placeholder={tags.length ? 'Add tag…' : 'Add a tag…'}
      />
      {unused.length > 0 && (
        <span className="te-suggest">
          {unused.map((s) => (
            <button key={s} className="te-sug" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </span>
      )}
    </div>
  )
}
