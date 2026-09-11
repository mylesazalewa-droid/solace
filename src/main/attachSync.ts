import { promises as fs, type Dirent } from 'fs'
import { join, relative, sep, dirname } from 'path'
import { createHash } from 'crypto'
import type { AttachInfo, AttachState } from '../shared/types'

// Firestore documents cap out around 1MiB; base64 inflates raw bytes by ~1.37x,
// plus room for the other fields on the doc. Keep well under that.
const MAX_SYNC_BYTES = 650 * 1024
const IGNORE = new Set(['.solace', '.git', '.obsidian', 'node_modules', '.trash'])
const STATE_FILE = (vault: string): string => join(vault, '.solace', 'attach-sync-state.json')

async function collect(vault: string, dir: string, notebookId: string, out: AttachInfo[]): Promise<void> {
  let entries: Dirent[] = []
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (!e.isFile()) continue
    const abs = join(dir, e.name)
    const [stat, buf] = await Promise.all([fs.stat(abs), fs.readFile(abs)])
    out.push({
      path: relative(vault, abs).split(sep).join('/'),
      notebookId,
      hash: createHash('sha1').update(buf).digest('hex'),
      size: stat.size,
      updated: stat.mtime.toISOString(),
      oversized: stat.size > MAX_SYNC_BYTES
    })
  }
}

/** Every file sitting in a `_attachments/` folder anywhere in the vault. */
export async function listAttachments(vault: string): Promise<AttachInfo[]> {
  const out: AttachInfo[] = []
  let notebooks: Dirent[] = []
  try {
    notebooks = await fs.readdir(vault, { withFileTypes: true })
  } catch {
    return out
  }
  for (const nb of notebooks) {
    if (!nb.isDirectory() || IGNORE.has(nb.name)) continue
    const nbPath = join(vault, nb.name)
    await collect(vault, join(nbPath, '_attachments'), nb.name, out)
    let subs: Dirent[] = []
    try {
      subs = await fs.readdir(nbPath, { withFileTypes: true })
    } catch {
      /* not a real problem — just no folders here */
    }
    for (const s of subs) {
      if (s.isDirectory() && s.name !== '_attachments') {
        await collect(vault, join(nbPath, s.name, '_attachments'), nb.name, out)
      }
    }
  }
  return out
}

function resolveInVault(vault: string, relPath: string): string {
  const abs = join(vault, relPath.split('/').join(sep))
  if (!abs.startsWith(vault)) throw new Error('Invalid attachment path')
  return abs
}

export async function readAttachmentBase64(vault: string, relPath: string): Promise<string> {
  return (await fs.readFile(resolveInVault(vault, relPath))).toString('base64')
}

export async function writeAttachmentBase64(
  vault: string,
  relPath: string,
  base64: string
): Promise<void> {
  const abs = resolveInVault(vault, relPath)
  await fs.mkdir(dirname(abs), { recursive: true })
  await fs.writeFile(abs, Buffer.from(base64, 'base64'))
}

export async function readAttachState(vault: string): Promise<AttachState> {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE(vault), 'utf8')) as AttachState
  } catch {
    return {}
  }
}

export async function writeAttachState(vault: string, state: AttachState): Promise<void> {
  await fs.mkdir(join(vault, '.solace'), { recursive: true })
  await fs.writeFile(STATE_FILE(vault), JSON.stringify(state, null, 2), 'utf8')
}
