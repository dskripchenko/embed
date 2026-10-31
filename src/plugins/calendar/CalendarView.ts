/**
 * The calendar widget: the markup's events (repeats expanded for the shown
 * days) in the kit's UidCalendar — day, week, month, year, agenda. A click on
 * an event shows it; when editable and not locked, events are dragged and
 * resized, a click on an empty slot or "+ Event" opens the event builder, and
 * the source has a tab of its own. Each edit rewrites one line (two when one
 * occurrence of a repeat is moved: the series skips that date and a single
 * event takes its place) and is reported as `change` with the new source.
 */
import { computed, defineComponent, h, reactive, ref, watch, type PropType, type VNodeChild } from 'vue'
import { UidCalendar, UidDrawer, UidMarkdown, UidTag } from '@dskripchenko/ui'
import { hc } from '../runtime'
import { addEvent, detachOccurrence, expand, parseCalendar, removeEvent, ruleText, updateEvent, type CalendarItem, type Occurrence } from './markup'
import { draftOf, fieldsOf, newDraft, renderBuilder, type Draft } from './builder'
import { calendarText } from './text'

type View = 'day' | 'week' | 'month' | 'year' | 'agenda'
const VIEWS: View[] = ['day', 'week', 'month', 'year', 'agenda']
const TONES = ['info', 'success', 'warning', 'danger'] as const
const TONE_COLOR: Record<string, string> = {
  info: 'var(--uid-info, #2563eb)',
  success: 'var(--uid-success, #16a34a)',
  warning: 'var(--uid-warning, #d97706)',
  danger: 'var(--uid-danger, #dc2626)',
}

interface KitEvent {
  id: string
  date: string
  endDate?: string
  time?: string
  endTime?: string
  title: string
  color?: string
}

