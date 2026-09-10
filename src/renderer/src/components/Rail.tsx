import { useStore } from '../store'
import { Icon } from './Icon'
import type { IconName } from './Icon'

type Key = 'library' | 'calendar' | 'agenda' | 'passages' | 'search'

const ITEMS: { key: Key; icon: IconName; label: string }[] = [
  { key: 'library', icon: 'book', label: 'Library' },
  { key: 'calendar', icon: 'calendar', label: 'Calendar' },
  { key: 'agenda', icon: 'checklist', label: 'To-dos' },
  { key: 'passages', icon: 'book', label: 'Passages' },
  { key: 'search', icon: 'search', label: 'Search' }
]

export function Rail({ active }: { active: Key }): JSX.Element {
  const go = useStore((s) => s.go)
  const openToday = useStore((s) => s.openToday)

  const nav = (k: Key): void => {
    if (k === 'library') go({ name: 'shelf' })
    else if (k === 'calendar') go({ name: 'calendar' })
    else if (k === 'agenda') go({ name: 'agenda' })
    else if (k === 'passages') go({ name: 'passages' })
    else go({ name: 'search', scope: 'all', query: '' })
  }

  return (
    <aside className="home-rail">
      <div className="hr-logo">
        <Icon name="logo" className="hr-mark" size={19} /> Solace
      </div>
      <nav className="hr-nav">
        {ITEMS.map((it) => (
          <button
            key={it.key}
            className={`hr-item ${active === it.key ? 'on' : ''}`}
            onClick={() => nav(it.key)}
          >
            <Icon name={it.icon} /> <span>{it.label}</span>
          </button>
        ))}
        <button className="hr-item" onClick={() => openToday()}>
          <Icon name="note" /> <span>Today’s note</span>
        </button>
        <button className="hr-item" onClick={() => window.solace.openCapture?.()}>
          <Icon name="plus" /> <span>Quick note</span>
        </button>
        <button className="hr-item" onClick={() => useStore.setState({ importOpen: true })}>
          <Icon name="import" /> <span>Import</span>
        </button>
      </nav>
      <div className="hr-foot">
        <button className="hr-item sm" onClick={() => useStore.setState({ settingsOpen: true })}>
          <Icon name="settings" /> <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}
