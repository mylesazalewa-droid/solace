import { promises as fs } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { hostname } from 'os'
import { app } from 'electron'
import {
  scanVault,
  readNoteById,
  writeNoteFile,
  deleteNote,
  setNotebookCover
} from './vault'
import { listTemplates, saveTemplate } from './templates'
import type {
  SyncSnapshot,
  SyncNote,
  SyncApply,
  SyncState,
  VaultSnapshot,
  CoverSpec
} from '../shared/types'

const STATE_FILE = (vault: string): string => join(vault, '.solace', 'sync-state.json')
const NB_FILE = (vault: string): string => join(vault, '.solace', 'notebooks.json')
const TPL_FILE = (vault: string): string => join(vault, '.solace', 'templates.json')

export function deviceName(): string {
  return hostname().replace(/\.local$/, '')
}

export function hashNote(n: Omit<SyncNote, 'hash'>): string {
  const canon = JSON.stringify({
    t: n.title,
    c: n.created,
    b: n.body,
    g: [...n.tags].sort(),
    s: n.summary,
    p: !!n.pinned
  })
  return createHash('sha1').update(canon).digest('hex')
}

async function mtime(p: string): Promise<number> {
  try {
    return (await fs.stat(p)).mtimeMs
  } catch {
    return 0
  }
}

export async function buildSnapshot(vault: string): Promise<SyncSnapshot> {
  const snap = await scanVault(vault)
  const notes: SyncNote[] = []
  for (const s of snap.notes) {
    // skip attachments folder etc. — scanVault already only returns notes
    const doc = await readNoteById(vault, s.id)
    const base: Omit<SyncNote, 'hash'> = {
      path: s.id,
      title: doc.title,
      created: doc.created,
      updated: doc.updated,
      tags: doc.tags,
      summary: doc.summary,
      pinned: doc.pinned,
      body: doc.body
    }
    notes.push({ ...base, hash: hashNote(base) })
  }

  const notebooks: Record<string, CoverSpec> = {}
  for (const nb of snap.notebooks) notebooks[nb.id] = nb.cover

  const templates = (await listTemplates()).filter((t) => !t.builtin)

  const metaUpdated = new Date(
    Math.max(await mtime(NB_FILE(vault)), await mtime(TPL_FILE(vault)))
  ).toISOString()

  return { notes, notebooks, templates, metaUpdated, device: deviceName() }
}

function conflictPath(path: string, from: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return path.replace(/\.md$/, '') + ` (from ${from} ${stamp}).md`
}

export async function applyRemote(vault: string, apply: SyncApply): Promise<VaultSnapshot> {
  for (const w of apply.writes) {
    await writeNoteFile(vault, w.path, w.fields)
  }
  for (const c of apply.conflicts) {
    await writeNoteFile(vault, conflictPath(c.path, c.from), c.fields)
  }
  for (const path of apply.deletes) {
    await deleteNote(vault, path).catch(() => {})
  }

  if (apply.notebooks) {
    for (const [id, cover] of Object.entries(apply.notebooks)) {
      await setNotebookCover(vault, id, cover).catch(() => {})
    }
  }
  if (apply.templates) {
    for (const t of apply.templates) await saveTemplate(t).catch(() => {})
  }

  return scanVault(vault)
}

export async function readSyncState(vault: string): Promise<SyncState> {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE(vault), 'utf8')) as SyncState
  } catch {
    return {}
  }
}

export async function writeSyncState(vault: string, state: SyncState): Promise<void> {
  await fs.mkdir(join(vault, '.solace'), { recursive: true })
  await fs.writeFile(STATE_FILE(vault), JSON.stringify(state, null, 2), 'utf8')
}

/** Forget everything we think we've synced — the next sync re-reconciles from scratch. */
export async function clearSyncState(vault: string): Promise<void> {
  await fs.rm(STATE_FILE(vault)).catch(() => {})
}

// so a stale state file can be wiped for a clean re-sync
export function stateFileFor(vault: string): string {
  return STATE_FILE(vault)
}

export function userDataDir(): string {
  return app.getPath('userData')
}
