import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { Icon } from './Icon'
import type { SortProposal } from '../../../shared/types'

type Phase = 'idle' | 'thinking' | 'review' | 'applying' | 'done'

export function SortPanel(): JSX.Element | null {
  const open = useStore((s) => s.sortOpen)
  const snapshot = useStore((s) => s.snapshot)
  const [phase, setPhase] = useState<Phase>('idle')
  const [proposals, setProposals] = useState<SortProposal[]>([])

  // notes that look un-filed: no summary and no tags
  const candidates = useMemo(
    () => (snapshot?.notes ?? []).filter((n) => !n.summary && n.tags.length === 0),
    [snapshot]
  )

  useEffect(() => {
    if (open) {
      setPhase('idle')
      setProposals([])
    }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && phase !== 'applying' && phase !== 'thinking') {
        useStore.setState({ sortOpen: false })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  if (!open || !snapshot) return null
  const close = (): void => useStore.setState({ sortOpen: false })

  const think = async (): Promise<void> => {
    setPhase('thinking')
    try {
      const res = await window.solace.proposeSort(candidates.map((n) => n.id))
      setProposals(res)
      setPhase('review')
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'The helper failed.')
      setPhase('idle')
    }
  }

  const apply = async (): Promise<void> => {
    setPhase('applying')
    const snap = await window.solace.applySort(
      proposals.map((p) => ({
        noteId: p.noteId,
        toNotebook: p.toNotebook,
        toFolder: p.toFolder,
        tags: p.tags
      }))
    )
    useStore.setState({ snapshot: snap })
    setPhase('done')
  }

  return (
    <div className="prompt-scrim" onMouseDown={(e) => e.target === e.currentTarget && phase === 'idle' && close()}>
      <div className="settings-card" role="dialog" aria-modal="true" aria-label="Sort my notes">
        <div className="settings-head">
          <h3>Sort my notes</h3>
          {(phase === 'idle' || phase === 'review' || phase === 'done') && (
            <button className="iconbtn" onClick={close} aria-label="Close">
              <Icon name="x" size={15} />
            </button>
          )}
        </div>

        <div className="settings-body">
          {phase === 'idle' && (
            <>
              <p className="sec-note">
                {candidates.length === 0
                  ? 'Everything already has a summary and tags — nothing to sort.'
                  : `${candidates.length} note${candidates.length === 1 ? '' : 's'} have no summary or tags yet. The helper will suggest a notebook and tags for each. Nothing moves until you approve it.`}
              </p>
              {candidates.length > 0 && (
                <div className="prompt-actions">
                  <button className="btn ghost" onClick={close}>
                    Cancel
                  </button>
                  <button className="btn accent" onClick={think}>
                    Suggest homes
                  </button>
                </div>
              )}
            </>
          )}

          {phase === 'thinking' && <div className="tidy-loading">Reading {candidates.length} notes…</div>}
          {phase === 'applying' && <div className="tidy-loading">Filing…</div>}

          {phase === 'review' && (
            <>
              <div className="sort-list">
                {proposals.map((p, i) => (
                  <div key={p.noteId} className="sort-row">
                    <div className="sr-main">
                      <span className="sr-title">{p.title}</span>
                      <span className="sr-move">
                        {p.currentNotebook}
                        <Icon name="chevron-left" size={13} className="sr-arrow" />
                        <select
                          value={p.toNotebook}
                          onChange={(e) => {
                            const v = e.target.value
                            setProposals((ps) =>
                              ps.map((x, j) => (j === i ? { ...x, toNotebook: v } : x))
                            )
                          }}
                        >
                          {snapshot.notebooks.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.name}
                            </option>
                          ))}
                        </select>
                      </span>
                    </div>
                    <div className="sr-tags">
                      {p.tags.map((t) => (
                        <span key={t} className="tag-pill">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="prompt-actions">
                <button className="btn ghost" onClick={close}>
                  Not now
                </button>
                <button className="btn accent" onClick={apply}>
                  File them
                </button>
              </div>
            </>
          )}

          {phase === 'done' && (
            <>
              <p className="sec-note">Filed {proposals.length} notes.</p>
              <div className="prompt-actions">
                <button className="btn accent" onClick={close}>
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
