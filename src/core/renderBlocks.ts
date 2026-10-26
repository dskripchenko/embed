/**
 * `renderBlocks(root)` — fenced code already in the page (HTML from a CMS, a
 * database, a static site generator) becomes live: every
 * `<pre><code class="language-…">` whose language has a renderer is replaced
 * by the renderer's widget or markup. Idempotent: a block is handled once,
 * however often the call is repeated; `unrenderBlocks(root)` puts the code back.
 */
import type { BlockMountHandle, BlockRegistry, BlockResult } from './types'

export interface RenderBlocksOptions {
  /** Only these languages (all registered ones by default). */
  languages?: string[]
}

interface Rendered {
  pre: HTMLElement
  handle: BlockMountHandle | null
}

const rendered = new WeakMap<Element, Rendered>()

/** Where the kit or the editor own the code blocks: never touched from outside. */
const OWNED = '[data-dsk-root], [contenteditable], .uid-markdown, dsk-markdown, dsk-editor'

/** The block's language: `language-x` / `lang-x` on the code or the pre, or `data-lang`. */
export function languageOf(pre: Element, code: Element | null): string | null {
  for (const el of [code, pre]) {
    if (!el) continue
    const data = el.getAttribute('data-lang') ?? el.getAttribute('data-language')
    if (data) return data.trim().toLowerCase()
    for (const cls of Array.from(el.classList)) {
      const m = /^(?:language|lang)-(.+)$/.exec(cls)
      if (m) return m[1]!.toLowerCase()
    }
  }
  return null
}

/** The code blocks under `root` a renderer is registered for. */
export function findBlocks(root: ParentNode, registry: BlockRegistry, options: RenderBlocksOptions = {}): { pre: HTMLElement; code: string; language: string }[] {
  const only = options.languages?.map((l) => l.toLowerCase())
  const out: { pre: HTMLElement; code: string; language: string }[] = []
  const pres: HTMLElement[] = []
  if (root instanceof HTMLElement && root.tagName === 'PRE') pres.push(root)
  pres.push(...Array.from(root.querySelectorAll<HTMLElement>('pre')))
  for (const pre of pres) {
    if (pre.hasAttribute('data-dsk-failed') || pre.closest(OWNED)) continue
    const code = pre.querySelector(':scope > code')
    const language = languageOf(pre, code)
    if (!language || !registry.has(language) || (only && !only.includes(language))) continue
    out.push({ pre, code: (code ?? pre).textContent ?? '', language })
  }
  return out
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Shows the code again, marked with why it could not be rendered. */
function fail(block: HTMLElement, pre: HTMLElement, message: string): void {
  pre.setAttribute('data-dsk-failed', '')
  pre.title = message
  if (block.isConnected) block.replaceWith(pre)
  rendered.delete(block)
}

/**
 * Renders the blocks under `root`; resolves with the number rendered. Errors
 * never reject: a block that cannot be rendered stays as code, its `<pre>`
 * marked with `data-dsk-failed` and the reason in `title`.
 */
export async function renderBlocks(root: ParentNode, registry: BlockRegistry, options: RenderBlocksOptions = {}): Promise<number> {
  const blocks = findBlocks(root, registry, options)
  let index = 0
  const jobs = blocks.map(async ({ pre, code, language }) => {
    const renderer = registry.get(language)!
    const block = document.createElement('div')
    block.className = `dsk-block dsk-block--${language}`
    block.setAttribute('data-dsk-block', language)
    block.setAttribute('data-dsk-state', 'loading')
    // Swapped synchronously, so a second call does not find the same <pre>.
    pre.replaceWith(block)
    rendered.set(block, { pre, handle: null })
    let result: BlockResult
    try {
      result = await renderer(code, { language, index: index++ })
    } catch (error) {
      fail(block, pre, errorMessage(error))
      return 0
    }
    if (!block.isConnected) return 0
    if (!result || result.error !== undefined || (result.html === undefined && !result.mount)) {
      fail(block, pre, result?.error ?? 'nothing to render')
      return 0
    }
    if (result.mount) {
      try {
        const out = result.mount(block, { code, language, editable: false, setCode: () => {} })
        rendered.set(block, { pre, handle: typeof out === 'function' ? { destroy: out } : (out ?? null) })
      } catch (error) {
        fail(block, pre, errorMessage(error))
        return 0
      }
    } else {
      block.innerHTML = result.html!
    }
    block.setAttribute('data-dsk-state', 'ready')
    return 1
  })
  const counts = await Promise.all(jobs)
  return counts.reduce<number>((a, b) => a + b, 0)
}

/** Destroys the live blocks under `root` and puts their code back. */
export function unrenderBlocks(root: ParentNode): number {
  let count = 0
  const blocks: Element[] = []
  if (root instanceof Element && root.hasAttribute('data-dsk-block')) blocks.push(root)
  blocks.push(...Array.from(root.querySelectorAll('[data-dsk-block]')))
  for (const block of blocks) {
    const entry = rendered.get(block)
    if (!entry) continue
    try {
      entry.handle?.destroy?.()
    } catch (error) {
      console.error('[dsk-embed] block destroy failed', error)
    }
    block.replaceWith(entry.pre)
    rendered.delete(block)
    count++
  }
  return count
}
