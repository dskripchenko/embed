/**
 * The calendar markup (docs/internal/adr-001-kanban-calendar.md): settings,
 * then one event per line —
 *
 *   2026-11-03 10:00-11:00 Release demo #release {where: Room 4}
 *   2026-11-10..2026-11-14 Code freeze #release
 *   every mon 11:00-11:30 Sprint planning {from: 2026-11-02, until: 2026-12-28, except: 2026-11-30}
 *   every 2 weeks fri 16:00 Retro {from: 2026-11-06}
 *   every month last fri Release
 *   every year 12-31 New year freeze
 *
 * A repeat is a subset of RFC 5545 RRULE in words (or `{rrule: FREQ=…}`),
 * expanded only over the days that are shown.
 */
import { parseProps, serializeProps, type Props } from '../markupProps'
import { splitProps } from '../kanban/markup'

export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface ByDay {
  /** 0 = Monday … 6 = Sunday. */
  day: number
  /** The n-th weekday of the month (1…4, -1 = last); undefined — every such weekday. */
  nth?: number
}

export interface Rule {
  freq: Freq
  interval: number
  byDay: ByDay[]
  /** Days of the month (-1 = the last day). */
  byMonthDay: number[]
  /** Months 1…12. */
  byMonth: number[]
  from: string | null
  until: string | null
  count: number | null
  except: string[]
}

export interface CalendarItem {
  id: string
  line: number
  title: string
  tags: string[]
  props: Props
  date: string | null
  endDate: string | null
  time: string | null
  endTime: string | null
  rule: Rule | null
}

export interface CalendarProblem {
  line: number
  message: string
}

export interface CalendarDoc {
  title: string | null
  settings: Props
  tagTones: Record<string, string>
  items: CalendarItem[]
  problems: CalendarProblem[]
}

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const WEEKDAY_ALIASES: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
  пн: 0, вт: 1, ср: 2, чт: 3, пт: 4, сб: 5, вс: 6,
}
const ICAL_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
const ORDINALS: Record<string, number> = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, last: -1 }
const ORDINAL_WORDS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', [-1]: 'last' }

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/

