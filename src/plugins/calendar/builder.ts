/**
 * The event builder: a form for one event — date or range, all day or a
 * time, and a repeat put together from choices ("every 2 weeks on Mon, Wed",
 * "the last Friday of every month", "until a date / N times") — that writes
 * the markup line. Editing one occurrence of a repeat asks whether it is that
 * occurrence or the whole series.
 */
import { h, type VNodeChild } from 'vue'
import { UidButton, UidDatePicker, UidInput, UidNumberInput, UidSelect, UidSwitch, UidTagsInput, UidTextarea, UidTimePicker } from '@dskripchenko/ui'
import { hc } from '../runtime'
import { parseProps } from '../markupProps'
import { serializeEvent, type CalendarItem, type EventFields, type Freq, type Rule } from './markup'
import type { CalendarText } from './text'

export interface Draft {
  itemId: string | null
  /** The occurrence of a repeat that was opened. */
  occurrence: string | null
  scope: 'one' | 'all'
  title: string
  allDay: boolean
  date: string
  endDate: string | null
  time: string
  endTime: string
  freq: 'none' | Freq
  interval: number
  byDay: number[]
  monthMode: 'day' | 'nth' | 'last'
  monthDay: number
  nth: number
  nthDay: number
  ends: 'never' | 'until' | 'count'
  until: string | null
  count: number
  except: string[]
  tags: string[]
  where: string
  extra: string
}

const KNOWN = new Set(['where', 'from', 'until', 'count', 'except', 'rrule'])

function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

function plusHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function newDraft(date: string, time?: string): Draft {
  return {
    itemId: null,
    occurrence: null,
    scope: 'all',
    title: '',
    allDay: !time,
    date,
    endDate: null,
    time: time ?? '10:00',
    endTime: time ? plusHour(time) : '11:00',
    freq: 'none',
    interval: 1,
    byDay: [weekdayOf(date)],
    monthMode: 'day',
    monthDay: Number(date.slice(8, 10)),
    nth: Math.min(4, Math.ceil(Number(date.slice(8, 10)) / 7)),
    nthDay: weekdayOf(date),
    ends: 'never',
    until: null,
    count: 10,
    except: [],
    tags: [],
    where: '',
    extra: '',
  }
}

export function draftOf(item: CalendarItem, occurrence: string | null): Draft {
  const start = item.rule ? (item.rule.from ?? occurrence ?? item.date ?? '') : (item.date ?? '')
  const d = newDraft(start || occurrence || '', item.time ?? undefined)
  d.itemId = item.id
  d.occurrence = item.rule ? occurrence : null
  d.title = item.title
  d.allDay = !item.time
  d.endTime = item.endTime ?? (item.time ? plusHour(item.time) : d.endTime)
  d.endDate = item.endDate
  d.tags = [...item.tags]
  d.where = item.props.get('where') ?? ''
  d.extra = [...item.props].filter(([k]) => !KNOWN.has(k)).map(([k, v]) => (v === '' ? k : `${k}: ${v}`)).join('\n')
  const r = item.rule
  if (r) {
    d.freq = r.freq
    d.interval = r.interval
    if (r.byDay.length && r.freq === 'weekly') d.byDay = r.byDay.map((b) => b.day)
    if (r.freq === 'monthly') {
      if (r.byDay.length === 1 && r.byDay[0].nth !== undefined) {
        d.monthMode = 'nth'
        d.nth = r.byDay[0].nth
        d.nthDay = r.byDay[0].day
      } else if (r.byMonthDay[0] === -1) d.monthMode = 'last'
      else if (r.byMonthDay.length) d.monthDay = r.byMonthDay[0]
    }
    if (r.freq === 'yearly' && r.byMonth.length && r.byMonthDay.length) {
      const y = (start || '2000').slice(0, 4)
      d.date = `${y}-${String(r.byMonth[0]).padStart(2, '0')}-${String(r.byMonthDay[0]).padStart(2, '0')}`
    }
    d.ends = r.until ? 'until' : r.count !== null ? 'count' : 'never'
    d.until = r.until
    d.count = r.count ?? 10
    d.except = [...r.except]
  }
  return d
}

