/**
 * `<dsk-calendar>` and ```calendar blocks: events written as markup (see
 * calendar/markup.ts) — dates, ranges, times and repeats — in the kit's
 * UidCalendar: day, week, month, year and agenda.
 *
 * `editable` — drag, resize, the event builder and the markup's source; each
 * edit is `dsk:change` with `{ source }`. `locked` / `lockable` / `dsk:lock`
 * as in `<dsk-kanban>`. `view` and `date` — what is shown first (else the
 * markup's `view:` and today); `views` — the views offered. `src` — GET → the
 * markup. `name` — a hidden input carries the markup, for a form.
 */
import { shallowRef } from 'vue'
import type { BlockRenderer, ElementContext, ElementInstance, Host } from '../core/types'
import { errorText, fetchText, hc, mountElementView, mountView, setupRuntime, state } from './runtime'
import { CalendarView } from './calendar/CalendarView'
import { parseCalendar } from './calendar/markup'
import calendarCss from '../calendar.css?inline'
import { injectStyle } from '../core/styles'

export function setup(host: Host): void {
  setupRuntime(host)
}

const VIEWS = ['day', 'week', 'month', 'year', 'agenda']

export function mountElement(ctx: ElementContext): ElementInstance {
  injectStyle('calendar', calendarCss, ctx.el.ownerDocument)
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
      ctx.emit('load', { problems: parseCalendar(source.value).problems })
    } catch (error) {
      failure.value = errorText(error)
      ctx.emit('error', { message: failure.value })
    }
  }

  const v = mountElementView(ctx, (view) => {
    const props = view.props
    if (failure.value) return hc('div', { class: 'dsk-error', role: 'alert' }, failure.value)
    const views = Array.isArray(props.views) ? (props.views as string[]).filter((x) => VIEWS.includes(x)) : []
    return hc(CalendarView, {
      source: source.value,
      editable: props.editable === true,
      locked: locked.value ?? props.locked === true,
      lockable: props.lockable === true,
      locale: view.locale,
      view: typeof props.view === 'string' ? props.view : '',
      date: typeof props.date === 'string' ? props.date : '',
      ...(views.length ? { views } : {}),
      onChange: (next: string) => {
        source.value = next
        syncInput()
        ctx.emit('change', { source: next })
      },
      onLock: (next: boolean) => {
        locked.value = next
        ctx.emit('lock', { locked: next })
      },
      onOpen: (event: unknown) => ctx.emit('open', { event }),
      onRange: (range: unknown) => ctx.emit('range', range as Record<string, unknown>),
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
    },
  }
}

export const renderers: Record<string, BlockRenderer> = {
  calendar(code) {
    const doc = parseCalendar(code)
    if (doc.items.length === 0 && doc.problems.length > 0) return { error: `Line ${doc.problems[0].line}: ${doc.problems[0].message}` }
    return {
      mount(el) {
        injectStyle('calendar', calendarCss, el.ownerDocument)
        const view = shallowRef(code)
        const mounted = mountView(el, () => hc(CalendarView, { source: view.value, locale: state.locale }))
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
