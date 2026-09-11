import type { Firestore } from 'firebase/firestore'

// The live Firestore + signed-in uid, for features outside the sync loop
// (publish, published-list). Kept in its own tiny module so sync/index.ts and
// publish.ts don't have to import each other.
let current: { db: Firestore; uid: string } | null = null

export function setSyncHandle(h: { db: Firestore; uid: string } | null): void {
  current = h
}

export function syncHandle(): { db: Firestore; uid: string } | null {
  return current
}
