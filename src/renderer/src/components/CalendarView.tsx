import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Icon } from './Icon'
import { Rail } from './Rail'
import type { NoteSummary } from '../../../shared/types'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function CalendarView(): JSX.Element {
  const snapshot = useStore((s) => s.snapshot)
  const go = useStore((s) => s.go)
  const today = new Date()
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [field, setField] = useState<'updated' | 'created'>('updated')
  const [selected, setSelected] = useState<string>(ymd(today))

  const byDay = useMemo(() => {
    const map = new Map<string, NoteSummary[]>()
    for (const n of snapshot?.notes ?? []) {
      const key = ymd(new Date(field === 'updated' ? n.updated : n.created))
      const arr = map.get(key) ?? []
      arr.push(n)
      map.set(key, arr)
    }
    return map
  }, [snapshot, field])

  const notebookColor = (id: string): string => {
    const nb = snapshot?.notebooks.find((n) => n.id === id)
    return nb?.cover.c1 ?? 'var(--muted)'
  }

  // build the grid (Mon-first)
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedNotes = (byDay.get(selected) ?? []).slice().sort((a, b) => b.updated.localeCompare(a.updated))
  const selDate = new Date(selected + 'T00:00:00')

  return (
    <div className="cal-page">
      <Rail active="calendar" />

      <div className="cal-main">
        <div className="cal-top">
          <h2>
            {MONTHS[month]} {year}
          </h2>
          <div className="cal-nav">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month">
              <Icon name="chevron-left" size={16} />
            </button>
            <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>
              Today
            </button>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month">
              <Icon name="chevron-left" size={16} className="flip" />
            </button>
          </div>
          <span className="grow" />
          <div className="seg">
            <button className={field === 'updated' ? 'on' : ''} onClick={() => setField('updated')}>
              Edited
            </button>
            <button className={field === 'created' ? 'on' : ''} onClick={() => setField('created')}>
              Created
            </button>
          </div>
        </div>

        <div className="cal-body">
          <div className="cal-grid">
            {DOW.map((d) => (
              <div key={d} className="cal-dow">
                {d}
              </div>
            ))}
            {cells.map((date, i) => {
              if (!date) return <div key={i} className="cal-cell empty" />
              const key = ymd(date)
              const items = byDay.get(key) ?? []
              const isToday = key === ymd(today)
              return (
                <button
                  key={i}
                  className={`cal-cell ${key === selected ? 'sel' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => setSelected(key)}
                >
                  <span className="cc-day">{date.getDate()}</span>
                  {items.length > 0 && (
                    <span className="cc-dots">
                      {[...new Set(items.map((n) => n.notebookId))].slice(0, 4).map((nb) => (
                        <i key={nb} style={{ background: notebookColor(nb) }} />
                      ))}
                      {items.length > 1 && <span className="cc-n">{items.length}</span>}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <aside className="cal-day-panel">
            <div className="cdp-head">
              {selDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              <span className="cdp-count">
                {selectedNotes.length} note{selectedNotes.length === 1 ? '' : 's'}
              </span>
            </div>
            <button
              className="btn subtle sm cdp-daily"
              onClick={async () => {
                const { snapshot: snap, noteId } = await window.solace.openDaily(selected)
                useStore.setState({
                  snapshot: snap,
                  route: { name: 'note', noteId, backTo: { name: 'calendar' } }
                })
              }}
            >
              <Icon name="note" size={14} /> Open daily note
            </button>
            {selectedNotes.length === 0 ? (
              <p className="cdp-empty">Nothing {field === 'updated' ? 'edited' : 'created'} this day.</p>
            ) : (
              <div className="cdp-list">
                {selectedNotes.map((n) => (
                  <button
                    key={n.id}
                    className="cdp-item"
                    onClick={() => go({ name: 'note', noteId: n.id, backTo: { name: 'calendar' } })}
                  >
                    <i style={{ background: notebookColor(n.notebookId) }} />
                    <span className="cdp-title">{n.title}</span>
                    <span className="cdp-nb">{n.notebookId}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
