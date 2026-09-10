import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Cover } from './Cover'
import { Menu } from './Menu'
import { Icon } from './Icon'
import { askText, askConfirm } from '../prompt'
import type { NoteSummary, NoteTemplate } from '../../../shared/types'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function NotebookView(): JSX.Element {
  const snapshot = useStore((s) => s.snapshot)
  const route = useStore((s) => s.route)
  const go = useStore((s) => s.go)
  const [scopedQuery, setScopedQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [view, setView] = useState<'cards' | 'list'>(() => {
    try {
      return localStorage.getItem('solace.view') === 'list' ? 'list' : 'cards'
    } catch {
      return 'cards'
    }
  })
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  useEffect(() => {
    window.solace.listTemplates().then(setTemplates)
  }, [])
  const setViewPersist = (v: 'cards' | 'list'): void => {
    setView(v)
    try {
      localStorage.setItem('solace.view', v)
    } catch {
      /* ignore */
    }
  }

  if (!snapshot || route.name !== 'notebook') return <div className="nb" />
  const nb = snapshot.notebooks.find((n) => n.id === route.notebookId)
  if (!nb) return <div className="nb" />

  const folderId = route.folderId
  const allNotes = snapshot.notes.filter((n) => n.notebookId === nb.id)

  const searching = scopedQuery.trim().length > 0
  let visible: NoteSummary[]
  if (searching) {
    const q = scopedQuery.trim().toLowerCase()
    visible = allNotes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.excerpt.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    )
  } else if (activeTag) {
    visible = allNotes.filter((n) => n.tags.includes(activeTag))
  } else if (folderId) {
    visible = allNotes.filter((n) => n.folderId === folderId)
  } else {
    visible = allNotes
  }
  visible = [...visible].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updated.localeCompare(a.updated)
  )

  const rootCount = allNotes.filter((n) => n.folderId === null).length

  const tagCounts = new Map<string, number>()
  for (const n of allNotes) for (const t of n.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
  const topics = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const openNote = (id: string): void => go({ name: 'note', noteId: id, backTo: route })
  const pickAll = (): void => {
    setActiveTag(null)
    go({ name: 'notebook', notebookId: nb.id, folderId: null })
  }
  const pickFolder = (fid: string): void => {
    setActiveTag(null)
    go({ name: 'notebook', notebookId: nb.id, folderId: fid })
  }

  const newNote = async (body = ''): Promise<void> => {
    const doc = await window.solace.createNote({
      notebookId: nb.id,
      folderId,
      title: 'Untitled note',
      body
    })
    await useStore.getState().refresh()
    openNote(doc.id)
  }

  const exportScope = (): void => {
    const ids = visible.map((n) => n.id)
    if (!ids.length) return
    useStore.setState({ exportTarget: { noteIds: ids, name: viewLabel === 'All notes' ? nb.name : viewLabel } })
  }

  const newFolder = async (): Promise<void> => {
    const name = await askText({
      title: `New folder in ${nb.name}`,
      placeholder: 'e.g. Rest & Sabbath',
      confirmText: 'Create'
    })
    if (!name) return
    try {
      const snap = await window.solace.createFolder(nb.id, name)
      useStore.setState({
        snapshot: snap,
        route: { name: 'notebook', notebookId: nb.id, folderId: name.trim() }
      })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not create folder')
    }
  }

  const renameNotebook = async (): Promise<void> => {
    const name = await askText({ title: 'Rename notebook', initial: nb.name, confirmText: 'Rename' })
    if (!name || name.trim() === nb.name) return
    try {
      const snap = await window.solace.renameNotebook(nb.id, name)
      useStore.setState({
        snapshot: snap,
        route: { name: 'notebook', notebookId: name.trim(), folderId: null }
      })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not rename notebook')
    }
  }

  const deleteNotebook = async (): Promise<void> => {
    const ok = await askConfirm({
      title: `Delete “${nb.name}”?`,
      label: `The notebook and its ${nb.noteCount} note${nb.noteCount === 1 ? '' : 's'} will be moved to the trash. You can restore them from your notes folder.`,
      confirmText: 'Delete notebook',
      danger: true
    })
    if (!ok) return
    const snap = await window.solace.deleteNotebook(nb.id)
    useStore.setState({ snapshot: snap, route: { name: 'shelf' } })
  }

  const renameFolder = async (fid: string): Promise<void> => {
    const name = await askText({ title: 'Rename folder', initial: fid, confirmText: 'Rename' })
    if (!name || name.trim() === fid) return
    try {
      const snap = await window.solace.renameFolder(nb.id, fid, name)
      useStore.setState({
        snapshot: snap,
        route: { name: 'notebook', notebookId: nb.id, folderId: name.trim() }
      })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not rename folder')
    }
  }

  const deleteFolder = async (fid: string): Promise<void> => {
    const count = allNotes.filter((n) => n.folderId === fid).length
    const ok = await askConfirm({
      title: `Delete folder “${fid}”?`,
      label: `${count} note${count === 1 ? '' : 's'} will be moved to the trash with it.`,
      confirmText: 'Delete folder',
      danger: true
    })
    if (!ok) return
    const snap = await window.solace.deleteFolder(nb.id, fid)
    useStore.setState({
      snapshot: snap,
      route: { name: 'notebook', notebookId: nb.id, folderId: null }
    })
  }

  const deleteNote = async (n: NoteSummary): Promise<void> => {
    const ok = await askConfirm({
      title: 'Delete this note?',
      label: `“${n.title}” will be moved to the trash.`,
      confirmText: 'Delete note',
      danger: true
    })
    if (!ok) return
    const snap = await window.solace.deleteNote(n.id)
    useStore.setState({ snapshot: snap })
  }

  const toggleStar = async (n: NoteSummary, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    await window.solace.saveNote(n.id, { pinned: !n.pinned })
    await useStore.getState().refresh()
  }

  const changeCover = (): void => {
    useStore.setState({ coverPickerFor: nb.id })
  }

  const viewLabel = searching
    ? `“${scopedQuery.trim()}”`
    : activeTag
      ? `#${activeTag}`
      : folderId
        ? folderId
        : 'All notes'

  return (
    <div className="nb">
      <aside className="nb-side">
        <div className="nb-side-head">
          <Cover cover={nb.cover} className="sh-cover" />
          <div className="sh-text">
            <h2>{nb.name}</h2>
            <div className="sh-meta">
              {nb.noteCount} note{nb.noteCount === 1 ? '' : 's'}
            </div>
          </div>
          <Menu
            trigger={(open) => (
              <button className="iconbtn" title="Notebook options" onClick={open}>
                ⋯
              </button>
            )}
          >
            {(close) => (
              <>
                <button
                  onClick={() => {
                    close()
                    renameNotebook()
                  }}
                >
                  Rename notebook
                </button>
                <button
                  onClick={() => {
                    close()
                    changeCover()
                  }}
                >
                  Change cover
                </button>
                <button
                  onClick={() => {
                    close()
                    exportScope()
                  }}
                >
                  Export notes…
                </button>
                <div className="menu-sep" />
                <button
                  className="danger"
                  onClick={() => {
                    close()
                    deleteNotebook()
                  }}
                >
                  Delete notebook
                </button>
              </>
            )}
          </Menu>
        </div>

        <div className="searchfield">
          <span className="mag">
            <Icon name="search" size={15} />
          </span>
          <input
            value={scopedQuery}
            onChange={(e) => setScopedQuery(e.target.value)}
            placeholder={`Search ${nb.name}`}
          />
        </div>
        <div className="scope-hint">
          This notebook ·{' '}
          <button onClick={() => go({ name: 'search', scope: 'all', query: scopedQuery.trim() })}>
            search everywhere →
          </button>
        </div>

        <nav className="side-nav">
          <button
            className={`nav-item ${folderId === null && !activeTag && !searching ? 'on' : ''}`}
            onClick={pickAll}
          >
            <Icon name="stack" />
            <span className="ni-label">All notes</span>
            <span className="ni-count">{nb.noteCount}</span>
          </button>
          {nb.folders.map((f) => (
            <div key={f.id} className="nav-row">
              <button
                className={`nav-item ${folderId === f.id && !activeTag ? 'on' : ''}`}
                onClick={() => pickFolder(f.id)}
                onDoubleClick={() => renameFolder(f.id)}
                title="Double-click to rename"
              >
                <Icon name="folder" />
                <span className="ni-label">{f.name}</span>
                <span className="ni-count">{f.noteCount}</span>
              </button>
              <button className="nav-del" title="Delete folder" onClick={() => deleteFolder(f.id)}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
          {rootCount > 0 && nb.folders.length > 0 && (
            <button
              className={`nav-item ${folderId === null && !activeTag && !searching ? '' : ''}`}
              onClick={pickAll}
            >
              <Icon name="inbox" />
              <span className="ni-label">Not in a series</span>
              <span className="ni-count">{rootCount}</span>
            </button>
          )}
          <button className="nav-item muted" onClick={newFolder}>
            <Icon name="plus" />
            <span className="ni-label">New folder</span>
          </button>
        </nav>

        {topics.length > 0 && (
          <>
            <div className="nav-sep" />
            <nav className="side-nav">
              <div className="side-label">Topics</div>
              {topics.slice(0, 12).map(([t, c]) => (
                <button
                  key={t}
                  className={`nav-item ${activeTag === t ? 'on' : ''}`}
                  onClick={() => setActiveTag(activeTag === t ? null : t)}
                >
                  <Icon name="tag" />
                  <span className="ni-label">{t}</span>
                  <span className="ni-count">{c}</span>
                </button>
              ))}
            </nav>
          </>
        )}

        <div className="nav-sep" />
        <div className="side-list-wrap">
          <div className="side-label">
            {viewLabel} · {visible.length}
          </div>
          <div className="side-list">
            {visible.map((n) => (
              <button key={n.id} className="mini-note" onClick={() => openNote(n.id)}>
                <span className="t">
                  {n.pinned && <span className="mini-star">★</span>}
                  {n.title}
                </span>
                <span className="d">{fmtDate(n.updated)}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="nb-main">
        <div className="nb-bar">
          <h2>
            {searching || folderId || activeTag ? <span className="dim">/</span> : null} {viewLabel}
          </h2>
          <span className="nb-count">
            {visible.length} note{visible.length === 1 ? '' : 's'}
          </span>
          {activeTag && (
            <button className="btn ghost sm" onClick={() => setActiveTag(null)}>
              clear
            </button>
          )}
          <span className="grow" />
          <div className="seg">
            <button className={view === 'cards' ? 'on' : ''} onClick={() => setViewPersist('cards')}>
              Cards
            </button>
            <button className={view === 'list' ? 'on' : ''} onClick={() => setViewPersist('list')}>
              List
            </button>
          </div>
          <Menu
            trigger={(open) => (
              <button className="btn accent" onClick={open}>
                ＋ New note
              </button>
            )}
          >
            {(close) => (
              <>
                {templates.map((t) => (
                  <button
                    key={t.id || t.name}
                    onClick={() => {
                      close()
                      newNote(t.body)
                    }}
                  >
                    {t.name}
                  </button>
                ))}
                <div className="menu-sep" />
                <button
                  onClick={() => {
                    close()
                    useStore.setState({ templatesOpen: true })
                  }}
                >
                  Manage templates…
                </button>
              </>
            )}
          </Menu>
        </div>

        {visible.length === 0 ? (
          <div className="empty-state">
            <div className="es-big">Nothing here yet</div>
            {searching ? 'No notes match your search.' : 'Make your first note with “＋ New note”.'}
          </div>
        ) : view === 'list' ? (
          <div className="note-list">
            {visible.map((n) => (
              <div key={n.id} className="lrow" onClick={() => openNote(n.id)}>
                <button
                  className={`star ${n.pinned ? 'on' : ''}`}
                  title={n.pinned ? 'Unstar' : 'Star'}
                  onClick={(e) => toggleStar(n, e)}
                >
                  {n.pinned ? '★' : '☆'}
                </button>
                <div className="lrow-main">
                  <span className="lrow-title">{n.title}</span>
                  <span className="lrow-sum">{n.summary || n.excerpt}</span>
                </div>
                <div className="lrow-tags">
                  {n.tags.slice(0, 2).map((t) => (
                    <span key={t} className="tag-pill">
                      {t}
                    </span>
                  ))}
                </div>
                <span className="lrow-date">{fmtDate(n.updated)}</span>
                <Menu
                  trigger={(open) => (
                    <button
                      className="ncard-menu"
                      title="Note options"
                      onClick={(e) => {
                        e.stopPropagation()
                        open()
                      }}
                    >
                      ⋯
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          close()
                          useStore.setState({
                            moveTarget: { noteId: n.id, title: n.title }
                          })
                        }}
                      >
                        Move to…
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          close()
                          useStore.setState({
                            exportTarget: { noteIds: [n.id], name: n.title }
                          })
                        }}
                      >
                        Export note…
                      </button>
                      <div className="menu-sep" />
                      <button
                        className="danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          close()
                          deleteNote(n)
                        }}
                      >
                        Delete note
                      </button>
                    </>
                  )}
                </Menu>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-grid">
            {visible.map((n) => (
              <div key={n.id} className="ncard" onClick={() => openNote(n.id)}>
                <button
                  className={`star ${n.pinned ? 'on' : ''}`}
                  title={n.pinned ? 'Unstar' : 'Star'}
                  onClick={(e) => toggleStar(n, e)}
                >
                  {n.pinned ? '★' : '☆'}
                </button>
                <h3>{n.title}</h3>
                <p className="sum">{n.summary || n.excerpt || 'No preview yet.'}</p>
                <div className="foot">
                  {n.tags.slice(0, 3).map((t) => (
                    <span key={t} className="tag-pill">
                      {t}
                    </span>
                  ))}
                  <span className="date">{fmtDate(n.updated)}</span>
                </div>
                <Menu
                  trigger={(open) => (
                    <button
                      className="ncard-menu"
                      title="Note options"
                      onClick={(e) => {
                        e.stopPropagation()
                        open()
                      }}
                    >
                      ⋯
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          close()
                          useStore.setState({
                            moveTarget: { noteId: n.id, title: n.title }
                          })
                        }}
                      >
                        Move to…
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          close()
                          useStore.setState({
                            exportTarget: { noteIds: [n.id], name: n.title }
                          })
                        }}
                      >
                        Export note…
                      </button>
                      <div className="menu-sep" />
                      <button
                        className="danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          close()
                          deleteNote(n)
                        }}
                      >
                        Delete note
                      </button>
                    </>
                  )}
                </Menu>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
