/**
 * The page-wide block-renderer registry: fence language → renderer, with the
 * live-block contract of the kit's UidMarkdown and the WYSIWYG editor. Every
 * `<dsk-markdown>`, `<dsk-editor>` and `renderBlocks()` call reads it, so a
 * renderer registered once works everywhere on the page.
 */
import type { BlockRegistry, BlockRenderer, BlockRendererInput, BlockResult } from './types'

const LANGUAGE_RE = /^[a-z0-9][a-z0-9_+.-]*$/

export function normalizeLanguage(language: string): string {
  return String(language).trim().toLowerCase()
}

/** A renderer from what `register` accepts: a function, or a fixed `{ html }` / `{ mount }` result. */
export function toRenderer(input: BlockRendererInput): BlockRenderer {
  if (typeof input === 'function') return input
  if (input && typeof input === 'object' && (typeof input.mount === 'function' || typeof input.html === 'string')) {
    const result: BlockResult = input
    return () => result
  }
  throw new TypeError('a block renderer is a function, or an object with `html` or `mount`')
}

export function createRegistry(): BlockRegistry {
  const renderers = new Map<string, BlockRenderer>()
  const listeners = new Set<() => void>()

  const changed = (): void => {
    for (const fn of [...listeners]) fn()
  }

  const registry: BlockRegistry = {
    register(language, input) {
      const lang = normalizeLanguage(language)
      if (!LANGUAGE_RE.test(lang)) throw new TypeError(`invalid block language "${language}"`)
      const renderer = toRenderer(input)
      renderers.set(lang, renderer)
      changed()
      return () => {
        if (renderers.get(lang) === renderer) registry.unregister(lang)
      }
    },
    unregister(language) {
      if (renderers.delete(normalizeLanguage(language))) changed()
    },
    get: (language) => renderers.get(normalizeLanguage(language)),
    has: (language) => renderers.has(normalizeLanguage(language)),
    languages: () => [...renderers.keys()],
    all: () => Object.fromEntries(renderers),
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
  return registry
}
