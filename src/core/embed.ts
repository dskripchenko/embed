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

export const ALL_PLUGINS: readonly PluginName[] = ['media', 'diagram', 'openapi', 'flow', 'markdown', 'editor', 'board', 'bpmn', 'drawio', 'kanban']

/** Which plugin draws each built-in fence language. */
export const BUILTIN_BLOCKS: Readonly<Record<string, PluginName>> = {
  mermaid: 'diagram',
  plantuml: 'diagram',
  puml: 'diagram',
  dot: 'diagram',
  graphviz: 'diagram',
  d2: 'diagram',
  dbml: 'diagram',
  structurizr: 'diagram',
  wardley: 'diagram',
  openapi: 'openapi',
  asyncapi: 'openapi',
  bpmn: 'bpmn',
  dmn: 'bpmn',
  drawio: 'drawio',
  kanban: 'kanban',
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
  /**
   * The plugins this build provides (default: all). Elements and block
   * languages of the others are not defined until `extend` brings them.
   */
  plugins?: readonly PluginName[]
}

/** What `extend` takes: plugin modules, or functions that bring them. */
export type PluginSources = Partial<Record<PluginName, PluginModule | (() => Promise<PluginModule>)>>

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
  /** The plugins available on the page. */
  plugins(): PluginName[]
  /**
   * Adds plugins from another build on the same page (a per-plugin bundle
   * loaded after this one): their elements and block languages are defined;
   * plugins already available are kept. Returns the names that were added.
   */
  extend(sources: PluginSources): PluginName[]
  /** @internal The plugins' side of the core. */
  readonly host: Host
}

export function createEmbed(options: EmbedOptions): DskEmbedApi {
  const config: ConfigStore = createConfig(options.config ?? {}, document, options.versions)
  const registry: BlockRegistry = createRegistry()
  const bus = createBus(document)
  const plugins = new Map<PluginName, Promise<PluginModule>>()
  const available = new Set<PluginName>(options.plugins ?? ALL_PLUGINS)
  const extra = new Map<PluginName, () => Promise<PluginModule>>()

  const host: Host = {
    version: options.version,
    config: () => config.get(),
    onConfig: (fn) => config.subscribe(fn),
    blocks: registry,
    emit: (name, detail, target) => bus.emit(name, detail, target),
    load(name) {
      let p = plugins.get(name)
      if (!p) {
        const source = extra.get(name)
        if (!source && !available.has(name)) return Promise.reject(new Error(`the ${name} plugin is not on this page`))
        p = (source ? source() : options.loadPlugin(name, config.get())).then((module) => {
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

  // The built-in fence languages of the available plugins: the plugin is fetched on the first block.
  const registerBlocks = (names: Iterable<PluginName>): void => {
    const wanted = new Set(names)
    for (const [language, plugin] of Object.entries(BUILTIN_BLOCKS)) {
      if (!wanted.has(plugin) || registry.has(language)) continue
      registry.register(language, async (code, ctx) => {
        const module = await host.load(plugin)
        const renderer = module.renderers?.[language]
        if (!renderer) return { error: `no ${language} renderer in the ${plugin} plugin` }
        return renderer(code, ctx)
      })
    }
  }
  registerBlocks(available)

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
    plugins: () => [...available],
    extend(sources) {
      const added: PluginName[] = []
      for (const [name, source] of Object.entries(sources) as [PluginName, PluginSources[PluginName]][]) {
        if (!source || available.has(name)) continue
        extra.set(name, typeof source === 'function' ? source : () => Promise.resolve(source))
        available.add(name)
        added.push(name)
      }
      if (added.length > 0) {
        defineElements(host, available)
        registerBlocks(added)
      }
      return added
    },
    host,
  }

  defineElements(host, available)
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
