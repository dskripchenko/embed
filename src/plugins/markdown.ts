/**
 * `<dsk-markdown>`: markdown through the kit's UidMarkdown, with every
 * registered block renderer — ```mermaid, ```openapi, ```flow, ```video,
 * ```audio and the host's own — live.
 */
import { h, shallowRef } from 'vue'
import { UidMarkdown } from '@dskripchenko/ui'
import type { ElementContext, ElementInstance, Host } from '../core/types'
import { errorText, fetchText, mountElementView, setupRuntime, state, hc } from './runtime'

export function setup(host: Host): void {
  setupRuntime(host)
}

export function mountElement(ctx: ElementContext): ElementInstance {
  const fetched = shallowRef<string | null>(null)
  const failure = shallowRef<string | null>(null)
  let src = ''

  async function load(): Promise<void> {
    const url = ctx.props().src
    if (typeof url !== 'string' || url === '' || url === src) return
    src = url
    try {
      fetched.value = await fetchText(url)
      failure.value = null
    } catch (error) {
      failure.value = errorText(error)
      ctx.emit('error', { message: failure.value })
    }
  }

  const v = mountElementView(ctx, (view) => {
    if (failure.value) return h('div', { class: 'dsk-error', role: 'alert' }, failure.value)
    const p = view.props
    const source = typeof p.src === 'string' && p.src !== '' ? (fetched.value ?? '') : view.source
    return hc(UidMarkdown, {
      class: 'dsk-markdown',
      source,
      blockRenderers: state.renderers,
      ...(p.toc !== undefined ? { toc: p.toc } : {}),
      ...(p.tocDepth !== undefined ? { tocDepth: p.tocDepth } : {}),
      ...(p.linkBase !== undefined ? { linkBase: p.linkBase } : {}),
      ...(p.imageBase !== undefined ? { imageBase: p.imageBase } : {}),
    })
  })
  void load()

  return {
    update() {
      v.refresh()
      void load()
    },
    destroy: () => v.unmount(),
    api: {
      get value() {
        return typeof ctx.props().src === 'string' ? (fetched.value ?? '') : ctx.source()
      },
    },
  }
}
