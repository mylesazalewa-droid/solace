import { promises as fs } from 'fs'
import { join } from 'path'
import { scanVault, createNotebook, createNote, readNoteById } from './vault'
import type { NoteDoc, VaultSnapshot } from '../shared/types'

const NOTEBOOK = 'Daily'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** local YYYY-MM-DD (not UTC — a daily note should match the user's calendar day) */
export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function prettyDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

const SCAFFOLD = (key: string): string =>
  `## ${prettyDate(key)}

## Today
- [ ]

## Notes


## Grateful for
-
`

/** Open (or create) the daily note for a date key like "2026-09-10". */
export async function openDaily(
  vault: string,
  key = todayKey()
): Promise<{ snapshot: VaultSnapshot; noteId: string }> {
  const snap = await scanVault(vault)
  if (!snap.notebooks.some((n) => n.id === NOTEBOOK)) {
    await createNotebook(vault, NOTEBOOK)
  }

  const wanted = `${NOTEBOOK}/${key}.md`
  const existing = snap.notes.find((n) => n.id === wanted)
  if (existing) {
    return { snapshot: snap, noteId: wanted }
  }

  // guard against a same-day file that got a slug suffix
  const abs = join(vault, NOTEBOOK, `${key}.md`)
  if (
    await fs
      .access(abs)
      .then(() => true)
      .catch(() => false)
  ) {
    return { snapshot: await scanVault(vault), noteId: wanted }
  }

  const doc = await createNote(vault, NOTEBOOK, null, key, SCAFFOLD(key))
  return { snapshot: await scanVault(vault), noteId: doc.id }
}

export async function readDaily(vault: string, key: string): Promise<NoteDoc | null> {
  try {
    return await readNoteById(vault, `${NOTEBOOK}/${key}.md`)
  } catch {
    return null
  }
}
