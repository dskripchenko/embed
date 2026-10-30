/**
 * The custom elements. Their classes are tiny and defined up front; what an
 * element draws with — Vue, the kit, a plugin package — is fetched the
 * moment the first element of its kind is connected (or, with
 * `loading="lazy"`, scrolled near the viewport). The elements live in the
 * light DOM, so the kit's stylesheets and the page's own CSS apply.
 */
import { SCHEMAS, attrOf, readAttributes, camel, type Schema } from './attrs'
import { DATA_CHILDREN, readMediaChildren, readSource } from './source'
import { normalizeLocale } from './config'
import type { ElementContext, ElementInstance, Host, Locale, PluginName } from './types'

export interface ElementSpec {
  plugin: PluginName
  /** Methods forwarded to the plugin; called before it is ready, they wait for it. */
  methods: readonly string[]
  /** Read-only values the plugin exposes. */
  getters: readonly string[]
  /** Properties set from script only (objects, functions). */
  objects: readonly string[]
}

export const ELEMENTS: Readonly<Record<string, ElementSpec>> = {
  'dsk-video': { plugin: 'media', methods: ['play', 'pause', 'toggle', 'seek', 'playChapter'], getters: ['state', 'media', 'chapters'], objects: [] },
  'dsk-audio': { plugin: 'media', methods: ['play', 'pause', 'toggle', 'seek', 'next', 'prev'], getters: ['state', 'media'], objects: [] },
  'dsk-diagram': { plugin: 'diagram', methods: ['enterFullscreen', 'exitFullscreen'], getters: ['svg', 'fullscreen'], objects: [] },
  'dsk-openapi': { plugin: 'openapi', methods: ['go', 'open', 'print', 'enterFullscreen', 'exitFullscreen'], getters: ['loaded', 'value', 'fullscreen'], objects: ['spec', 'send', 'labels'] },
  'dsk-flow': {
    plugin: 'flow',
    methods: ['fit', 'select', 'enter', 'back', 'refresh', 'undo', 'redo', 'enterFullscreen', 'exitFullscreen'],
    getters: ['stack', 'fullscreen'],
    objects: ['graph', 'loadSubgraph', 'persistToggle', 'labels', 'registry'],
  },
  'dsk-markdown': { plugin: 'markdown', methods: [], getters: ['value'], objects: [] },
  'dsk-board': { plugin: 'board', methods: ['fit', 'select', 'toPng', 'toSvg', 'undo', 'redo', 'enterFullscreen', 'exitFullscreen'], getters: ['value', 'fullscreen'], objects: ['board', 'provider', 'labels'] },
  'dsk-editor': { plugin: 'editor', methods: ['focus'], getters: ['controller'], objects: [] },
  'dsk-asyncapi': { plugin: 'openapi', methods: ['enterFullscreen', 'exitFullscreen'], getters: ['loaded', 'fullscreen'], objects: ['spec', 'labels'] },
  'dsk-bpmn': { plugin: 'bpmn', methods: ['fit', 'undo', 'redo', 'toSvg', 'enterFullscreen', 'exitFullscreen'], getters: ['value', 'fullscreen'], objects: ['labels', 'highlight'] },
  'dsk-dmn': { plugin: 'bpmn', methods: ['fit', 'undo', 'redo', 'toSvg', 'open', 'enterFullscreen', 'exitFullscreen'], getters: ['value', 'fullscreen'], objects: ['labels', 'highlight'] },
  'dsk-drawio': { plugin: 'drawio', methods: ['showPage', 'enterFullscreen', 'exitFullscreen'], getters: ['svg', 'pages', 'page', 'fullscreen'], objects: [] },
}

export type DskElement = HTMLElement & {
  /** Resolves once the element has rendered. */
  readonly ready: Promise<void>
  /** The text source: the script/template child or text content, or what was set. */
  source: string
  /** Reads `<script>`/`<template>`/`<source>`/`<track>` children again and re-renders. */
  refresh(): void
}

let hostRef: Host | null = null

/** The pending start of a lazy element. */
const lazyObserver: { io: IntersectionObserver | null } = { io: null }

