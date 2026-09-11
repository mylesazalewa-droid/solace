import { autocompletion, completionKeymap, type CompletionSource } from '@codemirror/autocomplete'
import { keymap } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

/**
 * CodeMirror only allows one `autocompletion()` config per editor — a second
 * call throws "Config merge conflict for field override" — so every trigger
 * ([[ wiki links, / commands, …) has to share this single instance.
 */
export function editorCompletion(sources: CompletionSource[]): Extension {
  return [
    autocompletion({ override: sources, activateOnTyping: true, icons: false, aboveCursor: false }),
    keymap.of(completionKeymap)
  ]
}
