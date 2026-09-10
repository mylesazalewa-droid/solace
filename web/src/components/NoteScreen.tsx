import { useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import { useStore } from '../store'
import { saveNote, trashNote, toggleTask, type Note } from '../lib/notes'

export function NoteScreen({ id }: { id: string }): JSX.Element {
  const notes = useStore((s) => s.notes)
  const user = useStore((s) => s.user)
  const go = useStore((s) => s.go)
  const note = notes.find((n) => n.id === id)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tab, setTab] = useState<'write' | 'read'>('read')
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const loadedFor = useRef<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // load once per note; don't clobber local edits when snapshots stream in
  useEffect(() => {
    if (note && loadedFor.current !== note.id) {
      loadedFor.current = note.id
      setTitle(note.title)
      setBody(note.body)
      setDirty(false)
    }
  }, [note])

  const flush = async (): Promise<void> => {
    if (!note || !user || !dirty) return
    await saveNote(user.uid, note, { title: title.trim() || 'Untitled note', body })
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const queueSave = (): void => {
    setDirty(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(flush, 1200)
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      void flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const html = useMemo(
    () => marked.parse(body || '_Empty note_', { async: false }) as string,
    [body]
  )

  if (!note) {
    return (
      <div className="note-screen">
        <header className="topbar">
          <button className="tb-link" onClick={() => go({ name: 'home' })}>
            ‹ Back
          </button>
        </header>
        <div className="empty">This note isn’t here anymore.</div>
      </div>
    )
  }

  const del = async (): Promise<void> => {
    if (!user) return
    if (!confirm(`Delete “${note.title}”? It moves to the desktop app’s trash.`)) return
    await trashNote(user.uid, note)
    go({ name: 'home' })
  }

  const onCheckbox = async (line: number, done: boolean): Promise<void> => {
    if (!user) return
    await toggleTask(user.uid, note as Note, line, done)
  }

  return (
    <div className="note-screen">
      <header className="topbar">
        <button className="tb-link" onClick={() => { void flush(); go({ name: 'home' }) }}>
          ‹ Notes
        </button>
        <span className="save-hint">{saved ? 'Saved' : dirty ? 'Editing…' : note.notebook}</span>
        <button className="tb-link danger" onClick={del}>
          Delete
        </button>
      </header>

      <input
        className="note-title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          queueSave()
        }}
        onBlur={flush}
        placeholder="Title"
      />

      <div className="seg">
        <button className={tab === 'read' ? 'on' : ''} onClick={() => { void flush(); setTab('read') }}>
          Read
        </button>
        <button className={tab === 'write' ? 'on' : ''} onClick={() => setTab('write')}>
          Write
        </button>
      </div>

      {tab === 'write' ? (
        <textarea
          className="note-body"
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            queueSave()
          }}
          onBlur={flush}
          placeholder="Write in Markdown…"
        />
      ) : (
        <ReadBody html={html} body={body} onCheckbox={onCheckbox} />
      )}
    </div>
  )
}

function ReadBody({
  html,
  body,
  onCheckbox
}: {
  html: string
  body: string
  onCheckbox: (line: number, done: boolean) => void
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const boxes = Array.from(root.querySelectorAll('input[type=checkbox]')) as HTMLInputElement[]
    const taskLines: number[] = []
    body.split('\n').forEach((l, i) => {
      if (/^\s*[-*+]\s+\[[ xX]\]/.test(l)) taskLines.push(i)
    })
    boxes.forEach((box, i) => {
      box.disabled = false
      box.style.cursor = 'pointer'
      box.onclick = (ev) => {
        ev.preventDefault()
        const line = taskLines[i]
        if (line != null) onCheckbox(line, !box.checked)
      }
    })
  }, [html, body, onCheckbox])

  return <div ref={ref} className="note-read" dangerouslySetInnerHTML={{ __html: html }} />
}
