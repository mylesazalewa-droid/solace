import type { EditorView } from '@codemirror/view'
import { wrapInline, toggleLinePrefix, cycleHeading, insertLink } from '../editor/format'

const BTNS: { key: string; label: JSX.Element; title: string; run: (v: EditorView) => void }[] = [
  { key: 'b', title: 'Bold', label: <b>B</b>, run: (v) => wrapInline(v, '**') },
  { key: 'i', title: 'Italic', label: <i>i</i>, run: (v) => wrapInline(v, '*') },
  { key: 'h', title: 'Heading', label: <span>H</span>, run: cycleHeading },
  { key: 'ul', title: 'Bullet list', label: <span>•</span>, run: (v) => toggleLinePrefix(v, '- ') },
  {
    key: 'todo',
    title: 'Checkbox',
    label: <span>☑</span>,
    run: (v) => toggleLinePrefix(v, '- [ ] ')
  },
  { key: 'quote', title: 'Quote', label: <span>&ldquo;</span>, run: (v) => toggleLinePrefix(v, '> ') },
  { key: 'code', title: 'Code', label: <span className="fb-mono">{'<>'}</span>, run: (v) => wrapInline(v, '`') },
  { key: 'link', title: 'Link', label: <span>🔗</span>, run: insertLink }
]

export function FormatBar({
  view,
  onAttach
}: {
  view: EditorView | null
  onAttach?: () => void
}): JSX.Element {
  return (
    <div className="format-bar">
      {BTNS.map((b) => (
        <button
          key={b.key}
          className="fb-btn"
          title={b.title}
          onMouseDown={(e) => {
            e.preventDefault() // keep editor focus / selection
            if (view) b.run(view)
          }}
        >
          {b.label}
        </button>
      ))}
      {onAttach && (
        <button className="fb-btn" title="Attach a file" onMouseDown={(e) => e.preventDefault()} onClick={onAttach}>
          📎
        </button>
      )}
      <span className="fb-hint">
        Type <kbd>[[</kbd> to link a note, <kbd>/</kbd> for commands
      </span>
    </div>
  )
}
