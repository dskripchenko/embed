/**
 * Attributes → props. Every element declares its props once: the attribute
 * (kebab-case), the property (camelCase) and the type. An attribute that is
 * absent leaves the prop to the component's default; a property set from
 * script wins over the attribute.
 */

export type PropType = 'string' | 'boolean' | 'number' | 'json' | 'list' | 'numbers' | 'enum' | 'credentials'

export interface PropSpec {
  /** camelCase property name, also the key handed to the plugin. */
  prop: string
  type: PropType
  /** Allowed values of an `enum`. */
  values?: readonly string[]
  /** The attribute, when it is not the kebab-case of `prop`. */
  attr?: string
}

export type Schema = readonly PropSpec[]

export function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

export function camel(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

export function attrOf(spec: PropSpec): string {
  return spec.attr ?? kebab(spec.prop)
}

const FALSE = new Set(['false', '0', 'off', 'no'])

export function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined
  return !FALSE.has(value.trim().toLowerCase())
}

export function parseNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** `a, b, c` or a JSON array. */
export function parseList(value: string | null): string[] | undefined {
  if (value === null) return undefined
  const v = value.trim()
  if (v === '') return []
  if (v.startsWith('[')) {
    const parsed: unknown = JSON.parse(v)
    if (!Array.isArray(parsed)) throw new SyntaxError('expected a JSON array')
    return parsed.map((x) => String(x))
  }
  return v.split(',').map((s) => s.trim()).filter((s) => s !== '')
}

export function parseNumbers(value: string | null): number[] | undefined {
  const list = parseList(value)
  return list?.map(Number).filter((n) => Number.isFinite(n))
}

export function parseJson(value: string | null): unknown {
  if (value === null || value.trim() === '') return undefined
  return JSON.parse(value)
}

/** `true`/`false`/`session`/`local` — the shape of openapi's persistCredentials. */
export function parseCredentials(value: string | null): boolean | 'session' | 'local' | undefined {
  if (value === null) return undefined
  const v = value.trim().toLowerCase()
  if (v === 'session' || v === 'local') return v
  return parseBoolean(v)
}

export function parseAttr(spec: PropSpec, value: string | null): unknown {
  switch (spec.type) {
    case 'string':
      return value ?? undefined
    case 'boolean':
      return parseBoolean(value)
    case 'number':
      return parseNumber(value)
    case 'list':
      return parseList(value)
    case 'numbers':
      return parseNumbers(value)
    case 'json':
      return parseJson(value)
    case 'credentials':
      return parseCredentials(value)
    case 'enum':
      return value !== null && spec.values?.includes(value.trim()) ? value.trim() : undefined
  }
}

export interface ReadResult {
  props: Record<string, unknown>
  /** Attributes that did not parse, with the reason. */
  errors: { attr: string; message: string }[]
}

