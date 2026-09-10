import { create } from 'zustand'
import type { AppConfig, VaultSnapshot, ImportOutcome, SyncStatus } from '../../shared/types'

export interface ImportJob {
  names: string[]
  step: Record<string, string>
  outcomes: ImportOutcome[]
  running: boolean
  notebookId: string
  folderId: string | null
}

export type Route =
  | { name: 'welcome' }
  | { name: 'shelf' }
  | { name: 'calendar' }
  | { name: 'agenda' }
  | { name: 'notebook'; notebookId: string; folderId: string | null }
  | { name: 'note'; noteId: string; backTo: Route }
  | { name: 'search'; scope: string; query: string }

interface State {
  config: AppConfig | null
  snapshot: VaultSnapshot | null
  route: Route
  loading: boolean
  coverPickerFor: string | null
  importOpen: boolean
  sortOpen: boolean
  settingsOpen: boolean
  templatesOpen: boolean
  exportTarget: { noteIds: string[]; name: string } | null
  moveTarget: { noteId: string; title: string } | null
  historyFor: { noteId: string; title: string } | null
  sync: SyncStatus
  importJob: ImportJob | null

  boot: () => Promise<void>
  chooseVault: () => Promise<void>
  seed: () => Promise<void>
  refresh: () => Promise<void>
  go: (route: Route) => void
  setTheme: (t: 'system' | 'light' | 'dark') => Promise<void>
  startImport: (args: {
    files: string[]
    pasted: string | null
    notebookId: string
    folderId: string | null
  }) => Promise<void>
  dismissImportJob: () => void
  openToday: () => Promise<void>
}

let importProgressBound = false
let vaultWatchBound = false

export const useStore = create<State>((set, get) => ({
  config: null,
  snapshot: null,
  route: { name: 'welcome' },
  loading: true,
  coverPickerFor: null,
  importOpen: false,
  sortOpen: false,
  settingsOpen: false,
  templatesOpen: false,
  exportTarget: null,
  moveTarget: null,
  historyFor: null,
  sync: { state: 'off' },
  importJob: null,

  boot: async () => {
    const config = await window.solace.getConfig()
    applyTheme(config.theme)
    if (!vaultWatchBound) {
      vaultWatchBound = true
      window.solace.onVaultChanged?.(() => {
        void get().refresh()
      })
      window.addEventListener('focus', () => {
        void get().refresh()
      })
    }
    if (config.vaultPath) {
      try {
        const snapshot = await window.solace.scanVault()
        set({ config, snapshot, route: { name: 'shelf' }, loading: false })
        return
      } catch {
        /* fall through to welcome */
      }
    }
    set({ config, loading: false, route: { name: 'welcome' } })
  },

  chooseVault: async () => {
    const res = await window.solace.chooseVault()
    if (!res) return
    const config = await window.solace.getConfig()
    if (res.empty) {
      set({ config, route: { name: 'welcome' } })
      return
    }
    const snapshot = await window.solace.scanVault()
    set({ config, snapshot, route: { name: 'shelf' } })
  },

  seed: async () => {
    const snapshot = await window.solace.seedVault()
    set({ snapshot, route: { name: 'shelf' } })
  },

  refresh: async () => {
    if (!get().config?.vaultPath) return
    const snapshot = await window.solace.scanVault()
    set({ snapshot })
  },

  go: (route) => set({ route }),

  setTheme: async (t) => {
    const config = await window.solace.setTheme(t)
    applyTheme(t)
    set({ config })
  },

  startImport: async (args) => {
    const names = [
      ...args.files.map((f) => f.split('/').pop() ?? f),
      ...(args.pasted && args.pasted.trim() ? ['Pasted text'] : [])
    ]
    set({
      importJob: {
        names,
        step: {},
        outcomes: [],
        running: true,
        notebookId: args.notebookId,
        folderId: args.folderId
      }
    })

    if (!importProgressBound) {
      importProgressBound = true
      window.solace.onImportProgress(({ name, step }) => {
        const job = get().importJob
        if (job) set({ importJob: { ...job, step: { ...job.step, [name]: step } } })
      })
    }

    try {
      const { outcomes, snapshot } = await window.solace.runImport(args)
      set((s) => ({
        snapshot,
        importJob: s.importJob ? { ...s.importJob, outcomes, running: false } : null
      }))
    } catch (err) {
      set((s) => ({
        importJob: s.importJob
          ? {
              ...s.importJob,
              running: false,
              outcomes: s.importJob.names.map((n) => ({
                name: n,
                ok: false,
                error: err instanceof Error ? err.message : 'Import failed'
              }))
            }
          : null
      }))
    }
  },

  dismissImportJob: () => set({ importJob: null }),

  openToday: async () => {
    const { snapshot, noteId } = await window.solace.openDaily()
    const back = get().route
    set({
      snapshot,
      route: {
        name: 'note',
        noteId,
        backTo: back.name === 'note' ? back.backTo : back
      }
    })
  }
}))

function applyTheme(t: 'system' | 'light' | 'dark'): void {
  const root = document.documentElement
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
}
