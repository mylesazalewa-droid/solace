import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { askConfirm } from '../prompt'
import type { NoteTemplate } from '../../../shared/types'

const NEW: NoteTemplate = { id: '', name: '', body: '' }

export function Templates(): JSX.Element | null {
  const open = useStore((s) => s.templatesOpen)
  const close = (): void => useStore.setState({ templatesOpen: false })
  const [list, setList] = useState<NoteTemplate[]>([])
  const [sel, setSel] = useState<NoteTemplate | null>(null)
  const [draft, setDraft] = useState<NoteTemplate>(NEW)

  useEffect(() => {
    if (open) window.solace.listTemplates().then(setList)
  }, [open])

  if (!open) return null

  const pick = (t: NoteTemplate): void => {
    setSel(t)
    setDraft({ ...t })
  }
  const startNew = (): void => {
    setSel(NEW)
    setDraft({ ...NEW })
  }

  const save = async (): Promise<void> => {
    const next = await window.solace.saveTemplate(draft)
    setList(next)
    const match =
      next.find((t) => t.name === draft.name && !t.builtin) ?? next[next.length - 1]
    setSel(match)
    setDraft({ ...match })
  }

  const remove = async (t: NoteTemplate): Promise<void> => {
    const ok = await askConfirm({
      title: `Delete “${t.name}”?`,
      confirmText: 'Delete',
      danger: true
    })
    if (!ok) return
    const next = await window.solace.deleteTemplate(t.id)
    setList(next)
    setSel(null)
  }

  const editing = sel !== null

  return (
    <div className="prompt-scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="settings-card tpl-card" role="dialog" aria-modal="true" aria-label="Templates">
        <div className="settings-head">
          <h2>Templates</h2>
          <button className="iconbtn" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="tpl-body">
          <div className="tpl-list">
            {list.map((t) => (
              <button
                key={t.id || t.name}
                className={`tpl-row ${sel?.id === t.id ? 'on' : ''}`}
                onClick={() => pick(t)}
              >
                <span>{t.name}</span>
                {t.builtin && <span className="tpl-badge">built-in</span>}
              </button>
            ))}
            <button className="tpl-row muted" onClick={startNew}>
              ＋ New template
            </button>
          </div>

          <div className="tpl-edit">
            {!editing ? (
              <p className="sec-note">Pick a template to preview it, or make a new one.</p>
            ) : (
              <>
                <label className="field">
                  <span>Name</span>
                  <input
                    value={draft.name}
                    disabled={!!draft.builtin}
                    placeholder="e.g. Weekly review"
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Body</span>
                  <textarea
                    className="tpl-textarea"
                    value={draft.body}
                    disabled={!!draft.builtin}
                    placeholder={'## Heading\n\n- point'}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  />
                </label>
                {draft.builtin ? (
                  <p className="sec-note">Built-in templates can’t be edited, but you can start a new one from this text.</p>
                ) : (
                  <div className="prompt-actions">
                    {sel?.id && (
                      <button className="btn ghost" onClick={() => remove(sel)}>
                        Delete
                      </button>
                    )}
                    <button className="btn accent" onClick={save} disabled={!draft.name.trim()}>
                      Save
                    </button>
                  </div>
                )}
                {draft.builtin && (
                  <div className="prompt-actions">
                    <button
                      className="btn subtle"
                      onClick={() => setDraft({ id: '', name: `${draft.name} copy`, body: draft.body })}
                    >
                      Duplicate as editable
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
