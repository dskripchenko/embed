// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { Host } from '../../src/core/types'
import { installPrinter, printable } from '../../src/plugins/print'

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
    // The print is called off while this very form is being built.
    printable(h, a, () => {
      h.printer!.restore()
      return 'late'
    })
    await h.printer!.prepare(document)
    expect(a.classList.contains('dsk-print-hidden')).toBe(false)
    expect(document.querySelectorAll('.dsk-print-form')).toHaveLength(0)
    a.remove()

    const b = widget()
    printable(h, b, () => 'auto')
    window.dispatchEvent(new Event('beforeprint'))
    await vi.waitFor(() => expect(b.nextElementSibling?.textContent).toBe('auto'))
    window.dispatchEvent(new Event('afterprint'))
    expect(b.classList.contains('dsk-print-hidden')).toBe(false)
  })

  it('forms the page prepared itself stay through the browser print events', async () => {
    const h = host()
    const a = widget()
    printable(h, a, () => 'mine')
    const restore = await h.printer!.prepare(document)
    // A print to PDF fires beforeprint and afterprint around the printing.
    window.dispatchEvent(new Event('beforeprint'))
    expect(a.nextElementSibling?.textContent).toBe('mine')
    window.dispatchEvent(new Event('afterprint'))
    await new Promise((r) => setTimeout(r, 50))
    expect(document.querySelectorAll('.dsk-print-form')).toHaveLength(1)
    restore()
    expect(document.querySelectorAll('.dsk-print-form')).toHaveLength(0)
    a.remove()
  })

  it('waits for the widgets in its scope that are still drawing', async () => {
    const h = host()
    const part = widget()
    const loading = widget(part)
    loading.setAttribute('data-dsk-state', 'loading')
    // A plugin with Vue sets the printer up when it loads, before any form exists.
    const prepared = installPrinter(h).prepare(part)
    // The widget finishes drawing and registers its form while prepare waits.
    await new Promise((r) => setTimeout(r, 120))
    printable(h, loading, () => 'drawn')
    loading.setAttribute('data-dsk-state', 'ready')
    await prepared
    expect(loading.nextElementSibling?.textContent).toBe('drawn')
    h.printer!.restore()
  })
})
