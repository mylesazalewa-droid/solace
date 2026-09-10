import { promises as fs } from 'fs'
import { join, relative, sep, basename, dirname, extname } from 'path'
import matter from 'gray-matter'
import yaml from 'js-yaml'
import type {
  VaultSnapshot,
  NotebookMeta,
  FolderMeta,
  NoteSummary,
  NoteDoc,
  CoverSpec,
  SearchHit
} from '../shared/types'

const IGNORE = new Set(['.solace', '.git', '.obsidian', 'node_modules', '.trash'])

const DEFAULT_COVERS: CoverSpec[] = [
  { style: 'arcs', c1: '#2f7d5b', c2: '#e9f2ec' },
  { style: 'stripe', c1: '#d99436', c2: '#f6e7cf' },
  { style: 'dots', c1: '#7367e8', c2: '#e6e2fb' },
  { style: 'arcs', c1: '#c15b3c', c2: '#f3ddd2' },
  { style: 'grid', c1: '#4c6b86', c2: '#d7e2ea' },
  { style: 'chev', c1: '#2c2f45', c2: '#e7e4d7' },
  { style: 'wash', c1: '#4b5bbf', c2: '#c9c2f4' },
  { style: 'dots', c1: '#3f9a72', c2: '#e4f1ea' }
]

function coverFor(index: number): CoverSpec {
  return DEFAULT_COVERS[index % DEFAULT_COVERS.length]
}

// ---------- paths ----------

function metaDir(vault: string): string {
  return join(vault, '.solace')
}

