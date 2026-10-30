import { createEmbed } from '../../src/core/embed'
import type { PluginModule } from '../../src/core/types'

describe('a build with some plugins, extended by another', () => {
  const markdown: PluginModule = {
    mountElement(ctx) {
      ctx.container.textContent = 'markdown'
      return { update() {}, destroy() {} }
    },
  }
  const diagram: PluginModule = {
    mountElement(ctx) {
      ctx.container.textContent = 'diagram'
      return { update() {}, destroy() {} }
    },
    renderers: { mermaid: () => ({ html: '<svg id="late"></svg>' }) },
  }
  const loadPlugin = vi.fn(async (name: string) => {
    if (name === 'markdown') return markdown
    throw new Error(`not here: ${name}`)
  })
  const api = createEmbed({ mode: 'bundle', version: 't', versions: {}, plugins: ['markdown'], loadPlugin })

  it('defines only the elements and block languages of its plugins', () => {
    expect(customElements.get('dsk-markdown')).toBeDefined()
    expect(customElements.get('dsk-diagram')).toBeUndefined()
    expect(api.blocks.has('mermaid')).toBe(false)
    expect(api.plugins()).toEqual(['markdown'])
  })

  it('extend adds the elements and the block languages, and tells the registry', async () => {
    const changed = vi.fn()
    api.host.blocks.subscribe(changed)
    expect(api.extend({ diagram, markdown: { mountElement: () => { throw new Error('kept the first') } } })).toEqual(['diagram'])
    expect(changed).toHaveBeenCalled()
    expect(api.blocks.has('mermaid')).toBe(true)
    expect(api.plugins().sort()).toEqual(['diagram', 'markdown'])

    document.body.innerHTML = '<dsk-diagram id="d">graph TD</dsk-diagram><dsk-markdown id="m"># hi</dsk-markdown>'
    const d = document.getElementById('d') as HTMLElement & { ready: Promise<void> }
    const m = document.getElementById('m') as HTMLElement & { ready: Promise<void> }
    await Promise.all([d.ready, m.ready])
    expect(d.querySelector('[data-dsk-root]')!.textContent).toBe('diagram')
    expect(m.querySelector('[data-dsk-root]')!.textContent).toBe('markdown')
    expect(loadPlugin).not.toHaveBeenCalledWith('diagram', expect.anything())

    document.body.innerHTML = '<pre><code class="language-mermaid">graph TD</code></pre>'
    expect(await api.renderBlocks()).toBe(1)
    expect(document.getElementById('late')).not.toBeNull()
  })

  it('extending with what is there adds nothing', () => {
    expect(api.extend({ diagram })).toEqual([])
  })
})
