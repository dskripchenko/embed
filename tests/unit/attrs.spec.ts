import { SCHEMAS, aspectRatio, camel, cssLength, kebab, parseAttr, parseBoolean, parseList, readAttributes } from '../../src/core/attrs'
import { propertyOf } from '../../src/core/elements'

describe('attribute → prop mapping', () => {
  it('converts names', () => {
    expect(kebab('resumeKey')).toBe('resume-key')
    expect(camel('aspect-ratio')).toBe('aspectRatio')
  })

  it('booleans: presence is true, false/0/off/no are false, absence is undefined', () => {
    expect(parseBoolean('')).toBe(true)
    expect(parseBoolean('controls')).toBe(true)
    for (const v of ['false', '0', 'off', 'no', ' FALSE ']) expect(parseBoolean(v)).toBe(false)
    expect(parseBoolean(null)).toBeUndefined()
  })

  it('lists, numbers, enums, credentials', () => {
    expect(parseList('curl, js ,python')).toEqual(['curl', 'js', 'python'])
    expect(parseList('["a","b"]')).toEqual(['a', 'b'])
    expect(parseAttr({ prop: 'rates', type: 'numbers' }, '0.5, 1, x, 2')).toEqual([0.5, 1, 2])
    expect(parseAttr({ prop: 'n', type: 'number' }, 'abc')).toBeUndefined()
    expect(parseAttr({ prop: 'v', type: 'enum', values: ['default', 'mini'] }, 'mini')).toBe('mini')
    expect(parseAttr({ prop: 'v', type: 'enum', values: ['default', 'mini'] }, 'huge')).toBeUndefined()
    expect(parseAttr({ prop: 'p', type: 'credentials' }, 'session')).toBe('session')
    expect(parseAttr({ prop: 'p', type: 'credentials' }, '')).toBe(true)
  })

  it('reads an element by its schema and reports broken JSON', () => {
    const el = document.createElement('dsk-video')
    el.setAttribute('aspect-ratio', '4:3')
    el.setAttribute('muted', '')
    el.setAttribute('controls', 'false')
    el.setAttribute('resume-key', 'intro')
    el.setAttribute('tracks', '[{"src":"a.vtt"}]')
    el.setAttribute('sources', '{broken')
    const { props, errors } = readAttributes(el, SCHEMAS['dsk-video']!)
    expect(props).toMatchObject({ aspectRatio: '4:3', muted: true, controls: false, resumeKey: 'intro', tracks: [{ src: 'a.vtt' }] })
    expect(props.autoplay).toBeUndefined()
    expect(errors).toEqual([{ attr: 'sources', message: expect.any(String) }])
  })

  it('maps attributes of every element to properties', () => {
    expect(propertyOf('dsk-flow', 'poll-url')).toBe('pollUrl')
    expect(propertyOf('dsk-openapi', 'try-it')).toBe('tryIt')
    expect(propertyOf('dsk-audio', 'track-title')).toBe('trackTitle')
    expect(propertyOf('dsk-editor', 'min-height')).toBe('minHeight')
    for (const [tag, schema] of Object.entries(SCHEMAS)) {
      const props = schema.map((s) => s.prop)
      expect(new Set(props).size, tag).toBe(props.length)
    }
  })

  it('aspect ratios and CSS lengths', () => {
    expect(aspectRatio('16:9')).toBe('16 / 9')
    expect(aspectRatio('4/3')).toBe('4 / 3')
    expect(aspectRatio(1.5)).toBe('1.5')
    expect(cssLength('480')).toBe('480px')
    expect(cssLength(320)).toBe('320px')
    expect(cssLength('60vh')).toBe('60vh')
    expect(cssLength(undefined, '1px')).toBe('1px')
  })
})
