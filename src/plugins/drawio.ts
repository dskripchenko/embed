/**
 * `<dsk-drawio>` and ```drawio blocks: draw.io files — compressed or plain
 * pages, `.drawio.svg` — to SVG through @dskripchenko/drawio. No Vue here.
 * A file with several pages gets page tabs. Labels are read as text, never
 * as markup; shapes of vendor libraries and images on the web (unless
 * `external-images`) become placeholders.
 */
import { DrawioError, parseDrawio, render, type DrawioFile } from '@dskripchenko/drawio'
import type { BlockRenderer, ElementContext, ElementInstance } from '../core/types'
import { withFullscreen } from './fullscreen'
import { figure, printable } from './print'
import drawioCss from '../drawio.css?inline'
import { injectStyle } from '../core/styles'

let sequence = 0
const textCache = new Map<string, Promise<string>>()

function fetchText(url: string): Promise<string> {
  let p = textCache.get(url)
  if (!p) {
    p = fetch(url, { credentials: 'same-origin' }).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
      return r.text()
    })
    p.catch(() => textCache.delete(url))
    textCache.set(url, p)
  }
  return p
}

function message(error: unknown): string {
  if (error instanceof DrawioError) {
    const where = error.line > 0 ? ` (line ${error.line}${error.column > 0 ? `, column ${error.column}` : ''})` : ''
    return `${error.message}${where}${error.hint ? `. ${error.hint}` : ''}`
  }
  return error instanceof Error ? error.message : String(error)
}

export function mountElement(ctx: ElementContext): ElementInstance {
  injectStyle('drawio', drawioCss, ctx.el.ownerDocument)
  const root = document.createElement('div')
  root.className = 'dsk-drawio'
  const tabs = document.createElement('div')
  tabs.className = 'dsk-drawio__pages'
  tabs.setAttribute('role', 'tablist')
  const box = document.createElement('div')
  box.className = 'dsk-drawio__page'
  root.append(tabs, box)
  ctx.container.appendChild(root)
  let file: DrawioFile | null = null
  let current = 0
  let generation = 0
  let loadedFrom = ''

  function pageIndex(value: unknown): number {
    if (!file) return 0
    if (typeof value === 'number') return Math.max(0, Math.min(file.pages.length - 1, value))
    if (typeof value === 'string' && value !== '') {
      const byName = file.pages.findIndex((p) => p.name === value || p.id === value)
      if (byName >= 0) return byName
      const n = Number(value)
      if (Number.isInteger(n)) return Math.max(0, Math.min(file.pages.length - 1, n))
    }
    return 0
  }

  function show(index: number): void {
    if (!file) return
    current = index
    const props = ctx.props()
    const label = typeof props.label === 'string' ? props.label : undefined
    try {
      const result = render(file, {
        page: index,
        idPrefix: `dsk-dw-${++sequence}`,
        allowExternalImages: props.externalImages === true,
        ...(label ? { title: label } : {}),
      })
      box.innerHTML = result.svg
      for (const [i, tab] of Array.from(tabs.children).entries()) tab.setAttribute('aria-selected', String(i === index))
      ctx.emit('render', { page: result.page, pages: result.pages, width: result.width, height: result.height, warnings: result.warnings })
    } catch (error) {
      fail(error)
    }
  }

  function buildTabs(): void {
    tabs.replaceChildren()
    if (!file || file.pages.length < 2) {
      tabs.hidden = true
      return
    }
    tabs.hidden = false
    file.pages.forEach((p, i) => {
      const tab = document.createElement('button')
      tab.type = 'button'
      tab.className = 'dsk-drawio__tab'
      tab.setAttribute('role', 'tab')
      tab.textContent = p.name ?? `${i + 1}`
      tab.addEventListener('click', () => show(i))
      tabs.appendChild(tab)
    })
  }

  async function load(): Promise<void> {
    const gen = ++generation
    const props = ctx.props()
    const key = typeof props.src === 'string' && props.src !== '' ? `src:${props.src}` : `source:${ctx.source()}`
    if (key === loadedFrom && file) {
      show(pageIndex(props.page))
      return
    }
    let text: string
    try {
      text = typeof props.src === 'string' && props.src !== '' ? await fetchText(props.src) : ctx.source()
    } catch (error) {
      if (gen === generation) fail(error)
      return
    }
    if (gen !== generation) return
    try {
      file = parseDrawio(text)
      loadedFrom = key
      buildTabs()
      show(pageIndex(props.page))
    } catch (error) {
      fail(error)
    }
  }

  function fail(error: unknown): void {
    loadedFrom = ''
    file = null
    tabs.replaceChildren()
    tabs.hidden = true
    const alert = document.createElement('div')
    alert.className = 'dsk-error'
    alert.setAttribute('role', 'alert')
    alert.textContent = message(error)
    box.replaceChildren(alert)
    const detail: Record<string, unknown> = { message: message(error) }
    if (error instanceof DrawioError) Object.assign(detail, { line: error.line, column: error.column, hint: error.hint })
    ctx.emit('error', detail)
  }

  void load()
  const fs = withFullscreen(ctx)
  // On paper every page, one after another, each named when there are several.
  const unprint = printable(ctx.host, root, () => {
    if (!file) return null
    const f = file
    const props = ctx.props()
    const out = document.createDocumentFragment()
    f.pages.forEach((p, i) => {
      const { svg } = render(f, { page: i, idPrefix: `dsk-dwp-${++sequence}`, allowExternalImages: props.externalImages === true })
      out.append(figure(svg, f.pages.length > 1 ? (p.name ?? `${i + 1}`) : undefined))
    })
    return out
  })
  return {
    update: () => void load(),
    destroy: () => {
      unprint()
      fs?.destroy()
      root.remove()
    },
    api: {
      showPage: (page: unknown) => show(pageIndex(page)),
      enterFullscreen: () => fs?.enter(),
      exitFullscreen: () => fs?.exit(),
      get fullscreen() {
        return fs?.active ?? false
      },
      get svg() {
        return box.querySelector('svg')
      },
      get pages() {
        return file ? file.pages.map((p, i) => p.name ?? `${i + 1}`) : []
      },
      get page() {
        return current
      },
    },
  }
}

export const renderers: Record<string, BlockRenderer> = {
  drawio(code) {
    try {
      return { html: render(code, { idPrefix: `dsk-dw-${++sequence}` }).svg }
    } catch (error) {
      if (error instanceof DrawioError) return { error: message(error) }
      throw error
    }
  },
}
