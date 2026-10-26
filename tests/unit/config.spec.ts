import { createConfig, normalizeLocale } from '../../src/core/config'

const flush = () => new Promise((r) => setTimeout(r, 0))

function mockMedia(dark: boolean) {
  const listeners = new Set<() => void>()
  const mq = {
    matches: dark,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }
  vi.stubGlobal('matchMedia', () => mq)
  return { set(v: boolean) { mq.matches = v; for (const fn of listeners) fn() } }
}

describe('config', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.setAttribute('lang', 'en')
    mockMedia(false)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('normalizes locales', () => {
    expect(normalizeLocale('ru-RU')).toBe('ru')
    expect(normalizeLocale('RU')).toBe('ru')
    expect(normalizeLocale('de')).toBe('en')
    expect(normalizeLocale(null)).toBe('en')
  })

  it('follows the page by default and leaves <html> alone', () => {
    document.documentElement.setAttribute('lang', 'ru')
    const c = createConfig()
    expect(c.get()).toMatchObject({ theme: null, resolvedTheme: 'light', locale: 'ru' })
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    c.dispose()
  })

  it('reads <html data-theme> and follows changes of theme and lang', async () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const c = createConfig()
    const seen = vi.fn()
    c.subscribe(seen)
    expect(c.get().resolvedTheme).toBe('dark')
    document.documentElement.setAttribute('data-theme', 'light')
    document.documentElement.setAttribute('lang', 'ru-RU')
    await flush()
    expect(c.get()).toMatchObject({ resolvedTheme: 'light', locale: 'ru' })
    expect(seen).toHaveBeenCalled()
    c.dispose()
  })

  it('configure writes the theme on <html>; a configured locale ignores lang', async () => {
    const c = createConfig()
    c.configure({ theme: 'dark', locale: 'ru' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    document.documentElement.setAttribute('lang', 'en')
    await flush()
    expect(c.get().locale).toBe('ru')
    c.configure({ locale: null })
    expect(c.get().locale).toBe('en')
    c.dispose()
  })

  it('system follows prefers-color-scheme live', () => {
    const media = mockMedia(true)
    const c = createConfig({ theme: 'system' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    media.set(false)
    expect(c.get().resolvedTheme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    c.dispose()
  })

  it('ignores an unknown theme with a warning, normalizes cdnBase and merges versions', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c = createConfig({}, document, { vue: '3.5.0' })
    c.configure({ theme: 'pink' as never, cdnBase: 'https://cdn.example/npm', versions: { '@dskripchenko/ui': '1.0.0' } })
    expect(warn).toHaveBeenCalled()
    expect(c.get().theme).toBe(null)
    expect(c.get().cdnBase).toBe('https://cdn.example/npm/')
    expect(c.get().versions).toEqual({ vue: '3.5.0', '@dskripchenko/ui': '1.0.0' })
    warn.mockRestore()
    c.dispose()
  })
})
