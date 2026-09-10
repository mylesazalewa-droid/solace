import { promises as fs } from 'fs'
import { join } from 'path'
import { gunzipSync } from 'zlib'
import { app } from 'electron'
import { parseRefs, bookName } from '../shared/scripture'
import type { VerseRef, VerseText } from '../shared/types'

export { parseRefs, bookName }
export type Translation = 'kjv' | 'bbe'

type Bible = Record<string, string[][]> // bookIndex -> chapters -> verses
const cache: Partial<Record<Translation, Bible>> = {}

function bibleFile(t: Translation): string {
  const dev = join(app.getAppPath(), 'resources', 'bible', `${t}.json.gz`)
  const prod = join(process.resourcesPath, 'bible', `${t}.json.gz`)
  return app.isPackaged ? prod : dev
}

async function loadBible(t: Translation): Promise<Bible> {
  if (cache[t]) return cache[t] as Bible
  const gz = await fs.readFile(bibleFile(t))
  const json = JSON.parse(gunzipSync(gz).toString('utf8')) as Bible
  cache[t] = json
  return json
}

export async function lookup(ref: VerseRef, translation: Translation): Promise<VerseText> {
  const label =
    `${ref.bookName} ${ref.chapter}` +
    (ref.verse ? `:${ref.verse}${ref.endVerse ? `–${ref.endVerse}` : ''}` : '')
  try {
    const bible = await loadBible(translation)
    const chapters = bible[String(ref.book)]
    const chap = chapters?.[ref.chapter - 1]
    if (!chap)
      return { ref: ref.text, translation, reference: label, verses: [], error: 'Passage not found' }

    if (!ref.verse) {
      return {
        ref: ref.text,
        translation,
        reference: label,
        verses: chap.map((t, i) => ({ n: i + 1, text: t }))
      }
    }
    const end = ref.endVerse && ref.endVerse >= ref.verse ? ref.endVerse : ref.verse
    const verses: { n: number; text: string }[] = []
    for (let v = ref.verse; v <= end; v++) if (chap[v - 1]) verses.push({ n: v, text: chap[v - 1] })
    return { ref: ref.text, translation, reference: label, verses }
  } catch (e) {
    return {
      ref: ref.text,
      translation,
      reference: label,
      verses: [],
      error: e instanceof Error ? e.message : 'Lookup failed'
    }
  }
}
