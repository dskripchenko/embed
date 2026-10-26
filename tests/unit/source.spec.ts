import { dedent, readSource } from '../../src/core/source'

describe('element source', () => {
  it('dedents and trims blank lines', () => {
    expect(dedent('\n    a\n      b\n\n    c\n  ')).toBe('a\n  b\n\nc')
  })

  it('prefers a data <script>, then a <template>, then text', () => {
    const el = document.createElement('div')
    el.innerHTML = '<script type="text/markdown">\n  # T &lt; <b>x</b>\n</script><template><p>t</p></template>text'
    expect(readSource(el)).toBe('# T &lt; <b>x</b>')
    el.querySelector('script')!.remove()
    expect(readSource(el)).toBe('<p>t</p>')
    el.querySelector('template')!.remove()
    expect(readSource(el)).toBe('text')
  })

  it('ignores executable scripts, source/track children and its own root', () => {
    const el = document.createElement('div')
    el.innerHTML = '<script>var x</script>graph TD<source src="a"><div data-dsk-root>rendered</div>'
    expect(readSource(el)).toBe('graph TD')
  })
})

import { tidyMarkup } from '../../src/plugins/editor'

describe('editor template markup', () => {
  it('drops indentation between tags, keeps text spaces and <pre>', () => {
    const html = '\n  <h2>Title</h2>\n  <p>Some <b>bold</b> text</p>\n  <pre><code>a:\n  b: 1\n</code></pre>\n  <p>end</p>\n'
    expect(tidyMarkup(html)).toBe('<h2>Title</h2><p>Some <b>bold</b> text</p><pre><code>a:\n  b: 1\n</code></pre><p>end</p>')
  })
})

describe('template sources keep the YAML of code blocks', () => {
  it('a code block indented with its markup comes out at column 0', () => {
    const el = document.createElement('div')
    el.innerHTML = `
          <template>
            <p>Notes</p>
            <pre><code class="language-openapi">method: POST
            url: /v1/orders
            body:
              example:
                items:
                  - sku: A
                    quantity: 2</code></pre>
          </template>`
    const html = tidyMarkup(readSource(el))
    expect(html).toBe('<p>Notes</p><pre><code class="language-openapi">method: POST\nurl: /v1/orders\nbody:\n  example:\n    items:\n      - sku: A\n        quantity: 2</code></pre>')
  })
})
