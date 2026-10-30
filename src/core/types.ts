/**
 * Shared types of the embed core. The core itself has no Vue: it is the
 * loader's part (registry, config, events, element shells) and is a few
 * kilobytes. Plugins — the Vue side — get a `Host` to talk back to it.
 */

export type ThemeSetting = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type Locale = 'en' | 'ru'

export interface EmbedConfig {
  /**
   * The colour theme. `null` follows the page: its `<html data-theme>`, or the
   * kit's light tokens when the page sets none.
   */
  theme: ThemeSetting | null
  /** The theme in effect. */
  resolvedTheme: ResolvedTheme
  /** Interface language of every element (an element's own `locale` wins). */
  locale: Locale
  /** Where the shared runtime packages are loaded from (loader only). */
  cdnBase: string
  /** Exact versions of the shared runtime packages (loader only). */
  versions: Readonly<Record<string, string>>
}

export interface ConfigInput {
  theme?: ThemeSetting | null
  locale?: string | null
  cdnBase?: string
  versions?: Record<string, string>
}

/** What a live block's `mount` is told — the contract of UidMarkdown and the WYSIWYG editor. */
export interface BlockMountContext {
  code: string
  language: string
  /** True inside the editor: the widget may change the block's source through `setCode`. */
  editable: boolean
  setCode(code: string): void
}

export interface BlockMountHandle {
  update?(code: string): void
  destroy?(): void
}

/** A block renderer's answer: static markup, an error, or a live widget. */
export interface BlockResult {
  /** Markup the renderer built itself with every piece of user text escaped. */
  html?: string
  error?: string
  mount?: (el: HTMLElement, ctx: BlockMountContext) => BlockMountHandle | (() => void) | void
}

export type BlockRenderer = (code: string, ctx: { language: string; index: number }) => BlockResult | Promise<BlockResult>

/** What `blocks.register` accepts: a renderer, or a fixed result (`{ html }` / `{ mount }`). */
export type BlockRendererInput = BlockRenderer | BlockResult

/** Names of the lazily loaded plugin modules. */
export type PluginName = 'media' | 'diagram' | 'openapi' | 'flow' | 'markdown' | 'editor' | 'board' | 'bpmn' | 'drawio'

/** What an element gives its plugin. */
export interface ElementContext {
  host: Host
  el: HTMLElement
  tag: string
  /** Current props: parsed attributes overlaid with properties set from script. */
  props(): Record<string, unknown>
  /** The element's text source (script child, template or text), captured at upgrade. */
  source(): string
  /** `<source>` / `<track>` children, read at upgrade and on `refresh()`. */
  children(): { sources: Record<string, string>[]; tracks: Record<string, string>[] }
  /** The container the plugin renders into. */
  container: HTMLElement
  /** Dispatches a bubbling `dsk:<name>` CustomEvent from the element. */
  emit(name: string, detail?: unknown): void
  /** The locale for this element: its own `locale` attribute, else the global one. */
  locale(): Locale
}

export interface ElementInstance {
  /** Props or source changed. */
  update(): void
  destroy(): void
  /** Methods and getters the element forwards (`play`, `go`, `state`, …). */
  api?: Record<string, unknown>
}

export interface PluginModule {
  mountElement?(ctx: ElementContext): ElementInstance
  renderers?: Record<string, BlockRenderer>
}

export interface Host {
  version: string
  config(): Readonly<EmbedConfig>
  onConfig(fn: (config: Readonly<EmbedConfig>) => void): () => void
  blocks: BlockRegistry
  emit(name: string, detail?: unknown, target?: EventTarget): boolean
  load(plugin: PluginName): Promise<PluginModule>
}

export interface BlockRegistry {
  register(language: string, renderer: BlockRendererInput): () => void
  unregister(language: string): void
  get(language: string): BlockRenderer | undefined
  has(language: string): boolean
  languages(): string[]
  /** A snapshot of every renderer by language. */
  all(): Record<string, BlockRenderer>
  subscribe(fn: () => void): () => void
}
