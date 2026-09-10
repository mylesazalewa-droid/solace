import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useStore } from '../store'

function Ico({ d }: { d: string }): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

const BOOK = 'M5 4a2 2 0 0 1 2-2h11v18H7a2 2 0 0 0-2 2V4Z'
const SEARCH = 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3'
const PLUS = 'M12 5v14M5 12h14'

export function Rail({ active }: { active: 'library' | 'search' }): JSX.Element {
  const go = useStore((s) => s.go)
  const email = useStore((s) => s.user?.email) ?? ''

  return (
    <aside className="rail">
      <div className="rail-logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="5" y="3" width="10" height="18" rx="1.7" />
          <path d="M15 3v18M8.4 21v3.4l1.7-1.4 1.7 1.4V21" />
        </svg>
        Solace
      </div>
      <nav className="rail-nav">
        <button className={`rail-item ${active === 'library' ? 'on' : ''}`} onClick={() => go({ name: 'home' })}>
          <Ico d={BOOK} /> <span>Library</span>
        </button>
        <button className={`rail-item ${active === 'search' ? 'on' : ''}`} onClick={() => go({ name: 'search' })}>
          <Ico d={SEARCH} /> <span>Search</span>
        </button>
        <button className="rail-item" onClick={() => go({ name: 'new' })}>
          <Ico d={PLUS} /> <span>New note</span>
        </button>
      </nav>
      <div className="rail-foot">
        <div className="rail-acct">{email}</div>
        <button className="rail-signout" onClick={() => signOut(auth)}>
          Sign out
        </button>
      </div>
    </aside>
  )
}
