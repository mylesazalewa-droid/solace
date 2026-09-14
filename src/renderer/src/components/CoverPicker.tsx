import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Cover } from './Cover'
import type { CoverSpec, CoverStyle } from '../../../shared/types'

const STYLES: { id: CoverStyle; name: string }[] = [
  { id: 'arcs', name: 'Arcs' },
  { id: 'stripe', name: 'Stripes' },
  { id: 'dots', name: 'Dots' },
  { id: 'chev', name: 'Chevron' },
  { id: 'grid', name: 'Grid' },
  { id: 'wash', name: 'Wash' }
]

// c1 = ink colour, c2 = light tint behind it
const COLORS: { c1: string; c2: string }[] = [
  { c1: '#2f7d5b', c2: '#e9f2ec' },
  { c1: '#3f9a72', c2: '#e4f1ea' },
  { c1: '#4c6b86', c2: '#dde6ec' },
  { c1: '#3a5fb0', c2: '#e2e8f6' },
  { c1: '#6f63e6', c2: '#e9e7fb' },
  { c1: '#8a4fa8', c2: '#efe3f4' },
  { c1: '#b8447a', c2: '#f6e0eb' },
  { c1: '#c25239', c2: '#f6e2dc' },
  { c1: '#c98a2f', c2: '#f6ead6' },
  { c1: '#7d7a2f', c2: '#efeed6' },
  { c1: '#2c2f45', c2: '#e7e4d7' },
  { c1: '#5b5147', c2: '#ece5da' }
]

export function CoverPicker(): JSX.Element | null {
  const notebookId = useStore((s) => s.coverPickerFor)
  const snapshot = useStore((s) => s.snapshot)
  const nb = snapshot?.notebooks.find((n) => n.id === notebookId)
  const [spec, setSpec] = useState<CoverSpec | null>(nb?.cover ?? null)

  useEffect(() => {
    setSpec(nb?.cover ?? null)
  }, [nb?.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') useStore.setState({ coverPickerFor: null })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!notebookId || !nb || !spec) return null

  const close = (): void => useStore.setState({ coverPickerFor: null })

  const apply = async (next: CoverSpec): Promise<void> => {
    setSpec(next)
    const snap = await window.solace.setNotebookCover(notebookId, next)
    useStore.setState({ snapshot: snap })
  }

  const uploadPhoto = async (): Promise<void> => {
    const snap = await window.solace.pickCoverImage(notebookId)
    if (!snap) return
    useStore.setState({ snapshot: snap })
    const fresh = snap.notebooks.find((n) => n.id === notebookId)
    if (fresh) setSpec(fresh.cover)
  }

  return (
    <div className="prompt-scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="cover-picker" role="dialog" aria-modal="true" aria-label="Change cover">
        <div className="settings-head">
          <h3>Cover for “{nb.name}”</h3>
          <button className="iconbtn" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="cp-body">
          <div className="cp-preview">
            <Cover cover={spec} />
            <button className="btn subtle sm cp-upload" onClick={uploadPhoto}>
              {spec.style === 'image' ? 'Choose a different photo…' : 'Upload your own photo…'}
            </button>
          </div>

          <div className="cp-controls">
            <div className="sec-label">Pattern</div>
            <div className="cp-styles">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  className={`cp-style ${spec.style === s.id ? 'on' : ''}`}
                  onClick={() => apply({ ...spec, style: s.id })}
                >
                  <Cover cover={{ ...spec, style: s.id }} className="cp-swatch" />
                  <span>{s.name}</span>
                </button>
              ))}
            </div>

            {spec.style !== 'image' && (
              <>
                <div className="sec-label">Colour</div>
                <div className="cp-colors">
                  {COLORS.map((c) => (
                    <button
                      key={c.c1}
                      className={`cp-color ${spec.c1 === c.c1 ? 'on' : ''}`}
                      style={{ background: c.c1 }}
                      onClick={() => apply({ ...spec, c1: c.c1, c2: c.c2 })}
                      aria-label={c.c1}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
