/**
 * `<dsk-diagram>` and diagram blocks — ```mermaid, ```plantuml, ```dot,
 * ```d2, ```dbml, ```structurizr, ```wardley: source → SVG through
 * @dskripchenko/diagrams. No Vue here: a page with diagrams alone loads the
 * diagrams package and nothing else. The SVG escapes every label by
 * construction, which is what makes it safe to insert as markup; its colours
 * are `--dg-*` custom properties, mapped onto the kit's theme tokens in the
 * embed's base stylesheet, so both themes follow.
 */
import { DiagramError, render, type Syntax } from '@dskripchenko/diagrams'
import type { BlockRenderer, ElementContext, ElementInstance } from '../core/types'
import { withFullscreen } from './fullscreen'

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
  if (error instanceof DiagramError) {
    const where = error.line > 0 ? ` (line ${error.line}${error.column > 0 ? `, column ${error.column}` : ''})` : ''
    return `${error.message}${where}${error.hint ? `. ${error.hint}` : ''}`
  }
  return error instanceof Error ? error.message : String(error)
}

export function mountElement(ctx: ElementContext): ElementInstance {
  const box = document.createElement('div')
  box.className = 'dsk-diagram'
  ctx.container.appendChild(box)
  let generation = 0
  let lastKey = ''

  async function draw(): Promise<void> {
    const gen = ++generation
    const props = ctx.props()
    const label = typeof props.label === 'string' ? props.label : undefined
    let code: string
    try {
      code = typeof props.src === 'string' && props.src !== '' ? await fetchText(props.src) : ctx.source()
    } catch (error) {
      if (gen === generation) fail(error)
      return
    }
    if (gen !== generation) return
    const key = `${label ?? ''}\n${code}`
    if (key === lastKey) return
    lastKey = key
    try {
      const syntax = typeof props.syntax === 'string' ? (props.syntax as Syntax) : undefined
      const result = render(code, { idPrefix: `dsk-dg-${++sequence}`, ...(syntax ? { syntax } : {}), ...(label ? { title: label } : {}) })
      box.innerHTML = result.svg
      ctx.emit('render', { type: result.type, width: result.width, height: result.height })
    } catch (error) {
      fail(error)
    }
  }

  function fail(error: unknown): void {
    lastKey = ''
    const alert = document.createElement('div')
    alert.className = 'dsk-error'
    alert.setAttribute('role', 'alert')
    alert.textContent = message(error)
    box.replaceChildren(alert)
    const detail: Record<string, unknown> = { message: message(error) }
    if (error instanceof DiagramError) Object.assign(detail, { line: error.line, column: error.column, hint: error.hint })
    ctx.emit('error', detail)
  }

  void draw()
  const fs = withFullscreen(ctx)
  return {
    update: () => void draw(),
    destroy: () => {
      fs?.destroy()
      box.remove()
    },
    api: {
      enterFullscreen: () => fs?.enter(),
      exitFullscreen: () => fs?.exit(),
      get fullscreen() {
        return fs?.active ?? false
      },
      get svg() {
        return box.querySelector('svg')
      },
    },
  }
}

/** The syntax each block language is written in. */
export const LANGUAGES: Readonly<Record<string, Syntax>> = {
  mermaid: 'mermaid',
  plantuml: 'plantuml',
  puml: 'plantuml',
  dot: 'dot',
  graphviz: 'dot',
  d2: 'd2',
  dbml: 'dbml',
  structurizr: 'structurizr',
  wardley: 'wardley',
}

function block(syntax: Syntax): BlockRenderer {
  return (code) => {
    try {
      return { html: render(code, { syntax, idPrefix: `dsk-dg-${++sequence}` }).svg }
    } catch (error) {
      if (error instanceof DiagramError) return { error: message(error) }
      throw error
    }
  }
}

export const renderers: Record<string, BlockRenderer> = Object.fromEntries(Object.entries(LANGUAGES).map(([language, syntax]) => [language, block(syntax)]))
