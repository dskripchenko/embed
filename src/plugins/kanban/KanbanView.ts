/**
 * The kanban widget: the markup drawn as a UidBoard, with a filter by tag and
 * person, a panel for a card, and — when editable and not locked — moves,
 * new cards, card edits and the markup's source. Every edit rewrites only the
 * lines it touches (see markup.ts) and is reported as `change` with the new
 * source.
 */
import { computed, defineComponent, h, ref, watch, type PropType, type VNodeChild } from 'vue'
import { UidBoard, UidButton, UidDatePicker, UidDrawer, UidInput, UidMarkdown, UidSelect, UidTag, UidTagsInput, UidTextarea } from '@dskripchenko/ui'
import { hc } from '../runtime'
import { parseProps } from '../markupProps'
import { addCard, moveCard, parseKanban, removeCard, updateCard, type KanbanCard, type KanbanColumn, type Priority } from './markup'
import { kanbanText, type KanbanText } from './text'

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'default'
const TONES: Tone[] = ['info', 'success', 'warning', 'danger']

interface BoardMoveLike {
  card: { key: string | number }
  to: string | number
  beforeKey: string | number | null
  lane: string | number | null
}

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A card title's inline markdown: links, code, bold, italics. */
export function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, url: string) => {
      const safe = /^(https?:|mailto:|\/|#)/i.test(url) ? url : '#'
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
}

function hash(s: string): number {
  let n = 0
  for (const ch of s) n = (n * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(n)
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

const svg = (paths: string[]): VNodeChild =>
  h('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, paths.map((d) => h('path', { d })))
const ICON_LOCK = ['M7 11V7a5 5 0 0 1 10 0v4', 'M5 11h14v10H5z']
const ICON_UNLOCK = ['M7 11V7a5 5 0 0 1 9.9-1', 'M5 11h14v10H5z']
const ICON_PLUS = ['M12 5v14', 'M5 12h14']

interface Draft {
  id: string | null
  columnId: string
  title: string
  tags: string[]
  priority: '' | Priority
  who: string
  due: string | null
  lane: string
  extra: string
  description: string
}

const KNOWN = new Set(['lane', 'who', 'due'])

export const KanbanView = defineComponent({
  name: 'DskKanban',
  props: {
    source: { type: String, default: '' },
    editable: { type: Boolean, default: false },
    locked: { type: Boolean, default: false },
    lockable: { type: Boolean, default: false },
    locale: { type: String as PropType<'ru' | 'en'>, default: 'en' },
    today: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  },
  emits: ['change', 'lock', 'open'],
  setup(props, { emit }) {
    const text = ref(props.source)
    let emitted = props.source
    watch(() => props.source, (next) => {
      if (next !== emitted) {
        text.value = next
        emitted = next
      }
    })
    const t = computed<KanbanText>(() => kanbanText(props.locale))
    const doc = computed(() => parseKanban(text.value))
    const canEdit = computed(() => props.editable && !props.locked)
    const tab = ref<'board' | 'source'>('board')
    const tagFilter = ref<string | null>(null)
    const whoFilter = ref<string | null>(null)
    const open = ref(false)
    const draft = ref<Draft | null>(null)
    const viewing = ref<{ card: KanbanCard; column: KanbanColumn } | null>(null)

    function commit(next: string): void {
      if (next === text.value) return
      text.value = next
      emitted = next
      emit('change', next)
    }

    const allTags = computed(() => [...new Set(doc.value.columns.flatMap((c) => c.cards.flatMap((k) => k.tags)))])
    const people = computed(() => [...new Set(doc.value.columns.flatMap((c) => c.cards.map((k) => k.props.get('who') ?? '').filter(Boolean)))])
    const toneOf = (tag: string): Tone => (doc.value.tagTones[tag] as Tone | undefined) ?? TONES[hash(tag) % TONES.length]

    const visible = (card: KanbanCard): boolean =>
      (tagFilter.value === null || card.tags.includes(tagFilter.value)) && (whoFilter.value === null || card.props.get('who') === whoFilter.value)

    const cardById = computed(() => {
      const map = new Map<string, { card: KanbanCard; column: KanbanColumn }>()
      for (const column of doc.value.columns) for (const card of column.cards) map.set(card.id, { card, column })
      return map
    })

    const lanes = computed(() => doc.value.lanes.map((l) => ({ key: l, title: l })))
    const columns = computed(() =>
      doc.value.columns.map((column) => ({
        key: column.id,
        title: column.title,
        wip: column.wip,
        cards: column.cards.filter(visible).map((card) => ({
          key: card.id,
          title: card.title,
          ...(lanes.value.length > 0 ? { lane: card.props.get('lane') ?? doc.value.lanes[0] } : {}),
        })),
      })),
    )

    function onMove(move: BoardMoveLike): void {
      if (!canEdit.value) return
      const id = String(move.card.key)
      const current = cardById.value.get(id)?.card.props.get('lane') ?? (lanes.value.length > 0 ? doc.value.lanes[0] : null)
      const lane = lanes.value.length > 0 && move.lane !== null && String(move.lane) !== current ? String(move.lane) : undefined
      commit(moveCard(text.value, id, String(move.to), move.beforeKey === null ? null : String(move.beforeKey), lane))
    }

    function openCard(id: string): void {
      const found = cardById.value.get(id)
      if (!found) return
      viewing.value = found
      emit('open', { id, title: found.card.title, column: found.column.title })
      if (canEdit.value) {
        const { card, column } = found
        const extra = [...card.props].filter(([k]) => !KNOWN.has(k)).map(([k, v]) => (v === '' ? k : `${k}: ${v}`)).join('\n')
        draft.value = {
          id: card.id,
          columnId: column.id,
          title: card.title,
          tags: [...card.tags],
          priority: card.priority ?? '',
          who: card.props.get('who') ?? '',
          due: card.props.get('due') || null,
          lane: card.props.get('lane') ?? '',
          extra,
          description: card.description,
        }
      } else {
        draft.value = null
      }
      open.value = true
    }

    function newCard(columnId: string): void {
      viewing.value = null
      draft.value = { id: null, columnId, title: '', tags: [], priority: '', who: '', due: null, lane: doc.value.lanes[0] ?? '', extra: '', description: '' }
      open.value = true
    }

    function save(): void {
      const d = draft.value
      if (!d || d.title.trim() === '') return
      const props = new Map<string, string>()
      if (d.lane && lanes.value.length > 0) props.set('lane', d.lane)
      if (d.who.trim()) props.set('who', d.who.trim())
      if (d.due) props.set('due', d.due)
      for (const line of d.extra.split('\n')) for (const [k, v] of parseProps(line)) props.set(k, v)
      const fields = { title: d.title, tags: d.tags.map((x) => x.replace(/^#/, '').trim()).filter(Boolean), priority: d.priority || null, props, description: d.description }
      let next = d.id === null ? addCard(text.value, d.columnId, fields) : updateCard(text.value, d.id, fields)
      if (d.id !== null && cardById.value.get(d.id)?.column.id !== d.columnId) next = moveCard(next, d.id, d.columnId, null)
      commit(next)
      open.value = false
    }

    function remove(): void {
      const d = draft.value
      if (!d || d.id === null) return
      commit(removeCard(text.value, d.id))
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

    function cardContent(id: string, columnId: string): VNodeChild {
      const found = cardById.value.get(id)
      if (!found) return null
      const { card } = found
      const column = doc.value.columns.find((c) => c.id === columnId)
      const due = card.props.get('due')
      const overdue = !!due && due < props.today && !column?.done
      const who = card.props.get('who')
      const meta: VNodeChild[] = []
      if (card.priority) meta.push(h('span', { class: ['dsk-kanban__priority', `dsk-kanban__priority--${card.priority}`] }, t.value.priority[card.priority]))
      for (const tag of card.tags) meta.push(hc(UidTag, { size: 'sm', variant: toneOf(tag) }, () => tag))
      const foot: VNodeChild[] = []
      if (due) foot.push(h('span', { class: ['dsk-kanban__due', { 'dsk-kanban__due--overdue': overdue }], title: t.value.due }, due))
      if (who) foot.push(h('span', { class: 'dsk-kanban__who', title: who }, [h('span', { class: 'dsk-kanban__avatar', style: { '--dsk-kanban-avatar': `hsl(${hash(who) % 360} 55% 45%)` } }, initials(who)), h('span', null, who)]))
      return h('div', { class: ['dsk-kanban__card', { 'dsk-kanban__card--done': column?.done }] }, [
        h('div', {
          class: 'dsk-kanban__card-title',
          innerHTML: inlineMarkdown(card.title),
          onClick: (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('a')) e.stopPropagation()
          },
        }),
        meta.length ? h('div', { class: 'dsk-kanban__card-meta' }, meta) : null,
        foot.length ? h('div', { class: 'dsk-kanban__card-foot' }, foot) : null,
        card.description ? h('span', { class: 'dsk-kanban__has-desc', title: t.value.description }, '≡') : null,
      ])
    }

    function columnHeader(column: { key: string | number; title: string }, count: number, over: boolean): VNodeChild {
      const source = doc.value.columns.find((c) => c.id === column.key)
      return h('div', { class: ['dsk-kanban__column-head', { 'dsk-kanban__column-head--over': over }] }, [
        h('span', { class: 'dsk-kanban__column-title' }, column.title),
        h('span', { class: 'dsk-kanban__count' }, source?.wip ? `${count}/${source.wip}` : String(count)),
        canEdit.value
          ? h('button', { type: 'button', class: 'dsk-kanban__add', title: t.value.addCard, 'aria-label': `${t.value.addCard}: ${column.title}`, onClick: () => newCard(String(column.key)) }, [svg(ICON_PLUS)])
          : null,
      ])
    }

    function toolbar(): VNodeChild {
      const filters: VNodeChild[] = []
      if (allTags.value.length > 0) {
        filters.push(h('div', { class: 'dsk-kanban__tags', role: 'group', 'aria-label': t.value.filterTag }, allTags.value.map((tag) =>
          h('button', {
            type: 'button',
            class: ['dsk-kanban__filter', { 'dsk-kanban__filter--on': tagFilter.value === tag }],
            'aria-pressed': tagFilter.value === tag,
            onClick: () => (tagFilter.value = tagFilter.value === tag ? null : tag),
          }, `#${tag}`))))
      }
      if (people.value.length > 0) {
        filters.push(h('div', { class: 'dsk-kanban__people' }, hc(UidSelect, {
          size: 'sm',
          clearable: true,
          placeholder: t.value.everyone,
          options: people.value.map((p) => ({ value: p, label: p })),
          modelValue: whoFilter.value,
          'onUpdate:modelValue': (v: string | null) => (whoFilter.value = v ?? null),
        })))
      }
      const right: VNodeChild[] = []
      if (canEdit.value) {
        right.push(h('div', { class: 'dsk-kanban__tabs', role: 'group' }, (['board', 'source'] as const).map((k) =>
          h('button', { type: 'button', class: ['dsk-kanban__tab', { 'dsk-kanban__tab--on': tab.value === k }], 'aria-pressed': tab.value === k, onClick: () => (tab.value = k) }, t.value[k]))))
      }
      if (props.lockable) {
        right.push(h('button', {
          type: 'button',
          class: ['dsk-kanban__lock', { 'dsk-kanban__lock--on': props.locked }],
          title: props.locked ? t.value.unlock : t.value.lock,
          'aria-label': props.locked ? t.value.unlock : t.value.lock,
          'aria-pressed': props.locked,
          onClick: () => emit('lock', !props.locked),
        }, [svg(props.locked ? ICON_LOCK : ICON_UNLOCK)]))
      }
      return h('div', { class: 'dsk-kanban__bar' }, [
        doc.value.title ? h('div', { class: 'dsk-kanban__title' }, doc.value.title) : null,
        h('div', { class: 'dsk-kanban__filters' }, filters),
        h('div', { class: 'dsk-kanban__actions' }, right),
      ])
    }

    function drawer(): VNodeChild {
      const d = draft.value
      const v = viewing.value
      const title = d ? (d.id === null ? t.value.newCard : t.value.editCard) : v?.card.title.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') ?? ''
      let body: VNodeChild
      if (d) {
        const field = (label: string, control: VNodeChild): VNodeChild => h('label', { class: 'dsk-kanban__field' }, [h('span', { class: 'dsk-kanban__label' }, label), control])
        body = h('form', { class: 'dsk-kanban__form', onSubmit: (e: Event) => { e.preventDefault(); save() } }, [
          field(t.value.cardTitle, hc(UidInput, { modelValue: d.title, 'onUpdate:modelValue': (x: string) => (d.title = x), required: true })),
          field(t.value.column, hc(UidSelect, { options: doc.value.columns.map((c) => ({ value: c.id, label: c.title })), modelValue: d.columnId, 'onUpdate:modelValue': (x: string) => (d.columnId = x) })),
          lanes.value.length > 0 ? field(t.value.lane, hc(UidSelect, { options: doc.value.lanes.map((l) => ({ value: l, label: l })), modelValue: d.lane, 'onUpdate:modelValue': (x: string) => (d.lane = x) })) : null,
          field(t.value.tags, hc(UidTagsInput, { modelValue: d.tags, 'onUpdate:modelValue': (x: string[]) => (d.tags = x) })),
          h('div', { class: 'dsk-kanban__row' }, [
            field(t.value.priorityLabel, hc(UidSelect, {
              options: [{ value: '', label: t.value.priority.none }, { value: 'high', label: t.value.priority.high }, { value: 'low', label: t.value.priority.low }],
              modelValue: d.priority,
              'onUpdate:modelValue': (x: '' | Priority) => (d.priority = x),
            })),
            field(t.value.due, hc(UidDatePicker, { modelValue: d.due, 'onUpdate:modelValue': (x: string | null) => (d.due = x) })),
          ]),
          field(t.value.who, hc(UidInput, { modelValue: d.who, 'onUpdate:modelValue': (x: string) => (d.who = x) })),
          field(t.value.description, hc(UidTextarea, { modelValue: d.description, rows: 5, autoGrow: true, 'onUpdate:modelValue': (x: string) => (d.description = x) })),
          field(t.value.extra, hc(UidTextarea, { modelValue: d.extra, rows: 2, autoGrow: true, placeholder: 'key: value', 'onUpdate:modelValue': (x: string) => (d.extra = x) })),
          h('div', { class: 'dsk-kanban__buttons' }, [
            hc(UidButton, { type: 'submit', variant: 'primary' }, () => t.value.save),
            hc(UidButton, { variant: 'ghost', onClick: () => (open.value = false) }, () => t.value.cancel),
            d.id !== null ? hc(UidButton, { variant: 'danger', class: 'dsk-kanban__delete', onClick: remove }, () => t.value.delete) : null,
          ]),
        ])
      } else if (v) {
        const { card, column } = v
        const rows: [string, string][] = [[t.value.column, column.title]]
        if (card.props.get('lane')) rows.push([t.value.lane, card.props.get('lane')!])
        if (card.priority) rows.push([t.value.priorityLabel, t.value.priority[card.priority]])
        if (card.props.get('who')) rows.push([t.value.who, card.props.get('who')!])
        if (card.props.get('due')) rows.push([t.value.due, card.props.get('due')!])
        for (const [k, val] of card.props) if (!KNOWN.has(k)) rows.push([k, val || '✓'])
        body = h('div', { class: 'dsk-kanban__details' }, [
          card.tags.length ? h('div', { class: 'dsk-kanban__card-meta' }, card.tags.map((tag) => hc(UidTag, { size: 'sm', variant: toneOf(tag) }, () => tag))) : null,
          h('dl', { class: 'dsk-kanban__props' }, rows.flatMap(([k, val]) => [h('dt', null, k), h('dd', null, val)])),
          card.description ? hc(UidMarkdown, { source: card.description }) : null,
        ])
      }
      return hc(UidDrawer, { modelValue: open.value, 'onUpdate:modelValue': (x: boolean) => (open.value = x), title, width: '440px' }, () => body)
    }

    function sourceView(): VNodeChild {
      return h('div', { class: 'dsk-kanban__source' }, [
        h('textarea', {
          class: 'dsk-kanban__code',
          value: text.value,
          spellcheck: false,
          'aria-label': t.value.source,
          onInput: (e: Event) => onSource((e.target as HTMLTextAreaElement).value),
        }),
        doc.value.problems.length
          ? h('ul', { class: 'dsk-kanban__problems', role: 'status' }, doc.value.problems.map((p) => h('li', null, `${t.value.line} ${p.line}: ${p.message}`)))
          : null,
      ])
    }

    return () =>
      h('div', { class: ['dsk-kanban', { 'dsk-kanban--editable': canEdit.value, 'dsk-kanban--locked': props.locked }] }, [
        toolbar(),
        tab.value === 'source' && canEdit.value
          ? sourceView()
          : hc(UidBoard, {
              columns: columns.value,
              lanes: lanes.value,
              readonly: !canEdit.value,
              onMove,
              onOpen: (card: { key: string | number }) => openCard(String(card.key)),
            }, {
              card: ({ card, column }: { card: { key: string | number }; column: { key: string | number } }) => cardContent(String(card.key), String(column.key)),
              'column-header': ({ column, count, over }: { column: { key: string | number; title: string }; count: number; over: boolean }) => columnHeader(column, count, over),
            }),
        drawer(),
      ])
  },
})