function observeLazy(el: Element, start: () => void): void {
  if (typeof IntersectionObserver !== 'function') {
    start()
    return
  }
  lazyObserver.io ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        lazyObserver.io!.unobserve(entry.target)
        ;(entry.target as unknown as { _dskLazyStart?: () => void })._dskLazyStart?.()
      }
    },
    { rootMargin: '200px' },
  )
  ;(el as unknown as { _dskLazyStart?: () => void })._dskLazyStart = start
  lazyObserver.io.observe(el)
}

function createElementClass(tag: string, spec: ElementSpec, schema: Schema): CustomElementConstructor {
  const observed = schema.map(attrOf)

  class Element extends HTMLElement {
    static get observedAttributes(): string[] {
      return observed
    }

    _overrides: Record<string, unknown> = {}
    _source: string | null = null
    _children: { sources: Record<string, string>[]; tracks: Record<string, string>[] } = { sources: [], tracks: [] }
    _instance: ElementInstance | null = null
    _container: HTMLElement | null = null
    _starting = false
    _waitingForParse = false
    _updateQueued = false
    _resolveReady!: () => void
    _ready: Promise<void>

    constructor() {
      super()
      this._ready = new Promise((resolve) => (this._resolveReady = resolve))
    }

    get ready(): Promise<void> {
      return this._ready
    }

    get source(): string {
      if (this._source === null) this._capture()
      return this._source ?? ''
    }

    set source(value: string) {
      this._source = String(value ?? '')
      this._queueUpdate()
    }

    connectedCallback(): void {
      // Moved within the page: the rendered content moved with it.
      if (this._instance || this._starting) return
      // Upgraded while the parser is still on the start tag: the children (the
      // source, <source>/<track>, a <template>) are not there yet.
      if (document.readyState === 'loading') {
        if (!this._waitingForParse) {
          this._waitingForParse = true
          document.addEventListener('DOMContentLoaded', () => {
            this._waitingForParse = false
            if (this.isConnected) this.connectedCallback()
          }, { once: true })
        }
        return
      }
      const lazy = this.getAttribute('loading') === 'lazy'
      if (lazy) observeLazy(this, () => this._start())
      else this._start()
    }

    disconnectedCallback(): void {
      lazyObserver.io?.unobserve(this)
      // A move is a disconnect and a connect in one task: destroy only what really left.
      queueMicrotask(() => {
        if (!this.isConnected) this._destroy()
      })
    }

    attributeChangedCallback(name: string, before: string | null, after: string | null): void {
      if (before === after) return
      if (name === 'loading' && after !== 'lazy' && !this._instance && !this._starting && this.isConnected) this._start()
      this._queueUpdate()
    }

    refresh(): void {
      this._capture(true)
      this._queueUpdate()
    }

    _capture(force = false): void {
      if (this._source !== null && !force) return
      this._source = readSource(this)
      this._children = readMediaChildren(this)
    }

    _props(): Record<string, unknown> {
      const { props, errors } = readAttributes(this, schema)
      for (const error of errors) console.warn(`[dsk-embed] <${tag} ${error.attr}>: ${error.message}`)
      return { ...props, ...this._overrides }
    }

    _locale(): Locale {
      const own = this._overrides.locale ?? this.getAttribute('locale')
      return typeof own === 'string' && own !== '' ? normalizeLocale(own) : (hostRef?.config().locale ?? 'en')
    }

    _queueUpdate(): void {
      if (!this._instance || this._updateQueued) return
      this._updateQueued = true
      queueMicrotask(() => {
        this._updateQueued = false
        this._instance?.update()
      })
    }

    _start(): void {
      const host = hostRef
      if (!host || this._starting || this._instance) return
      this._starting = true
      this._capture()
      // The text source is now held; what remains visible of it goes.
      for (const node of Array.from(this.childNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE && DATA_CHILDREN.has((node as HTMLElement).tagName)) continue
        if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).hasAttribute('data-dsk-root')) continue
        node.remove()
      }
      const container = document.createElement('div')
      container.setAttribute('data-dsk-root', '')
      container.className = 'dsk-root'
      this.appendChild(container)
      this._container = container
      this.setAttribute('data-dsk-state', 'loading')

      host
        .load(spec.plugin)
        .then((plugin) => {
          if (!this.isConnected || this._container !== container) return
          if (!plugin.mountElement) throw new Error(`plugin ${spec.plugin} has no elements`)
          const ctx: ElementContext = {
            host,
            el: this,
            tag,
            container,
            props: () => this._props(),
            source: () => this.source,
            children: () => this._children,
            emit: (name, detail) => host.emit(name, detail, this),
            locale: () => this._locale(),
          }
          this._instance = plugin.mountElement(ctx)
          this.setAttribute('data-dsk-state', 'ready')
          this._resolveReady()
          host.emit('ready', { tag }, this)
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          console.error(`[dsk-embed] <${tag}> failed to load`, error)
          this.setAttribute('data-dsk-state', 'error')
          container.replaceChildren()
          const box = document.createElement('div')
          box.className = 'dsk-error'
          box.setAttribute('role', 'alert')
          box.textContent = message
          container.appendChild(box)
          host.emit('error', { tag, message }, this)
        })
        .finally(() => {
          this._starting = false
        })
    }

    _destroy(): void {
      if (this._instance) {
        try {
          this._instance.destroy()
        } catch (error) {
          console.error(`[dsk-embed] <${tag}> destroy failed`, error)
        }
      }
      this._instance = null
      this._container?.remove()
      this._container = null
      this.removeAttribute('data-dsk-state')
      this._ready = new Promise((resolve) => (this._resolveReady = resolve))
    }
  }

  const proto = Element.prototype as unknown as Record<string, unknown>

  // Attribute-backed properties: a value set from script wins over the attribute.
  for (const prop of schema) {
    if (prop.prop in proto) continue
    Object.defineProperty(proto, prop.prop, {
      configurable: true,
      enumerable: true,
      get(this: Element) {
        const api = this._instance?.api
        if (api && prop.prop in api) return api[prop.prop]
        if (prop.prop in this._overrides) return this._overrides[prop.prop]
        return this._props()[prop.prop]
      },
      set(this: Element, value: unknown) {
        if (value === undefined) delete this._overrides[prop.prop]
        else this._overrides[prop.prop] = value
        this._queueUpdate()
      },
    })
  }
  for (const name of spec.objects) {
    Object.defineProperty(proto, name, {
      configurable: true,
      enumerable: true,
      get(this: Element) {
        const api = this._instance?.api
        if (api && name in api) return api[name]
        return this._overrides[name]
      },
      set(this: Element, value: unknown) {
        if (value === undefined) delete this._overrides[name]
        else this._overrides[name] = value
        this._queueUpdate()
      },
    })
  }
  for (const name of spec.methods) {
    proto[name] = function (this: Element, ...args: unknown[]) {
      const call = (): unknown => {
        const fn = this._instance?.api?.[name]
        if (typeof fn !== 'function') throw new Error(`<${tag}>.${name}() is not available`)
        return (fn as (...a: unknown[]) => unknown)(...args)
      }
      return this._instance ? call() : this.ready.then(call)
    }
  }
  for (const name of spec.getters) {
    Object.defineProperty(proto, name, {
      configurable: true,
      enumerable: true,
      get(this: Element) {
        return this._instance?.api?.[name]
      },
    })
  }
  return Element
}

/** Defines the elements of the given plugins (each once per page) against the host. */
export function defineElements(host: Host, plugins?: ReadonlySet<PluginName>, registry: CustomElementRegistry = customElements): void {
  hostRef = host
  for (const [tag, spec] of Object.entries(ELEMENTS)) {
    if (registry.get(tag) || (plugins && !plugins.has(spec.plugin))) continue
    registry.define(tag, createElementClass(tag, spec, SCHEMAS[tag] ?? []))
  }
}

/** For tests: the property name an attribute maps to. */
export function propertyOf(tag: string, attr: string): string | undefined {
  return SCHEMAS[tag]?.find((p) => attrOf(p) === attr)?.prop ?? (SCHEMAS[tag] ? camel(attr) : undefined)
}