async function readNotebookCovers(vault: string): Promise<Record<string, CoverSpec>> {
  try {
    const raw = await fs.readFile(join(metaDir(vault), 'notebooks.json'), 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function writeNotebookCovers(vault: string, covers: Record<string, CoverSpec>): Promise<void> {
  await fs.mkdir(metaDir(vault), { recursive: true })
  await fs.writeFile(join(metaDir(vault), 'notebooks.json'), JSON.stringify(covers, null, 2), 'utf8')
}

async function readNotebookOrder(vault: string): Promise<string[]> {
  try {
    const raw = await fs.readFile(join(metaDir(vault), 'layout.json'), 'utf8')
    const o = (JSON.parse(raw) as { notebookOrder?: unknown }).notebookOrder
    return Array.isArray(o) ? o.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export async function setNotebookOrder(vault: string, ids: string[]): Promise<void> {
  await fs.mkdir(metaDir(vault), { recursive: true })
  await fs.writeFile(
    join(metaDir(vault), 'layout.json'),
    JSON.stringify({ notebookOrder: ids }, null, 2),
    'utf8'
  )
}

// ---------- slug / titles ----------

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/['’"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 80) || 'untitled'
  )
}

function titleFromBody(body: string, fallback: string): string {
  const h1 = body.match(/^\s*#\s+(.+)$/m)
  if (h1) return h1[1].trim()
  const firstLine = body.split('\n').map((l) => l.trim()).find(Boolean)
  return firstLine ? firstLine.replace(/^#+\s*/, '').slice(0, 120) : fallback
}

function excerptFromBody(body: string): string {
  return body
    .replace(/^#.*$/gm, '')
    .replace(/[*_`>#\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

// ---------- scanning ----------

async function listDirs(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !IGNORE.has(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))
}

async function listMarkdown(dir: string): Promise<string[]> {
  let entries: import('fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isFile() && extname(e.name).toLowerCase() === '.md' && !e.name.startsWith('.'))
    .map((e) => e.name)
}

async function readNote(
  vault: string,
  absPath: string,
  notebookId: string,
  folderId: string | null
): Promise<NoteDoc> {
  const raw = await fs.readFile(absPath, 'utf8')
  const stat = await fs.stat(absPath)
  let parsed: { data: Record<string, unknown>; content: string }
  try {
    const m = matter(raw)
    parsed = { data: m.data as Record<string, unknown>, content: m.content }
  } catch {
    // malformed / unparseable frontmatter — recover by hand rather than crash
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
    let data: Record<string, unknown> = {}
    if (fm) {
      try {
        data = (yaml.load(fm[1]) as Record<string, unknown>) ?? {}
      } catch {
        data = {}
      }
    }
    parsed = { data, content: fm ? fm[2] : raw }
  }
  const data = parsed.data
  const body = parsed.content.replace(/^\n+/, '')
  const fileTitle = basename(absPath, '.md').replace(/-/g, ' ')
  const title =
    typeof data.title === 'string' && data.title.trim()
      ? data.title.trim()
      : titleFromBody(body, fileTitle)
  const tags = Array.isArray(data.tags)
    ? (data.tags as unknown[]).map(String)
    : typeof data.tags === 'string'
      ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : []
  const id = relative(vault, absPath).split(sep).join('/')
  const links = [...body.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g)].map((m) => m[1].trim())
  return {
    id,
    notebookId,
    folderId,
    title,
    summary: typeof data.summary === 'string' ? data.summary : '',
    tags,
    pinned: data.pinned === true,
    created: typeof data.created === 'string' ? data.created : stat.birthtime.toISOString(),
    updated: typeof data.updated === 'string' ? data.updated : stat.mtime.toISOString(),
    excerpt: excerptFromBody(body),
    links: [...new Set(links)],
    body
  }
}

export async function scanVault(vault: string): Promise<VaultSnapshot> {
  const covers = await readNotebookCovers(vault)
  let coversDirty = false
  const notebooks: NotebookMeta[] = []
  const notes: NoteSummary[] = []

  const notebookNames = await listDirs(vault)

  for (let i = 0; i < notebookNames.length; i++) {
    const nbName = notebookNames[i]
    const nbPath = join(vault, nbName)
    const nbId = nbName

    if (!covers[nbId]) {
      covers[nbId] = coverFor(i)
      coversDirty = true
    }

    const folders: FolderMeta[] = []
    let nbNoteCount = 0

    // notes directly in the notebook (folderId = null)
    for (const file of await listMarkdown(nbPath)) {
      const doc = await readNote(vault, join(nbPath, file), nbId, null)
      notes.push(stripBody(doc))
      nbNoteCount++
    }

    // one level of subfolders = folders / series
    for (const folderName of await listDirs(nbPath)) {
      const folderPath = join(nbPath, folderName)
      const folderId = folderName
      let count = 0
      for (const file of await listMarkdown(folderPath)) {
        const doc = await readNote(vault, join(folderPath, file), nbId, folderId)
        notes.push(stripBody(doc))
        count++
      }
      folders.push({ id: folderId, name: folderName, noteCount: count })
      nbNoteCount += count
    }

    notebooks.push({
      id: nbId,
      name: nbName,
      cover: covers[nbId],
      noteCount: nbNoteCount,
      folders
    })
  }

  if (coversDirty) await writeNotebookCovers(vault, covers)

  // apply the user's shelf order; unknown / new notebooks fall to the end (alpha)
  const order = await readNotebookOrder(vault)
  if (order.length) {
    const rank = new Map(order.map((id, i) => [id, i]))
    notebooks.sort((a, b) => {
      const ra = rank.has(a.id) ? (rank.get(a.id) as number) : Number.MAX_SAFE_INTEGER
      const rb = rank.has(b.id) ? (rank.get(b.id) as number) : Number.MAX_SAFE_INTEGER
      return ra - rb || a.name.localeCompare(b.name)
    })
  }

  return { path: vault, notebooks, notes }
}

function stripBody(doc: NoteDoc): NoteSummary {
  const { body: _body, ...summary } = doc
  return summary
}

// ---------- read / write ----------

export async function readNoteById(vault: string, noteId: string): Promise<NoteDoc> {
  const abs = join(vault, noteId.split('/').join(sep))
  const parts = noteId.split('/')
  const notebookId = parts[0]
  const folderId = parts.length === 3 ? parts[1] : null
  return readNote(vault, abs, notebookId, folderId)
}

function serialize(
  doc: Partial<NoteDoc> & { body: string; title: string },
  keepUpdated = false
): string {
  const fm: Record<string, unknown> = {
    title: doc.title,
    created: doc.created ?? new Date().toISOString(),
    updated: keepUpdated && doc.updated ? doc.updated : new Date().toISOString()
  }
  if (doc.summary) fm.summary = doc.summary
  if (doc.tags && doc.tags.length) fm.tags = doc.tags
  if (doc.pinned) fm.pinned = true

  // Build the file by hand. matter.stringify() re-parses the body string looking
  // for frontmatter, which corrupts (and can throw on) notes whose body starts
  // with a "---" divider — very common in imported documents.
  const front = yaml.dump(fm, { lineWidth: -1, noRefs: true }).trimEnd()
  const body = doc.body.replace(/^﻿/, '').replace(/^\s*\n/, '').replace(/\s+$/, '')
  return `---\n${front}\n---\n\n${body}\n`
}

export async function saveNote(
  vault: string,
  noteId: string,
  patch: { body?: string; title?: string; summary?: string; tags?: string[]; pinned?: boolean }
): Promise<NoteDoc> {
  const existing = await readNoteById(vault, noteId)
  const merged = { ...existing, ...patch }
  const abs = join(vault, noteId.split('/').join(sep))
  await fs.writeFile(abs, serialize(merged), 'utf8')
  return readNoteById(vault, noteId)
}

/** Write a note file at an exact vault-relative path (used by the sync layer). */
export async function writeNoteFile(
  vault: string,
  relPath: string,
  fields: {
    title: string
    body: string
    created?: string
    updated?: string
    tags?: string[]
    summary?: string
    pinned?: boolean
  }
): Promise<void> {
  const abs = join(vault, relPath.split('/').join(sep))
  await fs.mkdir(dirname(abs), { recursive: true })
  await fs.writeFile(abs, serialize({ ...fields }, true), 'utf8')
}

export async function createNote(
  vault: string,
  notebookId: string,
  folderId: string | null,
  title: string,
  body = ''
): Promise<NoteDoc> {
  const dir = folderId ? join(vault, notebookId, folderId) : join(vault, notebookId)
  await fs.mkdir(dir, { recursive: true })
  let name = slugify(title)
  let abs = join(dir, `${name}.md`)
  let n = 2
  // avoid clobbering
  while (await exists(abs)) {
    abs = join(dir, `${name}-${n}.md`)
    n++
  }
  const now = new Date().toISOString()
  const doc = {
    title: title || 'Untitled note',
    body,
    created: now,
    updated: now,
    tags: [] as string[]
  }
  await fs.writeFile(abs, serialize(doc), 'utf8')
  const id = relative(vault, abs).split(sep).join('/')
  return readNoteById(vault, id)
}

function safeName(name: string): string {
  const clean = name.trim().replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
  if (!clean || clean === '.' || clean === '..') throw new Error('Invalid name')
  return clean
}

export async function createNotebook(vault: string, name: string): Promise<void> {
  const dir = join(vault, safeName(name))
  if (await exists(dir)) throw new Error('A notebook with that name already exists')
  await fs.mkdir(dir, { recursive: true })
}

export async function createFolder(
  vault: string,
  notebookId: string,
  name: string
): Promise<void> {
  const dir = join(vault, notebookId, safeName(name))
  if (await exists(dir)) throw new Error('A folder with that name already exists')
  await fs.mkdir(dir, { recursive: true })
}

export async function renameNotebook(
  vault: string,
  notebookId: string,
  newName: string
): Promise<void> {
  const next = safeName(newName)
  if (next === notebookId) return
  const from = join(vault, notebookId)
  const to = join(vault, next)
  if (await exists(to)) throw new Error('A notebook with that name already exists')
  await fs.rename(from, to)
  // carry the cover over
  const covers = await readNotebookCovers(vault)
  if (covers[notebookId]) {
    covers[next] = covers[notebookId]
    delete covers[notebookId]
    await writeNotebookCovers(vault, covers)
  }
  // keep its place on the shelf
  const order = await readNotebookOrder(vault)
  const at = order.indexOf(notebookId)
  if (at !== -1) {
    order[at] = next
    await setNotebookOrder(vault, order)
  }
}

export async function renameFolder(
  vault: string,
  notebookId: string,
  folderId: string,
  newName: string
): Promise<void> {
  const next = safeName(newName)
  if (next === folderId) return
  const from = join(vault, notebookId, folderId)
  const to = join(vault, notebookId, next)
  if (await exists(to)) throw new Error('A folder with that name already exists')
  await fs.rename(from, to)
}

export async function setNotebookCover(
  vault: string,
  notebookId: string,
  cover: CoverSpec
): Promise<void> {
  const covers = await readNotebookCovers(vault)
  covers[notebookId] = cover
  await writeNotebookCovers(vault, covers)
}

// ---------- soft delete (move to .trash, never destroy) ----------

async function trashPath(vault: string, originalRelPath: string): Promise<string> {
  const trash = join(metaDir(vault), 'trash')
  await fs.mkdir(trash, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const flat = originalRelPath.split('/').join('__')
  return join(trash, `${stamp}__${flat}`)
}

export async function deleteNote(vault: string, noteId: string): Promise<void> {
  const abs = join(vault, noteId.split('/').join(sep))
  await fs.rename(abs, await trashPath(vault, noteId))
}

export async function deleteNotebook(vault: string, notebookId: string): Promise<void> {
  const abs = join(vault, safeName(notebookId))
  await fs.rename(abs, await trashPath(vault, notebookId))
  const covers = await readNotebookCovers(vault)
  if (covers[notebookId]) {
    delete covers[notebookId]
    await writeNotebookCovers(vault, covers)
  }
}

export async function deleteFolder(
  vault: string,
  notebookId: string,
  folderId: string
): Promise<void> {
  const abs = join(vault, notebookId, folderId)
  await fs.rename(abs, await trashPath(vault, `${notebookId}/${folderId}`))
}

export async function moveNote(
  vault: string,
  noteId: string,
  toNotebook: string,
  toFolder: string | null
): Promise<string> {
  const from = join(vault, noteId.split('/').join(sep))
  const destDir = toFolder ? join(vault, toNotebook, toFolder) : join(vault, toNotebook)
  await fs.mkdir(destDir, { recursive: true })
  let name = basename(from)
  let to = join(destDir, name)
  let n = 2
  while (await exists(to)) {
    to = join(destDir, `${basename(name, '.md')}-${n}.md`)
    n++
  }
  if (from === to) return noteId
  await fs.rename(from, to)
  return relative(vault, to).split(sep).join('/')
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

// ---------- search (simple substring index; FTS comes in a later stage) ----------

export async function searchVault(vault: string, query: string): Promise<SearchHit[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const terms = q.split(/\s+/).filter(Boolean)
  const { notes } = await scanVault(vault)

  const scored: { note: NoteSummary; snippet: string; score: number }[] = []
  for (const note of notes) {
    const doc = await readNoteById(vault, note.id)
    const title = doc.title.toLowerCase()
    const tags = doc.tags.join(' ').toLowerCase()
    const summary = doc.summary.toLowerCase()
    const body = doc.body.toLowerCase()

    let score = 0
    let matchedAll = true
    for (const t of terms) {
      let s = 0
      if (title === t) s += 200
      else if (title.startsWith(t)) s += 80
      else if (title.includes(t)) s += 40
      if (tags.split(/\s+/).includes(t)) s += 30
      else if (tags.includes(t)) s += 15
      if (summary.includes(t)) s += 12
      const bodyHits = body.split(t).length - 1
      s += Math.min(bodyHits, 6) * 4
      if (s === 0) matchedAll = false
      score += s
    }
    // whole-phrase bonus
    if (terms.length > 1 && `${title}\n${summary}\n${body}`.includes(q)) score += 25
    if (!matchedAll || score === 0) continue

    if (doc.pinned) score += 8
    scored.push({ note, snippet: makeSnippet(`${doc.title} — ${doc.summary} ${doc.body}`, terms[0]), score })
  }

  scored.sort((a, b) => b.score - a.score || b.note.updated.localeCompare(a.note.updated))
  return scored.slice(0, 50).map(({ note, snippet }) => ({ note, snippet }))
}

function makeSnippet(text: string, term: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const idx = flat.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return flat.slice(0, 160)
  const start = Math.max(0, idx - 60)
  const end = Math.min(flat.length, idx + term.length + 90)
  const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return (
    (start > 0 ? '… ' : '') +
    esc(flat.slice(start, idx)) +
    '<mark>' +
    esc(flat.slice(idx, idx + term.length)) +
    '</mark>' +
    esc(flat.slice(idx + term.length, end)) +
    (end < flat.length ? ' …' : '')
  )
}

// ---------- seeding a fresh vault with examples ----------

export async function seedVault(vault: string): Promise<void> {
  const mk = async (nb: string, folder: string | null, title: string, body: string): Promise<void> => {
    const dir = folder ? join(vault, nb, folder) : join(vault, nb)
    await fs.mkdir(dir, { recursive: true })
    const now = new Date().toISOString()
    await fs.writeFile(
      join(dir, `${slugify(title)}.md`),
      serialize({ title, body, created: now, updated: now, tags: [] }),
      'utf8'
    )
  }

  await mk(
    'Sermon Prep',
    'Rest & Sabbath',
    'The weight of rest',
    `The disciples had just come back from being sent out — they hadn't even had time to eat. Jesus tells them, "Come away by yourselves and rest a while." He doesn't praise how busy they've been. He pulls them out of it.\n\nRest here isn't a reward for finished work. The work *wasn't* finished — the crowds were still coming. It's a rhythm you keep while things are unfinished, or you never keep it at all.\n\nConnects to [[Margin — the room between load and limit]].`
  )
  await mk(
    'Sermon Prep',
    'Rest & Sabbath',
    '"Come away" — sermon outline',
    `## Passage\nMark 6:30–34\n\n## Big idea\nRest is a rhythm we keep *while* the work is unfinished.\n\n## Outline\n1. The invitation to rest\n2. The interruption by the crowd\n3. The compassion that teaches them anyway\n\n## Application\nWhere is the "desolate place" this week?`
  )
  await mk(
    'Sermon Prep',
    null,
    'Greek note — anapausis',
    `The word for "rest" in Matthew 11:28. Carries the sense of stopping to recover strength — an intermission, not just sleep.`
  )
  await mk(
    'Journal',
    null,
    'Morning pages',
    `Slept badly. Thinking about the fall calendar and whether we've built any margin into it at all. Note to self: block a real day off before Advent.`
  )
  await mk(
    'Ideas',
    null,
    'Song idea in the car',
    `A slow 6/8 thing. "The seed that dies is the seed that grows." Chorus could lean on the John 12 image.`
  )
  await mk(
    'Reading',
    'Theology',
    'Margin — the room between load and limit',
    `Swenson's idea of margin: the space between your load and your limit. You need some, and most of us have spent it. Pairs with [[The weight of rest]].`
  )
}
