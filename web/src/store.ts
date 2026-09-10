import { create } from 'zustand'
import type { User } from 'firebase/auth'
import type { Note, Cover } from './lib/notes'

export type Route =
  | { name: 'home' }
  | { name: 'notebook'; id: string }
  | { name: 'note'; id: string; from: Route }
  | { name: 'new'; notebook?: string }
  | { name: 'search' }

export type SyncState = 'synced' | 'saving' | 'offline'

interface State {
  user: User | null | undefined
  notes: Note[]
  covers: Record<string, Cover>
  route: Route
  query: string
  online: boolean
  pending: boolean
  lastSync: number
  setUser: (u: User | null) => void
  setNotes: (n: Note[]) => void
  setCovers: (c: Record<string, Cover>) => void
  go: (r: Route) => void
  setQuery: (q: string) => void
  setOnline: (v: boolean) => void
  setPending: (v: boolean) => void
}

export const useStore = create<State>((set) => ({
  user: undefined,
  notes: [],
  covers: {},
  route: { name: 'home' },
  query: '',
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  pending: false,
  lastSync: 0,
  setUser: (user) => set({ user }),
  setNotes: (notes) => set({ notes }),
  setCovers: (covers) => set({ covers }),
  go: (route) => set({ route }),
  setQuery: (query) => set({ query }),
  setOnline: (online) => set({ online }),
  setPending: (pending) => set((s) => ({ pending, lastSync: pending ? s.lastSync : Date.now() }))
}))

export function syncState(s: State): SyncState {
  if (!s.online) return 'offline'
  if (s.pending) return 'saving'
  return 'synced'
}
