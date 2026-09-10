import { parseRefs } from '../../../shared/scripture'
import type { VerseRef } from '../../../shared/types'

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
    // build replacement fragment
    const frag = document.createDocumentFragment()
    let idx = 0
    // parseRefs doesn't give offsets — re-find each match text in order
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

let pop: HTMLDivElement | null = null
function popover(): HTMLDivElement {
  if (pop) return pop
  pop = document.createElement('div')
  pop.className = 'verse-pop'
  pop.hidden = true
  document.body.appendChild(pop)
  return pop
}

function hide(): void {
  if (pop) pop.hidden = true
}

/** Decorate scripture references in a rendered preview and wire the hover card. */
export function attachScripture(
  root: HTMLElement,
  getTranslation: () => 'kjv' | 'bbe'
): () => void {
  decorate(root)
  const el = popover()
  let token = 0

  const show = async (span: HTMLElement): Promise<void> => {
    const raw = span.dataset.ref
    if (!raw) return
    const ref = JSON.parse(raw) as VerseRef
    const mine = ++token
    const r = span.getBoundingClientRect()
    el.hidden = false
    el.className = 'verse-pop loading'
    el.textContent = 'Looking it up…'
    // position: below the ref, clamped to viewport
    el.style.top = `${window.scrollY + r.bottom + 8}px`
    el.style.left = `${Math.min(window.scrollX + r.left, window.scrollX + window.innerWidth - 380)}px`

    try {
      const res = await window.solace.scriptureLookup(ref, getTranslation())
      if (mine !== token) return
      el.className = 'verse-pop'
      el.innerHTML = ''
      const head = document.createElement('div')
      head.className = 'vp-head'
      head.textContent = `${res.reference}  ·  ${res.translation.toUpperCase()}`
      el.appendChild(head)
      if (res.error || !res.verses.length) {
        const p = document.createElement('p')
        p.className = 'vp-err'
        p.textContent = res.error || 'Not found in this translation.'
        el.appendChild(p)
      } else {
        for (const v of res.verses) {
          const p = document.createElement('p')
          p.className = 'vp-v'
          p.innerHTML = `<sup>${v.n}</sup> ${escapeHtml(v.text)}`
          el.appendChild(p)
        }
      }
    } catch {
      if (mine !== token) return
      el.className = 'verse-pop'
      el.textContent = 'Could not load that passage.'
    }
  }

  const onOver = (e: Event): void => {
    const t = (e.target as HTMLElement)?.closest?.('.verse-ref') as HTMLElement | null
    if (t) void show(t)
  }
  const onOut = (e: Event): void => {
    const to = (e as MouseEvent).relatedTarget as HTMLElement | null
    if (to && (to.closest?.('.verse-ref') || to.closest?.('.verse-pop'))) return
    setTimeout(() => {
      if (!el.matches(':hover')) hide()
    }, 120)
  }

  root.addEventListener('mouseover', onOver)
  root.addEventListener('mouseout', onOut)
  el.addEventListener('mouseleave', hide)
  window.addEventListener('scroll', hide, true)

  return () => {
    root.removeEventListener('mouseover', onOver)
    root.removeEventListener('mouseout', onOut)
    el.removeEventListener('mouseleave', hide)
    window.removeEventListener('scroll', hide, true)
    hide()
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
