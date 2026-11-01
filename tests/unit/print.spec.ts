// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { Host } from '../../src/core/types'
import { printable } from '../../src/plugins/print'

const host = () => ({}) as Host
const widget = (parent: HTMLElement = document.body) => {
  const el = document.createElement('div')
  parent.append(el)
  return el
}

describe('print forms', () => {
  it('puts each form after its widget, hides the widget on paper, and takes it all away', async () => {
    const h = host()
    const a = widget()
    const b = widget()
    const c = widget()
    printable(h, a, () => '<svg id="pa"></svg>')
    printable(h, b, async () => {
      const p = document.createElement('p')
      p.textContent = 'built later'
      return p
    })
    // Printed as it is: no form.
    printable(h, c, () => null)
    const restore = await h.printer!.prepare(document)
    expect(a.nextElementSibling?.className).toBe('dsk-print-form')
    expect(a.nextElementSibling?.querySelector('#pa')).not.toBeNull()
    expect(b.nextElementSibling?.textContent).toBe('built later')
    expect(a.classList.contains('dsk-print-hidden') && b.classList.contains('dsk-print-hidden')).toBe(true)
    expect(c.classList.contains('dsk-print-hidden')).toBe(false)
    // The print stylesheet goes in once (vitest leaves imported CSS empty).
    expect(document.querySelectorAll('style[data-dsk-embed="print"]')).toHaveLength(1)
    restore()
    expect(document.querySelectorAll('.dsk-print-form, .dsk-print-hidden')).toHaveLength(0)
  })

  it('keeps to the part of the page asked for, skips a form that fails and widgets that left', async () => {
    const h = host()
    const part = widget()
    const inside = widget(part)
    const outside = widget()
    const broken = widget(part)
    const gone = widget(part)
    printable(h, inside, () => 'in')
    printable(h, outside, () => 'out')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    printable(h, broken, () => {
      throw new Error('no')
    })
    const unregister = printable(h, gone, () => 'gone')
    unregister()
    await h.printer!.prepare(part)
    expect(inside.nextElementSibling?.textContent).toBe('in')
    expect(outside.nextElementSibling).toBeNull()
    expect(broken.classList.contains('dsk-print-hidden')).toBe(false)
    expect(gone.classList.contains('dsk-print-hidden')).toBe(false)
    expect(warn).toHaveBeenCalled()
    h.printer!.restore()
    warn.mockRestore()
  })

  it('a restore while forms are built leaves nothing behind; the browser print events do both', async () => {
    const h = host()
    const a = widget()
    let release!: () => void
    printable(h, a, () => new Promise<string>((r) => (release = () => r('late'))))
    const pending = h.printer!.prepare(document)
    h.printer!.restore()
    release()
    await pending
    expect(a.classList.contains('dsk-print-hidden')).toBe(false)
    expect([...document.querySelectorAll('.dsk-print-form')].map((f) => f.textContent)).toEqual([])

    const b = widget()
    printable(h, b, () => 'auto')
    window.dispatchEvent(new Event('beforeprint'))
    release()
    await new Promise((r) => setTimeout(r, 0))
    expect(b.nextElementSibling?.textContent).toBe('auto')
    window.dispatchEvent(new Event('afterprint'))
    expect(b.classList.contains('dsk-print-hidden')).toBe(false)
  })
})
