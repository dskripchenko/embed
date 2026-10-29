/**
 * dist/embed.bundle.js — the fat bundle: Vue, the kit, every plugin package
 * and all styles in one classic script, no import map and no further
 * requests. The same elements and the same `DskEmbed` API as the loader:
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.bundle.js"></script>
 *
 * For a page that cannot use import maps or wants no CDN at run time. It is
 * the whole runtime at once — see the README for its size.
 */
import kitTokens from '@dskripchenko/ui/styles/tokens.css?inline'
import kitThemes from '@dskripchenko/ui/styles/themes.css?inline'
import kitComponents from '@dskripchenko/ui/styles/index.css?inline'
import openapiCss from '@dskripchenko/openapi/style.css?inline'
import flowCss from '@dskripchenko/flow/style.css?inline'
import editorCss from '@dskripchenko/wysiwyg/style.css?inline'
import boardCss from '@dskripchenko/board/style.css?inline'
import { BASE_CSS } from './core/baseCss'
import { autoRenderBlocks, createEmbed, pageConfig, type DskEmbedApi } from './core/embed'
import { injectStyle } from './core/styles'
import type { PluginModule, PluginName } from './core/types'
import * as media from './plugins/media'
import * as diagram from './plugins/diagram'
import * as openapi from './plugins/openapi'
import * as flow from './plugins/flow'
import * as markdown from './plugins/markdown'
import * as editor from './plugins/editor'
import * as board from './plugins/board'

declare global {
  interface Window {
    DskEmbed?: DskEmbedApi
  }
}

const PLUGINS: Record<PluginName, PluginModule> = { media, diagram, openapi, flow, markdown, editor, board }

function boot(): void {
  if (window.DskEmbed) {
    console.warn(`[dsk-embed] already loaded (${window.DskEmbed.mode} ${window.DskEmbed.version}); the bundle is ignored`)
    return
  }
  const script = document.currentScript instanceof HTMLScriptElement ? document.currentScript : null
  injectStyle('kit', [kitTokens, kitThemes, kitComponents, openapiCss, flowCss, editorCss, boardCss].join('\n'))
  injectStyle('base', BASE_CSS)
  const api = createEmbed({
    mode: 'bundle',
    version: __EMBED_VERSION__,
    versions: __EMBED_VERSIONS__,
    config: pageConfig(script),
    loadPlugin: async (name) => PLUGINS[name],
  })
  window.DskEmbed = api
  autoRenderBlocks(api, script)
  document.dispatchEvent(new CustomEvent('dsk:embed-ready', { detail: { version: __EMBED_VERSION__, mode: 'bundle' } }))
}

boot()
