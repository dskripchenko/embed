import { createEmbed } from '../../src/core/embed'
import type { ElementContext, PluginModule } from '../../src/core/types'

describe('elements and the embed API', () => {
  const mounted: ElementContext[] = []
  const plugin: PluginModule = {
    mountElement(ctx) {
      mounted.push(ctx)
      ctx.container.textContent = `rendered:${ctx.source()}`
      return {
        update: vi.fn(() => (ctx.container.textContent = `updated:${JSON.stringify(ctx.props())}`)),
        destroy: vi.fn(),
        api: { play: vi.fn(() => 'played'), get state() { return { playing: true } } },
      }
    },
    renderers: { mermaid: () => ({ html: '<svg id="from-plugin"></svg>' }) },
  }
  const loadPlugin = vi.fn(async () => plugin)
  const api = createEmbed({ mode: 'bundle', version: 't', versions: {}, loadPlugin })

  it('upgrades lazily: the plugin is loaded when an element appears', async () => {
    expect(loadPlugin).not.toHaveBeenCalled()
    document.body.innerHTML = '<dsk-diagram id="d">\n  graph TD\n    A-->B\n</dsk-diagram>'
    const el = document.getElementById('d') as HTMLElement & { ready: Promise<void>; source: string }
    await el.ready
    expect(loadPlugin).toHaveBeenCalledWith('diagram', expect.anything())
    expect(el.getAttribute('data-dsk-state')).toBe('ready')
    expect(el.querySelector('[data-dsk-root]')!.textContent).toBe('rendered:graph TD\n  A-->B')
    // The raw text is gone; the source stays available.
    expect(Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE)).toEqual([])
    expect(el.source).toBe('graph TD\n  A-->B')
  })

  it('properties override attributes and trigger an update; methods and getters forward', async () => {
    document.body.innerHTML = '<dsk-video id="v" muted aspect-ratio="4:3"></dsk-video>'
    const el = document.getElementById('v') as HTMLElement & Record<string, any>
    await el.ready
    expect(el.aspectRatio).toBe('4:3')
    el.aspectRatio = '1:1'
    el.setAttribute('loop', '')
    await Promise.resolve()
    await Promise.resolve()
    expect(el.querySelector('[data-dsk-root]')!.textContent).toContain('"aspectRatio":"1:1"')
    expect(el.querySelector('[data-dsk-root]')!.textContent).toContain('"loop":true')
    expect(el.play()).toBe('played')
    expect(el.state).toEqual({ playing: true })
  })

  it('a method called before the element is ready waits for it', async () => {
    const el = document.createElement('dsk-audio') as HTMLElement & Record<string, any>
    const result = el.play()
    document.body.appendChild(el)
    await expect(result).resolves.toBe('played')
  })

  it('the global API: blocks, events, config, renderBlocks through built-in lazy renderers', async () => {
    expect(api.blocks.list().sort()).toEqual(['asyncapi', 'audio', 'board', 'bpmn', 'd2', 'dbml', 'dmn', 'dot', 'drawio', 'flow', 'graphviz', 'mermaid', 'openapi', 'plantuml', 'puml', 'structurizr', 'video', 'wardley'])
    const off = api.blocks.register('chart', { html: '<b>chart</b>' })
    expect(api.blocks.has('chart')).toBe(true)
    off()
    const seen = vi.fn()
    api.on('config', seen)
    api.configure({ locale: 'ru' })
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ locale: 'ru' }), expect.anything())
    document.body.innerHTML = '<pre><code class="language-mermaid">graph TD</code></pre>'
    expect(await api.renderBlocks()).toBe(1)
    expect(document.getElementById('from-plugin')).not.toBeNull()
  })

  it('an element removed from the page is destroyed; a move keeps it', async () => {
    document.body.innerHTML = '<div id="a"><dsk-markdown id="m">x</dsk-markdown></div><div id="b"></div>'
    const el = document.getElementById('m') as HTMLElement & { ready: Promise<void> }
    await el.ready
    const before = mounted.length
    document.getElementById('b')!.appendChild(el)
    await Promise.resolve()
    expect(el.getAttribute('data-dsk-state')).toBe('ready')
    expect(mounted.length).toBe(before)
    el.remove()
    await Promise.resolve()
    expect(el.hasAttribute('data-dsk-state')).toBe(false)
  })
})
