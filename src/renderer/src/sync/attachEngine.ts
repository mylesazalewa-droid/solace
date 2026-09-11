import { collection, doc, getDoc, getDocs, writeBatch, type Firestore } from 'firebase/firestore'
import type { AttachInfo, AttachState } from '../../../shared/types'

export interface AttachSyncResult {
  pushed: number
  pulled: number
  skipped: number
}

interface RemoteMeta {
  path: string
  notebookId: string
  hash: string
  size: number
  updated: string
  device?: string
}

function encId(path: string): string {
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(path)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * One-way-simple attachment sync: no deletion tombstones (v1) — files are
 * pushed/pulled by content hash + last-write-wins on mtime. Oversized files
 * (see AttachInfo.oversized) are never pushed, and never overwritten by a pull
 * either, so a big local file just stays local.
 */
export async function runAttachSync(db: Firestore, uid: string, device: string): Promise<AttachSyncResult> {
  const local = await window.solace.attachmentsList?.()
  if (!local) return { pushed: 0, pulled: 0, skipped: 0 }
  const state = (await window.solace.attachmentStateGet?.()) ?? {}

  const metaCol = collection(db, 'users', uid, 'attachmentMeta')
  const remoteDocs = await getDocs(metaCol)
  const R = new Map<string, RemoteMeta>()
  remoteDocs.forEach((d) => {
    const v = d.data() as RemoteMeta
    if (v?.path) R.set(v.path, v)
  })

  const L = new Map(local.map((a) => [a.path, a]))
  const newState: AttachState = { ...state }
  const toPush: AttachInfo[] = []
  const toPull: RemoteMeta[] = []
  let skipped = 0

  for (const path of new Set([...L.keys(), ...R.keys()])) {
    const l = L.get(path)
    const r = R.get(path)
    if (l && !r) {
      if (l.oversized) skipped++
      else toPush.push(l)
    } else if (!l && r) {
      toPull.push(r)
    } else if (l && r) {
      if (l.hash === r.hash) {
        newState[path] = { hash: l.hash, updated: l.updated }
      } else if (l.updated >= r.updated) {
        if (l.oversized) skipped++
        else toPush.push(l)
      } else {
        toPull.push(r)
      }
    }
  }

  // pull first — main process writes files to disk
  for (const r of toPull) {
    try {
      const dataSnap = await getDoc(doc(db, 'users', uid, 'attachmentData', encId(r.path)))
      const data = dataSnap.data() as { data?: string } | undefined
      if (!data?.data) continue
      await window.solace.attachmentWrite(r.path, data.data)
      newState[r.path] = { hash: r.hash, updated: r.updated }
    } catch {
      /* try again next sync */
    }
  }

  // push — batched, 2 writes per attachment (meta + data)
  let batch = writeBatch(db)
  let n = 0
  const flush = async (): Promise<void> => {
    if (n) {
      await batch.commit()
      batch = writeBatch(db)
      n = 0
    }
  }
  for (const l of toPush) {
    try {
      const base64 = await window.solace.attachmentRead(l.path)
      const id = encId(l.path)
      batch.set(doc(db, 'users', uid, 'attachmentMeta', id), {
        path: l.path,
        notebookId: l.notebookId,
        hash: l.hash,
        size: l.size,
        updated: l.updated,
        device
      })
      batch.set(doc(db, 'users', uid, 'attachmentData', id), { data: base64 })
      newState[l.path] = { hash: l.hash, updated: l.updated }
      n += 2
      if (n >= 400) await flush()
    } catch {
      /* try again next sync */
    }
  }
  await flush()

  await window.solace.attachmentStateSet?.(newState)
  return { pushed: toPush.length, pulled: toPull.length, skipped }
}
