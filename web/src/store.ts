import { create } from 'zustand'
import type { User } from 'firebase/auth'
import type { Note, Cover } from './lib/notes'

export type Route =
  | { name: 'home' }
  | { name: 'notebook'; id: string }
  | { name: 'note'; id: string; from: Route }
  | { name: 'new'; notebook?: string }
  | { name: 'search' }

interface State {
  user: User | null | undefined
  notes: Note[]
  covers: Record<string, Cover>
  route: Route
  query: string
  setUser: (u: User | null) => void
  setNotes: (n: Note[]) => void
  setCovers: (c: Record<string, Cover>) => void
  go: (r: Route) => void
  setQuery: (q: string) => void
}

export const useStore = create<State>((set) => ({
  user: undefined,
  notes: [],
  covers: {},
  route: { name: 'home' },
  query: '',
  setUser: (user) => set({ user }),
  setNotes: (notes) => set({ notes }),
  setCovers: (covers) => set({ covers }),
  go: (route) => set({ route }),
  setQuery: (query) => set({ query })
}))
