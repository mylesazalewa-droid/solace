import { promises as fs } from 'fs'
import { join, sep } from 'path'

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg'
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

/** Absolute filesystem dir a note lives in (for resolving relative image srcs in preview). */
export function noteDir(vault: string, noteId: string): string {
  const parts = noteId.split('/')
  return join(vault, ...parts.slice(0, -1)).split('/').join(sep)
}