/** The props an element's attributes give, by its schema. */
export function readAttributes(el: Element, schema: Schema): ReadResult {
  const props: Record<string, unknown> = {}
  const errors: ReadResult['errors'] = []
  for (const spec of schema) {
    const attr = attrOf(spec)
    try {
      const value = parseAttr(spec, el.getAttribute(attr))
      if (value !== undefined) props[spec.prop] = value
    } catch (error) {
      errors.push({ attr, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return { props, errors }
}

// Short forms of a prop's spec: the schemas are most of the loader's size.
const str = (prop: string): PropSpec => ({ prop, type: 'string' })
const bool = (prop: string): PropSpec => ({ prop, type: 'boolean' })
const num = (prop: string): PropSpec => ({ prop, type: 'number' })
const json = (prop: string): PropSpec => ({ prop, type: 'json' })
const list = (prop: string): PropSpec => ({ prop, type: 'list' })
const nums = (prop: string): PropSpec => ({ prop, type: 'numbers' })
const oneOf = (prop: string, values: readonly string[]): PropSpec => ({ prop, type: 'enum', values })

const COMMON: Schema = [
  str('locale'),
  oneOf('loading', ['lazy', 'eager']),
]

const MEDIA_COMMON: Schema = [
  str('src'),
  bool('loop'),
  oneOf('preload', ['none', 'metadata', 'auto']),
  oneOf('crossorigin', ['', 'anonymous', 'use-credentials']),
  bool('exclusive'),
  str('resumeKey'),
  nums('rates'),
  bool('hotkeys'),
  json('hlsOptions'),
]

/** Props of every element, by tag. */
export const SCHEMAS: Readonly<Record<string, Schema>> = {
  'dsk-video': [
    ...COMMON,
    ...MEDIA_COMMON,
    json('sources'),
    json('tracks'),
    str('poster'),
    str('thumbnails'),
    bool('autoplay'),
    bool('muted'),
    bool('controls'),
    str('aspectRatio'),
    // `title` would also be the browser's tooltip over the whole player.
    str('label'),
    num('autoHide'),
  ],
  'dsk-audio': [
    ...COMMON,
    ...MEDIA_COMMON,
    str('type'),
    str('trackTitle'),
    str('artist'),
    json('tracks'),
    oneOf('variant', ['default', 'mini']),
    bool('waveform'),
    nums('peaks'),
    num('waveformMaxBytes'),
    num('waveformMaxDuration'),
    bool('autoAdvance'),
    bool('showVolume'),
    bool('showRate'),
    bool('showPlaylist'),
    num('index'),
  ],
  'dsk-diagram': [
    ...COMMON,
    str('src'),
    str('label'),
    oneOf('syntax', ['mermaid', 'plantuml', 'dot', 'd2', 'dbml', 'structurizr', 'wardley']),
  ],
  'dsk-asyncapi': [...COMMON, str('src'), str('height')],
  'dsk-bpmn': [
    ...COMMON,
    str('src'),
    bool('editable'),
    bool('properties'),
    str('diagram'),
    list('highlight'),
    str('height'),
    str('name'),
  ],
  'dsk-dmn': [
    ...COMMON,
    str('src'),
    bool('editable'),
    str('decision'),
    list('highlight'),
    str('height'),
    str('name'),
  ],
  'dsk-calendar': [
    ...COMMON,
    str('src'),
    bool('editable'),
    bool('locked'),
    bool('lockable'),
    oneOf('view', ['day', 'week', 'month', 'year', 'agenda']),
    str('date'),
    list('views'),
    str('name'),
  ],
  'dsk-kanban': [
    ...COMMON,
    str('src'),
    bool('editable'),
    bool('locked'),
    bool('lockable'),
    str('name'),
  ],
  'dsk-drawio': [
    ...COMMON,
    str('src'),
    str('page'),
    str('label'),
    bool('externalImages'),
  ],
  'dsk-openapi': [
    ...COMMON,
    oneOf('mode', ['reference', 'operation', 'block', 'editor']),
    oneOf('view', ['visual', 'source', 'preview']),
    str('src'),
    json('specs'),
    str('active'),
    str('operation'),
    str('referenceUrl'),
    str('specId'),
    bool('tryIt'),
    str('proxy'),
    str('baseUrl'),
    str('defaultSnippet'),
    list('snippetTargets'),
    { prop: 'persistCredentials', type: 'credentials' },
    bool('hashNavigation'),
    str('heading'),
    bool('editable'),
    str('height'),
  ],
  'dsk-flow': [
    ...COMMON,
    str('src'),
    str('pollUrl'),
    num('pollInterval'),
    json('state'),
    bool('editable'),
    bool('readonly'),
    str('toggleUrl'),
    str('subgraphUrl'),
    oneOf('direction', ['TB', 'LR', 'auto']),
    oneOf('edgeStyle', ['orthogonal', 'smooth']),
    oneOf('wheel', ['zoom', 'pan']),
    bool('minimap'),
    bool('controls'),
    bool('details'),
    bool('statusBar'),
    list('palette'),
    str('height'),
    str('name'),
    str('openapiTarget'),
    str('mediaTarget'),
  ],
  'dsk-board': [
    ...COMMON,
    str('src'),
    str('boardUrl'),
    num('pollInterval'),
    bool('editable'),
    bool('readonly'),
    bool('lockable'),
    bool('minimap'),
    str('height'),
    str('name'),
    str('userId'),
    str('userName'),
    str('userColor'),
  ],
  'dsk-markdown': [
    ...COMMON,
    str('src'),
    bool('toc'),
    num('tocDepth'),
    str('linkBase'),
    str('imageBase'),
  ],
  'dsk-editor': [
    ...COMMON,
    str('value'),
    str('name'),
    str('input'),
    str('placeholder'),
    bool('readonly'),
    bool('toolbar'),
    str('minHeight'),
    str('maxHeight'),
    bool('resizable'),
  ],
  'dsk-markdown-editor': [
    ...COMMON,
    str('value'),
    str('name'),
    str('input'),
    oneOf('mode', ['visual', 'source', 'split']),
    list('modes'),
    str('placeholder'),
    bool('readonly'),
    str('minHeight'),
    str('maxHeight'),
    str('imageBase'),
    str('linkBase'),
    str('toolbarTarget'),
    bool('modeSwitch'),
  ],
}

/** `16:9` → `16 / 9`, the CSS aspect-ratio the kit takes. */
export function aspectRatio(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string' || value.trim() === '') return undefined
  return value.trim().replace(/\s*[:/]\s*/, ' / ')
}

/** A CSS length: a bare number is pixels. */
export function cssLength(value: unknown, fallback?: string): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`
  if (typeof value === 'string' && value.trim() !== '') return /^\d+(\.\d+)?$/.test(value.trim()) ? `${value.trim()}px` : value.trim()
  return fallback
}
