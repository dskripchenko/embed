import { RUNTIME_FILES, buildImportMap, installImportMap, readPageImportMaps, styleUrl } from '../../src/core/importmap'
import { cdnBaseOf, embedBaseOf } from '../../src/core/urls'

const VERSIONS = {
  vue: '3.5.44',
  '@dskripchenko/ui': '1.15.1',
  '@dskripchenko/wysiwyg': '0.5.0',
  '@dskripchenko/diagrams': '1.1.0',
  '@dskripchenko/openapi': '1.1.0',
  '@dskripchenko/flow': '1.0.1',
  '@dskripchenko/board': '0.2.0',
  '@dskripchenko/bpmn': '0.4.0',
  '@dskripchenko/drawio': '0.1.0',
}
const CDN = 'https://cdn.jsdelivr.net/npm/'

describe('import map', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('pins every runtime specifier to an exact version on the CDN', () => {
    const map = buildImportMap(CDN, VERSIONS)
    expect(Object.keys(map.imports).sort()).toEqual(Object.keys(RUNTIME_FILES).sort())
    expect(map.imports.vue).toBe('https://cdn.jsdelivr.net/npm/vue@3.5.44/dist/vue.runtime.esm-browser.prod.js')
    expect(map.imports['@dskripchenko/flow/vue']).toBe('https://cdn.jsdelivr.net/npm/@dskripchenko/flow@1.0.1/dist/vue.mjs')
    // The packages bundle their icons: no icon library in the map.
    expect(Object.keys(map.imports).some((k) => k.includes('lucide') || k.endsWith('/icons'))).toBe(false)
    expect(styleUrl(CDN, VERSIONS, 'kit')).toBe('https://cdn.jsdelivr.net/npm/@dskripchenko/ui@1.15.1/dist/styles/index.css')
    expect(() => buildImportMap(CDN, { vue: '3' })).toThrow(/no version pinned/)
  })

  it('writes a map ahead of module scripts', () => {
    document.head.innerHTML = '<script type="module" src="/app.js"></script>'
    const { added, conflicts } = installImportMap(buildImportMap(CDN, VERSIONS))
    expect(conflicts).toEqual([])
    expect(added).toContain('vue')
    const first = document.head.firstElementChild as HTMLScriptElement
    expect(first.type).toBe('importmap')
    expect(JSON.parse(first.textContent!).imports.vue).toContain('vue@3.5.44')
  })

  it('composes with the page map: the page keeps its entries, differences are reported', () => {
    const own = buildImportMap(CDN, VERSIONS)
    document.head.innerHTML = `<script type="importmap">${JSON.stringify({ imports: { vue: own.imports.vue, '@dskripchenko/ui': 'https://other/ui.js', app: '/app.js' } })}</script>`
    const { added, conflicts, map } = installImportMap(own)
    expect(added).not.toContain('vue')
    expect(added).not.toContain('@dskripchenko/ui')
    expect(conflicts).toEqual([{ specifier: '@dskripchenko/ui', page: 'https://other/ui.js', embed: own.imports['@dskripchenko/ui'] }])
    expect(map.imports['@dskripchenko/ui']).toBe('https://other/ui.js')
    expect(readPageImportMaps().imports.app).toBe('/app.js')
    expect(document.querySelectorAll('script[type="importmap"]').length).toBe(2)
  })

  it('pins a CDN range to the loader release and finds the CDN root', () => {
    expect(embedBaseOf('https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js', '1.2.3')).toBe('https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1.2.3/dist/')
    expect(embedBaseOf('https://example.com/static/embed/embed.js?v=2', '1.2.3')).toBe('https://example.com/static/embed/')
    expect(cdnBaseOf('http://127.0.0.1:5402/npm/@dskripchenko/embed@latest/dist/embed.js')).toBe('http://127.0.0.1:5402/npm/')
    expect(cdnBaseOf('https://example.com/embed.js')).toBe(null)
  })
})
