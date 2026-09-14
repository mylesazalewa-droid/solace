import { useStore } from '../store'
import type { CoverSpec } from '../../../shared/types'

interface Props {
  cover: CoverSpec
  className?: string
}

/** A notebook cover rendered from a pattern + two colours, or a custom photo. */
export function Cover({ cover, className = '' }: Props): JSX.Element {
  const vault = useStore((s) => s.config?.vaultPath)

  if (cover.style === 'image' && cover.image) {
    const src = vault
      ? `solace-attach://f/${encodeURIComponent(`${vault}/${cover.image}`)}`
      : undefined
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
