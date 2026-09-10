import { useEffect } from 'react'
import { useStore } from './store'
import { Welcome } from './components/Welcome'
import { Shelf } from './components/Shelf'
import { NotebookView } from './components/NotebookView'
import { NoteEditor } from './components/NoteEditor'
import { SearchView } from './components/SearchView'
import { CalendarView } from './components/CalendarView'
import { AgendaView } from './components/AgendaView'
import { Settings } from './components/Settings'
import { CoverPicker } from './components/CoverPicker'
import { ImportPanel } from './components/ImportPanel'
import { ImportToast } from './components/ImportToast'
import { SortPanel } from './components/SortPanel'
import { Templates } from './components/Templates'
import { ExportDialog } from './components/ExportDialog'
import { MovePanel } from './components/MovePanel'
import { HistoryPanel } from './components/HistoryPanel'
import { PromptHost } from './prompt'
import { startSync } from './sync'
import type { Route } from './store'

function routeKey(r: Route): string {
  if (r.name === 'notebook') return `notebook:${r.notebookId}`
  if (r.name === 'note') return `note:${r.noteId}`
  return r.name
}

export default function App(): JSX.Element {
  const { route, loading, boot, config, setTheme, go, snapshot } = useStore()
  const settingsOpen = useStore((s) => s.settingsOpen)
  const setSettingsOpen = (v: boolean): void => useStore.setState({ settingsOpen: v })

  useEffect(() => {
    boot()
    void startSync()
  }, [boot])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (snapshot) go({ name: 'search', scope: 'all', query: '' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, snapshot])

  const theme = config?.theme ?? 'system'

  const back = (): void => {
    if (route.name === 'note') go(route.backTo)
    else go({ name: 'shelf' })
  }

  return (
    <div className="app">
      <div className="titlebar">
        {route.name !== 'welcome' && route.name !== 'shelf' && route.name !== 'calendar' && route.name !== 'agenda' && (
          <button className="back-btn" onClick={back}>
            <span className="chev">‹</span> All notebooks
          </button>
        )}
        <span className="grow" />
        {route.name !== 'welcome' && route.name !== 'shelf' && route.name !== 'calendar' && route.name !== 'agenda' && (
          <>
            <button className="tbtn" onClick={() => go({ name: 'search', scope: 'all', query: '' })}>
              Search <kbd>⌘K</kbd>
            </button>
            <button
              className="tbtn"
              title={`Theme: ${theme}`}
              onClick={() =>
                setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')
              }
            >
              {theme === 'dark' ? '◑ Dark' : theme === 'light' ? '◐ Light' : '◒ Auto'}
            </button>
            <button className="tbtn" title="Settings" onClick={() => setSettingsOpen(true)}>
              ⚙
            </button>
          </>
        )}
      </div>

      {loading ? (
        <div className="body-scroll" />
      ) : (
        <div className="route-slot view-anim" key={routeKey(route)}>
          {route.name === 'welcome' ? (
            <Welcome />
          ) : route.name === 'shelf' ? (
            <Shelf />
          ) : route.name === 'calendar' ? (
            <CalendarView />
          ) : route.name === 'agenda' ? (
            <AgendaView />
          ) : route.name === 'notebook' ? (
            <NotebookView />
          ) : route.name === 'note' ? (
            <NoteEditor />
          ) : (
            <div className="body-scroll">
              <SearchView />
            </div>
          )}
        </div>
      )}

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      <CoverPicker />
      <ImportPanel />
      <SortPanel />
      <Templates />
      <ExportDialog />
      <MovePanel />
      <HistoryPanel />
      <ImportToast />
      <PromptHost />
    </div>
  )
}
