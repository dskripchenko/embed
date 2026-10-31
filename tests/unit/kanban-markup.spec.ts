import { describe, expect, it } from 'vitest'
import { addCard, addColumn, moveCard, parseKanban, removeCard, updateCard } from '../../src/plugins/kanban/markup'
import { parseProps, serializeProps } from '../../src/plugins/markupProps'

const SOURCE = `# Релиз 3.0
lanes: Платежи, Возвраты
tags: payments=info, refunds=warning

<!-- черновик плана -->
## Бэклог
- Подключить СБП #payments {lane: Платежи, who: Анна, due: 2026-11-15}
- Частичный возврат #refunds !high {lane: Возвраты}
  Мерчанты просят возвращать часть суммы.

  Ссылка: [ACME-412](https://jira.example.com/browse/ACME-412)

## В работе {wip: 3}
- [ACME-398](https://jira.example.com/browse/ACME-398) Антифрод v2 {who: Олег}

## Готово {done}
- Вебхуки с подписью #payments
`

describe('kanban markup', () => {
  it('reads the board, its columns and cards', () => {
    const doc = parseKanban(SOURCE)
    expect(doc.title).toBe('Релиз 3.0')
    expect(doc.lanes).toEqual(['Платежи', 'Возвраты'])
    expect(doc.tagTones).toEqual({ payments: 'info', refunds: 'warning' })
    expect(doc.problems).toEqual([])
    expect(doc.columns.map((c) => [c.title, c.wip, c.done, c.cards.length])).toEqual([
      ['Бэклог', null, false, 2],
      ['В работе', 3, false, 1],
      ['Готово', null, true, 1],
    ])
    const [sbp, refund] = doc.columns[0].cards
    expect(sbp.title).toBe('Подключить СБП')
    expect(sbp.tags).toEqual(['payments'])
    expect([...sbp.props]).toEqual([['lane', 'Платежи'], ['who', 'Анна'], ['due', '2026-11-15']])
    expect(refund.priority).toBe('high')
    expect(refund.description).toBe('Мерчанты просят возвращать часть суммы.\nСсылка: [ACME-412](https://jira.example.com/browse/ACME-412)')
    expect(doc.columns[1].cards[0].title).toBe('[ACME-398](https://jira.example.com/browse/ACME-398) Антифрод v2')
  })

  it('reports lines that are not part of the markup', () => {
    const doc = parseKanban('- orphan\n## A\nnot a card\n- ok')
    expect(doc.problems.map((p) => p.line)).toEqual([1, 3])
    expect(doc.columns[0].cards.map((c) => c.title)).toEqual(['ok'])
  })

  it('moves a card with its description, touching nothing else', () => {
    const out = moveCard(SOURCE, 'card-1', 'col-2', null)
    const doc = parseKanban(out)
    expect(doc.columns[0].cards.map((c) => c.title)).toEqual(['Подключить СБП'])
    expect(doc.columns[2].cards.map((c) => c.title)).toEqual(['Вебхуки с подписью', 'Частичный возврат'])
    expect(doc.columns[2].cards[1].description).toContain('ACME-412')
    expect(out).toContain('<!-- черновик плана -->')
    const rest = (text: string): string[] => text.split('\n').filter((l) => l.trim() !== '' && !/Частичный|Мерчанты|ACME-412/.test(l))
    expect(rest(out)).toEqual(rest(SOURCE))
  })

  it('moves a card before another one and into another lane', () => {
    const out = moveCard(SOURCE, 'card-3', 'col-0', 'card-0', 'Возвраты')
    const doc = parseKanban(out)
    expect(doc.columns[0].cards.map((c) => c.title)).toEqual(['Вебхуки с подписью', 'Подключить СБП', 'Частичный возврат'])
    expect(doc.columns[0].cards[0].props.get('lane')).toBe('Возвраты')
    expect(doc.columns[2].cards).toEqual([])
  })

  it('moving a card within its column keeps the text otherwise intact', () => {
    const out = moveCard(SOURCE, 'card-1', 'col-0', 'card-0')
    expect(parseKanban(out).columns[0].cards.map((c) => c.title)).toEqual(['Частичный возврат', 'Подключить СБП'])
    expect(moveCard(out, 'card-0', 'col-0', null)).toBe(SOURCE)
  })

  it('adds, changes and removes cards', () => {
    let out = addCard(SOURCE, 'col-1', { title: 'Новая', tags: ['payments'], props: new Map([['who', 'Ира']]) })
    expect(out).toContain('{who: Олег}\n- Новая #payments {who: Ира}\n')
    out = updateCard(out, 'card-0', { title: 'Подключить СБП и QR', tags: ['payments'], priority: 'low', props: new Map([['who', 'Анна']]), description: 'Две строки\nописания' })
    expect(out).toContain('- Подключить СБП и QR #payments !low {who: Анна}\n  Две строки\n  описания\n- Частичный')
    out = removeCard(out, 'card-1')
    expect(out).not.toContain('Частичный')
    expect(out).not.toContain('Мерчанты')
  })

  it('adds a column at the end', () => {
    expect(addColumn('## A\n- x\n', 'B')).toBe('## A\n- x\n\n## B\n')
    expect(addColumn('', 'A')).toBe('## A\n')
  })
})

describe('markup props', () => {
  it('reads values, flags and lists', () => {
    expect([...parseProps('wip: 3, done')]).toEqual([['wip', '3'], ['done', '']])
    expect([...parseProps('from: 2026-11-02, except: 2026-11-30, 2026-12-07, until: 2026-12-28')]).toEqual([
      ['from', '2026-11-02'], ['except', '2026-11-30, 2026-12-07'], ['until', '2026-12-28'],
    ])
    expect(serializeProps(parseProps('a: 1, b, c: x, y'))).toBe('{a: 1, b, c: x, y}')
  })
})
