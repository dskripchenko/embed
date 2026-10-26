/**
 * dist/embed.js — the loader. A classic script, so it runs synchronously
 * where it stands and can put the runtime's import map in place before any
 * module resolves `vue`:
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js"></script>
 *
 * It defines the elements and the `DskEmbed` API at once; Vue, the kit and
 * the plugin packages are fetched from the CDN when the first element that
 * needs them appears.
 */
import { DEFAULT_CDN, normalizeCdnBase } from './core/config'
import { autoRenderBlocks, createEmbed, pageConfig, type DskEmbedApi } from './core/embed'
import { buildImportMap, installImportMap, styleUrl } from './core/importmap'
import { PLUGIN_STYLES } from './core/plugins'
import { injectStyle, loadStylesheet } from './core/styles'
import type { PluginModule } from './core/types'
import { BASE_CSS } from './core/baseCss'
import { cdnBaseOf, embedBaseOf } from './core/urls'

declare global {
  interface Window {
    DskEmbed?: DskEmbedApi
  }
}

const VERSION = __EMBED_VERSION__
const VERSIONS = __EMBED_VERSIONS__

/** The tag that loaded us: currentScript for a classic script, else found by its address. */
function ownScript(): HTMLScriptElement | null {
  if (document.currentScript instanceof HTMLScriptElement) return document.currentScript
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'))
  return scripts.reverse().find((s) => /\/embed(\.min)?\.js(\?|#|$)/.test(s.src)) ?? null
}

function boot(): void {
  if (window.DskEmbed) {
    console.warn(`[dsk-embed] already loaded (${window.DskEmbed.mode} ${window.DskEmbed.version}); this copy is ignored`)
    return
  }
  const script = ownScript()
  if (!script) console.warn('[dsk-embed] cannot find its own <script>; assuming the default CDN')
  if (script?.type === 'module') {
    console.warn('[dsk-embed] embed.js runs best as a classic <script>: from a module the import map may come too late in browsers without multiple import maps')
  }
  const src = script?.src ?? `${DEFAULT_CDN}@dskripchenko/embed@${VERSION}/dist/embed.js`
  const config = pageConfig(script)
  const embedBase = embedBaseOf(src, VERSION)
  const cdnBase = normalizeCdnBase(config.cdnBase ?? cdnBaseOf(src) ?? DEFAULT_CDN)
  const versions = { ...VERSIONS, ...(config.versions ?? {}) }

  const { map, conflicts } = installImportMap(buildImportMap(cdnBase, versions))
  for (const c of conflicts) {
    console.warn(`[dsk-embed] the page maps "${c.specifier}" to ${c.page}; the embed was built against ${c.embed}. A second copy of Vue or the kit breaks the elements — map both to the same file.`)
  }

  injectStyle('base', BASE_CSS)

  const api = createEmbed({
    mode: 'loader',
    version: VERSION,
    versions,
    importMap: map,
    config: { ...config, cdnBase, versions },
    async loadPlugin(name) {
      const styles = PLUGIN_STYLES[name].map((s) => loadStylesheet(styleUrl(cdnBase, versions, s)))
      const module = import(/* @vite-ignore */ `${embedBase}plugins/${name}.js`) as Promise<PluginModule>
      const [m] = await Promise.all([module, ...styles])
      return m
    },
  })
  window.DskEmbed = api
  autoRenderBlocks(api, script)
  document.dispatchEvent(new CustomEvent('dsk:embed-ready', { detail: { version: VERSION, mode: 'loader' } }))
}

boot()
