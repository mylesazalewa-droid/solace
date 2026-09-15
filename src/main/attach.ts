import { promises as fs } from 'fs'
import { join, sep, basename, extname } from 'path'

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg'
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])
const AUDIO_EXT = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'flac', 'webm', 'amr'])

export type AttachKind = 'image' | 'audio' | 'file'

function kindOf(ext: string): AttachKind {
  const e = ext.toLowerCase()
  if (IMAGE_EXT.has(e)) return 'image'
  if (AUDIO_EXT.has(e)) return 'audio'
  return 'file'
}

async function nextFreeName(dir: string, base: string, ext: string): Promise<string> {
  let name = `${base}.${ext}`
  let n = 2
  while (
    await fs
      .access(join(dir, name))
      .then(() => true)
      .catch(() => false)
  ) {
    name = `${base}-${n}.${ext}`
    n++
  }
  return name
}

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024 // 100 MB — generous local cap; sync has its own smaller one

/**
 * Copy one or more files picked from disk into `<notebook>/_attachments/` and
 * return what to insert in the markdown body for each.
 */
export async function attachFiles(
  vault: string,
  noteId: string,
  srcPaths: string[]
): Promise<{ markdownPath: string; name: string; kind: AttachKind }[]> {
  const parts = noteId.split('/')
  const notebook = parts[0]
  const inFolder = parts.length === 3
  const dir = join(vault, notebook, '_attachments')
  await fs.mkdir(dir, { recursive: true })

  const out: { markdownPath: string; name: string; kind: AttachKind }[] = []
  for (const src of srcPaths) {
    const stat = await fs.stat(src)
    if (stat.size > MAX_UPLOAD_BYTES) throw new Error(`${basename(src)} is too large (100 MB max)`)
    const ext = extname(src).slice(1) || 'bin'
    const base = basename(src, extname(src)).replace(/[^\w.-]+/g, '-').slice(0, 60) || 'file'
    const name = await nextFreeName(dir, base, ext)
    await fs.copyFile(src, join(dir, name))
    out.push({
      markdownPath: (inFolder ? '../' : '') + `_attachments/${name}`,
      name,
      kind: kindOf(ext)
    })
  }
  return out
}

/**
 * Save a pasted/dropped image into `<notebook>/_attachments/` and return the
 * path to use in the markdown link, relative to the note's own folder.
 */
export async function saveAttachment(
  vault: string,
  noteId: string,
  dataUrl: string
): Promise<{ markdownPath: string; name: string }> {
  const m = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/s)
  if (!m) throw new Error('Not an image')
  const mime = m[1]
  const ext = EXT[mime] ?? 'png'
  const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8')
  if (buf.length > 25 * 1024 * 1024) throw new Error('Image is too large (25 MB max)')

  const parts = noteId.split('/')
  const notebook = parts[0]
  const inFolder = parts.length === 3
  const dir = join(vault, notebook, '_attachments')
  await fs.mkdir(dir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  let name = `paste-${stamp}.${ext}`
  let n = 2
  while (
    await fs
      .access(join(dir, name))
      .then(() => true)
      .catch(() => false)
  ) {
    name = `paste-${stamp}-${n}.${ext}`
    n++
  }
  await fs.writeFile(join(dir, name), buf)

  const markdownPath = (inFolder ? '../' : '') + `_attachments/${name}`
  return { markdownPath, name }
}

const COVER_IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])
const MAX_COVER_BYTES = 15 * 1024 * 1024

/**
 * Copy a picked photo into `.solace/covers/` (synced) or `.solace/covers-local/`
 * (this device only — never scanned by attachment sync) for use as a notebook
 * cover. Returns the path relative to the vault root (not a note, so no "../" math).
 */
export async function saveCoverImage(
  vault: string,
  notebookId: string,
  srcPath: string,
  scope: 'all' | 'device' = 'all'
): Promise<string> {
  const ext = extname(srcPath).slice(1).toLowerCase()
  if (!COVER_IMAGE_EXT.has(ext)) throw new Error('Pick a PNG, JPEG, WebP, or GIF image.')
  const stat = await fs.stat(srcPath)
  if (stat.size > MAX_COVER_BYTES) throw new Error('That image is too large (15 MB max).')

  const folder = scope === 'device' ? 'covers-local' : 'covers'
  const dir = join(vault, '.solace', folder)
  await fs.mkdir(dir, { recursive: true })
  const base = notebookId.replace(/[^\w.-]+/g, '-').slice(0, 40) || 'cover'
  const stamp = Date.now().toString(36)
  const name = `${base}-${stamp}.${ext}`
  await fs.copyFile(srcPath, join(dir, name))
  return `.solace/${folder}/${name}`
}

/** Absolute filesystem dir a note lives in (for resolving relative image srcs in preview). */
export function noteDir(vault: string, noteId: string): string {
  const parts = noteId.split('/')
  return join(vault, ...parts.slice(0, -1)).split('/').join(sep)
}
