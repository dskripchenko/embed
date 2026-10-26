/**
 * `<dsk-flow>` and ```flow blocks, through @dskripchenko/flow: a process
 * model (JSON, or Mermaid `stateDiagram-v2` / `flowchart`) as a read-only
 * view with monitoring, toggles and sub-processes — or, with `editable`, the
 * editor.
 *
 * HTTP conventions, so a backend needs no script on the page:
 *
 * - `src` — GET → the model (JSON).
 * - `poll-url` — GET → a monitoring snapshot, every `poll-interval` ms
 *   (5000). Inside a sub-process the query carries `path` (node ids from the
 *   root, comma-separated) and `ref` (the sub-process reference).
 * - `toggle-url` — POST `{ kind, id, enabled, path }` (JSON) when a node or
 *   an edge is switched; a non-2xx answer rolls the switch back.
 * - `subgraph-url` — GET → the model of a referenced sub-process; `{ref}` in
 *   the URL is replaced by the reference, else `?ref=` is appended.
 */
import { h, shallowReactive, shallowRef } from 'vue'
import { parseGraph, type Graph } from '@dskripchenko/flow'
import { FlowEditor, FlowView } from '@dskripchenko/flow/vue'
import { cssLength } from '../core/attrs'
import type { BlockRenderer, ElementContext, ElementInstance, Host } from '../core/types'
import { errorText, fetchText, instanceRef, mountElementView, mountView, setupRuntime, state, hc } from './runtime'

export function setup(host: Host): void {
  setupRuntime(host)
}

type MermaidModule = typeof import('@dskripchenko/flow/mermaid')
let mermaid: Promise<MermaidModule> | null = null

/** The Mermaid importer pulls in @dskripchenko/diagrams: loaded only for Mermaid sources and the editor. */
function loadMermaid(): Promise<MermaidModule> {
  mermaid ??= import('@dskripchenko/flow/mermaid')
  mermaid.catch(() => (mermaid = null))
  return mermaid
}

/** A model from JSON text, an object, or Mermaid source. */
export async function toGraph(input: unknown): Promise<Graph> {
  if (input && typeof input === 'object') return parseGraph(input)
  const text = String(input ?? '').trim()
  if (text === '') return parseGraph({ version: 1, nodes: [], edges: [] })
  if (text.startsWith('{')) return parseGraph(text)
  const { fromMermaid } = await loadMermaid()
  return fromMermaid(text)
}

/** `/state` + path/ref → `/state?path=a,b&ref=x`. */
export function pollUrl(url: string, context: { path?: string[]; ref?: string }): string {
  const u = new URL(url, document.baseURI)
  if (context.path && context.path.length > 0) u.searchParams.set('path', context.path.join(','))
  if (context.ref) u.searchParams.set('ref', context.ref)
  return u.href
}

