/**
 * `<dsk-openapi>` and ```openapi blocks, through @dskripchenko/openapi:
 *
 * - reference mode (default): the whole reference, one spec or several with
 *   a switcher;
 * - operation mode (`operation="createOrder"`): one operation as a card;
 * - block mode: the YAML/JSON of an ```openapi block — a request or a whole
 *   document — as the live widget, editable with `editable`;
 * - editor mode: the whole spec in the visual editor (a tree of the document
 *   and a form for each part), with its source and preview views.
 *
 * `<dsk-asyncapi>` and ```asyncapi blocks show AsyncAPI 2.x / 3.0 documents
 * of event-driven APIs the same way.
 */
import { h, shallowReactive, shallowRef } from 'vue'
import { AsyncApiReference, OpenApiBlock, OpenApiEditor, OpenApiOperation, OpenApiReference, proxySend } from '@dskripchenko/openapi/vue'
import { cssLength } from '../core/attrs'
import type { BlockRenderer, ElementContext, ElementInstance, Host } from '../core/types'
import { errorText, fetchText, instanceRef, mountElementView, mountView, setupRuntime, state, hc } from './runtime'
import { withFullscreen } from './fullscreen'

export function setup(host: Host): void {
  setupRuntime(host)
}

/** One loader function per URL: the reference reloads when the function changes, so it must stay the same. */
const loaders = new Map<string, () => Promise<string>>()

export function specLoader(url: string): () => Promise<string> {
  let loader = loaders.get(url)
  if (!loader) {
    loader = () => fetchText(url)
    loaders.set(url, loader)
  }
  return loader
}

interface SpecEntry {
  id: string
  name?: string
  spec: unknown
}

/** `specs` JSON: `[{ id, name?, src | content }]`. */
export function toSpecs(value: unknown): SpecEntry[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: SpecEntry[] = []
  value.forEach((item, i) => {
    if (!item || typeof item !== 'object') return
    const o = item as Record<string, unknown>
    const id = typeof o.id === 'string' && o.id !== '' ? o.id : `spec-${i + 1}`
    const spec = typeof o.src === 'string' ? specLoader(o.src) : o.content ?? o.spec
    if (spec === undefined) return
    out.push({ id, ...(typeof o.name === 'string' ? { name: o.name } : {}), spec })
  })
  return out
}

/** `createOrder` → `operation/createOrder`; anchors pass as they are. */
export function anchorOf(target: string): string {
  return /^(operation|schema|tag|webhook)\//.test(target) || target.startsWith('#') ? target.replace(/^#/, '') : `operation/${target}`
}

type Reference = { go(anchor: string, options?: { tryIt?: boolean }): Promise<void>; open(id: string): Promise<void>; spec: unknown; print?: () => void }

const COMMON = ['tryIt', 'baseUrl', 'defaultSnippet', 'snippetTargets', 'persistCredentials', 'send', 'labels'] as const

/** One `send` per proxy URL: a stable function, as the components compare it by identity. */
const proxies = new Map<string, unknown>()

function proxyFor(url: string): unknown {
  let send = proxies.get(url)
  if (!send) {
    send = proxySend(url)
    proxies.set(url, send)
  }
  return send
}

function common(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of COMMON) if (props[key] !== undefined) out[key] = props[key]
  // `proxy="/api-proxy"`: try-it goes through the host's proxy (a `send` set from script wins).
  if (out.send === undefined && typeof props.proxy === 'string' && props.proxy !== '') out.send = proxyFor(props.proxy)
  return out
}

function titleOf(spec: unknown): string | undefined {
  const doc = (spec as { document?: { info?: { title?: string } } } | null)?.document
  return doc?.info?.title
}

/** `<dsk-asyncapi>`: an AsyncAPI document from `src`, the `spec` property, or the element's text. */
function mountAsyncApi(ctx: ElementContext): ElementInstance {
  const text = shallowRef<string | object | null>(null)
  const failure = shallowRef<string | null>(null)
  let loadedFrom = ''

  async function load(): Promise<void> {
    const props = ctx.props()
    const key = props.spec !== undefined ? 'object' : typeof props.src === 'string' && props.src !== '' ? `src:${props.src}` : `source:${ctx.source()}`
    if (key === loadedFrom && key !== 'object') return
    loadedFrom = key
    try {
      text.value = props.spec !== undefined ? (props.spec as string | object) : typeof props.src === 'string' && props.src !== '' ? await fetchText(props.src) : ctx.source()
      failure.value = null
      ctx.emit('load', {})
    } catch (error) {
      failure.value = errorText(error)
      ctx.emit('error', { message: failure.value })
    }
  }

  const v = mountElementView(ctx, (view) => {
    const props = view.props
    if (failure.value) return h('div', { class: 'dsk-error', role: 'alert' }, failure.value)
    if (text.value === null) return h('div', { class: 'dsk-openapi dsk-openapi--asyncapi' })
    const height = cssLength(props.height)
    return hc('div', { class: 'dsk-openapi dsk-openapi--asyncapi', style: height ? { height, overflow: 'auto' } : undefined }, [
      hc(AsyncApiReference, { spec: text.value, locale: view.locale, ...(props.labels && typeof props.labels === 'object' ? { labels: props.labels } : {}) }),
    ])
  })
  void load()
  const fs = withFullscreen(ctx)
  return {
    update() {
      v.refresh()
      void load()
    },
    destroy() {
      fs?.destroy()
      v.unmount()
    },
    api: {
      enterFullscreen: () => fs?.enter(),
      exitFullscreen: () => fs?.exit(),
      get fullscreen() {
        return fs?.active ?? false
      },
      get loaded() {
        return text.value !== null && failure.value === null
      },
    },
  }
}

