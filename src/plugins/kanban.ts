/**
 * `<dsk-kanban>` and ```kanban blocks: a board of columns and cards written
 * as markup (see kanban/markup.ts) and drawn with the kit's UidBoard.
 *
 * `editable` — moves, new cards, card edits and the markup's source; each
 * edit is `dsk:change` with `{ source }`. `locked` makes it read-only for
 * everyone; `lockable` shows the lock, which asks for a change through
 * `dsk:lock` with `{ locked }` (the host keeps it, as it keeps the source).
 * `src` — GET → the markup. `name` — a hidden input carries the markup, for a
 * form.
 */
import { shallowRef } from 'vue'
import type { BlockRenderer, ElementContext, ElementInstance, Host } from '../core/types'
import { errorText, fetchText, hc, mountElementView, mountView, setupRuntime, state } from './runtime'
import { KanbanView } from './kanban/KanbanView'
import { parseKanban } from './kanban/markup'
import kanbanCss from '../kanban.css?inline'
import { injectStyle } from '../core/styles'

export function setup(host: Host): void {
  setupRuntime(host)
}

export function mountElement(ctx: ElementContext): ElementInstance {
  injectStyle('kanban', kanbanCss, ctx.el.ownerDocument)
  const source = shallowRef('')
  const failure = shallowRef<string | null>(null)
  const locked = shallowRef<boolean | null>(null)
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
    input.value = source.value
  }

  async function load(): Promise<void> {
    const props = ctx.props()
    const key = typeof props.src === 'string' && props.src !== '' ? `src:${props.src}` : `source:${ctx.source()}`
    if (key === loadedFrom) return
    loadedFrom = key
    try {
      source.value = typeof props.src === 'string' && props.src !== '' ? await fetchText(props.src) : ctx.source()
      failure.value = null
      syncInput()
      const problems = parseKanban(source.value).problems
      ctx.emit('load', { problems })
    } catch (error) {
      failure.value = errorText(error)
      ctx.emit('error', { message: failure.value })
    }
  }

  const v = mountElementView(ctx, (view) => {
    const props = view.props
    if (failure.value) return hc('div', { class: 'dsk-error', role: 'alert' }, failure.value)
    return hc(KanbanView, {
      source: source.value,
      editable: props.editable === true,
      locked: locked.value ?? props.locked === true,
      lockable: props.lockable === true,
      locale: view.locale,
      onChange: (next: string) => {
        source.value = next
        syncInput()
        ctx.emit('change', { source: next })
      },
      onLock: (next: boolean) => {
        locked.value = next
        ctx.emit('lock', { locked: next })
      },
      onOpen: (card: unknown) => ctx.emit('open', { card }),
    })
  })

  void load()

  return {
    update() {
      locked.value = null
      v.refresh()
      void load()
    },
    destroy() {
      v.unmount()
      input?.remove()
    },
    api: {
      get value() {
        return source.value
      },
      get board() {
        return parseKanban(source.value)
      },
    },
  }
}

export const renderers: Record<string, BlockRenderer> = {
  kanban(code) {
    if (parseKanban(code).columns.length === 0) return { error: 'No columns: a column starts with "## "' }
    return {
      mount(el) {
        injectStyle('kanban', kanbanCss, el.ownerDocument)
        const view = shallowRef(code)
        const mounted = mountView(el, () => hc(KanbanView, { source: view.value, locale: state.locale }))
        return {
          update(next) {
            view.value = next
          },
          destroy: () => mounted.unmount(),
        }
      },
    }
  },
}
