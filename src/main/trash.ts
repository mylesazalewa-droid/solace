import { promises as fs, type Dirent } from 'fs'
import { join, sep } from 'path'
import matter from 'gray-matter'
import type { TrashItem } from '../shared/types'

const dir = (vault: string): string => join(vault, '.solace', 'trash')

const STAMP_RE = /^(\d{4}-\d\d-\d\d)T(\d\d)-(\d\d)-(\d\d)-(\d{3})Z__(.+)$/

function parseName(name: string): { deletedAt: string; path: string } | null {
  const m = name.match(STAMP_RE)
  if (!m) return null
  const [, d, h, mm, s, ms, flat] = m
  return { deletedAt: `${d}T${h}:${mm}:${s}.${ms}Z`, path: flat.split('__').join('/') }
}

async function previewOf(abs: string, isDir: boolean): Promise<{ title: string; blurb: string }> {
  if (isDir) {
    const md = await countMarkdown(abs)
    return { title: '', blurb: `${md} note${md === 1 ? '' : 's'}` }
  }
  try {
    const raw = await fs.readFile(abs, 'utf8')
    let title = ''
    let body = raw
    try {
      const p = matter(raw)
      title = String(p.data.title ?? '')
      body = p.content
    } catch {
      /* ignore */
    }
    return {
      title,
      blurb: body.replace(/[#>*_`\-[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)
    }
  } catch {
    return { title: '', blurb: '' }
  }
}

async function countMarkdown(root: string): Promise<number> {
  let n = 0
  const walk = async (d: string): Promise<void> => {
    let entries: Dirent[] = []
    try {
      entries = await fs.readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.isDirectory()) await walk(join(d, e.name))
      else if (e.name.toLowerCase().endsWith('.md')) n++
    }
  }
  await walk(root)
  return n
}

export async function listTrash(vault: string): Promise<TrashItem[]> {
  let entries: Dirent[] = []
  try {
    entries = await fs.readdir(dir(vault), { withFileTypes: true })
  } catch {
    return []
  }
  const out: TrashItem[] = []
  for (const e of entries) {
    const parsed = parseName(e.name)
    if (!parsed) continue
    const abs = join(dir(vault), e.name)
    const isDir = e.isDirectory()
    const isFolder = isDir && parsed.path.includes('/')
    const { title, blurb } = await previewOf(abs, isDir)
    const segs = parsed.path.split('/')
    out.push({
      id: e.name,
      deletedAt: parsed.deletedAt,
      originalPath: parsed.path,
      kind: !isDir ? 'note' : isFolder ? 'folder' : 'notebook',
      name: title || segs[segs.length - 1].replace(/\.md$/, '').replace(/-/g, ' '),
      blurb
    })
  }
  out.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
  return out
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/** move a trashed item back to its original place (suffixing if occupied) */
export async function restoreTrash(vault: string, id: string): Promise<void> {
  const parsed = parseName(id)
  if (!parsed) throw new Error('Unknown trash item')
  const from = join(dir(vault), id)
  let dest = join(vault, parsed.path.split('/').join(sep))
  if (await exists(dest)) {
    const isMd = dest.endsWith('.md')
    const base = isMd ? dest.slice(0, -3) : dest
    let n = 2
    while (await exists(isMd ? `${base}-${n}.md` : `${base} ${n}`)) n++
    dest = isMd ? `${base}-${n}.md` : `${base} ${n}`
  }
  await fs.mkdir(join(dest, '..'), { recursive: true })
  await fs.rename(from, dest)
}

export async function purgeTrash(vault: string, id: string): Promise<void> {
  if (!parseName(id)) throw new Error('Unknown trash item')
  await fs.rm(join(dir(vault), id), { recursive: true, force: true })
}

export async function emptyTrash(vault: string): Promise<void> {
  await fs.rm(dir(vault), { recursive: true, force: true })
  await fs.mkdir(dir(vault), { recursive: true })
}
