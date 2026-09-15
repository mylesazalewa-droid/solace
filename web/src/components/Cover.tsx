import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { getAttachmentDataUrl } from '../lib/attachments'
import type { Cover as CoverSpec } from '../lib/notes'

const DEFAULTS: CoverSpec[] = [
  { style: 'arcs', c1: '#2f7d5b', c2: '#e9f2ec' },
  { style: 'stripe', c1: '#d99436', c2: '#f6e7cf' },
  { style: 'dots', c1: '#7367e8', c2: '#e6e2fb' },
  { style: 'wash', c1: '#c15b3c', c2: '#f3ddd2' },
  { style: 'grid', c1: '#4c6b86', c2: '#d7e2ea' },
  { style: 'chev', c1: '#6a7b3c', c2: '#e8edd8' }
]

export function coverFor(name: string, given?: CoverSpec): CoverSpec {
  if (given?.style === 'image' && given.image) return given
  if (given && given.style && given.c1) return given
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return DEFAULTS[Math.abs(h) % DEFAULTS.length]
}

export function Cover({
  cover,
  className = ''
}: {
  cover: CoverSpec
  className?: string
}): JSX.Element {
  const uid = useStore((s) => s.user?.uid)
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    if (cover.style === 'image' && cover.image && uid) {
      getAttachmentDataUrl(uid, cover.image).then((url) => {
        if (live) setSrc(url)
      })
    } else {
      setSrc(null)
    }
    return () => {
      live = false
    }
  }, [cover.style, cover.image, uid])

  if (cover.style === 'image') {
    return (
      <span className={`cover-box cover-image ${className}`}>
        {src && <img src={src} alt="" draggable={false} />}
      </span>
    )
  }

  return (
    <span
      className={`cover-box cover-${cover.style} ${className}`}
      style={
        {
          ['--cc1' as string]: cover.c1,
          ['--cc2' as string]: cover.c2
        } as React.CSSProperties
      }
    />
  )
}