export function mountElement(ctx: ElementContext): ElementInstance {
  if (ctx.tag === 'dsk-asyncapi') return mountAsyncApi(ctx)
  const comp = instanceRef<Reference>()
  // Block and editor modes: the text as edited in the widget.
  let blockText: string | null = null

  const v = mountElementView(ctx, (view) => {
    const props = view.props
    const mode = props.mode ?? (props.operation ? 'operation' : 'reference')
    const locale = view.locale
    const height = cssLength(props.height)
    const wrap = (child: ReturnType<typeof h>) =>
      hc('div', {
        class: `dsk-openapi dsk-openapi--${String(mode)}`,
        // In a fixed box the reference scrolls inside it; its sticky navigation fills the box (--oa-viewport-h).
        style: height ? { height: `var(--dsk-openapi-height, ${height})`, overflow: 'auto', '--oa-viewport-h': `var(--dsk-openapi-height, ${height})` } : undefined,
      }, [child])

    if (mode === 'block') {
      const source = blockText ?? view.source
      return wrap(
        hc(OpenApiBlock, {
          ...common(props),
          source,
          editable: props.editable === true,
          locale,
          'onUpdate:source': (text: string) => {
            blockText = text
            ctx.emit('change', { source: text })
          },
        }),
      )
    }

    if (mode === 'editor') {
      return wrap(
        hc(OpenApiEditor, {
          modelValue: blockText ?? view.source,
          ...(props.view ? { view: props.view } : {}),
          locale,
          ...(props.baseUrl ? { baseUrl: props.baseUrl } : {}),
          ...(props.labels ? { labels: props.labels } : {}),
          'onUpdate:modelValue': (text: string) => {
            blockText = text
            ctx.emit('change', { source: text })
          },
          onIssues: (issues: unknown[]) => ctx.emit('issues', { issues }),
        }),
      )
    }

    const spec = props.spec ?? (typeof props.src === 'string' && props.src !== '' ? specLoader(props.src) : view.source || undefined)
    const events = {
      ref: comp.set,
      onLoaded: (loaded: unknown, id?: string) => ctx.emit('loaded', { id: id ?? 'spec', title: titleOf(loaded) }),
      onError: (error: unknown, id?: string) => ctx.emit('error', { id: id ?? 'spec', message: errorText(error) }),
    }

    if (mode === 'operation') {
      return wrap(
        hc(OpenApiOperation, {
          ...common(props),
          ...events,
          spec,
          operation: String(props.operation ?? ''),
          locale,
          ...(props.referenceUrl ? { referenceUrl: props.referenceUrl } : {}),
          ...(props.specId ? { specId: props.specId } : {}),
        }),
      )
    }

    const specs = toSpecs(props.specs)
    return wrap(
      hc(OpenApiReference, {
        ...common(props),
        ...events,
        ...(specs ? { specs } : { spec }),
        ...(props.active ? { active: props.active } : {}),
        ...(props.heading ? { title: props.heading } : {}),
        ...(props.hashNavigation !== undefined ? { hashNavigation: props.hashNavigation } : {}),
        locale,
        'onUpdate:active': (id: string) => ctx.emit('active', { id }),
      }),
    )
  })

  const reference = (): Reference => {
    const r = comp.ref.value
    if (!r) throw new Error('the reference is not ready')
    return r
  }

  const fs = withFullscreen(ctx)
  return {
    update() {
      // A new source from outside replaces what was edited in the widget.
      if (ctx.source() !== v.view.source) blockText = null
      v.refresh()
    },
    destroy: () => {
      fs?.destroy()
      v.unmount()
    },
    api: {
      enterFullscreen: () => fs?.enter(),
      exitFullscreen: () => fs?.exit(),
      get fullscreen() {
        return fs?.active ?? false
      },
      /** Opens an operation (`createOrder`, `operation/createOrder`), a schema or a tag. */
      go: (target: string, options?: { tryIt?: boolean }) => reference().go(anchorOf(String(target)), options),
      open: (id: string) => reference().open(id),
      print: () => reference().print?.(),
      get loaded() {
        return comp.ref.value?.spec ?? null
      },
      /** Block and editor modes: the current text. */
      get value() {
        return blockText ?? ctx.source()
      },
    },
  }
}

export const renderers: Record<string, BlockRenderer> = {
  asyncapi() {
    return {
      mount(el, ctx) {
        el.classList.add('dsk-openapi-block', 'dsk-asyncapi-block')
        const view = shallowReactive({ code: ctx.code })
        const mounted = mountView(el, () => hc(AsyncApiReference, { spec: view.code, locale: state.locale }))
        return {
          update(code) {
            if (code !== view.code) view.code = code
          },
          destroy: () => mounted.unmount(),
        }
      },
    }
  },
  openapi() {
    return {
      mount(el, ctx) {
        el.classList.add('dsk-openapi-block')
        const view = shallowReactive({ code: ctx.code })
        const mounted = mountView(el, () =>
          hc(OpenApiBlock, {
            source: view.code,
            editable: ctx.editable,
            locale: state.locale,
            'onUpdate:source': (text: string) => {
              view.code = text
              ctx.setCode(text)
            },
          }),
        )
        return {
          update(code) {
            if (code !== view.code) view.code = code
          },
          destroy: () => mounted.unmount(),
        }
      },
    }
  },
}
