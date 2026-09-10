// Pure Bible-reference parser — shared by main and renderer (no Node/Electron deps).
import type { VerseRef } from './types'

const BOOKS: { name: string; abbr: string[] }[] = [
  { name: 'Genesis', abbr: ['gen', 'ge', 'gn'] },
  { name: 'Exodus', abbr: ['exod', 'exo', 'ex'] },
  { name: 'Leviticus', abbr: ['lev', 'le', 'lv'] },
  { name: 'Numbers', abbr: ['num', 'nu', 'nm', 'nb'] },
  { name: 'Deuteronomy', abbr: ['deut', 'de', 'dt'] },
  { name: 'Joshua', abbr: ['josh', 'jos', 'jsh'] },
  { name: 'Judges', abbr: ['judg', 'jdg', 'jg', 'jdgs'] },
  { name: 'Ruth', abbr: ['rth', 'ru'] },
  { name: '1 Samuel', abbr: ['1sam', '1 sam', '1sa', '1 sm', 'i sam', '1st samuel'] },
  { name: '2 Samuel', abbr: ['2sam', '2 sam', '2sa', '2 sm', 'ii sam'] },
  { name: '1 Kings', abbr: ['1kgs', '1 kgs', '1ki', '1 kin', 'i kings'] },
  { name: '2 Kings', abbr: ['2kgs', '2 kgs', '2ki', '2 kin', 'ii kings'] },
  { name: '1 Chronicles', abbr: ['1chr', '1 chr', '1ch', '1 chron'] },
  { name: '2 Chronicles', abbr: ['2chr', '2 chr', '2ch', '2 chron'] },
  { name: 'Ezra', abbr: ['ezr', 'ez'] },
  { name: 'Nehemiah', abbr: ['neh', 'ne'] },
  { name: 'Esther', abbr: ['esth', 'est', 'es'] },
  { name: 'Job', abbr: ['jb'] },
  { name: 'Psalms', abbr: ['psalm', 'psa', 'ps', 'pss', 'pslm'] },
  { name: 'Proverbs', abbr: ['prov', 'pro', 'prv', 'pr'] },
  { name: 'Ecclesiastes', abbr: ['eccl', 'ecc', 'ec', 'qoh'] },
  { name: 'Song of Solomon', abbr: ['song', 'song of songs', 'sos', 'so', 'canticles', 'cant'] },
  { name: 'Isaiah', abbr: ['isa', 'is'] },
  { name: 'Jeremiah', abbr: ['jer', 'je', 'jr'] },
  { name: 'Lamentations', abbr: ['lam', 'la'] },
  { name: 'Ezekiel', abbr: ['ezek', 'eze', 'ezk'] },
  { name: 'Daniel', abbr: ['dan', 'da', 'dn'] },
  { name: 'Hosea', abbr: ['hos', 'ho'] },
  { name: 'Joel', abbr: ['jl', 'joe'] },
  { name: 'Amos', abbr: ['am', 'amo'] },
  { name: 'Obadiah', abbr: ['obad', 'ob'] },
  { name: 'Jonah', abbr: ['jonah', 'jnh', 'jon'] },
  { name: 'Micah', abbr: ['mic', 'mc'] },
  { name: 'Nahum', abbr: ['nah', 'na'] },
  { name: 'Habakkuk', abbr: ['hab', 'hb'] },
  { name: 'Zephaniah', abbr: ['zeph', 'zep', 'zp'] },
  { name: 'Haggai', abbr: ['hag', 'hg'] },
  { name: 'Zechariah', abbr: ['zech', 'zec', 'zc'] },
  { name: 'Malachi', abbr: ['mal', 'ml'] },
  { name: 'Matthew', abbr: ['matt', 'mat', 'mt'] },
  { name: 'Mark', abbr: ['mrk', 'mar', 'mk', 'mr'] },
  { name: 'Luke', abbr: ['luk', 'lk'] },
  { name: 'John', abbr: ['joh', 'jhn', 'jn'] },
  { name: 'Acts', abbr: ['act', 'ac'] },
  { name: 'Romans', abbr: ['rom', 'ro', 'rm'] },
  { name: '1 Corinthians', abbr: ['1cor', '1 cor', '1co', 'i cor'] },
  { name: '2 Corinthians', abbr: ['2cor', '2 cor', '2co', 'ii cor'] },
  { name: 'Galatians', abbr: ['gal', 'ga'] },
  { name: 'Ephesians', abbr: ['eph', 'ephes'] },
  { name: 'Philippians', abbr: ['phil', 'php', 'pp'] },
  { name: 'Colossians', abbr: ['col', 'co'] },
  { name: '1 Thessalonians', abbr: ['1thess', '1 thess', '1th', '1 thes'] },
  { name: '2 Thessalonians', abbr: ['2thess', '2 thess', '2th', '2 thes'] },
  { name: '1 Timothy', abbr: ['1tim', '1 tim', '1ti'] },
  { name: '2 Timothy', abbr: ['2tim', '2 tim', '2ti'] },
  { name: 'Titus', abbr: ['tit', 'ti'] },
  { name: 'Philemon', abbr: ['philem', 'phm', 'pm'] },
  { name: 'Hebrews', abbr: ['heb', 'hbr'] },
  { name: 'James', abbr: ['jas', 'jm'] },
  { name: '1 Peter', abbr: ['1pet', '1 pet', '1pe', '1 pt', 'i pet'] },
  { name: '2 Peter', abbr: ['2pet', '2 pet', '2pe', '2 pt', 'ii pet'] },
  { name: '1 John', abbr: ['1john', '1 john', '1jn', '1 jn', '1jo', 'i john'] },
  { name: '2 John', abbr: ['2john', '2 john', '2jn', '2 jn', '2jo', 'ii john'] },
  { name: '3 John', abbr: ['3john', '3 john', '3jn', '3 jn', '3jo', 'iii john'] },
  { name: 'Jude', abbr: ['jud', 'jde'] },
  { name: 'Revelation', abbr: ['rev', 're', 'rv', 'the revelation', 'apocalypse'] }
]

