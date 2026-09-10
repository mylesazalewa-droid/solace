import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase'

export interface Note {
  id: string // firestore doc id (base64url of path)
  path: string
  notebook: string
  folder: string | null
  title: string
  created: string
  updated: string
  tags: string[]
  summary: string
  pinned: boolean
  body: string
  rev: number
}

export interface Cover {
  style: string
  c1: string
  c2: string
}

const DEVICE = 'web'

export function encId(path: string): string {
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(path)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60) || 'untitled'
  )
}

// must match src/main/sync.ts hashNote()
export async function hashNote(n: {
  title: string
  created: string
  body: string
  tags: string[]
  summary: string
  pinned: boolean
}): Promise<string> {
  const canon = JSON.stringify({
    t: n.title,
    c: n.created,
    b: n.body,
    g: [...n.tags].sort(),
    s: n.summary,
    p: !!n.pinned
  })
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(canon))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function parsePath(path: string): { notebook: string; folder: string | null } {
  const parts = path.split('/')
  return { notebook: parts[0], folder: parts.length === 3 ? parts[1] : null }
}

function toNote(id: string, d: Record<string, unknown>): Note | null {
  if (d.deleted) return null
  const path = String(d.path ?? '')
  if (!path) return null
  const { notebook, folder } = parsePath(path)
  return {
    id,
    path,
    notebook,
    folder,
    title: String(d.title ?? 'Untitled note'),
    created: String(d.created ?? new Date().toISOString()),
    updated: String(d.updated ?? new Date().toISOString()),
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    summary: String(d.summary ?? ''),
    pinned: !!d.pinned,
    body: String(d.body ?? ''),
    rev: Number(d.rev ?? 0)
  }
}

export function watchNotes(uid: string, cb: (notes: Note[]) => void): () => void {
  return onSnapshot(collection(db, 'users', uid, 'notes'), (snap) => {
    const out: Note[] = []
    snap.forEach((docSnap) => {
      const n = toNote(docSnap.id, docSnap.data())
      if (n) out.push(n)
    })
    out.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated.localeCompare(a.updated))
    cb(out)
  })
}

export function watchCovers(uid: string, cb: (covers: Record<string, Cover>) => void): () => void {
  return onSnapshot(doc(db, 'users', uid, 'meta', 'vault'), (snap) => {
    const data = snap.data() as { notebooks?: Record<string, Cover> } | undefined
    cb(data?.notebooks ?? {})
  })
}

async function writeNote(
  uid: string,
  note: Note,
  patch: Partial<Pick<Note, 'title' | 'body' | 'tags' | 'pinned' | 'summary'>>
): Promise<void> {
  const merged = { ...note, ...patch }
  const now = new Date().toISOString()
  const hash = await hashNote({
    title: merged.title,
    created: merged.created,
    body: merged.body,
    tags: merged.tags,
    summary: merged.summary,
    pinned: merged.pinned
  })
  await setDoc(
    doc(db, 'users', uid, 'notes', note.id),
    {
      path: note.path,
      title: merged.title,
      created: merged.created,
      updated: now,
      tags: merged.tags,
      summary: merged.summary,
      pinned: merged.pinned,
      body: merged.body,
      hash,
      rev: note.rev + 1,
      deleted: false,
      device: DEVICE,
      syncedAt: serverTimestamp()
    },
    { merge: true }
  )
}

export const saveNote = writeNote

export async function createNote(
  uid: string,
  notebook: string,
  title: string,
  existingPaths: Set<string>
): Promise<string> {
  let base = `${notebook}/${slugify(title || 'Untitled note')}`
  let path = `${base}.md`
  let n = 2
  while (existingPaths.has(path)) {
    path = `${base}-${n}.md`
    n++
  }
  const now = new Date().toISOString()
  const fields = {
    title: title || 'Untitled note',
    created: now,
    body: '',
    tags: [] as string[],
    summary: '',
    pinned: false
  }
  const hash = await hashNote(fields)
  await setDoc(doc(db, 'users', uid, 'notes', encId(path)), {
    ...fields,
    path,
    updated: now,
    hash,
    rev: 1,
    deleted: false,
    device: DEVICE,
    syncedAt: serverTimestamp()
  })
  return encId(path)
}

export async function trashNote(uid: string, note: Note): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'notes', note.id),
    { deleted: true, deletedAt: serverTimestamp(), rev: note.rev + 1, device: DEVICE, syncedAt: serverTimestamp() },
    { merge: true }
  )
}

const TASK_RE = /^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)$/

export async function toggleTask(uid: string, note: Note, line: number, done: boolean): Promise<void> {
  const lines = note.body.split('\n')
  const m = lines[line]?.match(TASK_RE)
  if (!m) return
  lines[line] = `${m[1]}${m[2]} [${done ? 'x' : ' '}] ${m[4]}`
  await writeNote(uid, note, { body: lines.join('\n') })
}

/** ensure the shared meta doc knows about a notebook we just invented on the web */
export async function ensureNotebook(uid: string, notebook: string): Promise<void> {
  const ref = doc(db, 'users', uid, 'meta', 'vault')
  const cur = (await getDoc(ref)).data() as
    | { notebooks?: Record<string, Cover>; metaUpdated?: string }
    | undefined
  if (cur?.notebooks && cur.notebooks[notebook]) return
  const palette: Cover[] = [
    { style: 'arcs', c1: '#2f7d5b', c2: '#e9f2ec' },
    { style: 'stripe', c1: '#d99436', c2: '#f6e7cf' },
    { style: 'dots', c1: '#7367e8', c2: '#e6e2fb' },
    { style: 'wash', c1: '#c15b3c', c2: '#f3ddd2' }
  ]
  const count = cur?.notebooks ? Object.keys(cur.notebooks).length : 0
  await setDoc(
    ref,
    {
      notebooks: { ...(cur?.notebooks ?? {}), [notebook]: palette[count % palette.length] },
      metaUpdated: new Date().toISOString(),
      device: DEVICE
    },
    { merge: true }
  )
}
