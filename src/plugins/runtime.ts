/**
 * The Vue side shared by every plugin: one app context for every element
 * and live block on the page. Each mount is rendered into its own element
 * with `render()`, in that context, under a root that provides the kit's
 * locale — so the kit's components, the plugin packages and the blocks
 * inside markdown all see the same Vue, the same locale and the same block
 * renderers.
 */
import {
  computed,
  createApp,
  createVNode,
  defineComponent,
  h,
  render,
  shallowReactive,
  shallowRef,
  type App,
  type PropType,
  type VNode,
  type VNodeChild,
} from 'vue'
import { en, markdownBlockRenderersKey, provideLocale, ru } from '@dskripchenko/ui'
import type { BlockRenderer, ElementContext, Host, Locale, ResolvedTheme } from '../core/types'

export interface RuntimeState {
  locale: Locale
  theme: ResolvedTheme
  /** Every registered block renderer; a new object on each change. */
  renderers: Record<string, BlockRenderer>
}

export const state: RuntimeState = shallowReactive({ locale: 'en', theme: 'light', renderers: {} })

let app: App | null = null
let host: Host | null = null

/** What `app.provide(markdownBlockRenderersKey)` hands every UidMarkdown: kept current in place. */
const providedRenderers: Record<string, BlockRenderer> = {}

export function setupRuntime(h: Host): void {
  if (host) return
  host = h
  app = createApp({ render: () => null })
  app.config.errorHandler = (error, _instance, info) => {
    console.error(`[dsk-embed] ${info}:`, error)
  }
  app.provide(markdownBlockRenderersKey, providedRenderers)

  const syncConfig = (): void => {
    const c = h.config()
    state.locale = c.locale
    state.theme = c.resolvedTheme
  }
  const syncRenderers = (): void => {
    const all = h.blocks.all()
    for (const k of Object.keys(providedRenderers)) if (!(k in all)) delete providedRenderers[k]
    Object.assign(providedRenderers, all)
    state.renderers = all
  }
  syncConfig()
  syncRenderers()
  h.onConfig(syncConfig)
  h.blocks.subscribe(syncRenderers)
}

export function runtimeHost(): Host {
  if (!host) throw new Error('the embed runtime is not set up')
  return host
}

/** Exposed for the single-runtime check: the Vue this runtime renders with. */
export function runtimeApp(): App | null {
  return app
}

const EmbedRoot = defineComponent({
  name: 'DskEmbedRoot',
  props: {
    locale: { type: Function as PropType<() => Locale>, required: true },
    content: { type: Function as PropType<() => VNodeChild>, required: true },
  },
  setup(props) {
    provideLocale(computed(() => (props.locale() === 'ru' ? ru : en)))
    return () => props.content()
  },
})

export interface Mounted {
  unmount(): void
}

/** Renders `content` into `container` in the shared app context, under the kit's locale. */
export function mountView(container: HTMLElement, locale: () => Locale, content: () => VNodeChild): Mounted {
  if (!app) throw new Error('the embed runtime is not set up')
  const vnode = createVNode(EmbedRoot, { locale, content })
  vnode.appContext = app._context
  render(vnode, container)
  return {
    unmount() {
      render(null, container)
    },
  }
}

export interface ElementView {
  /** Reactive copies of the element's props, source, children and locale. */
  view: {
    props: Record<string, unknown>
    source: string
    children: ReturnType<ElementContext['children']>
    locale: Locale
  }
  /** Reads the element again (after an attribute, property or source change). */
  refresh(): void
  unmount(): void
}

/** An element's view: re-rendered when the element or the global locale changes. */
export function mountElementView(ctx: ElementContext, content: (view: ElementView['view']) => VNodeChild): ElementView {
  const view = shallowReactive({ props: ctx.props(), source: ctx.source(), children: ctx.children(), locale: ctx.locale() })
  const off = ctx.host.onConfig(() => {
    view.locale = ctx.locale()
  })
  const mounted = mountView(ctx.container, () => view.locale, () => content(view))
  return {
    view,
    refresh() {
      view.props = ctx.props()
      view.source = ctx.source()
      view.children = ctx.children()
      view.locale = ctx.locale()
    },
    unmount() {
      off()
      mounted.unmount()
    },
  }
}

/** A component instance captured through a function ref. */
export function instanceRef<T = any>() {
  const r = shallowRef<T | null>(null)
  const set = (value: unknown): void => {
    r.value = (value as T) ?? null
  }
  return { ref: r, set }
}

const textCache = new Map<string, Promise<string>>()

/** Fetches a text resource once per URL (a failed fetch is retried next time). */
export function fetchText(url: string): Promise<string> {
  let p = textCache.get(url)
  if (!p) {
    p = fetch(url, { credentials: 'same-origin' }).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
      return r.text()
    })
    p.catch(() => textCache.delete(url))
    textCache.set(url, p)
  }
  return p
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * `h` for the plugin components. The embed builds their props from
 * attributes at run time, so it checks them itself (see core/attrs) rather
 * than through each component's prop types.
 */
export const hc = h as unknown as (type: unknown, props?: Record<string, unknown> | null, children?: unknown) => VNode