function hash(s: string): number {
  let n = 0
  for (const ch of s) n = (n * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(n)
}

const svg = (paths: string[]): VNodeChild =>
  h('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, paths.map((d) => h('path', { d })))
const ICON_LOCK = ['M7 11V7a5 5 0 0 1 10 0v4', 'M5 11h14v10H5z']
const ICON_UNLOCK = ['M7 11V7a5 5 0 0 1 9.9-1', 'M5 11h14v10H5z']

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const CalendarView = defineComponent({
  name: 'DskCalendar',
  props: {
    source: { type: String, default: '' },
    editable: { type: Boolean, default: false },
    locked: { type: Boolean, default: false },
    lockable: { type: Boolean, default: false },
    locale: { type: String as PropType<'ru' | 'en'>, default: 'en' },
    view: { type: String as PropType<View | ''>, default: '' },
    date: { type: String, default: '' },
    views: { type: Array as PropType<View[]>, default: () => VIEWS },
  },
  emits: ['change', 'lock', 'open', 'range'],
  setup(props, { emit }) {
    const text = ref(props.source)
    let emitted = props.source
    watch(() => props.source, (next) => {
      if (next !== emitted) {
        text.value = next
        emitted = next
      }
    })
    const t = computed(() => calendarText(props.locale))
    const doc = computed(() => parseCalendar(text.value))
    const canEdit = computed(() => props.editable && !props.locked)
    const settingView = (doc.value.settings.get('view') ?? '') as View
    const view = ref<View>(props.view || (VIEWS.includes(settingView) ? settingView : 'month'))
    watch(() => props.view, (v) => v && (view.value = v))
    const anchor = ref<string>(props.date || doc.value.settings.get('date') || today())
    const range = ref<{ start: string; end: string } | null>(null)
    const tab = ref<'calendar' | 'source'>('calendar')
    const open = ref(false)
    const draft = ref<Draft | null>(null)
    const viewing = ref<Occurrence | null>(null)

    function commit(next: string): void {
      if (next === text.value) return
      text.value = next
      emitted = next
      emit('change', next)
    }

    const toneOf = (tag: string): string => TONE_COLOR[doc.value.tagTones[tag] ?? ''] ?? doc.value.tagTones[tag] ?? TONE_COLOR[TONES[hash(tag) % TONES.length]]
    const occurrences = computed(() => (range.value ? expand(doc.value, range.value.start, range.value.end) : []))
    const byId = computed(() => new Map(occurrences.value.map((o) => [o.id, o])))
    const events = computed<KitEvent[]>(() =>
      occurrences.value.map((o) => ({
        id: o.id,
        date: o.date,
        ...(o.endDate ? { endDate: o.endDate } : {}),
        ...(o.time ? { time: o.time } : {}),
        ...(o.endTime ? { endTime: o.endTime } : {}),
        title: o.item.title,
        ...(o.item.tags.length ? { color: toneOf(o.item.tags[0]) } : {}),
      })),
    )

    function onRange(r: { start: string; end: string }): void {
      range.value = { start: r.start, end: r.end }
      emit('range', r)
    }

    function openOccurrence(id: string): void {
      const o = byId.value.get(id)
      if (!o) return
      viewing.value = o
      emit('open', { id: o.item.id, date: o.date, title: o.item.title })
      draft.value = canEdit.value ? reactive(draftOf(o.item, o.date)) : null
      if (draft.value && o.item.rule) draft.value.scope = 'one'
      open.value = true
    }

    function newEvent(date: string, time?: string): void {
      viewing.value = null
      draft.value = reactive(newDraft(date, time))
      open.value = true
    }

    function onMove(m: { event: KitEvent; date: string; endDate?: string; time?: string; endTime?: string }): void {
      if (!canEdit.value) return
      const o = byId.value.get(m.event.id)
      if (!o) return
      const item = o.item
      const moved = {
        title: item.title,
        tags: item.tags,
        props: item.props,
        date: m.date,
        endDate: m.endDate ?? null,
        time: m.time ?? item.time,
        endTime: m.endTime ?? item.endTime,
      }
      if (item.rule) {
        const props = new Map(item.props)
        for (const k of ['from', 'until', 'count', 'except', 'rrule']) props.delete(k)
        commit(detachOccurrence(text.value, item.id, o.date, { ...moved, props }))
      } else {
        commit(updateEvent(text.value, item.id, { ...moved, rule: null }))
      }
    }

    function save(): void {
      const d = draft.value
      if (!d || d.title.trim() === '') return
      if (d.itemId === null) commit(addEvent(text.value, fieldsOf(d)))
      else if (d.occurrence !== null && d.scope === 'one') commit(detachOccurrence(text.value, d.itemId, viewing.value?.date ?? d.occurrence, fieldsOf(d, true)))
      else commit(updateEvent(text.value, d.itemId, fieldsOf(d)))
      open.value = false
    }

    function remove(): void {
      const d = draft.value
      if (!d || d.itemId === null) return
      commit(removeEvent(text.value, d.itemId))
      open.value = false
    }

    function skip(): void {
      const d = draft.value
      const o = viewing.value
      if (!d || d.itemId === null || !o?.item.rule) return
      const item = parseCalendar(text.value).items.find((i) => i.id === d.itemId) as CalendarItem
      const rule = { ...item.rule!, except: [...new Set([...item.rule!.except, o.date])].sort() }
      commit(updateEvent(text.value, d.itemId, { title: item.title, date: item.date, time: item.time, endTime: item.endTime, tags: item.tags, props: item.props, rule }))
      open.value = false
    }

    let typing: ReturnType<typeof setTimeout> | undefined
    function onSource(next: string): void {
      text.value = next
      clearTimeout(typing)
      typing = setTimeout(() => {
        emitted = text.value
        emit('change', text.value)
      }, 300)
    }

    function details(o: Occurrence): VNodeChild {
      const item = o.item
      const when = `${o.date}${o.endDate ? ` – ${o.endDate}` : ''}${o.time ? `, ${o.time}${o.endTime ? `–${o.endTime}` : ''}` : `, ${t.value.allDay.toLowerCase()}`}`
      const rows: [string, string][] = [[t.value.date, when]]
      if (item.rule) rows.push([t.value.repeats, ruleText(item.rule) + (item.rule.until ? ` → ${item.rule.until}` : '') + (item.rule.count !== null ? ` × ${item.rule.count}` : '')])
      for (const [k, v] of item.props) if (!['from', 'until', 'count', 'except', 'rrule', 'description'].includes(k)) rows.push([k === 'where' ? t.value.where : k, v || '✓'])
      const description = item.props.get('description')
      return h('div', { class: 'dsk-cal__details' }, [
        item.tags.length ? h('div', { class: 'dsk-cal__tags' }, item.tags.map((tag) => hc(UidTag, { size: 'sm' }, () => tag))) : null,
        h('dl', { class: 'dsk-cal__props' }, rows.flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
        description ? hc(UidMarkdown, { source: description }) : null,
      ])
    }

    function drawer(): VNodeChild {
      const d = draft.value
      const o = viewing.value
      const title = d ? (d.itemId === null ? t.value.newEvent : t.value.event) : (o?.item.title ?? '')
      const body = d
        ? renderBuilder(d, t.value, { save, remove, skip, cancel: () => (open.value = false) })
        : o
          ? details(o)
          : null
      return hc(UidDrawer, { modelValue: open.value, 'onUpdate:modelValue': (x: boolean) => (open.value = x), title, width: '480px' }, () => body)
    }

    function toolbar(): VNodeChild {
      const right: VNodeChild[] = []
      if (canEdit.value) {
        right.push(h('button', { type: 'button', class: 'dsk-cal__btn', onClick: () => newEvent(anchor.value) }, `+ ${t.value.addEvent}`))
        right.push(h('div', { class: 'dsk-cal__tabs', role: 'group' }, (['calendar', 'source'] as const).map((k) =>
          h('button', { type: 'button', class: ['dsk-cal__tab', { 'dsk-cal__tab--on': tab.value === k }], 'aria-pressed': tab.value === k, onClick: () => (tab.value = k) }, t.value[k]))))
      }
      if (props.lockable) {
        right.push(h('button', {
          type: 'button',
          class: ['dsk-cal__lock', { 'dsk-cal__lock--on': props.locked }],
          title: props.locked ? t.value.unlock : t.value.lock,
          'aria-label': props.locked ? t.value.unlock : t.value.lock,
          'aria-pressed': props.locked,
          onClick: () => emit('lock', !props.locked),
        }, [svg(props.locked ? ICON_LOCK : ICON_UNLOCK)]))
      }
      if (!doc.value.title && right.length === 0) return null
      return h('div', { class: 'dsk-cal__bar' }, [
        doc.value.title ? h('div', { class: 'dsk-cal__title' }, doc.value.title) : null,
        h('div', { class: 'dsk-cal__actions' }, right),
      ])
    }

    function sourceView(): VNodeChild {
      return h('div', { class: 'dsk-cal__source' }, [
        h('textarea', { class: 'dsk-cal__code', value: text.value, spellcheck: false, 'aria-label': t.value.source, onInput: (e: Event) => onSource((e.target as HTMLTextAreaElement).value) }),
        doc.value.problems.length
          ? h('ul', { class: 'dsk-cal__problems', role: 'status' }, doc.value.problems.map((p) => h('li', null, `${t.value.line} ${p.line}: ${p.message}`)))
          : null,
      ])
    }

    return () =>
      h('div', { class: ['dsk-cal', { 'dsk-cal--editable': canEdit.value, 'dsk-cal--locked': props.locked }] }, [
        toolbar(),
        tab.value === 'source' && canEdit.value
          ? sourceView()
          : hc(UidCalendar, {
              events: events.value,
              views: props.views,
              view: view.value,
              'onUpdate:view': (v: View) => (view.value = v),
              anchor: anchor.value,
              'onUpdate:anchor': (v: string) => (anchor.value = v),
              editable: canEdit.value,
              onRange,
              'onEvent-click': (e: KitEvent) => openOccurrence(e.id),
              'onEvent-move': onMove,
              'onSlot-click': (s: { date: string; time?: string }) => newEvent(s.date, s.time),
              'onDate-click': (date: string) => {
                if (canEdit.value && view.value === 'month') newEvent(date)
              },
            }),
        drawer(),
      ])
  },
})
