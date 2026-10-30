/**
 * The import map of the shared runtime: one Vue, one kit, one copy of every
 * plugin package per page, at the exact versions an embed release was built
 * and tested with.
 *
 * Browsers resolve bare specifiers (`import 'vue'`) through import maps, and
 * a map only counts when it is in the document before the first module that
 * needs it starts loading. The loader is therefore a classic script: it runs
 * synchronously where it stands, writes the map, and only then imports
 * modules. A page that already has its own map keeps it — entries the page
 * maps itself are left to the page (and a different URL for one of them is
 * reported, since it would mean a second Vue or kit); the rest go in a map
 * of their own, which browsers with multiple import maps merge.
 */

/** Package files the runtime imports, by specifier: [package, path inside it]. */
export const RUNTIME_FILES: Readonly<Record<string, readonly [string, string]>> = {
  vue: ['vue', 'dist/vue.runtime.esm-browser.prod.js'],
  '@dskripchenko/ui': ['@dskripchenko/ui', 'dist/index.mjs'],
  '@dskripchenko/ui/hls': ['@dskripchenko/ui', 'dist/hls/index.mjs'],
  '@dskripchenko/wysiwyg': ['@dskripchenko/wysiwyg', 'dist/index.mjs'],
  '@dskripchenko/diagrams': ['@dskripchenko/diagrams', 'dist/index.mjs'],
  '@dskripchenko/openapi': ['@dskripchenko/openapi', 'dist/index.mjs'],
  '@dskripchenko/openapi/vue': ['@dskripchenko/openapi', 'dist/vue.mjs'],
  '@dskripchenko/flow': ['@dskripchenko/flow', 'dist/index.mjs'],
  '@dskripchenko/flow/vue': ['@dskripchenko/flow', 'dist/vue.mjs'],
  '@dskripchenko/flow/mermaid': ['@dskripchenko/flow', 'dist/mermaid.mjs'],
  '@dskripchenko/board': ['@dskripchenko/board', 'dist/index.mjs'],
  '@dskripchenko/board/vue': ['@dskripchenko/board', 'dist/vue.mjs'],
  '@dskripchenko/bpmn': ['@dskripchenko/bpmn', 'dist/index.mjs'],
  '@dskripchenko/bpmn/vue': ['@dskripchenko/bpmn', 'dist/vue.mjs'],
  '@dskripchenko/drawio': ['@dskripchenko/drawio', 'dist/index.mjs'],
}

/** Stylesheets of the runtime packages: [package, path]. */
export const RUNTIME_STYLES: Readonly<Record<string, readonly [string, string]>> = {
  tokens: ['@dskripchenko/ui', 'dist/styles/tokens.css'],
  themes: ['@dskripchenko/ui', 'dist/styles/themes.css'],
  kit: ['@dskripchenko/ui', 'dist/styles/index.css'],
  openapi: ['@dskripchenko/openapi', 'dist/style.css'],
  flow: ['@dskripchenko/flow', 'dist/style.css'],
  board: ['@dskripchenko/board', 'dist/style.css'],
  bpmn: ['@dskripchenko/bpmn', 'dist/style.css'],
  editor: ['@dskripchenko/wysiwyg', 'dist/style.css'],
}

export interface ImportMap {
  imports: Record<string, string>
  scopes?: Record<string, Record<string, string>>
}

/** `https://cdn/npm/` + `vue` + `3.5.44` + `dist/x.js`. */
export function packageUrl(cdnBase: string, pkg: string, version: string, path: string): string {
  return `${cdnBase}${pkg}@${version}/${path}`
}

/** The runtime's import map. The packages bundle their own icons: no icon library in it. */
export function buildImportMap(cdnBase: string, versions: Readonly<Record<string, string>>): ImportMap {
  const imports: Record<string, string> = {}
  for (const [specifier, [pkg, path]] of Object.entries(RUNTIME_FILES)) {
    const version = versions[pkg]
    if (!version) throw new Error(`no version pinned for ${pkg}`)
    imports[specifier] = packageUrl(cdnBase, pkg, version, path)
  }
  return { imports }
}

export function styleUrl(cdnBase: string, versions: Readonly<Record<string, string>>, name: keyof typeof RUNTIME_STYLES): string {
  const [pkg, path] = RUNTIME_STYLES[name]!
  return packageUrl(cdnBase, pkg, versions[pkg]!, path)
}

/** The page's own import maps, merged as the browser merges them (the first definition wins). */
export function readPageImportMaps(doc: Document = document): ImportMap {
  const imports: Record<string, string> = {}
  for (const script of Array.from(doc.querySelectorAll('script[type="importmap"]'))) {
    try {
      const map = JSON.parse(script.textContent ?? '{}') as Partial<ImportMap>
      for (const [k, v] of Object.entries(map.imports ?? {})) if (!(k in imports)) imports[k] = v
    } catch {
      // The browser reports a broken map itself.
    }
  }
  return { imports }
}

export interface InstallResult {
  /** The map in effect for the runtime's specifiers. */
  map: ImportMap
  /** Entries written by the embed. */
  added: string[]
  /** Specifiers the page maps to another URL than the embed would. */
  conflicts: { specifier: string; page: string; embed: string }[]
}

/** Writes the runtime's import map into the document, leaving what the page maps itself. */
export function installImportMap(map: ImportMap, doc: Document = document): InstallResult {
  const page = readPageImportMaps(doc)
  const missing: Record<string, string> = {}
  const conflicts: InstallResult['conflicts'] = []
  const effective: Record<string, string> = {}
  for (const [specifier, url] of Object.entries(map.imports)) {
    const existing = page.imports[specifier]
    if (existing === undefined) {
      missing[specifier] = url
      effective[specifier] = url
    } else {
      effective[specifier] = existing
      if (existing !== url) conflicts.push({ specifier, page: existing, embed: url })
    }
  }
  const added = Object.keys(missing)
  if (added.length > 0) {
    const script = doc.createElement('script')
    script.type = 'importmap'
    script.setAttribute('data-dsk-embed', '')
    script.textContent = JSON.stringify({ imports: missing }, null, 2)
    // Ahead of any module script, so the map is in place before they resolve.
    const firstModule = doc.querySelector('script[type="module"]')
    const anchor = firstModule && firstModule.parentNode ? firstModule : null
    if (anchor) anchor.parentNode!.insertBefore(script, anchor)
    else (doc.head ?? doc.documentElement).appendChild(script)
  }
  return { map: { imports: effective }, added, conflicts }
}
