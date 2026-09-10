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
let pinned = false
function popover(): HTMLDivElement {
  if (pop) return pop
  pop = document.createElement('div')
  pop.className = 'verse-pop'
  pop.hidden = true
  document.body.appendChild(pop)
  return pop
}

function hide(force = false): void {
  if (!pop) return
  if (pinned && !force) return
  pinned = false
  pop.hidden = true
  pop.classList.remove('pinned')
}

/** drag the pinned card by its header */
function makeDraggable(el: HTMLElement, handle: HTMLElement): void {
  handle.style.cursor = 'grab'
  handle.onpointerdown = (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const rect = el.getBoundingClientRect()
    const move = (ev: PointerEvent): void => {
      el.style.left = `${window.scrollX + rect.left + (ev.clientX - startX)}px`
      el.style.top = `${window.scrollY + rect.top + (ev.clientY - startY)}px`
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
}

/** Decorate scripture references in a rendered preview and wire the hover card. */
export function attachScripture(
  root: HTMLElement,
  getTranslation: () => 'kjv' | 'bbe'
): () => void {
  decorate(root)
  const el = popover()
  let token = 0

  const show = async (span: HTMLElement, pin = false): Promise<void> => {
    const raw = span.dataset.ref
    if (!raw) return
    const ref = JSON.parse(raw) as VerseRef
    const mine = ++token
    const r = span.getBoundingClientRect()
    if (pin) pinned = true
    el.hidden = false
    el.className = `verse-pop loading${pinned ? ' pinned' : ''}`
    el.textContent = 'Looking it up…'
    // position: below the ref, clamped to viewport
    el.style.top = `${window.scrollY + r.bottom + 8}px`
    el.style.left = `${Math.min(window.scrollX + r.left, window.scrollX + window.innerWidth - 380)}px`

    try {
      const res = await window.solace.scriptureLookup(ref, getTranslation())
      if (mine !== token) return
      el.className = `verse-pop${pinned ? ' pinned' : ''}`
      el.innerHTML = ''
      const head = document.createElement('div')
      head.className = 'vp-head'
      const label = document.createElement('span')
      label.textContent = `${res.reference}  ·  ${res.translation.toUpperCase()}`
      head.appendChild(label)
      if (pinned) {
        const x = document.createElement('button')
        x.className = 'vp-close'
        x.textContent = '✕'
        x.onclick = () => hide(true)
        head.appendChild(x)
        makeDraggable(el, label)
      }
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
    if (pinned) return
    const t = (e.target as HTMLElement)?.closest?.('.verse-ref') as HTMLElement | null
    if (t) void show(t)
  }
  const onOut = (e: Event): void => {
    if (pinned) return
    const to = (e as MouseEvent).relatedTarget as HTMLElement | null
    if (to && (to.closest?.('.verse-ref') || to.closest?.('.verse-pop'))) return
    setTimeout(() => {
      if (!pinned && !el.matches(':hover')) hide()
    }, 120)
  }
  const onClick = (e: Event): void => {
    const t = (e.target as HTMLElement)?.closest?.('.verse-ref') as HTMLElement | null
    if (t) {
      e.preventDefault()
      e.stopPropagation()
      void show(t, true)
    }
  }
  const onDocClick = (e: Event): void => {
    if (!pinned) return
    const t = e.target as HTMLElement
    if (!t.closest?.('.verse-pop') && !t.closest?.('.verse-ref')) hide(true)
  }
  const onLeave = (): void => hide()
  const onScroll = (): void => hide()

  root.addEventListener('mouseover', onOver)
  root.addEventListener('mouseout', onOut)
  root.addEventListener('click', onClick, true)
  document.addEventListener('click', onDocClick)
  el.addEventListener('mouseleave', onLeave)
  window.addEventListener('scroll', onScroll, true)

  return () => {
    root.removeEventListener('mouseover', onOver)
    root.removeEventListener('mouseout', onOut)
    root.removeEventListener('click', onClick, true)
    document.removeEventListener('click', onDocClick)
    el.removeEventListener('mouseleave', onLeave)
    window.removeEventListener('scroll', onScroll, true)
    hide(true)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
