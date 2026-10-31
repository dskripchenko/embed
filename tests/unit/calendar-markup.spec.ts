import { describe, expect, it } from 'vitest'
import { addEvent, detachOccurrence, expand, occurrences, parseCalendar, parseEventLine, parseRRule, removeEvent, ruleText, updateEvent, type Rule } from '../../src/plugins/calendar/markup'

const SOURCE = `# Платформа: релизы и дежурства
timezone: Europe/Moscow
view: month
tags: release=danger

2026-11-03 10:00-11:00 Демо релиза 3.0 #release {where: Переговорная 4}
2026-11-10..2026-11-14 Код-фриз #release
every mon 11:00-11:30 Планирование спринта {from: 2026-11-02, until: 2026-12-28, except: 2026-11-30}
every 2 weeks fri 16:00-17:00 Ретро {from: 2026-11-06}
every month 1 Закрытие периода #finance
every month last fri Релиз в прод #release
every year 12-31 Новогодняя заморозка
`

const rule = (line: string): Rule => {
  const item = parseEventLine(line)
  if (typeof item === 'string' || !item.rule) throw new Error(String(item))
  return item.rule
}

describe('calendar markup', () => {
  it('reads settings and events', () => {
    const doc = parseCalendar(SOURCE)
    expect(doc.title).toBe('Платформа: релизы и дежурства')
    expect(doc.settings.get('view')).toBe('month')
    expect(doc.tagTones).toEqual({ release: 'danger' })
    expect(doc.problems).toEqual([])
    expect(doc.items).toHaveLength(7)
    const [demo, freeze, planning] = doc.items
    expect([demo.date, demo.time, demo.endTime, demo.title, demo.tags, demo.props.get('where')]).toEqual(['2026-11-03', '10:00', '11:00', 'Демо релиза 3.0', ['release'], 'Переговорная 4'])
    expect([freeze.date, freeze.endDate, freeze.time]).toEqual(['2026-11-10', '2026-11-14', null])
    expect(planning.rule).toMatchObject({ freq: 'weekly', byDay: [{ day: 0 }], from: '2026-11-02', until: '2026-12-28', except: ['2026-11-30'] })
  })

  it('reports lines that are not events', () => {
    const doc = parseCalendar('2026-13 x\nevery fortnight x\n2026-11-03 25:00 Late\n2026-11-03\n2026-11-05..2026-11-01 Back\nevery day Daily {count: 3}')
    expect(doc.problems.map((p) => p.line)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('weekly with an exception and an end', () => {
    expect(occurrences(rule('every mon x {from: 2026-11-02, until: 2026-12-14, except: 2026-11-30}'), '2026-11-01', '2026-12-31'))
      .toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-12-07', '2026-12-14'])
  })

  it('every other week, several days', () => {
    expect(occurrences(rule('every 2 weeks tue,thu x {from: 2026-11-03}'), '2026-11-01', '2026-11-30'))
      .toEqual(['2026-11-03', '2026-11-05', '2026-11-17', '2026-11-19'])
  })

  it('daily with a count', () => {
    expect(occurrences(rule('every 3 days x {from: 2026-11-01, count: 4}'), '2026-11-01', '2026-12-31')).toEqual(['2026-11-01', '2026-11-04', '2026-11-07', '2026-11-10'])
    expect(occurrences(rule('every day x {from: 2026-11-01, count: 4}'), '2026-11-03', '2026-11-30')).toEqual(['2026-11-03', '2026-11-04'])
  })

  it('monthly: a day, the last day, the n-th and the last weekday', () => {
    expect(occurrences(rule('every month 31 x {from: 2026-01-01}'), '2026-01-01', '2026-05-31')).toEqual(['2026-01-31', '2026-03-31', '2026-05-31'])
    expect(occurrences(rule('every month last x {from: 2026-01-01}'), '2026-01-01', '2026-03-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
    expect(occurrences(rule('every month 2nd tue x'), '2026-11-01', '2026-12-31')).toEqual(['2026-11-10', '2026-12-08'])
    expect(occurrences(rule('every month last fri x'), '2026-11-01', '2026-12-31')).toEqual(['2026-11-27', '2026-12-25'])
  })

  it('yearly, and a far range is quick', () => {
    expect(occurrences(rule('every year 02-29 x {from: 2024-01-01}'), '2024-01-01', '2032-12-31')).toEqual(['2024-02-29', '2028-02-29', '2032-02-29'])
    expect(occurrences(rule('every day x'), '2099-12-30', '2099-12-31')).toEqual(['2099-12-30', '2099-12-31'])
  })

  it('RRULE as is', () => {
    expect(parseRRule('FREQ=MONTHLY;BYDAY=-1FR;COUNT=2')).toMatchObject({ freq: 'monthly', byDay: [{ day: 4, nth: -1 }], count: 2 })
    expect(occurrences(rule('2026-11-02 10:00 x {rrule: FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261118}'), '2026-11-01', '2026-12-31'))
      .toEqual(['2026-11-02', '2026-11-04', '2026-11-16', '2026-11-18'])
  })

  it('expands what a view shows, multi-day events by overlap', () => {
    const shown = expand(parseCalendar(SOURCE), '2026-11-09', '2026-11-15')
    expect(shown.map((o) => `${o.date} ${o.item.title}`)).toEqual(['2026-11-10 Код-фриз', '2026-11-09 Планирование спринта'])
    expect(shown[1].id).toBe('ev-2@2026-11-09')
  })

  it('writes a repeat back in words', () => {
    for (const line of ['every day', 'every 3 days', 'every mon,wed', 'every 2 weeks fri', 'every month 15', 'every month last', 'every month 2nd tue', 'every month last fri', 'every year 12-31']) {
      expect(ruleText(rule(`${line} x`))).toBe(line)
    }
  })

  it('adds, changes, removes, and detaches one occurrence', () => {
    let out = addEvent(SOURCE, { title: 'Новое', date: '2026-11-20', time: '09:00', endTime: '09:30', tags: ['team'] })
    expect(out.endsWith('2026-11-20 09:00-09:30 Новое #team\n')).toBe(true)
    out = updateEvent(out, 'ev-0', { title: 'Демо 3.0', date: '2026-11-04', time: '12:00', endTime: '13:00', tags: ['release'], props: new Map([['where', 'Зал']]) })
    expect(out).toContain('\n2026-11-04 12:00-13:00 Демо 3.0 #release {where: Зал}\n2026-11-10..2026-11-14')
    out = removeEvent(out, 'ev-1')
    expect(out).not.toContain('Код-фриз')
    out = detachOccurrence(out, 'ev-1', '2026-11-16', { title: 'Планирование спринта', date: '2026-11-17', time: '11:00', endTime: '11:30' })
    expect(out).toContain('every mon 11:00-11:30 Планирование спринта {from: 2026-11-02, until: 2026-12-28, except: 2026-11-16, 2026-11-30}\n2026-11-17 11:00-11:30 Планирование спринта\n')
    expect(out).toContain('# Платформа: релизы и дежурства\ntimezone: Europe/Moscow')
  })
})
