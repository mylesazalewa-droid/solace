import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { marked } from 'marked'
import { useStore } from '../store'
import { askConfirm } from '../prompt'
import { Menu } from './Menu'
import { Icon } from './Icon'
import { TagEditor } from './TagEditor'
import { FormatBar } from './FormatBar'
import { wikiLinkComplete } from '../editor/wikiComplete'
import { attachScripture } from '../editor/scripturePreview'
import { diffWords, hasRealChange } from '../diff'
import type { NoteDoc } from '../../../shared/types'

export function NoteEditor(): JSX.Element {
  const route = useStore((s) => s.route)
  const go = useStore((s) => s.go)
  const refresh = useStore((s) => s.refresh)
  const config = useStore((s) => s.config)

  const [doc, setDoc] = useState<NoteDoc | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [summaryBusy, setSummaryBusy] = useState(false)
  const [mode, setMode] = useState<'write' | 'read'>('write')
  const [saved, setSaved] = useState(true)
  const [tidy, setTidy] = useState<{
    state: 'loading' | 'ready' | 'error'
    after?: string
    newTitle?: string
    msg?: string
  } | null>(null)
  const [enriching, setEnriching] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtySinceOpen = useRef(false)
  const lastSummarizedLen = useRef(0)

  const noteId = route.name === 'note' ? route.noteId : null
  const backTo = route.name === 'note' ? route.backTo : { name: 'shelf' as const }
  const snapshot = useStore((s) => s.snapshot)
  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of snapshot?.notes ?? []) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [snapshot])

  const cmRef = useRef<ReactCodeMirrorRef>(null)
  const [cmView, setCmView] = useState<EditorView | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const bibleTranslation = config?.bibleTranslation ?? 'kjv'

  useEffect(() => {
    if (mode !== 'read' || !previewRef.current) return
    return attachScripture(previewRef.current, () => bibleTranslation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, body, bibleTranslation])
  // note titles for `[[` autocomplete, read live from a ref so the extension is stable
  const titlesRef = useRef<string[]>([])
  titlesRef.current = useMemo(
    () => (snapshot?.notes ?? []).map((n) => n.title).filter(Boolean),
    [snapshot]
  )
  const cmExtensions = useMemo(
    () => [
      markdown({ base: markdownLanguage }),
      EditorView.lineWrapping,
      wikiLinkComplete(() => titlesRef.current)
    ],
    []
  )

  const notes = snapshot?.notes ?? []
  const backlinks = useMemo(() => {
    if (!doc) return []
    const t = doc.title.trim().toLowerCase()
    return notes.filter(
      (n) => n.id !== doc.id && n.links.some((l) => l.trim().toLowerCase() === t)
    )
  }, [notes, doc])

  const STOP = new Set(
    'the a an and or of to in on for with is are was were be as at by from into about note notes idea'.split(' ')
  )
  const related = useMemo(() => {
    if (!doc) return []
    const words = (s: string): Set<string> =>
      new Set(
        s
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 3 && !STOP.has(w))
      )
    const myWords = words(`${doc.title} ${doc.summary}`)
    const myTags = new Set(doc.tags)
    const backSet = new Set(backlinks.map((b) => b.id))
    return notes
      .filter((n) => n.id !== doc.id && !backSet.has(n.id))
      .map((n) => {
        let score = 0
        for (const t of n.tags) if (myTags.has(t)) score += 3
        const nw = words(`${n.title} ${n.summary}`)
        for (const w of nw) if (myWords.has(w)) score += 1
        return { n, score }
      })
      .filter((x) => x.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.n)
  }, [notes, doc, backlinks])

  const openRef = (id: string): void => {
    if (route.name === 'note') go({ name: 'note', noteId: id, backTo: route.backTo })
  }

  const renderWithWikiLinks = (src: string): string =>
    src.replace(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g, (_m, target: string, label?: string) => {
      const t = target.trim()
      return `[${(label ?? t).trim()}](#wiki:${encodeURIComponent(t)})`
    })

  const onPreviewClick = (e: React.MouseEvent): void => {
    const a = (e.target as HTMLElement).closest('a')
    if (!a) return
    const href = a.getAttribute('href') ?? ''
    if (href.startsWith('#wiki:')) {
      e.preventDefault()
      const target = decodeURIComponent(href.slice(6)).toLowerCase()
      const hit = notes.find((n) => n.title.trim().toLowerCase() === target)
      if (hit) openRef(hit.id)
    } else if (/^https?:/.test(href)) {
      e.preventDefault()
      window.solace.openUrl(href)
    }
  }

  useEffect(() => {
    if (!noteId) return
    dirtySinceOpen.current = false
    window.solace.readNote(noteId).then((d) => {
      setDoc(d)
      setTitle(d.title)
      setBody(d.body)
      setTags(d.tags)
      setSummary(d.summary)
      lastSummarizedLen.current = d.summary ? d.body.length : 0
      setSaved(true)
    })
  }, [noteId])

  const flush = useCallback(async () => {
    if (!noteId) return
    await window.solace.saveNote(noteId, { title: title.trim() || 'Untitled note', body, tags })
    setSaved(true)
    refresh()
  }, [noteId, title, body, tags, refresh])

  const updateTags = useCallback(
    (next: string[]) => {
      setTags(next)
      setSaved(false)
      window.solace.saveNote(noteId ?? '', { tags: next }).then(() => {
        setSaved(true)
        refresh()
      })
    },
    [noteId, refresh]
  )

  const summaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateSummary = useCallback(
    (text: string) => {
      setSummary(text)
      if (summaryTimer.current) clearTimeout(summaryTimer.current)
      summaryTimer.current = setTimeout(() => {
        window.solace.saveNote(noteId ?? '', { summary: text }).then(() => refresh())
        lastSummarizedLen.current = body.length
      }, 500)
    },
    [noteId, body.length, refresh]
  )

  const regenSummary = useCallback(async () => {
    if (!noteId || summaryBusy) return
    setSummaryBusy(true)
    try {
      if (!saved) await flush()
      const snap = await window.solace.summarizeNote(noteId)
      useStore.setState({ snapshot: snap })
      const fresh = await window.solace.readNote(noteId)
      setSummary(fresh.summary)
      setDoc(fresh)
      lastSummarizedLen.current = fresh.body.length
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'The helper couldn’t write a summary.')
    } finally {
      setSummaryBusy(false)
    }
  }, [noteId, summaryBusy, saved, flush])

  const scheduleSave = useCallback(() => {
    setSaved(false)
    dirtySinceOpen.current = true
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(flush, 700)
  }, [flush])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (autoTimer.current) clearTimeout(autoTimer.current)
      if (summaryTimer.current) clearTimeout(summaryTimer.current)
    }
  }, [])

  // background auto-summary: a few seconds after you stop typing, if enabled and
  // the note has grown enough that its summary is stale (or missing).
  useEffect(() => {
    if (!noteId || !config?.autoSummary || summaryBusy) return
    const len = body.trim().length
    const grew = len - lastSummarizedLen.current
    const needs = (!summary && len > 140) || grew > 220
    if (!needs) return
    if (autoTimer.current) clearTimeout(autoTimer.current)
    autoTimer.current = setTimeout(async () => {
      try {
        setSummaryBusy(true)
        await window.solace.saveNote(noteId, { title: title.trim() || 'Untitled note', body, tags })
        const snap = await window.solace.summarizeNote(noteId)
        useStore.setState({ snapshot: snap })
        const fresh = await window.solace.readNote(noteId)
        setSummary(fresh.summary)
        setDoc(fresh)
        lastSummarizedLen.current = fresh.body.trim().length
      } catch {
        /* silent — the manual ↻ still works */
      } finally {
        setSummaryBusy(false)
      }
    }, 6000)
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current)
    }
  }, [body, noteId, config?.autoSummary, summary, summaryBusy, title, tags])

  const goBack = async (): Promise<void> => {
    if (!saved) await flush()
    // auto-summary/tags after a real edit, if the helper is set up for it
    if (
      noteId &&
      dirtySinceOpen.current &&
      config?.autoSummary &&
      body.trim().length > 40
    ) {
      window.solace.enrichNote(noteId).then((snap) => useStore.setState({ snapshot: snap })).catch(() => {})
    }
    go(backTo)
  }

  const remove = async (): Promise<void> => {
    if (!noteId) return
    const ok = await askConfirm({
      title: 'Delete this note?',
      label: `“${title.trim() || 'Untitled note'}” moves to the trash. You can get it back from your notes folder.`,
      confirmText: 'Delete note',
      danger: true
    })
    if (!ok) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const snap = await window.solace.deleteNote(noteId)
    useStore.setState({ snapshot: snap })
    go(backTo)
  }

  const runTidy = async (): Promise<void> => {
    if (!body.trim() && !title.trim()) return
    setTidy({ state: 'loading' })
    try {
      // tidy title + body together so title typos get caught too
      const combined = `# ${title.trim() || 'Untitled'}\n\n${body}`
      const out = await window.solace.tidy(combined)
      let newTitle = title
      let after = out
      const m = out.match(/^#\s+(.+?)\n+([\s\S]*)$/)
      if (m) {
        newTitle = m[1].trim()
        after = m[2].trim()
      }
      setTidy({ state: 'ready', after, newTitle })
    } catch (err) {
      setTidy({ state: 'error', msg: err instanceof Error ? err.message : 'The helper failed.' })
    }
  }

  const acceptTidy = (): void => {
    if (tidy?.after != null) {
      setBody(tidy.after)
      if (tidy.newTitle && tidy.newTitle !== title) setTitle(tidy.newTitle)
      scheduleSave()
    }
    setTidy(null)
  }

  const summarizeNow = async (): Promise<void> => {
    if (!noteId) return
    setEnriching(true)
    try {
      if (!saved) await flush()
      const snap = await window.solace.enrichNote(noteId)
      useStore.setState({ snapshot: snap })
      const fresh = await window.solace.readNote(noteId)
      setDoc(fresh)
      setTags(fresh.tags)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'The helper failed.')
    } finally {
      setEnriching(false)
    }
  }

  if (!doc) return <div className="editor" />

  return (
    <div className="editor">
      <div className="editor-bar">
        <button className="btn ghost" onClick={goBack}>
          ‹ {doc.notebookId}
        </button>
        <span className="grow" />
        <span className={`save-state ${saved ? '' : 'dirty'}`}>{saved ? 'Saved' : 'Saving…'}</span>
        <div className="seg">
          <button className={mode === 'write' ? 'on' : ''} onClick={() => setMode('write')}>
            Write
          </button>
          <button className={mode === 'read' ? 'on' : ''} onClick={() => setMode('read')}>
            Preview
          </button>
        </div>
        <button
          className="btn tidy"
          onClick={runTidy}
          disabled={!body.trim() || tidy?.state === 'loading'}
        >
          ✦ {tidy?.state === 'loading' ? 'Tidying…' : 'Tidy up'}
        </button>
        <Menu
          trigger={(open) => (
            <button className="iconbtn" title="Note options" onClick={open}>
              ⋯
            </button>
          )}
        >
          {(close) => (
            <>
              <button
                onClick={() => {
                  close()
                  summarizeNow()
                }}
                disabled={enriching}
              >
                {enriching ? 'Working…' : '✦ Write summary & tags'}
              </button>
              <button
                onClick={() => {
                  close()
                  if (noteId)
                    useStore.setState({
                      moveTarget: { noteId, title: title.trim() || 'Untitled note' }
                    })
                }}
              >
                Move to…
              </button>
              <button
                onClick={() => {
                  close()
                  if (noteId)
                    useStore.setState({
                      exportTarget: {
                        noteIds: [noteId],
                        name: title.trim() || 'Untitled note'
                      }
                    })
                }}
              >
                Export note…
              </button>
              <button
                onClick={() => {
                  close()
                  if (noteId)
                    useStore.setState({
                      historyFor: { noteId, title: title.trim() || 'Untitled note' }
                    })
                }}
              >
                Version history…
              </button>
              <button
                onClick={async () => {
                  close()
                  if (!noteId) return
                  const ok = await askConfirm({
                    title: 'Split into a series?',
                    label:
                      'Each heading becomes its own note in a new folder. This note stays as an index linking to them.',
                    confirmText: 'Split'
                  })
                  if (!ok) return
                  try {
                    const snap = await window.solace.splitNote(noteId)
                    useStore.setState({ snapshot: snap })
                  } catch (err) {
                    window.alert(err instanceof Error ? err.message : 'Could not split note')
                  }
                }}
              >
                Split into a series…
              </button>
              <div className="menu-sep" />
              <button
                className="danger"
                onClick={() => {
                  close()
                  remove()
                }}
              >
                Delete note
              </button>
            </>
          )}
        </Menu>
      </div>

      <div className="editor-scroll">
        <div className="editor-inner">
          <input
            className="title-input"
            value={title}
            placeholder="Untitled note"
            onChange={(e) => {
              setTitle(e.target.value)
              scheduleSave()
            }}
          />
          <div className="editor-stamp">
            {new Date(doc.updated).toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}{' '}
            · saved automatically
          </div>

          <div className={`note-summary ${summary ? '' : 'empty'}`}>
            <span className="ns-mark" title="Written by the helper">
              ✦
            </span>
            <textarea
              className="ns-input"
              value={summary}
              rows={1}
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto'
                  el.style.height = el.scrollHeight + 'px'
                }
              }}
              placeholder={
                summaryBusy
                  ? 'The helper is writing a summary…'
                  : 'One-line summary — the helper writes this as you go, or type your own'
              }
              onChange={(e) => updateSummary(e.target.value)}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = el.scrollHeight + 'px'
              }}
            />
            <button
              className="ns-redo"
              title="Re-write the summary"
              onClick={regenSummary}
              disabled={summaryBusy || !body.trim()}
            >
              <Icon name="sparkle" size={13} />
              {summaryBusy ? '…' : summary ? 'Redo' : 'Write it'}
            </button>
          </div>

          <TagEditor tags={tags} suggestions={allTags} onChange={updateTags} />

          {mode === 'write' ? (
            <>
              <FormatBar view={cmView} />
              <CodeMirror
                ref={cmRef}
                className="cm-theme"
                value={body}
                extensions={cmExtensions}
                basicSetup={{
                  lineNumbers: false,
                  foldGutter: false,
                  highlightActiveLine: false,
                  autocompletion: false
                }}
                placeholder="Start writing…"
                onCreateEditor={(view) => setCmView(view)}
                onChange={(v) => {
                  setBody(v)
                  scheduleSave()
                }}
              />
            </>
          ) : (
            <div
              ref={previewRef}
              className="preview"
              onClick={onPreviewClick}
              dangerouslySetInnerHTML={{
                __html: marked.parse(renderWithWikiLinks(body || '*Nothing written yet.*')) as string
              }}
            />
          )}

          {(backlinks.length > 0 || related.length > 0) && (
            <div className="note-links">
              {backlinks.length > 0 && (
                <div className="nl-group">
                  <div className="nl-label">
                    <Icon name="tag" size={13} /> Linked from
                  </div>
                  {backlinks.map((n) => (
                    <button key={n.id} className="nl-item" onClick={() => openRef(n.id)}>
                      <span className="nl-title">{n.title}</span>
                      <span className="nl-nb">{n.notebookId}</span>
                    </button>
                  ))}
                </div>
              )}
              {related.length > 0 && (
                <div className="nl-group">
                  <div className="nl-label">
                    <Icon name="sparkle" size={13} /> Related
                  </div>
                  {related.map((n) => (
                    <button key={n.id} className="nl-item" onClick={() => openRef(n.id)}>
                      <span className="nl-title">{n.title}</span>
                      <span className="nl-nb">
                        {n.notebookId}
                        {n.tags.length > 0 ? ` · ${n.tags.slice(0, 2).join(', ')}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {tidy && (
        <div className="prompt-scrim" onMouseDown={(e) => e.target === e.currentTarget && setTidy(null)}>
          <div className="tidy-card" role="dialog" aria-modal="true" aria-label="Tidy up">
            <div className="settings-head">
              <h3>✦ Tidy up</h3>
              <button className="iconbtn" onClick={() => setTidy(null)} aria-label="Close">
                ✕
              </button>
            </div>
            {tidy.state === 'loading' && <div className="tidy-loading">Reading it over…</div>}
            {tidy.state === 'error' && (
              <div className="tidy-error">
                {tidy.msg}
                <div style={{ marginTop: 10 }}>
                  <button className="btn subtle" onClick={() => setTidy(null)}>
                    Close
                  </button>
                </div>
              </div>
            )}
            {tidy.state === 'ready' &&
              (() => {
                const parts = diffWords(body, tidy.after ?? '')
                const titleParts =
                  tidy.newTitle && tidy.newTitle !== title
                    ? diffWords(title, tidy.newTitle)
                    : null
                const changed = hasRealChange(parts) || Boolean(titleParts)
                const engineName =
                  config?.engine === 'cloud'
                    ? `Gemini (${config.geminiModel})`
                    : `the local model (${config?.ollamaModel})`
                if (!changed) {
                  return (
                    <>
                      <div className="tidy-diff">
                        <div className="tidy-col-h">What {engineName} returned</div>
                        <pre className="diff-pre">{tidy.after}</pre>
                      </div>
                      <p className="sec-note">
                        No changes from your text.{' '}
                        {config?.engine === 'local'
                          ? 'A small local model often misses typos — switch to the free online helper in Settings, or use a bigger model like qwen2.5.'
                          : 'If there are clearly typos, try model name "gemini-1.5-flash" in Settings.'}
                      </p>
                      <div className="prompt-actions">
                        <button className="btn subtle" onClick={() => setTidy(null)}>
                          Close
                        </button>
                      </div>
                    </>
                  )
                }
                return (
                  <>
                    <div className="tidy-diff">
                      <div className="tidy-col-h">Suggested changes · by {engineName}</div>
                      {titleParts && (
                        <pre className="diff-pre" style={{ borderBottom: '1px solid var(--line-soft)', fontWeight: 700 }}>
                          Title:{' '}
                          {titleParts.map((p, i) =>
                            p.type === 'same' ? (
                              <span key={i}>{p.text}</span>
                            ) : p.type === 'add' ? (
                              <ins key={i}>{p.text}</ins>
                            ) : (
                              <del key={i}>{p.text}</del>
                            )
                          )}
                        </pre>
                      )}
                      <pre className="diff-pre">
                        {parts.map((p, i) =>
                          p.type === 'same' ? (
                            <span key={i}>{p.text}</span>
                          ) : p.type === 'add' ? (
                            <ins key={i}>{p.text}</ins>
                          ) : (
                            <del key={i}>{p.text}</del>
                          )
                        )}
                      </pre>
                    </div>
                    <p className="sec-note">
                      <ins className="legend-ins">added / fixed</ins>{' '}
                      <del className="legend-del">removed</del> · meaning unchanged, nothing added.
                    </p>
                    <div className="prompt-actions">
                      <button className="btn ghost" onClick={() => setTidy(null)}>
                        Keep mine
                      </button>
                      <button className="btn accent" onClick={acceptTidy}>
                        Use tidied version
                      </button>
                    </div>
                  </>
                )
              })()}
          </div>
        </div>
      )}
    </div>
  )
}
