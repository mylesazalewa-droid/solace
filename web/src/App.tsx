import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './lib/firebase'
import { watchNotes, watchCovers } from './lib/notes'
import { useStore } from './store'
import { SignIn } from './components/SignIn'
import { Home } from './components/Home'
import { Notebook } from './components/Notebook'
import { SearchView } from './components/SearchView'
import { NoteScreen } from './components/NoteScreen'
import { NewNote } from './components/NewNote'
import { PublicPage } from './components/PublicPage'

const PUBLIC_MATCH = window.location.pathname.match(/^\/p\/([A-Za-z0-9_-]{6,64})\/?$/)

export function App(): JSX.Element {
  const user = useStore((s) => s.user)
  const route = useStore((s) => s.route)
  const setUser = useStore((s) => s.setUser)
  const setNotes = useStore((s) => s.setNotes)
  const setCovers = useStore((s) => s.setCovers)
  const setOnline = useStore((s) => s.setOnline)
  const setPending = useStore((s) => s.setPending)

  useEffect(() => {
    if (PUBLIC_MATCH) return
    return onAuthStateChanged(auth, (u) => setUser(u))
  }, [setUser])

  useEffect(() => {
    const on = (): void => setOnline(true)
    const off = (): void => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [setOnline])

  useEffect(() => {
    if (!user) {
      setNotes([])
      return
    }
    const a = watchNotes(user.uid, setNotes, (m) => setPending(m.pending))
    const b = watchCovers(user.uid, setCovers)
    return () => {
      a()
      b()
    }
  }, [user, setNotes, setCovers, setPending])

  if (PUBLIC_MATCH) return <PublicPage id={PUBLIC_MATCH[1]} />

  if (user === undefined) {
    return (
      <div className="splash">
        <span className="brand-mark" aria-hidden />
      </div>
    )
  }
  if (user === null) return <SignIn />

  if (route.name === 'note') return <NoteScreen id={route.id} />
  if (route.name === 'new') return <NewNote notebook={route.notebook} />
  if (route.name === 'notebook') return <Notebook id={route.id} />
  if (route.name === 'search') return <SearchView />
  return <Home />
}
