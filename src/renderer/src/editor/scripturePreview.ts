import { parseRefs } from '../../../shared/scripture'
import type { VerseRef } from '../../../shared/types'
import { showVerse, hideVerse, isPinned } from './versePopover'

const SKIP = new Set(['A', 'CODE', 'PRE', 'SCRIPT', 'STYLE', 'H1', 'H2', 'H3'])

function decorate(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent || !/\d/.test(node.textContent)) return NodeFilter.FILTER_REJECT
      let p = node.parentElement
      while (p && p !== root) {
        if (SKIP.has(p.tagName) || p.classList.contains('verse-ref'))
          return NodeFilter.FILTER_REJECT
        p = p.parentElement
      }
      return NodeFilter.FILTER_ACCEPT
    }
  })
  const targets: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) targets.push(n as Text)

  for (const textNode of targets) {
    const s = textNode.textContent as string
    const refs = parseRefs(s)
    if (!refs.length) continue
    const frag = document.createDocumentFragment()
    let idx = 0
    for (const ref of refs) {
      const at = s.indexOf(ref.text, idx)
      if (at < 0) continue
      if (at > idx) frag.append(s.slice(idx, at))
      const span = document.createElement('span')
      span.className = 'verse-ref'
      span.textContent = ref.text
      span.dataset.ref = JSON.stringify(ref)
      frag.append(span)
      idx = at + ref.text.length
    }
    if (idx < s.length) frag.append(s.slice(idx))
    textNode.replaceWith(frag)
  }
}

/** Decorate scripture references in a rendered preview and wire the hover/click card. */
export function attachScripture(
  root: HTMLElement,
  getTranslation: () => 'kjv' | 'bbe'
): () => void {
  decorate(root)

  const refOf = (span: HTMLElement): VerseRef | null => {
    const raw = span.dataset.ref
    return raw ? (JSON.parse(raw) as VerseRef) : null
  }

  const onOver = (e: Event): void => {
    if (isPinned()) return
    const t = (e.target as HTMLElement)?.closest?.('.verse-ref') as HTMLElement | null
    const ref = t && refOf(t)
    if (t && ref) void showVerse(ref, t.getBoundingClientRect(), getTranslation)
  }
  const onOut = (e: Event): void => {
    if (isPinned()) return
    const to = (e as MouseEvent).relatedTarget as HTMLElement | null
    if (to && (to.closest?.('.verse-ref') || to.closest?.('.verse-pop'))) return
    setTimeout(() => {
      if (!isPinned() && !document.querySelector('.verse-pop:hover')) hideVerse()
    }, 120)
  }
  const onClick = (e: Event): void => {
    const t = (e.target as HTMLElement)?.closest?.('.verse-ref') as HTMLElement | null
    const ref = t && refOf(t)
    if (t && ref) {
      e.preventDefault()
      e.stopPropagation()
      void showVerse(ref, t.getBoundingClientRect(), getTranslation, true)
    }
  }

  root.addEventListener('mouseover', onOver)
  root.addEventListener('mouseout', onOut)
  root.addEventListener('click', onClick, true)

  return () => {
    root.removeEventListener('mouseover', onOver)
    root.removeEventListener('mouseout', onOut)
    root.removeEventListener('click', onClick, true)
    hideVerse(true)
  }
}
