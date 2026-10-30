/**
 * Starting a bundle — the fat one or a per-plugin one. The first bundle on
 * the page builds `DskEmbed` with the plugins it carries; a bundle that comes
 * later adds its plugins to it (`extend`) instead, so several per-plugin
 * bundles share one registry of elements and block languages: a markdown
 * block of another bundle's language renders once that bundle is here.
 */
import { BASE_CSS } from './core/baseCss'
import { autoRenderBlocks, createEmbed, pageConfig, type DskEmbedApi } from './core/embed'
import { injectStyle } from './core/styles'
import type { PluginModule, PluginName } from './core/types'

declare global {
  interface Window {
    DskEmbed?: DskEmbedApi
  }
}

/** Stylesheets by id, in cascade order; each goes into the page once, whichever bundle brings it. */
export type BundleStyles = ReadonlyArray<readonly [id: string, css: string]>

export function bootBundle(plugins: Partial<Record<PluginName, PluginModule>>, styles: BundleStyles): void {
  const script = document.currentScript instanceof HTMLScriptElement ? document.currentScript : null
  const existing = window.DskEmbed
  if (existing && typeof existing.extend !== 'function') {
    console.warn(`[dsk-embed] already loaded (${existing.mode} ${existing.version}), without extend(); this bundle is ignored`)
    return
  }
  for (const [id, css] of styles) injectStyle(id, css)
  injectStyle('base', BASE_CSS)
  if (existing) {
    existing.extend(plugins)
    return
  }
  const api = createEmbed({
    mode: 'bundle',
    version: __EMBED_VERSION__,
    versions: __EMBED_VERSIONS__,
    config: pageConfig(script),
    plugins: Object.keys(plugins) as PluginName[],
    loadPlugin: async (name) => {
      const module = plugins[name]
      if (!module) throw new Error(`the ${name} plugin is not in this bundle`)
      return module
    },
  })
  window.DskEmbed = api
  autoRenderBlocks(api, script)
  document.dispatchEvent(new CustomEvent('dsk:embed-ready', { detail: { version: __EMBED_VERSION__, mode: 'bundle' } }))
}
