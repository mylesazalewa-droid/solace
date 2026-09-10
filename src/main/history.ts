import { promises as fs } from 'fs'
import { join, sep } from 'path'
import matter from 'gray-matter'
import { readNoteById, saveNote } from './vault'
import type { NoteDoc, HistoryEntry } from '../shared/types'

const KEEP = 40
const MIN_GAP_MS = 3 * 60 * 1000 // don't snapshot more than once per ~3 min of editing

function histDir(vault: string, noteId: string): string {
  return join(vault, '.solace', 'history', noteId.split('/').join('__'))
}

async function entries(dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir)
    return files.filter((f) => f.endsWith('.md')).sort() // ISO-ish names sort chronologically
  } catch {
    return []
  }
}

/** Copy the note's current on-disk content into history, unless we just did. */
export async function maybeSnapshot(vault: string, noteId: string, force = false): Promise<void> {
  const abs = join(vault, noteId.split('/').join(sep))
  let current: string
  try {
    current = await fs.readFile(abs, 'utf8')
  } catch {
    return // nothing to snapshot yet
  }
  const dir = histDir(vault, noteId)
  const existing = await entries(dir)

  if (existing.length) {
    const newest = existing[existing.length - 1]
    const prev = await fs.readFile(join(dir, newest), 'utf8').catch(() => '')
    if (prev === current) return
    if (!force) {
      const stamp = newest.replace('.md', '').replace(/_/g, ':')
      const age = Date.now() - Date.parse(stamp)
      if (!Number.isNaN(age) && age < MIN_GAP_MS) return
    }
  }

  await fs.mkdir(dir, { recursive: true })
  const name = new Date().toISOString().replace(/:/g, '_') + '.md'
  await fs.writeFile(join(dir, name), current, 'utf8')

  const after = await entries(dir)
  for (const old of after.slice(0, Math.max(0, after.length - KEEP))) {
    await fs.rm(join(dir, old)).catch(() => {})
  }
}

export async function listHistory(vault: string, noteId: string): Promise<HistoryEntry[]> {
  const dir = histDir(vault, noteId)
  const files = await entries(dir)
  const out: HistoryEntry[] = []
  for (const f of files) {
    const raw = await fs.readFile(join(dir, f), 'utf8').catch(() => '')
    if (!raw) continue
    let title = ''
    let body = raw
    try {
      const parsed = matter(raw)
      title = String(parsed.data.title ?? '')
      body = parsed.content
    } catch {
      /* use raw */
    }
    const at = f.replace('.md', '').replace(/_/g, ':')
    out.push({
      id: f,
      at,
      title,
      preview: body.replace(/[#>*_`-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140)
    })
  }
  return out.reverse() // newest first
}

export async function readHistory(
  vault: string,
  noteId: string,
  entryId: string
): Promise<{ title: string; body: string }> {
  const raw = await fs.readFile(join(histDir(vault, noteId), entryId), 'utf8')
  try {
    const parsed = matter(raw)
    return { title: String(parsed.data.title ?? ''), body: parsed.content.trim() }
  } catch {
    return { title: '', body: raw.trim() }
  }
}

export async function restoreHistory(
  vault: string,
  noteId: string,
  entryId: string
): Promise<NoteDoc> {
  await maybeSnapshot(vault, noteId, true) // keep the pre-restore state too
  const { title, body } = await readHistory(vault, noteId, entryId)
  const cur = await readNoteById(vault, noteId)
  return saveNote(vault, noteId, { title: title || cur.title, body })
}
