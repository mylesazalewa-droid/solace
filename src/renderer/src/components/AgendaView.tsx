import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { Rail } from './Rail'
import { Icon } from './Icon'
import type { TaskItem } from '../../../shared/types'

export function AgendaView(): JSX.Element {
  const go = useStore((s) => s.go)
  const snapshot = useStore((s) => s.snapshot)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showDone, setShowDone] = useState(false)

  const load = async (): Promise<void> => {
    setLoading(true)
    setTasks(await window.solace.agendaList())
    setLoading(false)
  }
  useEffect(() => {
    void load()
  }, [])

  const notebookColor = (id: string): string =>
    snapshot?.notebooks.find((n) => n.id === id)?.cover.c1 ?? 'var(--muted)'

  const toggle = async (t: TaskItem): Promise<void> => {
    // optimistic
    setTasks((prev) =>
      prev.map((x) => (x.noteId === t.noteId && x.line === t.line ? { ...x, done: !x.done } : x))
    )
    const snap = await window.solace.agendaToggle(t.noteId, t.line, !t.done)
    useStore.setState({ snapshot: snap })
  }

  const groups = useMemo(() => {
    const visible = tasks.filter((t) => showDone || !t.done)
    const map = new Map<string, TaskItem[]>()
    for (const t of visible) {
      const arr = map.get(t.noteId) ?? []
      arr.push(t)
      map.set(t.noteId, arr)
    }
    return [...map.entries()]
  }, [tasks, showDone])

  const openCount = tasks.filter((t) => !t.done).length

  return (
    <div className="cal-page">
      <Rail active="agenda" />
      <div className="cal-main agenda-main">
        <div className="cal-top">
          <h2>To-dos</h2>
          <span className="nb-count">
            {openCount} open item{openCount === 1 ? '' : 's'}
          </span>
          <span className="grow" />
          <label className="check-row inline">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
            />
            <span>Show done</span>
          </label>
          <button className="btn subtle sm" onClick={load}>
            Refresh
          </button>
        </div>

        <div className="agenda-body">
          {loading ? (
            <p className="cdp-empty">Gathering checkboxes from every note…</p>
          ) : groups.length === 0 ? (
            <div className="empty-state">
              <div className="es-big">Nothing to do</div>
              Add <code>- [ ] something</code> to any note and it shows up here.
            </div>
          ) : (
            groups.map(([noteId, items]) => (
              <section key={noteId} className="agenda-group">
                <button
                  className="agenda-note"
                  onClick={() =>
                    go({ name: 'note', noteId, backTo: { name: 'agenda' } })
                  }
                >
                  <i style={{ background: notebookColor(items[0].notebookId) }} />
                  <span className="agenda-note-title">{items[0].noteTitle}</span>
                  <span className="agenda-note-nb">{items[0].notebookId}</span>
                  <Icon name="chevron-left" size={14} className="flip agenda-go" />
                </button>
                <ul className="agenda-list">
                  {items.map((t) => (
                    <li key={t.line} className={`agenda-item ${t.done ? 'done' : ''}`}>
                      <button
                        className={`agenda-check ${t.done ? 'on' : ''}`}
                        onClick={() => toggle(t)}
                        aria-label={t.done ? 'Mark not done' : 'Mark done'}
                      >
                        {t.done && <Icon name="check" size={13} />}
                      </button>
                      <span className="agenda-text">{t.text || '(empty)'}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
