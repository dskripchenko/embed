/**
 * The full-screen button of the visual elements: the element itself goes full
 * screen (the Fullscreen API), or — where that is not available, as for plain
 * elements in iOS Safari — fills the window over the page. Escape, the button
 * or the browser's own gesture leave it.
 */
import type { Locale } from './types'

/** The elements that get the button; players have their own full screen. */
export const FULLSCREEN_TAGS = new Set(['dsk-diagram', 'dsk-flow', 'dsk-board', 'dsk-openapi'])

const LABELS: Record<'en' | 'ru', { enter: string; exit: string }> = {
  en: { enter: 'Full screen', exit: 'Exit full screen' },
  ru: { enter: 'Во весь экран', exit: 'Выйти из полноэкранного режима' },
}

const ICON_ENTER = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>'
const ICON_EXIT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>'

export interface FullscreenControl {
  readonly active: boolean
  enter(): void
  exit(): void
  toggle(): void
  /** Relabels the button (the element's language changed). */
  relabel(locale: Locale): void
  destroy(): void
}

export function attachFullscreen(el: HTMLElement, locale: Locale, onChange: (active: boolean) => void): FullscreenControl {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'dsk-fs-button'
  let labels = LABELS[locale === 'ru' ? 'ru' : 'en']
  let active = false
  let fallback = false

  const render = () => {
    const text = active ? labels.exit : labels.enter
    button.innerHTML = active ? ICON_EXIT : ICON_ENTER
    button.setAttribute('aria-label', text)
    button.title = text
    button.setAttribute('aria-pressed', String(active))
  }

  const set = (on: boolean) => {
    if (on === active) return
    active = on
    if (on) document.addEventListener('keydown', onKey)
    else document.removeEventListener('keydown', onKey)
    el.toggleAttribute('data-dsk-fullscreen', on)
    render()
    onChange(on)
  }

  // Browsers leave their full screen on Escape themselves; this covers the
  // window fallback and browsers that hand Escape to the page.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && active) exit()
  }

  const onFullscreenChange = () => {
    if (fallback) return
    set(document.fullscreenElement === el)
  }

  function enterFallback(): void {
    fallback = true
    el.classList.add('dsk-fs-fallback')
    document.documentElement.classList.add('dsk-fs-locked')
    set(true)
  }

  function enter(): void {
    if (active) return
    const request = (el as HTMLElement & { requestFullscreen?: () => Promise<void> }).requestFullscreen
    if (document.fullscreenEnabled && typeof request === 'function') {
      request.call(el).catch(enterFallback)
    } else {
      enterFallback()
    }
  }

  function exit(): void {
    if (!active) return
    if (fallback) {
      fallback = false
      el.classList.remove('dsk-fs-fallback')
      document.documentElement.classList.remove('dsk-fs-locked')
      set(false)
      return
    }
    if (document.fullscreenElement === el) void document.exitFullscreen().catch(() => set(false))
    else set(false)
  }

  button.addEventListener('click', (e) => {
    e.stopPropagation()
    if (active) exit()
    else enter()
  })
  // Pointer events on the button must not reach the widget (a board would start a selection).
  button.addEventListener('pointerdown', (e) => e.stopPropagation())
  document.addEventListener('fullscreenchange', onFullscreenChange)
  render()
  el.appendChild(button)

  return {
    get active() {
      return active
    },
    enter,
    exit,
    toggle: () => (active ? exit() : enter()),
    relabel(next) {
      labels = LABELS[next === 'ru' ? 'ru' : 'en']
      render()
    },
    destroy() {
      exit()
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      button.remove()
    },
  }
}
