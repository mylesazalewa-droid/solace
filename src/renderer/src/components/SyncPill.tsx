import { useState } from 'react'
import { useStore } from '../store'
import { Icon } from './Icon'
import { signInWithGoogle, syncNow } from '../sync'
import { hasSharedSync } from '../../../shared/appConfig'

export function SyncPill(): JSX.Element | null {
  const s = useStore((st) => st.sync)
  const [busy, setBusy] = useState(false)

  if (s.state === 'off') return null

  if (s.state === 'signed-out' || s.state === 'error') {
    const onClick = async (): Promise<void> => {
      if (hasSharedSync()) {
        setBusy(true)
        try {
          await signInWithGoogle()
        } catch {
          useStore.setState({ settingsOpen: true })
        } finally {
          setBusy(false)
        }
      } else {
        useStore.setState({ settingsOpen: true })
      }
    }
    return (
      <button className="sync-pill signin" onClick={onClick} disabled={busy}>
        <Icon name="sparkle" size={14} />
        <span>{busy ? 'Opening browser…' : 'Sign in to sync'}</span>
      </button>
    )
  }

  // idle / syncing
  return (
    <button
      className="sync-pill"
      onClick={() => syncNow('manual')}
      title={s.email ? `Synced as ${s.email}` : 'Synced'}
      disabled={s.state === 'syncing'}
    >
      <Icon name={s.state === 'syncing' ? 'auto' : 'check'} size={14} />
      <span>{s.state === 'syncing' ? 'Syncing…' : 'Synced'}</span>
    </button>
  )
}
