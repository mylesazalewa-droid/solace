import type { CoverSpec } from '../../../shared/types'

interface Props {
  cover: CoverSpec
  className?: string
}

/** A notebook cover rendered from a pattern + two colours. */
export function Cover({ cover, className = '' }: Props): JSX.Element {
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
