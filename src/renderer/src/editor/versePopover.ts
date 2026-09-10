import type { VerseRef } from '../../../shared/types'

let pop: HTMLDivElement | null = null
let pinned = false
let token = 0

function el(): HTMLDivElement {
  if (pop) return pop
  pop = document.createElement('div')
  pop.className = 'verse-pop'
  pop.hidden = true
  pop.addEventListener('mouseleave', () => hideVerse())
  document.body.appendChild(pop)
  return pop
}

export function isPinned(): boolean {
  return pinned
}

export function hideVerse(force = false): void {
  if (!pop) return
  if (pinned && !force) return
  pinned = false
  pop.hidden = true
  pop.classList.remove('pinned')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function makeDraggable(box: HTMLElement, handle: HTMLElement): void {
  handle.style.cursor = 'grab'
  handle.onpointerdown = (e) => {
    e.preventDefault()
    const sx = e.clientX
    const sy = e.clientY
    const rect = box.getBoundingClientRect()
    const move = (ev: PointerEvent): void => {
      box.style.left = `${window.scrollX + rect.left + (ev.clientX - sx)}px`
      box.style.top = `${window.scrollY + rect.top + (ev.clientY - sy)}px`
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
}

export async function showVerse(
  ref: VerseRef,
  anchor: DOMRect,
  getTranslation: () => 'kjv' | 'bbe',
  pin = false
): Promise<void> {
  const box = el()
  const mine = ++token
  if (pin) pinned = true
  box.hidden = false
  box.className = `verse-pop loading${pinned ? ' pinned' : ''}`
  box.textContent = 'Looking it up…'
  box.style.top = `${window.scrollY + anchor.bottom + 8}px`
  box.style.left = `${Math.min(window.scrollX + anchor.left, window.scrollX + window.innerWidth - 380)}px`

  try {
    const res = await window.solace.scriptureLookup(ref, getTranslation())
    if (mine !== token) return
    box.className = `verse-pop${pinned ? ' pinned' : ''}`
    box.innerHTML = ''
    const head = document.createElement('div')
    head.className = 'vp-head'
    const label = document.createElement('span')
    label.textContent = `${res.reference}  ·  ${res.translation.toUpperCase()}`
    head.appendChild(label)
    if (pinned) {
      const x = document.createElement('button')
      x.className = 'vp-close'
      x.textContent = '✕'
      x.onclick = () => hideVerse(true)
      head.appendChild(x)
      makeDraggable(box, label)
    }
    box.appendChild(head)
    if (res.error || !res.verses.length) {
      const p = document.createElement('p')
      p.className = 'vp-err'
      p.textContent = res.error || 'Not found in this translation.'
      box.appendChild(p)
    } else {
      for (const v of res.verses) {
        const p = document.createElement('p')
        p.className = 'vp-v'
        p.innerHTML = `<sup>${v.n}</sup> ${escapeHtml(v.text)}`
        box.appendChild(p)
      }
    }
  } catch {
    if (mine !== token) return
    box.className = 'verse-pop'
    box.textContent = 'Could not load that passage.'
  }
}

// close a pinned card when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!pinned) return
  const t = e.target as HTMLElement
  if (!t.closest?.('.verse-pop') && !t.closest?.('.verse-ref') && !t.closest?.('.cm-verse-ref'))
    hideVerse(true)
})
window.addEventListener('scroll', () => hideVerse(), true)
