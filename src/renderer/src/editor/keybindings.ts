import { keymap, type EditorView } from '@codemirror/view'
import { wrapInline, toggleLinePrefix, insertLink, cycleHeading } from './format'

const run = (fn: (v: EditorView) => void) => (view: EditorView): boolean => {
  fn(view)
  return true
}

export const editorKeymap = keymap.of([
  { key: 'Mod-b', run: run((v) => wrapInline(v, '**')) },
  { key: 'Mod-i', run: run((v) => wrapInline(v, '*')) },
  { key: 'Mod-e', run: run((v) => wrapInline(v, '`')) },
  { key: 'Mod-k', run: run(insertLink) },
  { key: 'Mod-Alt-1', run: run(cycleHeading) },
  { key: 'Mod-Shift-8', run: run((v) => toggleLinePrefix(v, '- ')) },
  { key: 'Mod-Shift-9', run: run((v) => toggleLinePrefix(v, '- [ ] ')) },
  { key: 'Mod-Shift-.', run: run((v) => toggleLinePrefix(v, '> ')) }
])
