import { create } from 'zustand'
import type { User } from 'firebase/auth'
import type { Note, Cover } from './lib/notes'

export type Route = { name: 'home' } | { name: 'note'; id: string } | { name: 'new' }

interface State {
  user: User | null | undefined // undefined = still checking
  notes: Note[]
  covers: Record<string, Cover>
  route: Route
  query: string
  notebook: string | null // active notebook filter on home
  setUser: (u: User | null) => void
  setNotes: (n: Note[]) => void
  setCovers: (c: Record<string, Cover>) => void
  go: (r: Route) => void
  setQuery: (q: string) => void
  setNotebook: (n: string | null) => void
}

export const useStore = create<State>((set) => ({
  user: undefined,
  notes: [],
  covers: {},
  route: { name: 'home' },
  query: '',
  notebook: null,
  setUser: (user) => set({ user }),
  setNotes: (notes) => set({ notes }),
  setCovers: (covers) => set({ covers }),
  go: (route) => set({ route }),
  setQuery: (query) => set({ query }),
  setNotebook: (notebook) => set({ notebook })
}))
