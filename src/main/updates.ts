import { app } from 'electron'
import { SHARED } from '../shared/appConfig'

export interface UpdateInfo {
  current: string
  latest: string | null
  url: string | null
  notes: string | null
  updateAvailable: boolean
}

function cmp(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

/**
 * Reads a public Firestore doc `public/release`:
 *   { version: "0.4.0", url: "https://…dmg or releases page", notes: "…" }
 * No auth needed — the Firestore rule allows unauthenticated read of `public/**`.
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
  const current = app.getVersion()
  const fb = SHARED.firebase
  const blank: UpdateInfo = { current, latest: null, url: null, notes: null, updateAvailable: false }
  if (!fb) return blank

  const url =
    `https://firestore.googleapis.com/v1/projects/${fb.projectId}` +
    `/databases/(default)/documents/public/release?key=${fb.apiKey}`

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (res.status === 404) return blank // no release doc published yet
  if (!res.ok) throw new Error(`Couldn’t check for updates (${res.status}).`)

  const doc = (await res.json()) as { fields?: Record<string, { stringValue?: string }> }
  const f = doc.fields ?? {}
  const latest = f.version?.stringValue?.trim() || null
  return {
    current,
    latest,
    url: f.url?.stringValue?.trim() || null,
    notes: f.notes?.stringValue?.trim() || null,
    updateAvailable: !!latest && cmp(latest, current) > 0
  }
}