function weekdays(word: string): number[] | null {
  const out: number[] = []
  for (const part of word.toLowerCase().split(',')) {
    const day = WEEKDAY_ALIASES[part.trim()]
    if (day === undefined) return null
    out.push(day)
  }
  return out
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function normTime(t: string): string {
  const [h, m] = t.split(':')
  return `${pad(Number(h))}:${m}`
}

function emptyRule(freq: Freq, interval = 1): Rule {
  return { freq, interval, byDay: [], byMonthDay: [], byMonth: [], from: null, until: null, count: null, except: [] }
}

/** `every …` words → a rule and the rest of the line; null when the words are not a repeat. */
function parseEvery(words: string[]): { rule: Rule; used: number } | null {
  let i = 1
  let interval = 1
  if (/^\d+$/.test(words[i] ?? '')) interval = Math.max(1, Number(words[i++]))
  const unit = (words[i] ?? '').toLowerCase()
  const wd = weekdays(unit)
  if (wd) {
    const rule = emptyRule('weekly', interval)
    rule.byDay = wd.map((day) => ({ day }))
    return { rule, used: i + 1 }
  }
  if (/^days?$/.test(unit)) return { rule: emptyRule('daily', interval), used: i + 1 }
  if (/^weeks?$/.test(unit)) {
    const rule = emptyRule('weekly', interval)
    const days = weekdays(words[i + 1] ?? '')
    if (days) {
      rule.byDay = days.map((day) => ({ day }))
      return { rule, used: i + 2 }
    }
    return { rule, used: i + 1 }
  }
  if (/^months?$/.test(unit)) {
    const rule = emptyRule('monthly', interval)
    const next = (words[i + 1] ?? '').toLowerCase()
    const ord = ORDINALS[next]
    const day = weekdays(words[i + 2] ?? '')
    if (ord !== undefined && day && day.length === 1) {
      rule.byDay = [{ day: day[0], nth: ord }]
      return { rule, used: i + 3 }
    }
    if (next === 'last') {
      rule.byMonthDay = [-1]
      return { rule, used: i + 2 }
    }
    if (/^\d{1,2}(,\d{1,2})*$/.test(next)) {
      rule.byMonthDay = next.split(',').map(Number).filter((d) => d >= 1 && d <= 31)
      return { rule, used: i + 2 }
    }
    return { rule, used: i + 1 }
  }
  if (/^years?$/.test(unit)) {
    const rule = emptyRule('yearly', interval)
    const md = /^(\d{2})-(\d{2})$/.exec(words[i + 1] ?? '')
    if (md) {
      rule.byMonth = [Number(md[1])]
      rule.byMonthDay = [Number(md[2])]
      return { rule, used: i + 2 }
    }
    return { rule, used: i + 1 }
  }
  return null
}

/** `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR;UNTIL=20261228` → a rule. */
export function parseRRule(text: string): Rule | null {
  const parts = Object.fromEntries(text.replace(/^RRULE:/i, '').split(';').map((p) => p.split('=').map((s) => s.trim().toUpperCase()) as [string, string]))
  const freq = ({ DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' } as Record<string, Freq>)[parts.FREQ ?? '']
  if (!freq) return null
  const rule = emptyRule(freq, Math.max(1, Number(parts.INTERVAL ?? 1) || 1))
  if (parts.BYDAY) {
    for (const d of parts.BYDAY.split(',')) {
      const m = /^([+-]?\d)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(d.trim())
      if (m) rule.byDay.push({ day: ICAL_DAYS.indexOf(m[2]), ...(m[1] ? { nth: Number(m[1]) } : {}) })
    }
  }
  if (parts.BYMONTHDAY) rule.byMonthDay = parts.BYMONTHDAY.split(',').map((x) => Number(x.trim())).filter((n) => n !== 0 && Math.abs(n) <= 31)
  if (parts.BYMONTH) rule.byMonth = parts.BYMONTH.split(',').map((x) => Number(x.trim())).filter((n) => n >= 1 && n <= 12)
  if (parts.COUNT) rule.count = Math.max(1, Number(parts.COUNT) || 1)
  if (parts.UNTIL) {
    const u = /^(\d{4})(\d{2})(\d{2})/.exec(parts.UNTIL)
    if (u) rule.until = `${u[1]}-${u[2]}-${u[3]}`
  }
  return rule
}

const TAG = /(^|\s)#([\p{L}\p{N}_-]+)/gu

export function parseCalendar(source: string): CalendarDoc {
  const lines = source.split(/\r?\n/)
  const doc: CalendarDoc = { title: null, settings: new Map(), tagTones: {}, items: [], problems: [] }
  let inComment = false
  let started = false
  for (let n = 0; n < lines.length; n++) {
    const trimmed = lines[n].trim()
    if (inComment) {
      if (trimmed.includes('-->')) inComment = false
      continue
    }
    if (trimmed.startsWith('<!--')) {
      if (!trimmed.includes('-->')) inComment = true
      continue
    }
    if (trimmed === '') continue
    const title = /^#\s+(.*)$/.exec(trimmed)
    if (title && !started && doc.title === null) {
      doc.title = title[1].trim()
      continue
    }
    const setting = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(trimmed)
    if (setting && !started) {
      doc.settings.set(setting[1], setting[2].trim())
      continue
    }
    const item = parseEventLine(trimmed, n, `ev-${doc.items.length}`)
    if (typeof item === 'string') {
      doc.problems.push({ line: n + 1, message: item })
      continue
    }
    started = true
    doc.items.push(item)
  }
  for (const pair of (doc.settings.get('tags') ?? '').split(',')) {
    const [tag, tone] = pair.split('=').map((s) => s.trim())
    if (tag && tone) doc.tagTones[tag] = tone
  }
  return doc
}

/** One event line → an item, or the reason it is not one. */
export function parseEventLine(text: string, line = 0, id = 'ev'): CalendarItem | string {
  const words = text.split(/\s+/)
  let used: number
  let date: string | null = null
  let endDate: string | null = null
  let rule: Rule | null = null
  if (words[0].toLowerCase() === 'every') {
    const every = parseEvery(words)
    if (!every) return 'Not a repeat: every day | mon,wed | 2 weeks fri | month 15 | month last fri | year 12-31'
    rule = every.rule
    used = every.used
  } else {
    const m = /^(\d{4}-\d{2}-\d{2})(?:\.\.(\d{4}-\d{2}-\d{2}))?$/.exec(words[0])
    if (!m) return 'An event starts with a date (2026-11-03), a range (2026-11-10..2026-11-14) or "every"'
    date = m[1]
    if (m[2]) {
      if (m[2] < m[1]) return 'The range ends before it starts'
      endDate = m[2]
    }
    used = 1
  }
  let time: string | null = null
  let endTime: string | null = null
  const tm = /^(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?$/.exec(words[used] ?? '')
  if (tm) {
    if (!TIME.test(tm[1]) || (tm[2] && !TIME.test(tm[2]))) return 'A time is HH:MM, 00:00…23:59'
    time = normTime(tm[1])
    endTime = tm[2] ? normTime(tm[2]) : null
    used++
  }
  const { text: rest, props } = splitProps(words.slice(used).join(' '))
  const tags: string[] = []
  const title = rest.replace(TAG, (_, sp: string, tag: string) => {
    tags.push(tag)
    return sp
  }).replace(/\s{2,}/g, ' ').trim()
  if (title === '') return 'An event needs a title'
  if (props.has('rrule')) {
    const r = parseRRule(props.get('rrule') ?? '')
    if (!r) return 'Not an RRULE: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY;…'
    rule = r
    if (date && !props.has('from')) rule.from = date
  }
  if (rule) {
    const from = props.get('from') ?? null
    const until = props.get('until') ?? null
    if (from && !DATE.test(from)) return '"from" is a date: 2026-11-02'
    if (until && !DATE.test(until)) return '"until" is a date: 2026-12-28'
    rule.from = from ?? rule.from
    rule.until = until ?? rule.until
    if (props.has('count')) rule.count = Math.max(1, Number(props.get('count')) || 1)
    rule.except = (props.get('except') ?? '').split(',').map((s) => s.trim()).filter((s) => DATE.test(s))
    if (rule.count !== null && !rule.from) return 'A repeat with "count" needs "from"'
  }
  return { id, line, title, tags, props, date, endDate, time, endTime, rule }
}

// ---- dates

function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function addDays(iso: string, n: number): string {
  const d = toDate(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return fromDate(d)
}

function weekday(iso: string): number {
  return (toDate(iso).getUTCDay() + 6) % 7
}

function daysIn(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function dayDiff(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000)
}

/** The days of one month a monthly or yearly rule picks. */
function monthDays(rule: Rule, y: number, m: number, fallbackDay: number): string[] {
  const last = daysIn(y, m)
  const out = new Set<number>()
  for (const d of rule.byMonthDay) {
    const day = d < 0 ? last + 1 + d : d
    if (day >= 1 && day <= last) out.add(day)
  }
  for (const b of rule.byDay) {
    const matches: number[] = []
    for (let d = 1; d <= last; d++) if (weekday(`${y}-${pad(m)}-${pad(d)}`) === b.day) matches.push(d)
    if (b.nth === undefined) matches.forEach((d) => out.add(d))
    else {
      const d = b.nth > 0 ? matches[b.nth - 1] : matches[matches.length + b.nth]
      if (d !== undefined) out.add(d)
    }
  }
  if (rule.byMonthDay.length === 0 && rule.byDay.length === 0 && fallbackDay <= last) out.add(fallbackDay)
  return [...out].sort((a, b) => a - b).map((d) => `${y}-${pad(m)}-${pad(d)}`)
}

const DEFAULT_FROM = '2000-01-03'

/** The dates a rule produces between `start` and `end` (inclusive). */
export function occurrences(rule: Rule, start: string, end: string, limit = 2000): string[] {
  const from = rule.from ?? DEFAULT_FROM
  const until = rule.until && rule.until < end ? rule.until : end
  const except = new Set(rule.except)
  const out: string[] = []
  let produced = 0
  const take = (iso: string): boolean => {
    if (iso < from) return true
    if (iso > until) return false
    produced++
    if (rule.count !== null && produced > rule.count) return false
    if (iso >= start && !except.has(iso)) out.push(iso)
    return out.length < limit
  }
  // Without a count the periods before `start` produce nothing to show: skip them.
  const skip = rule.count === null
  const [fy, fm, fd] = from.split('-').map(Number)
  if (rule.freq === 'daily') {
    let k = skip ? Math.max(0, Math.floor(dayDiff(from, start) / rule.interval)) : 0
    for (;; k++) if (!take(addDays(from, k * rule.interval))) break
  } else if (rule.freq === 'weekly') {
    const days = rule.byDay.length ? [...new Set(rule.byDay.map((b) => b.day))].sort() : [weekday(from)]
    const week0 = addDays(from, -weekday(from))
    let k = skip ? Math.max(0, Math.floor(dayDiff(week0, start) / 7 / rule.interval)) : 0
    outer: for (;; k++) {
      const week = addDays(week0, k * 7 * rule.interval)
      if (week > until) break
      for (const d of days) if (!take(addDays(week, d))) break outer
    }
  } else if (rule.freq === 'monthly') {
    const [sy, sm] = start.split('-').map(Number)
    let k = skip ? Math.max(0, Math.floor(((sy - fy) * 12 + (sm - fm)) / rule.interval)) : 0
    outer: for (;; k++) {
      const index = fm - 1 + k * rule.interval
      const y = fy + Math.floor(index / 12)
      const m = (index % 12) + 1
      if (`${y}-${pad(m)}-01` > until) break
      for (const iso of monthDays(rule, y, m, fd)) if (!take(iso)) break outer
    }
  } else {
    const sy = Number(start.slice(0, 4))
    let k = skip ? Math.max(0, Math.floor((sy - fy) / rule.interval)) : 0
    const months = rule.byMonth.length ? rule.byMonth : [fm]
    outer: for (;; k++) {
      const y = fy + k * rule.interval
      if (`${y}-01-01` > until) break
      for (const m of months) for (const iso of monthDays({ ...rule, byMonthDay: rule.byMonthDay.length ? rule.byMonthDay : rule.byDay.length ? [] : [fd] }, y, m, fd)) if (!take(iso)) break outer
    }
  }
  return out
}

export interface Occurrence {
  /** `<item id>` or `<item id>@<date>` for a repeat. */
  id: string
  item: CalendarItem
  date: string
  endDate?: string
  time?: string
  endTime?: string
}

/** Every event and repeat occurrence that touches the days `start`…`end`. */
export function expand(doc: CalendarDoc, start: string, end: string): Occurrence[] {
  const out: Occurrence[] = []
  for (const item of doc.items) {
    const timing = { ...(item.time ? { time: item.time } : {}), ...(item.endTime ? { endTime: item.endTime } : {}) }
    if (item.rule) {
      for (const date of occurrences(item.rule, start, end)) out.push({ id: `${item.id}@${date}`, item, date, ...timing })
      continue
    }
    const first = item.date!
    const last = item.endDate ?? first
    if (last < start || first > end) continue
    out.push({ id: item.id, item, date: first, ...(item.endDate ? { endDate: item.endDate } : {}), ...timing })
  }
  return out
}

// ---- writing

export function ruleText(rule: Rule): string {
  const n = rule.interval > 1 ? `${rule.interval} ` : ''
  const days = (list: ByDay[]): string => list.map((b) => WEEKDAYS[b.day]).join(',')
  switch (rule.freq) {
    case 'daily':
      return `every ${n}${rule.interval > 1 ? 'days' : 'day'}`
    case 'weekly':
      if (rule.interval === 1 && rule.byDay.length) return `every ${days(rule.byDay)}`
      return `every ${n}${rule.interval > 1 ? 'weeks' : 'week'}${rule.byDay.length ? ` ${days(rule.byDay)}` : ''}`
    case 'monthly': {
      const unit = `every ${n}${rule.interval > 1 ? 'months' : 'month'}`
      if (rule.byDay.length === 1 && rule.byDay[0].nth !== undefined) return `${unit} ${ORDINAL_WORDS[rule.byDay[0].nth]} ${WEEKDAYS[rule.byDay[0].day]}`
      if (rule.byMonthDay.length === 1 && rule.byMonthDay[0] === -1) return `${unit} last`
      return rule.byMonthDay.length ? `${unit} ${rule.byMonthDay.join(',')}` : unit
    }
    case 'yearly': {
      const unit = `every ${n}${rule.interval > 1 ? 'years' : 'year'}`
      return rule.byMonth.length === 1 && rule.byMonthDay.length === 1 ? `${unit} ${pad(rule.byMonth[0])}-${pad(rule.byMonthDay[0])}` : unit
    }
  }
}

export interface EventFields {
  title: string
  date?: string | null
  endDate?: string | null
  time?: string | null
  endTime?: string | null
  tags?: string[]
  props?: Props
  rule?: Rule | null
}

export function serializeEvent(e: EventFields): string {
  const props = new Map(e.props ?? [])
  for (const k of ['from', 'until', 'count', 'except', 'rrule']) props.delete(k)
  let head: string
  if (e.rule) {
    head = ruleText(e.rule)
    if (e.rule.from) props.set('from', e.rule.from)
    if (e.rule.until) props.set('until', e.rule.until)
    if (e.rule.count !== null) props.set('count', String(e.rule.count))
    if (e.rule.except.length) props.set('except', e.rule.except.join(', '))
  } else {
    head = e.date && e.endDate && e.endDate > e.date ? `${e.date}..${e.endDate}` : (e.date ?? '')
  }
  if (e.time) head += ` ${e.time}${e.endTime ? `-${e.endTime}` : ''}`
  let line = `${head} ${e.title.trim()}`
  for (const tag of e.tags ?? []) line += ` #${tag}`
  const tail = serializeProps(props)
  return tail ? `${line} ${tail}` : line
}

function replaceLine(source: string, line: number, text: string | null): string {
  const lines = source.split(/\r?\n/)
  if (text === null) lines.splice(line, 1)
  else lines[line] = text
  return lines.join('\n')
}

function find(source: string, id: string): CalendarItem {
  const item = parseCalendar(source).items.find((i) => i.id === id)
  if (!item) throw new Error(`No event ${id}`)
  return item
}

export function addEvent(source: string, e: EventFields): string {
  const trimmed = source.replace(/\s+$/, '')
  return `${trimmed}${trimmed ? '\n' : ''}${serializeEvent(e)}\n`
}

export function updateEvent(source: string, id: string, e: EventFields): string {
  return replaceLine(source, find(source, id).line, serializeEvent(e))
}

export function removeEvent(source: string, id: string): string {
  return replaceLine(source, find(source, id).line, null)
}

/**
 * One occurrence of a repeat changed (moved, or edited "this one only"): the
 * series skips that date and a single event takes its place.
 */
export function detachOccurrence(source: string, id: string, date: string, single: EventFields): string {
  const item = find(source, id)
  if (!item.rule) throw new Error(`${id} is not a repeat`)
  const rule = { ...item.rule, except: [...new Set([...item.rule.except, date])].sort() }
  const lines = source.split(/\r?\n/)
  lines[item.line] = serializeEvent({ ...item, rule })
  lines.splice(item.line + 1, 0, serializeEvent({ ...single, rule: null }))
  return lines.join('\n')
}

export { parseProps }
