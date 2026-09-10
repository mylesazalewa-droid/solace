import {
  autocompletion,
  completionKeymap,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import { keymap } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

/**
 * `[[` opens a picker of note titles. Selecting one inserts `[[Title]]`.
 * `getTitles` is read live so new notes show up without rebuilding the editor.
 */
export function wikiLinkComplete(getTitles: () => string[]): Extension {
  const source = (ctx: CompletionContext): CompletionResult | null => {
    const before = ctx.matchBefore(/\[\[([^[\]\n]*)$/)
    if (!before) return null
    if (before.from === before.to && !ctx.explicit) return null
    const q = before.text.slice(2).toLowerCase()
    const titles = getTitles()
    const scored = titles
      .map((t) => {
        const lt = t.toLowerCase()
        let score = -1
        if (!q) score = 0
        else if (lt.startsWith(q)) score = 3
        else if (lt.includes(q)) score = 1
        return { t, score }
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score || a.t.localeCompare(b.t))
      .slice(0, 10)

    if (!scored.length) return null
    return {
      from: before.from,
      filter: false,
      options: scored.map(({ t }) => ({
        label: t,
        type: 'text',
        apply: `[[${t}]]`
      }))
    }
  }

  return [
    autocompletion({
      override: [source],
      activateOnTyping: true,
      icons: false,
      aboveCursor: false
    }),
    keymap.of(completionKeymap)
  ]
}
