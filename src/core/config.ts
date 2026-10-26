/**
 * The global configuration: theme, locale, and (for the loader) where the
 * runtime comes from.
 *
 * The kit's themes key off `<html data-theme>`, so a theme is page-wide:
 * `configure({ theme })` writes that attribute, `system` follows
 * `prefers-color-scheme` live, and a page that changes the attribute itself
 * is followed. Without a theme and without the attribute, the kit's light
 * tokens apply through `:root:not([data-theme])` (see embed.css) and the
 * page's `<html>` is left alone.
 *
 * The locale is the page's `<html lang>` (ru… → ru, anything else → en)
 * until `configure({ locale })` fixes it; a page that changes `lang` is
 * followed as long as no locale was configured.
 */
import type { ConfigInput, EmbedConfig, Locale, ResolvedTheme, ThemeSetting } from './types'

export const DEFAULT_CDN = 'https://cdn.jsdelivr.net/npm/'

export function normalizeLocale(value: string | null | undefined): Locale {
  return typeof value === 'string' && value.trim().toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

export function isThemeSetting(value: unknown): value is ThemeSetting {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function normalizeCdnBase(value: string): string {
  const v = value.trim()
  return v.endsWith('/') ? v : `${v}/`
}

export interface ConfigStore {
  get(): Readonly<EmbedConfig>
  configure(input: ConfigInput): Readonly<EmbedConfig>
  subscribe(fn: (config: Readonly<EmbedConfig>) => void): () => void
  /** Stops observing the page. */
  dispose(): void
}

export function createConfig(initial: ConfigInput = {}, doc: Document = document, versions: Record<string, string> = {}): ConfigStore {
  const root = doc.documentElement
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
  const listeners = new Set<(config: Readonly<EmbedConfig>) => void>()

  // What the host configured explicitly; null follows the page.
  let themeSetting: ThemeSetting | null = null
  let localeSetting: Locale | null = null
  let cdnBase = DEFAULT_CDN
  let pinned: Record<string, string> = { ...versions }
  let writing = false
  let current: EmbedConfig = snapshot()

  function pageTheme(): ResolvedTheme | null {
    const v = root.getAttribute('data-theme')
    return v === 'dark' || v === 'light' ? v : null
  }

  function resolve(): ResolvedTheme {
    if (themeSetting === 'light' || themeSetting === 'dark') return themeSetting
    if (themeSetting === 'system') return media?.matches ? 'dark' : 'light'
    return pageTheme() ?? 'light'
  }

  function snapshot(): EmbedConfig {
    return Object.freeze({
      theme: themeSetting,
      resolvedTheme: resolve(),
      locale: localeSetting ?? normalizeLocale(root.getAttribute('lang')),
      cdnBase,
      versions: Object.freeze({ ...pinned }),
    })
  }

  /** Writes the configured theme on <html>; a page-driven theme is left as it is. */
  function applyTheme(): void {
    if (themeSetting === null) return
    const value = resolve()
    if (root.getAttribute('data-theme') === value) return
    writing = true
    root.setAttribute('data-theme', value)
    writing = false
  }

  function refresh(): void {
    const next = snapshot()
    const changed =
      next.theme !== current.theme ||
      next.resolvedTheme !== current.resolvedTheme ||
      next.locale !== current.locale ||
      next.cdnBase !== current.cdnBase ||
      JSON.stringify(next.versions) !== JSON.stringify(current.versions)
    current = next
    if (!changed) return
    for (const fn of [...listeners]) {
      try {
        fn(current)
      } catch (error) {
        console.error('[dsk-embed] config listener failed', error)
      }
    }
  }

  function configure(input: ConfigInput): Readonly<EmbedConfig> {
    if ('theme' in input) {
      if (input.theme === null || input.theme === undefined) themeSetting = null
      else if (isThemeSetting(input.theme)) themeSetting = input.theme
      else console.warn(`[dsk-embed] unknown theme "${String(input.theme)}"; use light, dark or system`)
    }
    if ('locale' in input) localeSetting = input.locale ? normalizeLocale(input.locale) : null
    if (typeof input.cdnBase === 'string' && input.cdnBase.trim() !== '') cdnBase = normalizeCdnBase(input.cdnBase)
    if (input.versions && typeof input.versions === 'object') pinned = { ...pinned, ...input.versions }
    applyTheme()
    refresh()
    return current
  }

  // The page changing its own theme or language.
  const observer =
    typeof MutationObserver === 'function'
      ? new MutationObserver(() => {
          if (writing) return
          // A host writing data-theme over a configured one takes over the theme.
          const page = pageTheme()
          if (themeSetting !== null && page && page !== resolve()) themeSetting = page
          refresh()
        })
      : null
  observer?.observe(root, { attributes: true, attributeFilter: ['data-theme', 'lang'] })

  const onMedia = (): void => {
    applyTheme()
    refresh()
  }
  media?.addEventListener?.('change', onMedia)

  configure(initial)

  return {
    get: () => current,
    configure,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    dispose() {
      observer?.disconnect()
      media?.removeEventListener?.('change', onMedia)
      listeners.clear()
    },
  }
}
