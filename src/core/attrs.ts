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

const COMMON: Schema = [
  { prop: 'locale', type: 'string' },
  { prop: 'loading', type: 'enum', values: ['lazy', 'eager'] },
]

const MEDIA_COMMON: Schema = [
  { prop: 'src', type: 'string' },
  { prop: 'loop', type: 'boolean' },
  { prop: 'preload', type: 'enum', values: ['none', 'metadata', 'auto'] },
  { prop: 'crossorigin', type: 'enum', values: ['', 'anonymous', 'use-credentials'] },
  { prop: 'exclusive', type: 'boolean' },
  { prop: 'resumeKey', type: 'string' },
  { prop: 'rates', type: 'numbers' },
  { prop: 'hotkeys', type: 'boolean' },
  { prop: 'hlsOptions', type: 'json' },
]

/** Props of every element, by tag. */
export const SCHEMAS: Readonly<Record<string, Schema>> = {
  'dsk-video': [
    ...COMMON,
    ...MEDIA_COMMON,
    { prop: 'sources', type: 'json' },
    { prop: 'tracks', type: 'json' },
    { prop: 'poster', type: 'string' },
    { prop: 'thumbnails', type: 'string' },
    { prop: 'autoplay', type: 'boolean' },
    { prop: 'muted', type: 'boolean' },
    { prop: 'controls', type: 'boolean' },
    { prop: 'aspectRatio', type: 'string' },
    // `title` would also be the browser's tooltip over the whole player.
    { prop: 'label', type: 'string' },
    { prop: 'autoHide', type: 'number' },
  ],
  'dsk-audio': [
    ...COMMON,
    ...MEDIA_COMMON,
    { prop: 'type', type: 'string' },
    { prop: 'trackTitle', type: 'string' },
    { prop: 'artist', type: 'string' },
    { prop: 'tracks', type: 'json' },
    { prop: 'variant', type: 'enum', values: ['default', 'mini'] },
    { prop: 'waveform', type: 'boolean' },
    { prop: 'peaks', type: 'numbers' },
    { prop: 'waveformMaxBytes', type: 'number' },
    { prop: 'waveformMaxDuration', type: 'number' },
    { prop: 'autoAdvance', type: 'boolean' },
    { prop: 'showVolume', type: 'boolean' },
    { prop: 'showRate', type: 'boolean' },
    { prop: 'showPlaylist', type: 'boolean' },
    { prop: 'index', type: 'number' },
  ],
  'dsk-diagram': [...COMMON, { prop: 'src', type: 'string' }, { prop: 'label', type: 'string' }],
  'dsk-openapi': [
    ...COMMON,
    { prop: 'mode', type: 'enum', values: ['reference', 'operation', 'block', 'editor'] },
    { prop: 'view', type: 'enum', values: ['visual', 'source', 'preview'] },
    { prop: 'src', type: 'string' },
    { prop: 'specs', type: 'json' },
    { prop: 'active', type: 'string' },
    { prop: 'operation', type: 'string' },
    { prop: 'referenceUrl', type: 'string' },
    { prop: 'specId', type: 'string' },
    { prop: 'tryIt', type: 'boolean' },
    { prop: 'proxy', type: 'string' },
    { prop: 'baseUrl', type: 'string' },
    { prop: 'defaultSnippet', type: 'string' },
    { prop: 'snippetTargets', type: 'list' },
    { prop: 'persistCredentials', type: 'credentials' },
    { prop: 'hashNavigation', type: 'boolean' },
    { prop: 'heading', type: 'string' },
    { prop: 'editable', type: 'boolean' },
    { prop: 'height', type: 'string' },
  ],
  'dsk-flow': [
    ...COMMON,
    { prop: 'src', type: 'string' },
    { prop: 'pollUrl', type: 'string' },
    { prop: 'pollInterval', type: 'number' },
    { prop: 'state', type: 'json' },
    { prop: 'editable', type: 'boolean' },
    { prop: 'readonly', type: 'boolean' },
    { prop: 'toggleUrl', type: 'string' },
    { prop: 'subgraphUrl', type: 'string' },
    { prop: 'direction', type: 'enum', values: ['TB', 'LR', 'auto'] },
    { prop: 'edgeStyle', type: 'enum', values: ['orthogonal', 'smooth'] },
    { prop: 'wheel', type: 'enum', values: ['zoom', 'pan'] },
    { prop: 'minimap', type: 'boolean' },
    { prop: 'controls', type: 'boolean' },
    { prop: 'details', type: 'boolean' },
    { prop: 'statusBar', type: 'boolean' },
    { prop: 'palette', type: 'list' },
    { prop: 'height', type: 'string' },
    { prop: 'name', type: 'string' },
    { prop: 'openapiTarget', type: 'string' },
    { prop: 'mediaTarget', type: 'string' },
  ],
  'dsk-markdown': [
    ...COMMON,
    { prop: 'src', type: 'string' },
    { prop: 'toc', type: 'boolean' },
    { prop: 'tocDepth', type: 'number' },
    { prop: 'linkBase', type: 'string' },
    { prop: 'imageBase', type: 'string' },
  ],
  'dsk-editor': [
    ...COMMON,
    { prop: 'value', type: 'string' },
    { prop: 'name', type: 'string' },
    { prop: 'input', type: 'string' },
    { prop: 'placeholder', type: 'string' },
    { prop: 'readonly', type: 'boolean' },
    { prop: 'toolbar', type: 'boolean' },
    { prop: 'minHeight', type: 'string' },
    { prop: 'maxHeight', type: 'string' },
    { prop: 'resizable', type: 'boolean' },
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
