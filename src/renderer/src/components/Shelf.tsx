import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Cover } from './Cover'
import { Icon } from './Icon'
import { Menu } from './Menu'
import { SyncPill } from './SyncPill'
import { askText, askConfirm } from '../prompt'
import type { NotebookMeta } from '../../../shared/types'

export function Shelf(): JSX.Element {
  const { snapshot, config, go, setTheme } = useStore()
  const [q, setQ] = useState('')

  const lastNote = useMemo(
    () =>
      [...(snapshot?.notes ?? [])].sort((a, b) => b.updated.localeCompare(a.updated))[0] ?? null,
    [snapshot]
  )
  const pinned = useMemo(
    () => (snapshot?.notes ?? []).filter((n) => n.pinned).slice(0, 12),
    [snapshot]
  )

  if (!snapshot) return <div className="home" />

  const totalNotes = snapshot.notes.length
  const theme = config?.theme ?? 'system'

  const createNotebook = async (): Promise<void> => {
    const name = await askText({ title: 'New notebook', placeholder: 'e.g. Sermon Prep', confirmText: 'Create' })
    if (!name) return
    try {
      const snap = await window.solace.createNotebook(name)
      useStore.setState({ snapshot: snap, route: { name: 'notebook', notebookId: name.trim(), folderId: null } })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not create notebook')
    }
  }
  const renameNotebook = async (id: string, cur: string): Promise<void> => {
    const name = await askText({ title: 'Rename notebook', initial: cur, confirmText: 'Rename' })
    if (!name || name.trim() === cur) return
    try {
      useStore.setState({ snapshot: await window.solace.renameNotebook(id, name) })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not rename notebook')
    }
  }
  const deleteNotebook = async (id: string, name: string, count: number): Promise<void> => {
    const ok = await askConfirm({
      title: `Delete “${name}”?`,
      label: `The notebook and its ${count} note${count === 1 ? '' : 's'} will be moved to the trash.`,
      confirmText: 'Delete notebook',
      danger: true
    })
    if (!ok) return
    useStore.setState({ snapshot: await window.solace.deleteNotebook(id) })
  }

  return (
    <div className="home">
      <aside className="home-rail">
        <div className="hr-logo">
          <Icon name="logo" className="hr-mark" size={19} /> Solace
        </div>

        <nav className="hr-nav">
          <button className="hr-item on">
            <Icon name="book" /> <span>Library</span>
          </button>
          <button className="hr-item" onClick={() => go({ name: 'calendar' })}>
            <Icon name="calendar" /> <span>Calendar</span>
          </button>
          <button className="hr-item" onClick={() => go({ name: 'agenda' })}>
            <Icon name="checklist" /> <span>To-dos</span>
          </button>
          <button
            className="hr-item"
            onClick={() => go({ name: 'search', scope: 'all', query: '' })}
          >
            <Icon name="search" /> <span>Search</span>
          </button>
          <button className="hr-item" onClick={() => useStore.getState().openToday()}>
            <Icon name="note" /> <span>Today’s note</span>
          </button>
          <button className="hr-item" onClick={() => window.solace.openCapture?.()}>
            <Icon name="plus" /> <span>Quick note</span>
          </button>
          <button className="hr-item" onClick={() => useStore.setState({ importOpen: true })}>
            <Icon name="import" /> <span>Import</span>
          </button>
          <button className="hr-item" onClick={() => useStore.setState({ sortOpen: true })}>
            <Icon name="sparkle" /> <span>Sort my notes</span>
          </button>
          <button className="hr-item" onClick={() => go({ name: 'trash' })}>
            <Icon name="trash" /> <span>Trash</span>
          </button>
        </nav>

        <div className="hr-foot">
          <SyncPill />
          {lastNote && (
            <button
              className="hr-continue"
              onClick={() => go({ name: 'note', noteId: lastNote.id, backTo: { name: 'shelf' } })}
            >
              <span className="hrc-label">Continue</span>
              <span className="hrc-title">{lastNote.title}</span>
              <span className="hrc-nb">{lastNote.notebookId}</span>
            </button>
          )}
          <div className="hr-row">
            <button
              className="hr-item sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
            >
              <Icon name={theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'auto'} />
              <span>{theme[0].toUpperCase() + theme.slice(1)}</span>
            </button>
            <button
              className="hr-item sm"
              onClick={() => useStore.setState({ settingsOpen: true })}
            >
              <Icon name="settings" /> <span>Settings</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="home-main">
        <div className="home-head">
          <div>
            <h2>My library</h2>
            <span className="hh-meta">
              {snapshot.notebooks.length} notebook{snapshot.notebooks.length === 1 ? '' : 's'} ·{' '}
              {totalNotes} note{totalNotes === 1 ? '' : 's'}
            </span>
          </div>
          <form
            className="searchfield"
            onSubmit={(e) => {
              e.preventDefault()
              if (q.trim()) go({ name: 'search', scope: 'all', query: q.trim() })
            }}
          >
            <span className="mag">
              <Icon name="search" size={15} />
            </span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your library…" />
          </form>
        </div>

        <div className="library-scroll">
          {pinned.length > 0 && (
            <section className="shelf-section">
              <div className="ss-head">
                <h3>Pinned</h3>
              </div>
              <ShelfRow
                items={pinned.map((n) => ({
                  key: n.id,
                  book: (
                    <button
                      className="pin-book"
                      onClick={() => go({ name: 'note', noteId: n.id, backTo: { name: 'shelf' } })}
                      title={`${n.title} · ${n.notebookId}`}
                    >
                      <span className="pb-cover">
                        <Icon name="star-fill" size={14} />
                        <span className="pb-title">{n.title}</span>
                      </span>
                    </button>
                  ),
                  caption: (
                    <button
                      className="book-caption"
                      onClick={() => go({ name: 'note', noteId: n.id, backTo: { name: 'shelf' } })}
                    >
                      <span className="book-name">{n.title}</span>
                      <span className="book-count">{n.notebookId}</span>
                    </button>
                  )
                }))}
              />
            </section>
          )}

          <section className="shelf-section">
            <div className="ss-head">
              <h3>Notebooks</h3>
              <button className="ss-add" onClick={createNotebook}>
                <Icon name="plus" size={14} /> New notebook
              </button>
            </div>
            {snapshot.notebooks.length === 0 ? (
              <div className="library-empty">
                Your library is empty. Make a notebook, or import a document.
              </div>
            ) : (
              <ShelfRow
                onReorder={async (fromKey, toKey) => {
                  const ids = snapshot.notebooks.map((n) => n.id)
                  const from = ids.indexOf(fromKey)
                  const to = ids.indexOf(toKey)
                  if (from === -1 || to === -1) return
                  ids.splice(to, 0, ids.splice(from, 1)[0])
                  const snap = await window.solace.reorderNotebooks(ids)
                  useStore.setState({ snapshot: snap })
                }}
                items={[
                  ...snapshot.notebooks.map((nb) =>
                    notebookItem(nb, {
                      onOpen: () => go({ name: 'notebook', notebookId: nb.id, folderId: null }),
                      onRename: () => renameNotebook(nb.id, nb.name),
                      onDelete: () => deleteNotebook(nb.id, nb.name, nb.noteCount),
                      onCover: () => useStore.setState({ coverPickerFor: nb.id }),
                      onExport: () => {
                        const ids = snapshot.notes
                          .filter((n) => n.notebookId === nb.id)
                          .map((n) => n.id)
                        if (ids.length)
                          useStore.setState({ exportTarget: { noteIds: ids, name: nb.name } })
                      }
                    })
                  ),
                  {
                    key: '__add__',
                    book: (
                      <button className="book add" onClick={createNotebook}>
                        <span className="add-cover">
                          <Icon name="plus" size={20} />
                        </span>
                      </button>
                    ),
                    caption: (
                      <button className="book-caption" onClick={createNotebook}>
                        <span className="book-name" style={{ color: 'var(--lib-faint)' }}>
                          New
                        </span>
                      </button>
                    )
                  }
                ]}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

interface ShelfItem {
  key: string
  book: React.ReactNode
  caption: React.ReactNode
  /** draggable for shelf reordering */
  movable?: boolean
}

function ShelfRow({
  items,
  onReorder
}: {
  items: ShelfItem[]
  onReorder?: (fromKey: string, toKey: string) => void
}): JSX.Element {
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const dragProps = (it: ShelfItem): React.HTMLAttributes<HTMLDivElement> => {
    if (!it.movable || !onReorder) return {}
    return {
      draggable: true,
      onDragStart: (e) => {
        setDrag(it.key)
        e.dataTransfer.effectAllowed = 'move'
      },
      onDragEnd: () => {
        setDrag(null)
        setOver(null)
      },
      onDragOver: (e) => {
        if (drag && drag !== it.key) {
          e.preventDefault()
          setOver(it.key)
        }
      },
      onDrop: (e) => {
        e.preventDefault()
        if (drag && drag !== it.key) onReorder(drag, it.key)
        setDrag(null)
        setOver(null)
      }
    }
  }

  return (
    <div className="shelf-row">
      <div className="shelf-books">
        {items.map((it) => (
          <div
            key={it.key}
            className={`shelf-slot ${drag === it.key ? 'dragging' : ''} ${over === it.key ? 'drop-here' : ''}`}
            {...dragProps(it)}
          >
            <div className="shelf-slot-book">{it.book}</div>
            <div className="shelf-slot-caption">{it.caption}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function notebookItem(
  nb: NotebookMeta,
  handlers: {
    onOpen: () => void
    onRename: () => void
    onDelete: () => void
    onCover: () => void
    onExport: () => void
  }
): ShelfItem {
  return {
    key: nb.id,
    movable: true,
    book: (
      <div className="book-wrap">
        <button className="book" onClick={handlers.onOpen}>
          <Cover cover={nb.cover} />
        </button>
        <div className="book-menu">
          <Menu
            trigger={(open) => (
              <button className="book-menu-btn" title="Notebook options" onClick={open}>
                <Icon name="dots" size={15} />
              </button>
            )}
          >
            {(close) => (
              <>
                <button onClick={() => { close(); handlers.onCover() }}>Change cover</button>
                <button onClick={() => { close(); handlers.onRename() }}>Rename</button>
                <button onClick={() => { close(); handlers.onExport() }}>Export notes…</button>
                <div className="menu-sep" />
                <button className="danger" onClick={() => { close(); handlers.onDelete() }}>
                  Delete notebook
                </button>
              </>
            )}
          </Menu>
        </div>
      </div>
    ),
    caption: (
      <button className="book-caption" onClick={handlers.onOpen}>
        <span className="book-name">{nb.name}</span>
        <span className="book-count">
          {nb.noteCount} note{nb.noteCount === 1 ? '' : 's'}
        </span>
      </button>
    )
  }
}
