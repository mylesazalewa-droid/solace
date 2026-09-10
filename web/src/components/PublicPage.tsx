import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { marked } from 'marked'
import { db } from '../lib/firebase'

marked.use({ breaks: true, gfm: true })

interface Page {
  title: string
  body: string
  publishedAt?: string
  updatedAt?: string
}

type Status = 'loading' | 'ok' | 'missing' | 'error'

export function PublicPage({ id }: { id: string }): JSX.Element {
  const [status, setStatus] = useState<Status>('loading')
  const [page, setPage] = useState<Page | null>(null)

  useEffect(() => {
    let live = true
    getDoc(doc(db, 'pages', id))
      .then((snap) => {
        if (!live) return
        if (!snap.exists()) {
          setStatus('missing')
          return
        }
        setPage(snap.data() as Page)
        setStatus('ok')
      })
      .catch(() => live && setStatus('error'))
    return () => {
      live = false
    }
  }, [id])

  const html = useMemo(
    () => (page ? (marked.parse(page.body || '_Empty note._', { async: false }) as string) : ''),
    [page]
  )

  const when = useMemo(() => {
    const iso = page?.updatedAt ?? page?.publishedAt
    if (!iso) return null
    const d = new Date(iso)
    return Number.isNaN(d.getTime())
      ? null
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  }, [page])

  return (
    <div className="pub-page">
      <main className="pub-sheet">
        {status === 'loading' && <p className="pub-muted">Loading…</p>}

        {status === 'missing' && (
          <div className="pub-empty">
            <h1>Nothing here</h1>
            <p className="pub-muted">This link was unpublished, or it never existed.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="pub-empty">
            <h1>Couldn’t load this page</h1>
            <p className="pub-muted">Check the link and try again.</p>
          </div>
        )}

        {status === 'ok' && page && (
          <>
            <header className="pub-head">
              <h1>{page.title}</h1>
              {when && <span className="pub-when">{when}</span>}
            </header>
            <article className="ed-read" dangerouslySetInnerHTML={{ __html: html }} />
          </>
        )}

        <footer className="pub-foot">
          <span className="brand-mark" aria-hidden /> Shared with Solace
        </footer>
      </main>
    </div>
  )
}
