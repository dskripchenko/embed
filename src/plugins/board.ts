/**
 * `<dsk-board>` and ```board blocks, through @dskripchenko/board: an
 * infinite whiteboard (shapes, sticky notes, frames, connectors, emoji, pen
 * and marker) — a read-only view, an editor (`editable`), or a shared board
 * edited by several people at once (`board-url`).
 *
 * Sources, first that is set: the `board` property (an object), `board-url`
 * (the server: collaboration), `src` (GET → the board JSON), the element's
 * text (JSON).
 *
 * `board-url` is the base of the HTTP contract of @dskripchenko/board:
 * `GET {base}/snapshot`, `POST {base}/batches`, `GET {base}/batches?after=N`
 * (long polling), `POST {base}/presence`.
 */
import { h, shallowRef } from 'vue'
import { boardToSvg, httpProvider, parseBoard, type Board, type BoardProvider } from '@dskripchenko/board'
import { BoardEditor } from '@dskripchenko/board/vue'
import { cssLength } from '../core/attrs'
import type { BlockRenderer, ElementContext, ElementInstance, Host } from '../core/types'
import { errorText, fetchText, instanceRef, mountElementView, mountView, runtimeHost, setupRuntime, state, hc } from './runtime'
import { withFullscreen } from './fullscreen'
import { printable } from './print'

export function setup(host: Host): void {
  setupRuntime(host)
}

type BoardApi = {
  fit?: () => void
  select?: (ids: string[]) => void
  toPng?: (scale?: number) => Promise<Blob>
  toSvg?: () => { svg: string; width: number; height: number }
  doc?: { undo(): void; redo(): void }
}

function emptyBoard(): Board {
  return { version: 1, objects: {} }
}

export function mountElement(ctx: ElementContext): ElementInstance {
  const comp = instanceRef<BoardApi>()
  const model = shallowRef<Board | null>(null)
  const failure = shallowRef<string | null>(null)
  let provider: BoardProvider | null = null
  let providerBase = ''
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

  /** The shared board: one provider per `board-url`, replaced when it changes. */
  function providerFor(base: string, interval: unknown): BoardProvider {
    // poll-interval: plain polling every N ms instead of long polling (for
    // servers that cannot hold a request open).
    const every = typeof interval === 'number' && interval > 0 ? Math.max(250, interval) : 0
    const key = `${base}|${every}`
    if (provider && providerBase === key) return provider
    provider?.close?.()
    provider = httpProvider(every ? { base, wait: 0, interval: every } : { base })
    providerBase = key
    return provider
  }

  async function load(): Promise<void> {
    const props = ctx.props()
    if (typeof props.boardUrl === 'string' && props.boardUrl !== '') {
      failure.value = null
      return
    }
    const key = props.board !== undefined ? 'object' : typeof props.src === 'string' && props.src !== '' ? `src:${props.src}` : `source:${ctx.source()}`
    if (key === loadedFrom && key !== 'object') return
    loadedFrom = key
    try {
      const raw = props.board !== undefined ? props.board : typeof props.src === 'string' && props.src !== '' ? await fetchText(props.src) : ctx.source().trim() || emptyBoard()
      model.value = parseBoard(raw)
      failure.value = null
      syncInput()
      ctx.emit('load', { objects: Object.keys(model.value.objects).length })
    } catch (error) {
      failure.value = errorText(error)
      ctx.emit('error', { message: failure.value })
    }
  }

  const v = mountElementView(ctx, (view) => {
    const props = view.props
    if (failure.value) return h('div', { class: 'dsk-error', role: 'alert' }, failure.value)
    const shared = typeof props.boardUrl === 'string' && props.boardUrl !== ''
    // The page may size it per breakpoint: `dsk-board { --dsk-board-height: 520px }`.
    const height = `var(--dsk-board-height, ${cssLength(props.height, '560px')})`
    if (!shared && !model.value) return h('div', { class: 'dsk-board-frame', style: { height } })
    const user = typeof props.userName === 'string' && props.userName !== '' ? { id: typeof props.userId === 'string' ? props.userId : undefined, name: props.userName, color: typeof props.userColor === 'string' ? props.userColor : undefined } : null
    return h('div', { class: 'dsk-board-frame', style: { height } }, [
      hc(BoardEditor, {
        ref: comp.set,
        locale: view.locale,
        readonly: shared ? props.readonly === true : props.editable !== true,
        minimap: props.minimap !== false,
        ...(props.labels && typeof props.labels === 'object' ? { labels: props.labels } : {}),
        ...(shared
          ? { provider: props.provider && typeof props.provider === 'object' ? props.provider : providerFor(props.boardUrl as string, props.pollInterval), user }
          : { modelValue: model.value }),
        style: { height: '100%' },
        'onUpdate:modelValue': (board: Board) => {
          model.value = board
          syncInput()
        },
        onChange: (event: { board: Board; ops: unknown[]; origin: string }) => ctx.emit('change', { board: event.board, ops: event.ops, origin: event.origin }),
        onSelection: (ids: string[]) => ctx.emit('select', { ids }),
      }),
    ])
  })

  void load()

  const call = <K extends keyof BoardApi>(name: K) => (...args: unknown[]) => {
    const fn = comp.ref.value?.[name]
    if (typeof fn !== 'function') throw new Error(`${String(name)}() is not available here`)
    return (fn as (...a: unknown[]) => unknown)(...args)
  }

  const fs = withFullscreen(ctx, () => comp.ref.value?.fit?.())
  // On paper the whole board as one picture: what the editor exports, else the board as loaded.
  const unprint = printable(ctx.host, ctx.container, () => comp.ref.value?.toSvg?.().svg ?? (model.value ? boardToSvg(model.value).svg : null))
  return {
    update() {
      v.refresh()
      void load()
    },
    destroy() {
      unprint()
      fs?.destroy()
      v.unmount()
      provider?.close?.()
      input?.remove()
    },
    api: {
      fit: call('fit'),
      enterFullscreen: () => fs?.enter(),
      exitFullscreen: () => fs?.exit(),
      get fullscreen() {
        return fs?.active ?? false
      },
      select: call('select'),
      toPng: call('toPng'),
      toSvg: call('toSvg'),
      undo: () => comp.ref.value?.doc?.undo(),
      redo: () => comp.ref.value?.doc?.redo(),
      get value() {
        return model.value
      },
    },
  }
}

export const renderers: Record<string, BlockRenderer> = {
  async board(code) {
    let board: Board
    try {
      board = parseBoard(code.trim() || emptyBoard())
    } catch (error) {
      return { error: errorText(error) }
    }
    return {
      mount(el) {
        el.classList.add('dsk-board-frame')
        el.style.height = '420px'
        const current = shallowRef(board)
        const mounted = mountView(el, () => hc(BoardEditor, { modelValue: current.value, readonly: true, minimap: false, locale: state.locale, style: { height: '100%' } }))
        const unprint = printable(runtimeHost(), el, () => boardToSvg(current.value).svg)
        return {
          update(next) {
            try {
              current.value = parseBoard(next)
            } catch {
              // Keep the last good board while the source is being typed.
            }
          },
          destroy: () => {
            unprint()
            mounted.unmount()
          },
        }
      },
    }
  },
}
