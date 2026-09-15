import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  type Firestore
} from 'firebase/firestore'
import { useStore } from '../store'
import type { SyncApply, SyncNote, SyncState } from '../../../shared/types'

export interface SyncResult {
  pushed: number
  pulled: number
  conflicts: number
}

type Fields = Omit<SyncNote, 'hash' | 'path'>

interface RemoteNote extends Partial<SyncNote> {
  path: string
  rev: number
  deleted?: boolean
  device?: string
}

function encId(path: string): string {
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(path)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fieldsOf(n: { title?: string; created?: string; updated?: string; tags?: string[]; summary?: string; pinned?: boolean; body?: string }): Fields {
  return {
    title: n.title ?? 'Untitled note',
    created: n.created ?? new Date().toISOString(),
    updated: n.updated ?? new Date().toISOString(),
    tags: n.tags ?? [],
    summary: n.summary ?? '',
    pinned: !!n.pinned,
    body: n.body ?? ''
  }
}

export async function runSync(db: Firestore, uid: string, device: string): Promise<SyncResult> {
  const local = await window.solace.syncSnapshot()
  const state = await window.solace.syncStateGet()

  const notesCol = collection(db, 'users', uid, 'notes')
  const remoteDocs = await getDocs(notesCol)
  const R = new Map<string, RemoteNote>()
  remoteDocs.forEach((d) => {
    const v = d.data() as RemoteNote
    if (v && v.path) R.set(v.path, v)
  })

  const L = new Map(local.notes.map((n) => [n.path, n]))
  const deletedHere = new Set(local.deleted ?? [])
  const newState: SyncState = { ...state }
  const apply: SyncApply = { writes: [], deletes: [], conflicts: [] }
  const pushes: SyncNote[] = []
  const tombstones: string[] = []
  const clearedTombstones: string[] = []

  // SAFETY INVARIANT — do not weaken this without re-reading the whole loop:
  // a note is NEVER deleted here just because it's missing from one side. The
  // only two ways a note gets tombstoned (r.deleted / apply.deletes) are (a)
  // deletedHere, sourced from this device's own trash + sync-tombstones.json —
  // i.e. the user actually deleted it on THIS device — or (b) `s` (this path's
  // prior synced state) already existed and the file is now gone locally,
  // meaning this device previously had it and lost it (again, a real local
  // delete, not "the other device doesn't have it yet"). A note the cloud has
  // never seen, or that simply hasn't arrived here yet, is only ever pulled
  // (apply.writes) or pushed (pushes) — never removed. forceSync() clears
  // sync-state (`s`), which makes path (b) impossible too, so a force sync can
  // only ever add notes back in, never infer a deletion from absence. Even the
  // one real deletion path (apply.deletes → deleteNote) is a soft delete into
  // .solace/trash, recoverable from the Trash view.
  for (const path of new Set([...L.keys(), ...R.keys(), ...deletedHere])) {
    const l = L.get(path)
    const r = R.get(path)
    const s = state[path]

    // deleted on this device — push the delete to the cloud and never resurrect it,
    // even if it was never in sync-state
    if (deletedHere.has(path) && !l) {
      if (r && !r.deleted) tombstones.push(path)
      else clearedTombstones.push(path) // already gone remotely — nothing to do
      delete newState[path]
      continue
    }

    if (l && !r) {
      pushes.push(l)
    } else if (!l && r) {
      if (r.deleted) {
        delete newState[path]
      } else if (s) {
        tombstones.push(path) // was synced, now gone locally → deleted here
      } else {
        apply.writes.push({ path, fields: fieldsOf(r) })
        newState[path] = { rev: r.rev, hash: r.hash ?? '' }
      }
    } else if (l && r) {
      const localChanged = !s || s.hash !== l.hash
      const remoteChanged = !s || s.rev !== r.rev
      if (r.deleted) {
        if (localChanged) pushes.push(l) // local has edits (or was never synced) — keep it
        else {
          apply.deletes.push(path)
          delete newState[path]
        }
      } else if (l.hash === r.hash) {
        // identical content on both sides — just record where we are
        newState[path] = { rev: r.rev, hash: r.hash ?? l.hash }
      } else if (localChanged && remoteChanged) {
        if (l.updated >= (r.updated ?? '')) {
          apply.conflicts.push({ path, fields: fieldsOf(r), from: r.device || 'another device' })
          pushes.push(l)
        } else {
          apply.conflicts.push({ path, fields: fieldsOf(l), from: device })
          apply.writes.push({ path, fields: fieldsOf(r) })
          newState[path] = { rev: r.rev, hash: r.hash ?? '' }
        }
      } else if (localChanged) {
        pushes.push(l)
      } else if (remoteChanged) {
        apply.writes.push({ path, fields: fieldsOf(r) })
        newState[path] = { rev: r.rev, hash: r.hash ?? '' }
      }
    }
  }

  // ---- metadata (notebook covers + custom templates): last-writer-wins on one doc ----
  const metaRef = doc(db, 'users', uid, 'meta', 'vault')
  const metaSnap = await getDoc(metaRef)
  const rMeta = metaSnap.exists() ? (metaSnap.data() as { metaUpdated?: string; notebooks?: Record<string, unknown>; templates?: unknown[] }) : null
  let metaPush = false
  if (!rMeta) {
    metaPush = true
  } else if ((local.metaUpdated || '') > (rMeta.metaUpdated || '')) {
    metaPush = true
  } else if ((rMeta.metaUpdated || '') > (local.metaUpdated || '')) {
    apply.notebooks = (rMeta.notebooks as SyncApply['notebooks']) || {}
    apply.templates = (rMeta.templates as SyncApply['templates']) || []
  }

  // ---- 1. remote → local ----
  const willTouchDisk =
    apply.writes.length || apply.deletes.length || apply.conflicts.length || apply.notebooks || apply.templates
  if (willTouchDisk) await window.solace.syncApply(apply)

  // ---- 2. local → remote (chunked; Firestore caps a batch at 500) ----
  let batch = writeBatch(db)
  let n = 0
  const flush = async (): Promise<void> => {
    if (n) {
      await batch.commit()
      batch = writeBatch(db)
      n = 0
    }
  }
  for (const l of pushes) {
    const rev = (R.get(l.path)?.rev ?? 0) + 1
    batch.set(doc(notesCol, encId(l.path)), {
      path: l.path,
      title: l.title,
      created: l.created,
      updated: l.updated,
      tags: l.tags,
      summary: l.summary,
      pinned: l.pinned,
      body: l.body,
      hash: l.hash,
      rev,
      deleted: false,
      device,
      syncedAt: serverTimestamp()
    })
    newState[l.path] = { rev, hash: l.hash }
    if (++n >= 400) await flush()
  }
  for (const path of tombstones) {
    const rev = (R.get(path)?.rev ?? 0) + 1
    batch.set(
      doc(notesCol, encId(path)),
      { path, deleted: true, deletedAt: serverTimestamp(), rev, device, syncedAt: serverTimestamp() },
      { merge: true }
    )
    delete newState[path]
    if (++n >= 400) await flush()
  }
  if (metaPush) {
    batch.set(
      metaRef,
      {
        notebooks: local.notebooks,
        templates: local.templates,
        metaUpdated: local.metaUpdated || new Date().toISOString(),
        device
      },
      { merge: true }
    )
    n++
  }
  await flush()

  await window.solace.syncStateSet(newState)
  // the tombstones we just pushed (and any that were already gone remotely) are done
  const doneTombstones = [
    ...clearedTombstones,
    ...tombstones.filter((p) => deletedHere.has(p))
  ]
  if (doneTombstones.length)
    await window.solace.syncClearTombstones?.(doneTombstones).catch(() => {})
  if (willTouchDisk) await useStore.getState().refresh()

  return {
    pushed: pushes.length + tombstones.length,
    pulled: apply.writes.length,
    conflicts: apply.conflicts.length
  }
}
