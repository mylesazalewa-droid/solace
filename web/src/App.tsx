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

export function App(): JSX.Element {
  const user = useStore((s) => s.user)
  const route = useStore((s) => s.route)
  const setUser = useStore((s) => s.setUser)
  const setNotes = useStore((s) => s.setNotes)
  const setCovers = useStore((s) => s.setCovers)

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), [setUser])

  useEffect(() => {
    if (!user) {
      setNotes([])
      return
    }
    const a = watchNotes(user.uid, setNotes)
    const b = watchCovers(user.uid, setCovers)
    return () => {
      a()
      b()
    }
  }, [user, setNotes, setCovers])

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
