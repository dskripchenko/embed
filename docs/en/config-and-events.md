# Configuration and events

## Configuration

```js
DskEmbed.configure({ theme: 'dark', locale: 'ru' })
DskEmbed.config  // { theme, resolvedTheme, locale, cdnBase, versions }
```

### Theme

| `theme` | |
|---|---|
| `null` (default) | Follow the page: its `<html data-theme>`, or the kit's light colours when the page sets none. |
| `'light'`, `'dark'` | Written to `<html data-theme>`. |
| `'system'` | `prefers-color-scheme`, followed live, written to `<html data-theme>`. |

The kit's themes key off `<html data-theme>`, so **the theme is page-wide**:
menus and dialogs the components open are attached to `<body>`, and a
per-element theme would not reach them. A page that toggles its own
`data-theme` is followed — no call needed:

```js
document.documentElement.dataset.theme = 'dark'   // every element follows
```

Without a theme and without the attribute, the kit's light tokens are
defined on `:root:not([data-theme])` — custom properties only (`--uid-*`),
nothing the page itself uses.

Colours are CSS custom properties. Override the kit's tokens on `:root` (or
`:root[data-theme='dark']`), e.g. `--uid-accent`; diagrams read `--dg-*`
(mapped onto the kit's tokens by default).

### Locale

`'en'` or `'ru'`. Default: the page's `<html lang>` (`ru…` → `ru`, anything
else → `en`), followed when the page changes it. `configure({ locale })`
fixes it; `configure({ locale: null })` returns to the page's. An element's
own `locale` attribute wins for that element.

The locale reaches the kit's components (player controls, dialogs, empty
states), the OpenAPI widgets, the flow views and the editor's toolbar.

### Runtime location

`cdnBase` and `versions` decide where the loader fetches the runtime from.
They are read once, before the import map is written: set them on the script
tag (`data-cdn-base`) or in `window.DskEmbedConfig` before the loader, not
through `configure()` later. See [self-hosting](getting-started.md#self-hosting).

## Events

Every event is a bubbling DOM `CustomEvent` named `dsk:<name>`, the payload
in `detail`. An element's events start at the element; `DskEmbed.emit`
without a target dispatches on `document`. Listen either way:

```js
// The bus: listens on document, hears every element.
const off = DskEmbed.on('node', (detail, event) => {
  console.log(detail.id, 'in', event.target.id)
})
off()

DskEmbed.once('ready', (detail, event) => { /* the first element rendered */ })

// Plain DOM, on any ancestor or the element itself.
document.querySelector('#process').addEventListener('dsk:node', (e) => console.log(e.detail))
```

`DskEmbed.emit(name, detail?, target?)` dispatches your own `dsk:<name>`
events on the same bus — a page can coordinate its own widgets with the
elements the same way.

| Event | From | `detail` |
|---|---|---|
| `dsk:ready` | every element | `{ tag }` |
| `dsk:error` | every element | `{ message, … }` |
| `dsk:config` | `document` | `{ theme, resolvedTheme, locale }` on every change |
| `dsk:play`, `dsk:pause`, `dsk:ended`, `dsk:timeupdate` | video, audio, media blocks | `{ currentTime, duration, src }` |
| `dsk:chapter`, `dsk:chapterchange` | video | `{ index, title, start, end }` (`chapterchange`: or `null`) |
| `dsk:trackchange` | audio | `{ index }` |
| `dsk:qualitychange`, `dsk:audiotrackchange` | video | `{ label }` |
| `dsk:render` | diagram | `{ type, width, height }` |
| `dsk:loaded`, `dsk:active` | openapi | `{ id, title }`, `{ id }` |
| `dsk:change` | openapi (block), flow (editor), editor | `{ source }`, `{ graph, description, source }`, `{ value }` |
| `dsk:node` | flow, flow blocks | `{ id, path, node, data }` |
| `dsk:select`, `dsk:navigate` | flow | `{ kind, id, path, element }`, `{ path }` |
| `dsk:toggle`, `dsk:toggle-error` | flow | the change with `ok` (and `rolledBack` when refused); `{ change, message }` |
| `dsk:poll-error`, `dsk:load`, `dsk:validate` | flow | `{ message }`, `{ nodes, edges }`, `{ issues }` |
| `dsk:input`, `dsk:editor-ready` | editor | `{ value }`, `{ controller }` |
| `dsk:embed-ready` | `document` | `{ version, mode }` — the API is defined |

## Cooperation

The elements know nothing about each other; the page wires them with events
and methods. Two recipes.

### A process step opens its API operation

A flow node carries its operation in `data` (shown in the node's details
too):

```json
{ "id": "pay", "type": "task", "label": "Pay", "data": { "operation": "payOrder" } }
```

Declaratively — `openapi-target` scrolls a reference to the operation:

```html
<dsk-flow src="/process.json" openapi-target="#api"></dsk-flow>
<dsk-openapi id="api" src="/openapi.yaml"></dsk-openapi>
```

Or with the bus — here an operation card next to the process switches:

```html
<dsk-flow src="/process.json" details="false"></dsk-flow>
<dsk-openapi id="card" src="/openapi.yaml" operation="createOrder"></dsk-openapi>
<script>
  DskEmbed.on('node', ({ data }) => {
    if (data.operation) document.querySelector('#card').operation = data.operation
  })
</script>
```

### A process step plays its part of a video

```json
{ "id": "pay", "type": "task", "label": "Pay", "data": { "chapter": "Payment" } }
```

```html
<dsk-flow src="/process.json" media-target="#tour"></dsk-flow>
<dsk-video id="tour" src="/tour.mp4">
  <track kind="chapters" src="/tour.chapters.vtt" default>
</dsk-video>
```

`data.chapter` is a chapter's title (or a part of it) or index;
`data.time` is a position in seconds. By hand:

```js
DskEmbed.on('node', ({ data }) => {
  const video = document.querySelector('#tour')
  if (data.chapter !== undefined) video.playChapter(data.chapter)
  else if (data.time !== undefined) video.seek(data.time).then(() => video.play())
})
```

The other way round — the process follows the video:

```js
document.querySelector('#tour').addEventListener('dsk:chapter', (e) => {
  document.querySelector('dsk-flow').select(STEP_OF_CHAPTER[e.detail.title])
})
```
