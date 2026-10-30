# Blocks

A **block** is a fenced code block of a registered language — ```` ```mermaid ````
in markdown, `<pre><code class="language-mermaid">` in HTML — shown as what
it describes instead of as code. One page-wide registry serves every place
blocks appear:

- `<dsk-markdown>`,
- `<dsk-editor>` (live, and editable where the widget edits),
- `DskEmbed.renderBlocks()` over HTML already in the page,
- markdown inside the components themselves (e.g. OpenAPI descriptions).

## Built-in blocks

| Language | Becomes | Loads |
|---|---|---|
| `mermaid` | SVG diagram | diagrams |
| `plantuml` (`puml`), `dot` (`graphviz`), `d2`, `dbml`, `structurizr`, `wardley` | SVG diagram in that syntax | diagrams |
| `bpmn` | a BPMN 2.0 process, as laid out in its modeler | bpmn |
| `dmn` | the decision requirements diagram and each decision's table | bpmn |
| `drawio` | the first page of a draw.io file (plain or compressed) | drawio |
| `asyncapi` | an AsyncAPI 2.x / 3.0 reference | openapi |
| `openapi` | the live API widget: one request, several, or a whole document | openapi |
| `flow` | a process view, from JSON or Mermaid state/flowchart source | flow |
| `board` | a read-only whiteboard, from the board's JSON | board |
| `video` | the kit's video player | kit |
| `audio` | the kit's audio player or playlist | kit |

Each loads its plugin on the first block of its kind.

```` ```video ```` and ```` ```audio ```` take a URL (one per line for
alternatives or a playlist), JSON, or a little YAML — the syntax of
laravel-admin's media blocks:

````markdown
```video
src: /media/intro.mp4
poster: /media/intro.jpg
title: Product tour
aspectRatio: 16:9
maxWidth: 640
tracks:
  - src: /media/chapters.vtt
    kind: chapters
```

```audio
- src: /media/1.mp3
  title: Intro
- src: /media/2.mp3
  title: Outro
```
````

Video keys: `src` / `sources`, `poster`, `tracks`, `thumbnails`, `title`,
`aspectRatio`, `autoplay`, `muted`, `loop`, `maxWidth`. Audio: `src` /
`tracks`, `title`, `artist`, `waveform`, `peaks`, `loop`, `mini`, `maxWidth`.

A block player answers the element's methods through `blockEl.dskPlayer`
(`play()`, `seek()`, `playChapter()`, …), and its events bubble from the
block like an element's.

## Your own blocks

```js
DskEmbed.blocks.register('chart', (code, { language, index }) => {
  const values = code.split(',').map(Number)
  return { html: renderChartSvg(values) }   // markup you built, with user text escaped
})
```

The contract is the live-block contract of the kit's UidMarkdown and of the
WYSIWYG editor. A renderer takes the block's source and returns — directly or
as a promise — one of:

| Result | |
|---|---|
| `{ html }` | Markup to insert in place of the block. Inserted as is: build it yourself and escape every piece of user text. |
| `{ mount(el, ctx) }` | A live widget: mount it into `el`. Return `{ update(code), destroy() }` or a cleanup function. |
| `{ error }` | The block cannot be rendered; it is shown as code with the message. |

`ctx` of `mount`:

| | |
|---|---|
| `code`, `language` | The source and the language. |
| `editable` | `true` inside `<dsk-editor>`: the widget may change its source. |
| `setCode(code)` | Writes a new source back (the editor updates its HTML). |

```js
DskEmbed.blocks.register('counter', () => ({
  mount(el, ctx) {
    const button = document.createElement('button')
    let n = Number(ctx.code) || 0
    const draw = () => (button.textContent = `Clicked ${n}`)
    button.onclick = () => { n++; draw(); if (ctx.editable) ctx.setCode(String(n)) }
    draw()
    el.append(button)
    return {
      update(code) { n = Number(code) || 0; draw() },
      destroy() { button.remove() },
    }
  },
}))
```

`register(language, rendererOrResult)` also takes a fixed result
(`{ html }` or `{ mount }`), and returns a function that unregisters it.
Registering a built-in language replaces the built-in renderer. Other calls:
`DskEmbed.blocks.unregister(language)`, `has(language)`, `list()`.

Register before the content renders — in a script right after the loader —
so the first render already knows the language.

## renderBlocks

HTML from a CMS, a database or a static site generator already has its code
blocks as `<pre><code class="language-…">`. One call makes them live:

```js
await DskEmbed.renderBlocks(document.querySelector('article'))  // → the number rendered
```

Or on the script tag, for the whole page once it is parsed:

```html
<script src="…/embed.js" data-render-blocks="article"></script>
```

- The language is read from `language-x` / `lang-x` on the `<code>` or the
  `<pre>`, or from `data-lang`.
- Only registered languages are touched; other code stays as it is.
  `renderBlocks(root, { languages: ['mermaid'] })` limits it further.
- **Idempotent**: a block is rendered once, however often you call it — call
  it again after inserting more HTML.
- A block that fails stays code; its `<pre>` gets `data-dsk-failed` and the
  reason in `title`, and is not retried.
- Code inside `<dsk-markdown>`, `<dsk-editor>` and `contenteditable` is left
  to them.
- `DskEmbed.unrenderBlocks(root)` destroys the widgets and puts the original
  `<pre>` back.

A rendered block is a `<div class="dsk-block dsk-block--<language>" data-dsk-block="<language>">`.
