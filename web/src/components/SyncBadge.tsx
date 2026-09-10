import { useStore, syncState } from '../store'

function ago(ts: number): string {
  if (!ts) return ''
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 8) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}

export function SyncBadge({ compact = false }: { compact?: boolean }): JSX.Element {
  const state = useStore(syncState)
  const lastSync = useStore((s) => s.lastSync)

  const label =
    state === 'offline'
      ? 'Offline — changes saved here'
      : state === 'saving'
        ? 'Saving…'
        : compact
          ? 'Synced'
          : `Synced${lastSync ? ` · ${ago(lastSync)}` : ''}`

  return (
    <div className={`sync-badge ${state}`} title={label}>
      <span className="sb-dot" />
      <span className="sb-label">{label}</span>
    </div>
  )
}
