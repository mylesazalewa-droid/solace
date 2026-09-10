import { EditorSelection, type ChangeSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

/** wrap each selection in `before`…`after`; if already wrapped, unwrap */
export function wrapInline(view: EditorView, before: string, after = before): void {
  const { state } = view
  const tr = state.changeByRange((range) => {
    const inner = state.sliceDoc(range.from, range.to)
    const outerFrom = Math.max(0, range.from - before.length)
    const outerTo = Math.min(state.doc.length, range.to + after.length)
    const hasOuter =
      state.sliceDoc(outerFrom, range.from) === before &&
      state.sliceDoc(range.to, outerTo) === after

    if (hasOuter) {
      return {
        changes: [
          { from: outerFrom, to: range.from, insert: '' },
          { from: range.to, to: outerTo, insert: '' }
        ],
        range: EditorSelection.range(range.from - before.length, range.to - before.length)
      }
    }
    return {
      changes: [
        { from: range.from, insert: before },
        { from: range.to, insert: after }
      ],
      range: EditorSelection.range(
        range.from + before.length,
        range.to + before.length + (inner.length === 0 ? 0 : 0)
      )
    }
  })
  view.dispatch(tr, { scrollIntoView: true })
  view.focus()
}

/** toggle a line-start prefix (heading, quote, bullet, checkbox) across the selection */
export function toggleLinePrefix(view: EditorView, prefix: string, alt?: string): void {
  const { state } = view
  const changes: ChangeSpec[] = []
  const seen = new Set<number>()
  for (const range of state.selection.ranges) {
    let pos = range.from
    while (pos <= range.to) {
      const line = state.doc.lineAt(pos)
      if (!seen.has(line.number)) {
        seen.add(line.number)
        const text = line.text
        const stripped = text.replace(/^(\s*)(#{1,6}\s|>\s|[-*+]\s(?:\[[ xX]\]\s)?)?/, '$1')
        const already = text.startsWith(prefix)
        const insert = already ? stripped : prefix + stripped.replace(/^\s*/, '')
        changes.push({ from: line.from, to: line.to, insert })
        if (alt && !already && text.startsWith(alt)) {
          /* handled by stripped */
        }
      }
      if (line.to >= range.to) break
      pos = line.to + 1
    }
  }
  if (changes.length) {
    view.dispatch({ changes })
    view.focus()
  }
}

export function cycleHeading(view: EditorView): void {
  const line = view.state.doc.lineAt(view.state.selection.main.head)
  const m = line.text.match(/^(#{1,3})\s/)
  const level = m ? m[1].length : 0
  const next = level >= 3 ? '' : '#'.repeat(level + 1) + ' '
  const body = line.text.replace(/^#{1,6}\s*/, '')
  view.dispatch({ changes: { from: line.from, to: line.to, insert: next + body } })
  view.focus()
}

export function insertLink(view: EditorView): void {
  const { state } = view
  const r = state.selection.main
  const sel = state.sliceDoc(r.from, r.to)
  const text = sel || 'text'
  view.dispatch({
    changes: { from: r.from, to: r.to, insert: `[${text}](url)` },
    selection: sel
      ? { anchor: r.from + text.length + 3, head: r.from + text.length + 6 }
      : { anchor: r.from + 1, head: r.from + 1 + text.length }
  })
  view.focus()
}
