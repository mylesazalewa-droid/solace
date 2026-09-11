import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import type { EditorView } from '@codemirror/view'

export interface SlashAction {
  label: string
  hint: string
  run: (view: EditorView) => void
}

export function insertAtLine(view: EditorView, text: string): void {
  const line = view.state.doc.lineAt(view.state.selection.main.head)
  const insert = line.text.trim() ? `${text}\n` : text
  const from = line.text.trim() ? line.to : line.from
  view.dispatch({
    changes: { from, insert },
    selection: { anchor: from + insert.length }
  })
  view.focus()
}

/** `/` at the start of a line opens a quick-insert menu. */
export function slashSource(getActions: () => SlashAction[]) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const before = ctx.matchBefore(/^\/(\w*)$/)
    if (!before) return null
    if (before.from === before.to && !ctx.explicit) return null
    const q = before.text.slice(1).toLowerCase()
    const scored = getActions()
      .map((a) => {
        const l = a.label.toLowerCase()
        let score = -1
        if (!q) score = 0
        else if (l.startsWith(q)) score = 3
        else if (l.includes(q)) score = 1
        return { a, score }
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)

    if (!scored.length) return null
    return {
      from: before.from,
      filter: false,
      options: scored.map(({ a }) => ({
        label: a.label,
        detail: a.hint,
        type: 'text',
        apply: (view, _completion, from, to) => {
          view.dispatch({ changes: { from, to, insert: '' } })
          a.run(view)
        }
      }))
    }
  }
}