export function bookName(i: number): string {
  return BOOKS[i]?.name ?? ''
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
}

// longest names first so "1 John" wins over "John"
const NAME_ALTS: { i: number; re: string }[] = BOOKS.flatMap((b, i) =>
  [b.name, ...b.abbr].map((s) => ({ i, re: esc(s) + '\\.?' }))
).sort((a, b) => b.re.length - a.re.length)

const REF_RE = new RegExp(
  `\\b(${NAME_ALTS.map((x) => x.re).join('|')})\\s+` +
    `(\\d{1,3})` +
    `(?::(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?)?`,
  'gi'
)

function resolveBook(matched: string): number {
  const norm = matched.toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ').trim()
  for (const b of BOOKS) {
    if (b.name.toLowerCase() === norm) return BOOKS.indexOf(b)
  }
  for (let i = 0; i < BOOKS.length; i++) {
    const b = BOOKS[i]
    if ([b.name.toLowerCase(), ...b.abbr].some((a) => a.replace(/\s+/g, ' ') === norm)) return i
  }
  // loose: strip spaces
  const tight = norm.replace(/\s+/g, '')
  for (let i = 0; i < BOOKS.length; i++) {
    const b = BOOKS[i]
    if (
      [b.name, ...b.abbr].some((a) => a.toLowerCase().replace(/\s+/g, '') === tight)
    )
      return i
  }
  return -1
}

export function parseRefs(text: string): VerseRef[] {
  const out: VerseRef[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  REF_RE.lastIndex = 0
  while ((m = REF_RE.exec(text))) {
    const book = resolveBook(m[1])
    if (book < 0) continue
    const chapter = parseInt(m[2], 10)
    const verse = m[3] ? parseInt(m[3], 10) : null
    const endVerse = m[4] ? parseInt(m[4], 10) : null
    const key = `${book}.${chapter}.${verse}.${endVerse}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      text: m[0],
      book,
      bookName: BOOKS[book].name,
      chapter,
      verse,
      endVerse
    })
  }
  return out
}
