/**
 * Print forms. A widget that is not paper by itself — a canvas with pan and
 * zoom, a player, a reference with navigation — registers a form: static
 * markup that takes its place on paper. `prepare` builds every form and puts
 * it right after its widget, which print CSS then hides; `restore` takes them
 * away. `prepare` first waits for the widgets in its scope that are still
 * drawing. The browser's own print triggers both through `beforeprint` and
 * `afterprint` (forms that need a moment to build are ready only when
 * `DskEmbed.print.prepare()` is awaited before printing).
 *
 * No Vue here: the state lives on the host, shared by every plugin bundle.
 */
import printCss from '../print.css?inline'
import { injectStyle } from '../core/styles'
import type { Host, PrintForm, Printer } from '../core/types'

const HIDDEN = 'dsk-print-hidden'

/** Widgets still drawing: an element loading its plugin or source, a markdown block not mounted yet. */
const BUSY = '[data-dsk-state="loading"], .uid-markdown__block--pending'

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/**
 * Waits (up to `timeout` ms) until nothing in the scope is still drawing, then
 * two frames for the last drawings to lay out: a form is made from what a
 * widget drew, and a block mounted a moment ago has not registered its form yet.
 */
async function settled(scope: ParentNode, timeout = 10000): Promise<void> {
  const until = Date.now() + timeout
  while (scope.querySelector(BUSY) && Date.now() < until) await new Promise((r) => setTimeout(r, 50))
  await frame()
  await frame()
}

function createPrinter(host: Host): Printer & { busy(): boolean } {
  let placed: { root: HTMLElement; box: HTMLElement }[] = []
  let run = 0
  let preparing = false
  const restore = (): void => {
    run++
    preparing = false
    for (const { root, box } of placed) {
      box.remove()
      root.classList.remove(HIDDEN)
    }
    placed = []
  }

  async function build(scope: ParentNode, mine: number): Promise<() => void> {
    await settled(scope)
    if (mine !== run) return restore
    const wanted = [...(host.printables ?? [])].filter((p) => p.root.isConnected && (scope === document || scope.contains(p.root)))
    const forms = await Promise.all(
      wanted.map(async (p) => {
        try {
          return await p.form()
        } catch (error) {
          console.warn('[dsk-embed] a print form failed; the widget prints as it is', error)
          return null
        }
      }),
    )
    // A restore (or another prepare) came while the forms were built.
    if (mine !== run) return restore
    wanted.forEach((p, i) => {
      const form = forms[i]
      if (form === null || form === undefined || !p.root.isConnected) return
      const box = document.createElement('div')
      box.className = 'dsk-print-form'
      box.setAttribute('aria-hidden', 'true')
      if (typeof form === 'string') box.innerHTML = form
      else box.append(form)
      p.root.after(box)
      p.root.classList.add(HIDDEN)
      placed.push({ root: p.root, box })
    })
    return restore
  }

  return {
    async prepare(scope) {
      restore()
      const mine = run
      preparing = true
      try {
        return await build(scope, mine)
      } finally {
        if (mine === run) preparing = false
      }
    },
    restore,
    /** Forms in place, or being made: the page prepared itself before printing. */
    busy: () => preparing || placed.length > 0,
  }
}

/**
 * Sets up printing once per page: the printer on the host, its stylesheet,
 * the browser's print events. Every plugin with Vue does it when it loads (so
 * a page whose widgets are still drawing can already wait for them); the
 * others with their first print form.
 */
export function installPrinter(host: Host): Printer {
  if (host.printer) return host.printer
  const printer = createPrinter(host)
  host.printer = printer
  injectStyle('print', printCss)
  let auto = false
  window.addEventListener('beforeprint', () => {
    // The page prepared the forms itself (and awaited them): printing is what it asked for, they stay.
    if (printer.busy()) return
    auto = true
    void printer.prepare(document)
  })
  window.addEventListener('afterprint', () => {
    if (!auto) return
    auto = false
    printer.restore()
  })
  return printer
}

/** Registers a widget's print form; the returned function unregisters it. */
export function printable(host: Host, root: HTMLElement, form: PrintForm): () => void {
  installPrinter(host)
  const entry = { root, form }
  const all = (host.printables ??= new Set())
  all.add(entry)
  return () => all.delete(entry)
}

/** A figure holding markup (an SVG) and an optional caption. */
export function figure(markup: string | Node, caption?: string): HTMLElement {
  const fig = document.createElement('figure')
  fig.className = 'dsk-print-page'
  fig.style.margin = '0'
  if (typeof markup === 'string') fig.innerHTML = markup
  else fig.append(markup)
  if (caption) {
    const cap = document.createElement('figcaption')
    cap.textContent = caption
    fig.append(cap)
  }
  return fig
}

/** What draws an SVG element: copied from the screen's computed style onto a copy that leaves its stylesheet's reach. */
const PAINT = ['display', 'visibility', 'opacity', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'marker-start', 'marker-mid', 'marker-end', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'filter', 'color']

/**
 * A live SVG drawn under a pan/zoom transform, copied whole: the copy's
 * viewBox is the content's own box and the transform goes, so the whole
 * diagram fits the paper's width, whatever part of it was on screen.
 */
export function wholeSvg(svg: SVGSVGElement, content: SVGGraphicsElement, drop: string[] = [], pad = 16): SVGSVGElement | null {
  let box: DOMRect
  try {
    box = content.getBBox()
  } catch {
    return null
  }
  if (!(box.width > 0 && box.height > 0)) return null
  const copy = svg.cloneNode(true) as SVGSVGElement
  const live = [...svg.querySelectorAll('*')]
  const copies = [...copy.querySelectorAll('*')]
  // The canvas's styles hang off its ancestors (and the theme's custom properties): the copy carries them itself.
  live.forEach((el, i) => {
    const to = copies[i] as SVGElement | undefined
    if (!to || !(el instanceof SVGElement)) return
    const cs = getComputedStyle(el)
    to.setAttribute('style', PAINT.map((prop) => `${prop}:${cs.getPropertyValue(prop)}`).join(';'))
  })
  const inner = copies[live.indexOf(content)] as SVGGraphicsElement | undefined
  inner?.removeAttribute('transform')
  // Screen-only parts of the canvas: its background, a grid, overlays.
  for (const selector of drop) for (const el of copy.querySelectorAll(selector)) el.remove()
  const x = box.x - pad
  const y = box.y - pad
  const w = box.width + pad * 2
  const h = box.height + pad * 2
  copy.setAttribute('viewBox', `${x} ${y} ${w} ${h}`)
  copy.setAttribute('width', String(Math.ceil(w)))
  copy.setAttribute('height', String(Math.ceil(h)))
  // The canvas's own class places it over its box (absolutely): the copy, painted inline, needs none.
  copy.removeAttribute('class')
  copy.removeAttribute('style')
  copy.style.maxWidth = '100%'
  copy.style.height = 'auto'
  return copy
}