export function ruleOf(d: Draft): Rule | null {
  if (d.freq === 'none') return null
  const rule: Rule = { freq: d.freq, interval: Math.max(1, d.interval || 1), byDay: [], byMonthDay: [], byMonth: [], from: d.date || null, until: null, count: null, except: [...d.except] }
  if (d.freq === 'weekly') rule.byDay = [...new Set(d.byDay.length ? d.byDay : [weekdayOf(d.date)])].sort().map((day) => ({ day }))
  if (d.freq === 'monthly') {
    if (d.monthMode === 'nth') rule.byDay = [{ day: d.nthDay, nth: d.nth }]
    else rule.byMonthDay = [d.monthMode === 'last' ? -1 : d.monthDay]
  }
  if (d.freq === 'yearly' && d.date) {
    rule.byMonth = [Number(d.date.slice(5, 7))]
    rule.byMonthDay = [Number(d.date.slice(8, 10))]
  }
  if (d.ends === 'until' && d.until) rule.until = d.until
  if (d.ends === 'count') rule.count = Math.max(1, d.count || 1)
  return rule
}

export function fieldsOf(d: Draft, single = false): EventFields {
  const props = new Map<string, string>()
  if (d.where.trim()) props.set('where', d.where.trim())
  for (const line of d.extra.split('\n')) for (const [k, v] of parseProps(line)) props.set(k, v)
  const timed = !d.allDay && d.time
  return {
    title: d.title,
    date: single && d.occurrence ? d.occurrence : d.date,
    endDate: !single && d.freq === 'none' && d.endDate && d.endDate > d.date ? d.endDate : null,
    time: timed ? d.time : null,
    endTime: timed && d.endTime && d.endTime > d.time ? d.endTime : null,
    tags: d.tags.map((t) => t.replace(/^#/, '').trim()).filter(Boolean),
    props,
    rule: single ? null : ruleOf(d),
  }
}

export interface BuilderActions {
  save(): void
  cancel(): void
  remove(): void
  skip(): void
}

export function renderBuilder(d: Draft, t: CalendarText, act: BuilderActions): VNodeChild {
  const field = (label: string, control: VNodeChild, cls = ''): VNodeChild => h('label', { class: ['dsk-cal__field', cls] }, [h('span', { class: 'dsk-cal__label' }, label), control])
  const series = d.itemId !== null && d.occurrence !== null
  const editsSeries = !series || d.scope === 'all'
  const select = <T extends string | number>(value: T, options: { value: T; label: string }[], set: (v: T) => void): VNodeChild =>
    hc(UidSelect, { options, modelValue: value, 'onUpdate:modelValue': set })
  const rows: VNodeChild[] = []
  if (series) {
    rows.push(field(t.scope, select(d.scope, [{ value: 'one', label: `${t.scopeOne} (${d.occurrence})` }, { value: 'all', label: t.scopeAll }], (v) => (d.scope = v))))
  }
  rows.push(field(t.title, hc(UidInput, { modelValue: d.title, required: true, 'onUpdate:modelValue': (v: string) => (d.title = v) })))
  rows.push(h('div', { class: 'dsk-cal__row' }, [
    field(series && d.scope === 'one' ? t.date : d.freq === 'none' ? t.date : t.start, hc(UidDatePicker, {
      modelValue: series && d.scope === 'one' ? d.occurrence : d.date,
      'onUpdate:modelValue': (v: string | null) => {
        if (!v) return
        if (series && d.scope === 'one') d.occurrence = v
        else d.date = v
      },
    })),
    d.freq === 'none' && editsSeries ? field(t.endDate, hc(UidDatePicker, { modelValue: d.endDate, clearable: true, 'onUpdate:modelValue': (v: string | null) => (d.endDate = v) })) : null,
  ]))
  rows.push(hc(UidSwitch, { label: t.allDay, modelValue: d.allDay, 'onUpdate:modelValue': (v: boolean) => (d.allDay = v) }))
  if (!d.allDay) {
    rows.push(h('div', { class: 'dsk-cal__row' }, [
      field(t.start, hc(UidTimePicker, { modelValue: d.time, step: 15, 'onUpdate:modelValue': (v: string | null) => v && (d.time = v) })),
      field(t.end, hc(UidTimePicker, { modelValue: d.endTime, step: 15, 'onUpdate:modelValue': (v: string | null) => v && (d.endTime = v) })),
    ]))
  }
  if (editsSeries) {
    const freqs: ('none' | Freq)[] = ['none', 'daily', 'weekly', 'monthly', 'yearly']
    rows.push(h('fieldset', { class: 'dsk-cal__repeat' }, [
      h('legend', { class: 'dsk-cal__label' }, t.repeat),
      h('div', { class: 'dsk-cal__row' }, [
        select(d.freq, freqs.map((f) => ({ value: f, label: t.freq[f] })), (v) => (d.freq = v)),
        d.freq !== 'none'
          ? h('div', { class: 'dsk-cal__interval' }, [
              h('span', null, t.every),
              hc(UidNumberInput, { modelValue: d.interval, min: 1, max: 99, 'onUpdate:modelValue': (v: number | null) => (d.interval = v ?? 1) }),
              h('span', null, t.units[d.freq]),
            ])
          : null,
      ]),
      d.freq === 'weekly'
        ? h('div', { class: 'dsk-cal__days', role: 'group', 'aria-label': t.onDays }, t.weekdays.map((name, i) =>
            h('button', {
              type: 'button',
              class: ['dsk-cal__day', { 'dsk-cal__day--on': d.byDay.includes(i) }],
              'aria-pressed': d.byDay.includes(i),
              onClick: () => (d.byDay = d.byDay.includes(i) ? d.byDay.filter((x) => x !== i) : [...d.byDay, i]),
            }, name)))
        : null,
      d.freq === 'monthly'
        ? h('div', { class: 'dsk-cal__row' }, [
            select(d.monthMode, (['day', 'nth', 'last'] as const).map((m) => ({ value: m, label: t.monthMode[m] })), (v) => (d.monthMode = v)),
            d.monthMode === 'day' ? hc(UidNumberInput, { modelValue: d.monthDay, min: 1, max: 31, 'onUpdate:modelValue': (v: number | null) => (d.monthDay = v ?? 1) }) : null,
            d.monthMode === 'nth' ? select(d.nth, ([1, 2, 3, 4, -1] as const).map((n) => ({ value: n, label: t.ordinals[String(n) as '1'] })), (v) => (d.nth = v)) : null,
            d.monthMode === 'nth' ? select(d.nthDay, t.weekdays.map((name, i) => ({ value: i, label: name })), (v) => (d.nthDay = v)) : null,
          ])
        : null,
      d.freq !== 'none'
        ? h('div', { class: 'dsk-cal__row' }, [
            field(t.ends, select(d.ends, (['never', 'until', 'count'] as const).map((m) => ({ value: m, label: t.endsMode[m] })), (v) => (d.ends = v))),
            d.ends === 'until' ? field(t.endDate, hc(UidDatePicker, { modelValue: d.until, 'onUpdate:modelValue': (v: string | null) => (d.until = v) })) : null,
            d.ends === 'count' ? field(t.times, hc(UidNumberInput, { modelValue: d.count, min: 1, max: 999, 'onUpdate:modelValue': (v: number | null) => (d.count = v ?? 1) })) : null,
          ])
        : null,
      d.freq !== 'none' && d.except.length
        ? h('div', { class: 'dsk-cal__skipped' }, [
            h('span', { class: 'dsk-cal__label' }, t.skipped),
            ...d.except.map((date) => h('button', { type: 'button', class: 'dsk-cal__chip', title: t.delete, onClick: () => (d.except = d.except.filter((x) => x !== date)) }, `${date} ×`)),
          ])
        : null,
    ]))
  }
  rows.push(field(t.tags, hc(UidTagsInput, { modelValue: d.tags, 'onUpdate:modelValue': (v: string[]) => (d.tags = v) })))
  rows.push(field(t.where, hc(UidInput, { modelValue: d.where, 'onUpdate:modelValue': (v: string) => (d.where = v) })))
  rows.push(field(t.extra, hc(UidTextarea, { modelValue: d.extra, rows: 2, autoGrow: true, placeholder: 'key: value', 'onUpdate:modelValue': (v: string) => (d.extra = v) })))
  if (d.title.trim()) {
    const single = series && d.scope === 'one'
    rows.push(h('div', { class: 'dsk-cal__line' }, [h('span', { class: 'dsk-cal__label' }, t.line), h('code', null, serializeEvent(fieldsOf(d, single)))]))
  }
  rows.push(h('div', { class: 'dsk-cal__buttons' }, [
    hc(UidButton, { type: 'submit', variant: 'primary' }, () => t.save),
    hc(UidButton, { variant: 'ghost', onClick: act.cancel }, () => t.cancel),
    series ? hc(UidButton, { variant: 'secondary', onClick: act.skip }, () => t.skip) : null,
    d.itemId !== null ? hc(UidButton, { variant: 'danger', class: 'dsk-cal__delete', onClick: act.remove }, () => t.delete) : null,
  ]))
  return h('form', { class: 'dsk-cal__form', onSubmit: (e: Event) => { e.preventDefault(); act.save() } }, rows)
}
