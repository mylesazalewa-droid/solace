import { useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'

marked.use({ breaks: true, gfm: true })
import { useStore } from '../store'
import { saveNote, trashNote, toggleTask, type Note } from '../lib/notes'
import { attachKind, resolveAttachPath, getAttachmentDataUrl } from '../lib/attachments'

export function NoteScreen({ id }: { id: string }): JSX.Element {
  const notes = useStore((s) => s.notes)
  const user = useStore((s) => s.user)
  const route = useStore((s) => s.route)
  const go = useStore((s) => s.go)
  const note = notes.find((n) => n.id === id)
  const back = route.name === 'note' ? route.from : { name: 'home' as const }

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tab, setTab] = useState<'write' | 'read'>('read')
  const [state, setState] = useState<'clean' | 'dirty' | 'saved'>('clean')
  const loadedFor = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ title: '', body: '' })

  useEffect(() => {
    if (note && loadedFor.current !== note.id) {
      loadedFor.current = note.id
      setTitle(note.title)
      setBody(note.body)
      latest.current = { title: note.title, body: note.body }
      setState('clean')
      // a fresh / empty note opens ready to type; one with content opens in Read
      setTab(note.body.trim() ? 'read' : 'write')
    }
  }, [note])

  const flush = async (): Promise<void> => {
    if (!note || !user || state !== 'dirty') return
    await saveNote(user.uid, note, {
      title: latest.current.title.trim() || 'Untitled note',
      body: latest.current.body
    })
    setState('saved')
    setTimeout(() => setState((s) => (s === 'saved' ? 'clean' : s)), 1600)
  }

  const queue = (t: string, b: string): void => {
    latest.current = { title: t, body: b }
    setState('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 1100)
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      void flush()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const html = useMemo(
    () => marked.parse(body || '_Empty note_', { async: false }) as string,
    [body]
  )

  if (!note) {
    return (
      <div className="editor">
        <div className="editor-bar">
          <button className="back" onClick={() => go(back)}>
            ‹ Back
          </button>
        </div>
        <div className="lib-empty">This note isn’t here anymore.</div>
      </div>
    )
  }

  const del = async (): Promise<void> => {
    if (!user) return
    if (!confirm(`Delete “${note.title}”? It moves to the desktop app’s trash.`)) return
    await trashNote(user.uid, note)
    go(back)
  }

  const onCheckbox = async (line: number, done: boolean): Promise<void> => {
    if (user) await toggleTask(user.uid, note as Note, line, done)
  }

  return (
    <div className="editor">
      <div className="editor-bar">
        <button className="back" onClick={() => { void flush(); go(back) }}>
          ‹ Back
        </button>
        <div className="seg">
          <button className={tab === 'read' ? 'on' : ''} onClick={() => { void flush(); setTab('read') }}>
            Read
          </button>
          <button className={tab === 'write' ? 'on' : ''} onClick={() => setTab('write')}>
            Write
          </button>
        </div>
        <button className="tbtn danger" onClick={del} aria-label="Delete note">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
          </svg>
        </button>
      </div>

      <div className="editor-scroll">
        <div className="editor-inner">
          <div className="ed-meta">
            <span>{note.notebook}</span>
            <span className={`save-state ${state === 'dirty' ? 'dirty' : ''}`}>
              {state === 'saved' ? 'Saved' : state === 'dirty' ? 'Saving…' : ''}
            </span>
          </div>
          <input
            className="ed-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              queue(e.target.value, body)
            }}
            onBlur={flush}
            placeholder="Title"
          />
          {tab === 'write' ? (
            <textarea
              className="ed-body"
              value={body}
              onChange={(e) => {
                setBody(e.target.value)
                queue(title, e.target.value)
              }}
              onBlur={flush}
              placeholder="Write in Markdown…"
            />
          ) : (
            <ReadBody
              html={html}
              body={body}
              notePath={note.path}
              uid={user?.uid}
              onCheckbox={onCheckbox}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ReadBody({
  html,
  body,
  notePath,
  uid,
  onCheckbox
}: {
  html: string
  body: string
  notePath: string
  uid: string | undefined
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

  // resolve synced attachments (images/audio/files) referenced by relative path —
  // the desktop app can read them straight off disk, the web app has to pull them
  // out of Firestore and swap in a data: URL
  useEffect(() => {
    const root = ref.current
    if (!root || !uid) return
    let live = true

    const patchSrc = (el: HTMLImageElement | HTMLMediaElement, src: string): void => {
      const path = resolveAttachPath(notePath, src)
      if (!path) return
      getAttachmentDataUrl(uid, path).then((url) => {
        if (live && url) el.src = url
      })
    }

    root.querySelectorAll('img[src]').forEach((img) => {
      const src = img.getAttribute('src')
      if (src) patchSrc(img as HTMLImageElement, src)
    })
    root.querySelectorAll('audio[src], video[src]').forEach((el) => {
      const src = el.getAttribute('src')
      if (src) patchSrc(el as HTMLMediaElement, src)
    })
    root.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href')
      if (!href) return
      const path = resolveAttachPath(notePath, href)
      if (!path) return
      const kind = attachKind(path)
      const label = a.textContent ?? ''
      getAttachmentDataUrl(uid, path).then((url) => {
        if (!live || !url) return
        const link = a as HTMLAnchorElement
        link.href = url
        link.target = '_blank'
        link.rel = 'noopener'
        if (kind === 'file' && !url.startsWith('data:application/pdf')) {
          link.setAttribute('download', label.replace(/^📎\s*/, '') || path.split('/').pop() || 'file')
        }
      })
    })

    return () => {
      live = false
    }
  }, [html, notePath, uid])

  return <div ref={ref} className="ed-read" dangerouslySetInnerHTML={{ __html: html }} />
}
