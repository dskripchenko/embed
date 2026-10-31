/**
 * `{key: value, flag, list: a, b}` — the properties at the end of a kanban
 * card, column or calendar event line. A part without a colon is a flag
 * (`done`) when it reads like a name, otherwise the next item of the
 * previous value (`except: 2026-11-30, 2026-12-07`). Flags map to ''.
 */
export type Props = Map<string, string>

const NAME = /^[A-Za-z][\w-]*$/

export function parseProps(inner: string): Props {
  const props: Props = new Map()
  let last: string | null = null
  for (const raw of inner.split(',')) {
    const part = raw.trim()
    if (part === '') continue
    const colon = part.indexOf(':')
    const key = colon > 0 ? part.slice(0, colon).trim() : ''
    if (colon > 0 && NAME.test(key)) {
      last = key
      props.set(key, part.slice(colon + 1).trim())
      continue
    }
    if (last !== null && props.get(last) !== '' && !NAME.test(part)) {
      props.set(last, `${props.get(last)}, ${part}`)
      continue
    }
    props.set(part, '')
    last = part
  }
  return props
}

export function serializeProps(props: Props): string {
  if (props.size === 0) return ''
  return `{${[...props].map(([k, v]) => (v === '' ? k : `${k}: ${v}`)).join(', ')}}`
}
