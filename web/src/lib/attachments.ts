import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])
const AUDIO_EXT = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'flac', 'webm', 'amr'])
const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  flac: 'audio/flac',
  webm: 'audio/webm',
  amr: 'audio/amr',
  pdf: 'application/pdf'
}

function extOf(path: string): string {
  const m = path.match(/\.([a-z0-9]+)$/i)
  return m ? m[1].toLowerCase() : ''
}

export function attachKind(path: string): 'image' | 'audio' | 'file' {
  const e = extOf(path)
  if (IMAGE_EXT.has(e)) return 'image'
  if (AUDIO_EXT.has(e)) return 'audio'
  return 'file'
}

/** Resolve a note-relative attachment path (handles "../") to a vault-relative one. */
export function resolveAttachPath(notePath: string, p: string): string | null {
  if (/^(https?:|data:|#|\/|mailto:)/i.test(p)) return null
  const dir = notePath.split('/').slice(0, -1)
  let rel = p.trim()
  while (rel.startsWith('../')) {
    dir.pop()
    rel = rel.slice(3)
  }
  rel = rel.replace(/^\.\//, '')
  return [...dir, rel].join('/')
}

function encId(path: string): string {
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(path)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const cache = new Map<string, Promise<string | null>>()

/** Fetch a synced attachment and return it as a data: URL (cached per session). */
export function getAttachmentDataUrl(uid: string, path: string): Promise<string | null> {
  const cached = cache.get(path)
  if (cached) return cached
  const p = (async () => {
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'attachmentData', encId(path)))
      const data = snap.data() as { data?: string } | undefined
      if (!data?.data) return null
      const mime = MIME[extOf(path)] ?? 'application/octet-stream'
      return `data:${mime};base64,${data.data}`
    } catch {
      return null
    }
  })()
  cache.set(path, p)
  return p
}
