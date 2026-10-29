/**
 * The `DskEmbed` object: configuration, the block registry, the event bus,
 * `renderBlocks`, and the plugin loading behind the elements. The loader and
 * the fat bundle build the same object; they differ only in how a plugin
 * arrives (a module from the CDN, or code already in the bundle).
 */
import { createBus, type BusListener } from './bus'
import { createConfig, type ConfigStore } from './config'
import { defineElements } from './elements'
import { createRegistry } from './registry'
import { renderBlocks, unrenderBlocks, type RenderBlocksOptions } from './renderBlocks'
import type { BlockRegistry, BlockRendererInput, ConfigInput, EmbedConfig, Host, PluginModule, PluginName } from './types'
import type { ImportMap } from './importmap'

/** Which plugin draws each built-in fence language. */
export const BUILTIN_BLOCKS: Readonly<Record<string, PluginName>> = {
  mermaid: 'diagram',
  openapi: 'openapi',
  flow: 'flow',
  board: 'board',
  video: 'media',
  audio: 'media',
}

export interface EmbedOptions {
  version: string
  versions: Record<string, string>
  config?: ConfigInput
  /** Brings a plugin's module (and its stylesheets) in. */
  loadPlugin(name: PluginName, config: Readonly<EmbedConfig>): Promise<PluginModule>
  /** `loader` or `bundle`. */
  mode: 'loader' | 'bundle'
  importMap?: ImportMap
}

export interface DskEmbedApi {
  readonly version: string
  readonly mode: 'loader' | 'bundle'
  /** Exact versions of the shared runtime. */
  readonly versions: Readonly<Record<string, string>>
  /** The import map in effect for the runtime (loader only). */
  readonly importMap: ImportMap | null
  readonly config: Readonly<EmbedConfig>
  configure(input: ConfigInput): Readonly<EmbedConfig>
  blocks: {
    register(language: string, renderer: BlockRendererInput): () => void
    unregister(language: string): void
    has(language: string): boolean
    list(): string[]
  }
  on(name: string, fn: BusListener): () => void
  once(name: string, fn: BusListener): () => void
  off(name: string, fn: BusListener): void
  emit(name: string, detail?: unknown, target?: EventTarget): boolean
  renderBlocks(root?: ParentNode, options?: RenderBlocksOptions): Promise<number>
  unrenderBlocks(root?: ParentNode): number
  /** Loads a plugin ahead of its first element (e.g. on hover of a link). */
  preload(...names: PluginName[]): Promise<void>
  /** @internal The plugins' side of the core. */
  readonly host: Host
}

export function createEmbed(options: EmbedOptions): DskEmbedApi {
  const config: ConfigStore = createConfig(options.config ?? {}, document, options.versions)
  const registry: BlockRegistry = createRegistry()
  const bus = createBus(document)
  const plugins = new Map<PluginName, Promise<PluginModule>>()

  const host: Host = {
    version: options.version,
    config: () => config.get(),
    onConfig: (fn) => config.subscribe(fn),
    blocks: registry,
    emit: (name, detail, target) => bus.emit(name, detail, target),
    load(name) {
      let p = plugins.get(name)
      if (!p) {
        p = options.loadPlugin(name, config.get()).then((module) => {
          ;(module as PluginModule & { setup?: (h: Host) => void }).setup?.(host)
          return module
        })
        // A failed download may succeed on the next attempt.
        p.catch(() => plugins.delete(name))
        plugins.set(name, p)
      }
      return p
    },
  }

  // The built-in fence languages: the plugin is fetched on the first block.
  for (const [language, plugin] of Object.entries(BUILTIN_BLOCKS)) {
    registry.register(language, async (code, ctx) => {
      const module = await host.load(plugin)
      const renderer = module.renderers?.[language]
      if (!renderer) return { error: `no ${language} renderer in the ${plugin} plugin` }
      return renderer(code, ctx)
    })
  }

  config.subscribe((c) => {
    bus.emit('config', { theme: c.theme, resolvedTheme: c.resolvedTheme, locale: c.locale })
  })

  const api: DskEmbedApi = {
    version: options.version,
    mode: options.mode,
    versions: Object.freeze({ ...options.versions }),
    importMap: options.importMap ?? null,
    get config() {
      return config.get()
    },
    configure: (input) => config.configure(input),
    blocks: {
      register: (language, renderer) => registry.register(language, renderer),
      unregister: (language) => registry.unregister(language),
      has: (language) => registry.has(language),
      list: () => registry.languages(),
    },
    on: bus.on,
    once: bus.once,
    off: bus.off,
    emit: bus.emit,
    renderBlocks: (root = document.body, opts) => renderBlocks(root, registry, opts),
    unrenderBlocks: (root = document.body) => unrenderBlocks(root),
    preload: async (...names) => {
      await Promise.all(names.map((n) => host.load(n)))
    },
    host,
  }

  defineElements(host)
  return api
}

/** `window.DskEmbedConfig` and the script tag's `data-*` attributes, merged. */
export function pageConfig(script: HTMLScriptElement | null): ConfigInput {
  const fromWindow = ((globalThis as { DskEmbedConfig?: ConfigInput }).DskEmbedConfig ?? {}) as ConfigInput
  const out: ConfigInput = { ...fromWindow }
  if (script) {
    const theme = script.getAttribute('data-theme')
    const locale = script.getAttribute('data-locale')
    const cdn = script.getAttribute('data-cdn-base')
    if (theme) out.theme = theme as ConfigInput['theme']
    if (locale) out.locale = locale
    if (cdn) out.cdnBase = cdn
  }
  return out
}

/** Auto-render: `data-render-blocks` on the script tag renders the page's code blocks once it is parsed. */
export function autoRenderBlocks(api: DskEmbedApi, script: HTMLScriptElement | null): void {
  if (!script || !script.hasAttribute('data-render-blocks')) return
  const selector = script.getAttribute('data-render-blocks') || 'body'
  const run = (): void => {
    for (const root of Array.from(document.querySelectorAll(selector))) void api.renderBlocks(root)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true })
  else run()
}
