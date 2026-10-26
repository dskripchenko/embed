import { createRegistry } from '../../src/core/registry'
import { findBlocks, languageOf, renderBlocks, unrenderBlocks } from '../../src/core/renderBlocks'

function page(html: string) {
  document.body.innerHTML = html
  return document.body
}

describe('renderBlocks', () => {
  it('finds the language from class or data attributes', () => {
    const root = page('<pre class="lang-a"><code></code></pre><pre><code data-lang="B"></code></pre>')
    const [a, b] = Array.from(root.querySelectorAll('pre'))
    expect(languageOf(a!, a!.querySelector('code'))).toBe('a')
    expect(languageOf(b!, b!.querySelector('code'))).toBe('b')
  })

  it('renders html and live blocks, and is idempotent', async () => {
    const registry = createRegistry()
    const destroy = vi.fn()
    const update = vi.fn()
    registry.register('chart', (code) => ({ html: `<svg data-code="${code.length}"></svg>` }))
    registry.register('live', {
      mount(el, ctx) {
        el.textContent = `live:${ctx.code}`
        return { update, destroy }
      },
    })
    const root = page(`
      <pre><code class="language-chart">abc</code></pre>
      <pre><code class="language-live">x</code></pre>
      <pre><code class="language-js">keep()</code></pre>`)
    expect(await renderBlocks(root, registry)).toBe(2)
    expect(root.querySelector('.dsk-block--chart svg')!.getAttribute('data-code')).toBe('3')
    expect(root.querySelector('.dsk-block--live')!.textContent).toBe('live:x')
    expect(root.querySelector('code.language-js')).not.toBeNull()
    expect(await renderBlocks(root, registry)).toBe(0)
    expect(root.querySelectorAll('[data-dsk-block]').length).toBe(2)

    expect(unrenderBlocks(root)).toBe(2)
    expect(destroy).toHaveBeenCalledOnce()
    expect(root.querySelectorAll('pre').length).toBe(3)
    expect(root.querySelector('code.language-chart')!.textContent).toBe('abc')
  })

  it('a failing block stays code, marked, and is not retried', async () => {
    const registry = createRegistry()
    const renderer = vi.fn(async () => ({ error: 'bad diagram' }))
    registry.register('mermaid', renderer)
    registry.register('boom', () => {
      throw new Error('exploded')
    })
    const root = page('<pre><code class="language-mermaid">x</code></pre><pre><code class="language-boom">y</code></pre>')
    expect(await renderBlocks(root, registry)).toBe(0)
    const pres = root.querySelectorAll('pre[data-dsk-failed]')
    expect(pres.length).toBe(2)
    expect(pres[0]!.getAttribute('title')).toBe('bad diagram')
    expect(pres[1]!.getAttribute('title')).toBe('exploded')
    await renderBlocks(root, registry)
    expect(renderer).toHaveBeenCalledOnce()
  })

  it('leaves code owned by markdown, the editor and contenteditable alone; filters languages', async () => {
    const registry = createRegistry()
    registry.register('a', () => ({ html: '<i></i>' }))
    registry.register('b', () => ({ html: '<i></i>' }))
    const root = page(`
      <div contenteditable="true"><pre><code class="language-a">1</code></pre></div>
      <dsk-markdown><pre><code class="language-a">2</code></pre></dsk-markdown>
      <pre><code class="language-a">3</code></pre>
      <pre><code class="language-b">4</code></pre>`)
    expect(findBlocks(root, registry).map((b) => b.code)).toEqual(['3', '4'])
    expect(await renderBlocks(root, registry, { languages: ['b'] })).toBe(1)
  })
})