export function subgraphUrl(template: string, ref: string): string {
  if (template.includes('{ref}')) return template.replace('{ref}', encodeURIComponent(ref))
  const u = new URL(template, document.baseURI)
  u.searchParams.set('ref', ref)
  return u.href
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const r = await fetch(url, { signal, credentials: 'same-origin', headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return r.json()
}

/**
 * FlowView (@dskripchenko/flow 1.0.1) takes the persisting function as the
 * prop `onToggle` and also emits `toggle`; Vue's emit calls the vnode's
 * `onToggle` too, so the function runs twice per switch — once from the
 * emit (its rejection reported as an unhandled error) and once awaited (its
 * rejection rolls the switch back). Both calls get the same change object,
 * synchronously one after the other: the second shares the first's request,
 * and the emit's copy stays quiet. With a single call (a fixed FlowView) the
 * request's own promise is returned, so a refusal still rolls back.
 */
export function dedupeToggle(persist: (change: unknown) => Promise<unknown>): (change: unknown) => Promise<unknown> {
  const inflight = new WeakMap<object, { promise: Promise<unknown>; duplicated: boolean }>()
  return (change) => {
    const key = change as object
    const known = inflight.get(key)
    if (known) {
      known.duplicated = true
      return known.promise
    }
    const entry = { promise: persist(change), duplicated: false }
    inflight.set(key, entry)
    return Promise.resolve().then(() => (entry.duplicated ? entry.promise.catch(() => undefined) : entry.promise))
  }
}

const VIEW_PASS = ['direction', 'edgeStyle', 'wheel', 'minimap', 'controls', 'details', 'statusBar', 'labels', 'registry'] as const

type FlowApi = {
  fit?: () => void
  select?: (id: string | string[] | null) => void
  enter?: (id: string) => Promise<void>
  back?: () => void
  refresh?: () => void
  undo?: () => void
  redo?: () => void
  stack?: unknown
}

interface Targets {
  openapiTarget?: unknown
  mediaTarget?: unknown
}

/**
 * Built-in cooperation: a node's `data.operation` opens that operation in the
 * `openapi-target` element; `data.chapter` (title or index) or `data.time`
 * (seconds) plays the `media-target` player there.
 */
export function followNode(node: { data?: Record<string, unknown> }, targets: Targets): void {
  const data = node.data ?? {}
  const pick = (selector: unknown): (HTMLElement & Record<string, any>) | null =>
    typeof selector === 'string' && selector !== '' ? (document.querySelector(selector) as (HTMLElement & Record<string, any>) | null) : null
  const api = pick(targets.openapiTarget)
  if (api && typeof data.operation === 'string' && data.operation !== '') {
    void Promise.resolve(api.go?.(data.operation)).catch((e: unknown) => console.warn('[dsk-embed] openapi-target:', errorText(e)))
  }
  const player = pick(targets.mediaTarget)
  if (player && (data.chapter !== undefined || data.time !== undefined)) {
    const run = data.chapter !== undefined ? player.playChapter?.(data.chapter) : Promise.resolve(player.seek?.(Number(data.time))).then(() => player.play?.())
    void Promise.resolve(run).catch((e: unknown) => console.warn('[dsk-embed] media-target:', errorText(e)))
  }
}

export function mountElement(ctx: ElementContext): ElementInstance {
  const comp = instanceRef<FlowApi>()
  const model = shallowRef<Graph | null>(null)
  const failure = shallowRef<string | null>(null)
  let input: HTMLInputElement | null = null
  let loadedFrom = ''

  function syncInput(): void {
    const name = ctx.props().name
    if (typeof name !== 'string' || name === '') return
    if (!input) {
      input = document.createElement('input')
      input.type = 'hidden'
      ctx.el.appendChild(input)
    }
    input.name = name
    input.value = model.value ? JSON.stringify(model.value) : ''
  }

  async function load(): Promise<void> {
    const props = ctx.props()
    const key = props.graph !== undefined ? 'object' : typeof props.src === 'string' && props.src !== '' ? `src:${props.src}` : `source:${ctx.source()}`
    if (key === loadedFrom && key !== 'object') return
    loadedFrom = key
    try {
      const graph =
        props.graph !== undefined
          ? await toGraph(props.graph)
          : typeof props.src === 'string' && props.src !== ''
            ? await toGraph(await fetchText(props.src))
            : await toGraph(ctx.source())
      model.value = graph
      failure.value = null
      syncInput()
      ctx.emit('load', { nodes: graph.nodes.length, edges: graph.edges.length })
    } catch (error) {
      failure.value = errorText(error)
      ctx.emit('error', { message: failure.value })
    }
  }

  const v = mountElementView(ctx, (view) => {
    const props = view.props
    if (failure.value) return h('div', { class: 'dsk-error', role: 'alert' }, failure.value)
    if (!model.value) return h('div', { class: 'dsk-flow-frame', style: { height: cssLength(props.height, '480px') } })
    const pass: Record<string, unknown> = {}
    for (const key of VIEW_PASS) if (props[key] !== undefined) pass[key] = props[key]
    // The page may size it per breakpoint: `dsk-flow { --dsk-flow-height: 520px }`.
    const height = `var(--dsk-flow-height, ${cssLength(props.height, props.editable ? '600px' : '480px')})`

    if (props.editable) {
      return h('div', { class: 'dsk-flow-frame', style: { height } }, [
        hc(FlowEditor, {
          ...pass,
          ref: comp.set,
          modelValue: model.value,
          locale: view.locale,
          readonly: props.readonly === true,
          ...(Array.isArray(props.palette) ? { palette: props.palette } : {}),
          mermaid: (source: string) => {
            // The editor's "import Mermaid" is synchronous: the module is preloaded on mount.
            if (!mermaidSync) throw new Error('Mermaid import is still loading; try again')
            return mermaidSync(source)
          },
          style: { height: '100%' },
          'onUpdate:modelValue': (graph: Graph) => {
            model.value = graph
            syncInput()
          },
          onChange: (event: { graph: Graph; description: string; source: string }) => {
            model.value = event.graph
            syncInput()
            ctx.emit('change', { graph: event.graph, description: event.description, source: event.source })
          },
          onSelect: (ids: string[]) => ctx.emit('select', { ids }),
          onValidate: (issues: unknown[]) => ctx.emit('validate', { issues }),
        }),
      ])
    }

    const pollUrlProp = typeof props.pollUrl === 'string' && props.pollUrl !== '' ? props.pollUrl : null
    const toggleUrl = typeof props.toggleUrl === 'string' && props.toggleUrl !== '' ? props.toggleUrl : null
    const customToggle = typeof props.onToggle === 'function' ? (props.onToggle as (c: unknown) => unknown) : null
    const subUrl = typeof props.subgraphUrl === 'string' && props.subgraphUrl !== '' ? props.subgraphUrl : null
    const customSub = typeof props.loadSubgraph === 'function' ? props.loadSubgraph : null

    return h('div', { class: 'dsk-flow-frame', style: { height } }, [
      hc(FlowView, {
        ...pass,
        ref: comp.set,
        graph: model.value,
        locale: view.locale,
        style: { height: '100%' },
        ...(props.state !== undefined ? { state: props.state } : {}),
        ...(pollUrlProp
          ? {
              poll: {
                intervalMs: typeof props.pollInterval === 'number' ? props.pollInterval : 5000,
                fetch: (signal: AbortSignal, context: { path?: string[]; ref?: string }) => getJson(pollUrl(pollUrlProp, context), signal),
              },
            }
          : {}),
        ...(toggleUrl || customToggle
          ? {
              toggleable: true,
              onToggle: dedupeToggle(async (change: unknown) => {
                ctx.emit('toggle', change)
                if (customToggle) return customToggle(change)
                const r = await fetch(toggleUrl!, {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                  body: JSON.stringify(change),
                })
                if (!r.ok) throw new Error(`${r.status} ${r.statusText}`.trim())
                return r
              }),
            }
          : {}),
        ...(customSub
          ? { loadSubgraph: customSub }
          : subUrl
            ? { loadSubgraph: (ref: string) => getJson(subgraphUrl(subUrl, ref)).then((g) => toGraph(g)) }
            : {}),
        onSelect: (sel: { kind: string; id: string; element: { data?: Record<string, unknown> }; path: string[] } | null) => {
          ctx.emit('select', sel ? { kind: sel.kind, id: sel.id, path: sel.path, element: sel.element } : null)
          if (sel?.kind === 'node') {
            ctx.emit('node', { id: sel.id, path: sel.path, node: sel.element, data: sel.element.data ?? {} })
            followNode(sel.element, { openapiTarget: props.openapiTarget, mediaTarget: props.mediaTarget })
          }
        },
        onNavigate: (stack: { nodeId: string }[]) => ctx.emit('navigate', { path: stack.map((l) => l.nodeId).filter(Boolean) }),
        'onToggle-error': (change: unknown, error: unknown) => ctx.emit('toggle-error', { change, message: errorText(error) }),
        'onPoll-error': (error: unknown) => ctx.emit('poll-error', { message: errorText(error) }),
      }),
    ])
  })

  let mermaidSync: MermaidModule['fromMermaid'] | null = null
  if (ctx.props().editable) void loadMermaid().then((m) => (mermaidSync = m.fromMermaid), () => undefined)
  void load()

  const call = <K extends keyof FlowApi>(name: K) => (...args: unknown[]) => {
    const fn = comp.ref.value?.[name]
    if (typeof fn !== 'function') throw new Error(`${String(name)}() is not available here`)
    return (fn as (...a: unknown[]) => unknown)(...args)
  }

  return {
    update() {
      v.refresh()
      void load()
      if (ctx.props().editable && !mermaidSync) void loadMermaid().then((m) => (mermaidSync = m.fromMermaid), () => undefined)
    },
    destroy() {
      v.unmount()
      input?.remove()
    },
    api: {
      fit: call('fit'),
      select: call('select'),
      enter: call('enter'),
      back: call('back'),
      refresh: call('refresh'),
      undo: call('undo'),
      redo: call('redo'),
      get stack() {
        return comp.ref.value?.stack
      },
      get graph() {
        return model.value
      },
    },
  }
}

export const renderers: Record<string, BlockRenderer> = {
  async flow(code) {
    let graph: Graph
    try {
      graph = await toGraph(code)
    } catch (error) {
      return { error: errorText(error) }
    }
    return {
      mount(el) {
        el.classList.add('dsk-flow-frame')
        el.style.height = '420px'
        const view = shallowReactive({ graph })
        const mounted = mountView(el, () => state.locale, () =>
          hc(FlowView, {
            graph: view.graph,
            locale: state.locale,
            minimap: false,
            statusBar: false,
            style: { height: '100%' },
            onSelect: (sel: { kind: string; id: string; element: { data?: Record<string, unknown> }; path: string[] } | null) => {
              if (sel?.kind === 'node') {
                el.dispatchEvent(new CustomEvent('dsk:node', { bubbles: true, composed: true, detail: { id: sel.id, path: sel.path, node: sel.element, data: sel.element.data ?? {} } }))
              }
            },
          }),
        )
        return {
          update(next) {
            toGraph(next).then((g) => (view.graph = g), () => undefined)
          },
          destroy: () => mounted.unmount(),
        }
      },
    }
  },
}
