interface Props {
  name: IconName
  size?: number
  className?: string
}

export type IconName =
  | 'stack'
  | 'folder'
  | 'tag'
  | 'search'
  | 'star'
  | 'star-fill'
  | 'plus'
  | 'chevron-left'
  | 'dots'
  | 'sparkle'
  | 'trash'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'auto'
  | 'note'
  | 'import'
  | 'inbox'
  | 'book'
  | 'x'
  | 'check'
  | 'calendar'
  | 'checklist'
  | 'history'
  | 'logo'
  | 'globe'
  | 'message'

const P: Record<IconName, JSX.Element> = {
  stack: (
    <>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 13 9 5 9-5" />
      <path d="m3 18 9 5 9-5" opacity=".5" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />,
  tag: (
    <>
      <path d="M20.6 12.6 12 21l-8-8 8.4-8.4A2 2 0 0 1 13.8 4H19a2 2 0 0 1 2 2v5.2a2 2 0 0 1-.4 1.4Z" />
      <circle cx="16" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  star: <path d="m12 3 2.9 6 6.1.8-4.5 4.3 1.1 6.1L12 17.8 6.4 20.2l1.1-6.1L3 9.8 9.1 9 12 3Z" />,
  'star-fill': (
    <path
      d="m12 3 2.9 6 6.1.8-4.5 4.3 1.1 6.1L12 17.8 6.4 20.2l1.1-6.1L3 9.8 9.1 9 12 3Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  dots: (
    <>
      <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  sparkle: (
    <path d="M12 3c.4 3.6 1.4 4.6 5 5-3.6.4-4.6 1.4-5 5-.4-3.6-1.4-4.6-5-5 3.6-.4 4.6-1.4 5-5Z" />
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1m11.4-11.4 2.1-2.1" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14a8 8 0 1 1-9.5-9.5A6 6 0 0 0 20 14Z" />,
  auto: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" stroke="none" />
    </>
  ),
  note: (
    <>
      <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v6h6" />
    </>
  ),
  import: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 19h16" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13h4l2 3h4l2-3h4" />
      <path d="M4 13 6 5h12l2 8v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6Z" />
    </>
  ),
  book: <path d="M5 4a2 2 0 0 1 2-2h11v18H7a2 2 0 0 0-2 2V4Z" />,
  x: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
  check: <path d="m5 12 5 5L20 7" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  checklist: (
    <>
      <path d="m3 6 2 2 3-3" />
      <path d="m3 15 2 2 3-3" />
      <path d="M12 6h9M12 16h9" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  logo: (
    <>
      <rect x="5" y="3" width="13" height="18" rx="1.7" />
      <path d="M15 3v18" />
      <path d="M8.4 21v3.4l1.7-1.4 1.7 1.4V21" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.8 2.5 4.2 5.7 4.2 9s-1.4 6.5-4.2 9c-2.8-2.5-4.2-5.7-4.2-9S9.2 5.5 12 3Z" />
    </>
  ),
  message: (
    <>
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <path d="M7.5 9.5h9M7.5 13h6" />
    </>
  )
}

export function Icon({ name, size = 18, className }: Props): JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {P[name]}
    </svg>
  )
}
