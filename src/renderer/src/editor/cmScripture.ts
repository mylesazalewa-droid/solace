import { ViewPlugin, Decoration, type DecorationSet, type EditorView, ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { parseRefs } from '../../../shared/scripture'
import { showVerse } from './versePopover'

const mark = Decoration.mark({ class: 'cm-verse-ref' })

/** Underline Bible references in the editor; click one for the verse card. */
export function cmScripture(getTranslation: () => 'kjv' | 'bbe') {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = build(view)
      }
      update(u: ViewUpdate): void {
        if (u.docChanged || u.viewportChanged) this.decorations = build(u.view)
      }
    },
    {
      decorations: (v) => v.decorations,
      eventHandlers: {
        mousedown(e, view) {
          const target = e.target as HTMLElement
          if (!target.classList.contains('cm-verse-ref')) return false
          const pos = view.posAtDOM(target)
          const line = view.state.doc.lineAt(pos)
          const refs = parseRefs(line.text)
          // pick the ref whose span covers this position
          let acc = line.from
          for (const r of refs) {
            const at = line.text.indexOf(r.text, acc - line.from)
            if (at < 0) continue
            const from = line.from + at
            const to = from + r.text.length
            if (pos >= from && pos <= to) {
              e.preventDefault()
              void showVerse(r, target.getBoundingClientRect(), getTranslation, true)
              return true
            }
            acc = to
          }
          return false
        }
      }
    }
  )
}

function build(view: EditorView): DecorationSet {
  const b = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos)
      if (/\d/.test(line.text)) {
        const refs = parseRefs(line.text)
        let acc = 0
        for (const r of refs) {
          const at = line.text.indexOf(r.text, acc)
          if (at < 0) continue
          b.add(line.from + at, line.from + at + r.text.length, mark)
          acc = at + r.text.length
        }
      }
      pos = line.to + 1
    }
  }
  return b.finish()
}
