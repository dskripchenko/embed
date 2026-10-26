import { createRegistry, toRenderer } from '../../src/core/registry'

describe('block registry', () => {
  it('registers, normalizes the language and unregisters', () => {
    const r = createRegistry()
    const fn = () => ({ html: '<b>x</b>' })
    const off = r.register(' Chart ', fn)
    expect(r.has('chart')).toBe(true)
    expect(r.get('CHART')).toBe(fn)
    expect(r.languages()).toEqual(['chart'])
    off()
    expect(r.has('chart')).toBe(false)
  })

  it('a stale unregister does not remove a newer renderer', () => {
    const r = createRegistry()
    const off = r.register('x', () => ({ html: '1' }))
    const second = () => ({ html: '2' })
    r.register('x', second)
    off()
    expect(r.get('x')).toBe(second)
  })

  it('accepts a fixed { html } or { mount } result', async () => {
    const mount = vi.fn()
    expect(await toRenderer({ html: '<i>a</i>' })('', { language: 'a', index: 0 })).toEqual({ html: '<i>a</i>' })
    expect((await toRenderer({ mount })('', { language: 'a', index: 0 })).mount).toBe(mount)
  })

  it('rejects what is not a renderer and bad languages', () => {
    const r = createRegistry()
    expect(() => r.register('x', {} as never)).toThrow(TypeError)
    expect(() => r.register('bad lang', () => ({}))).toThrow(TypeError)
  })

  it('notifies subscribers and snapshots all renderers', () => {
    const r = createRegistry()
    const seen = vi.fn()
    const off = r.subscribe(seen)
    r.register('a', () => ({ html: '' }))
    r.unregister('a')
    r.unregister('a')
    expect(seen).toHaveBeenCalledTimes(2)
    off()
    r.register('b', () => ({ html: '' }))
    expect(seen).toHaveBeenCalledTimes(2)
    expect(Object.keys(r.all())).toEqual(['b'])
  })
})
