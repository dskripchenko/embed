# Elements

Common to all elements:

- **Light DOM.** An element renders into a `<div data-dsk-root>` inside
  itself; the kit's stylesheets and the page's CSS apply. Data children
  (`<script type="text/…">`, `<template>`, `<source>`, `<track>`) stay and
  are never shown; other content is read and removed.
- **Text content.** For a source with markup in it (`<`, `&`), wrap it in a
  data script — the browser neither parses nor shows it, and indentation is
  removed for you:

  ```html
  <dsk-markdown>
    <script type="text/markdown">
      # Title — `a < b` stays as written
    </script>
  </dsk-markdown>
  ```

  A `<template>` child gives its markup (the editor's initial HTML); plain
  text content works for short sources without markup.
- **Attributes and properties.** Every attribute has a camelCase property
  (`poll-url` → `pollUrl`). A property set from script wins over the
  attribute; setting it to `undefined` gives the attribute back. Changes
  re-render in place. Boolean attributes: present is `true`; `"false"`,
  `"0"`, `"off"`, `"no"` are `false`; absent leaves the component's default.
  Lists take `a, b, c` or a JSON array; JSON attributes take JSON.
- **`source`** — the text source as a property: read it, or set a new one.
  **`refresh()`** reads the data children again.
- **`ready`** — a promise, resolved once the element has rendered. Methods
  called before that wait for it (they return a promise).
- **`locale`** — `en` or `ru` for this element only; default: the global
  locale ([configuration](config-and-events.md)).
- **`loading="lazy"`** — load and render only when the element comes near
  the viewport.
- **`data-dsk`** — every element marks itself with it when it connects;
  the embed's base styles select elements by it.
- **State** — `data-dsk-state` is `loading`, `ready` or `error`; style
  placeholders with it. While loading, the element reserves a box of a
  plausible size.
- **Events** — bubbling `CustomEvent`s named `dsk:<name>` with the payload
  in `detail`; every element emits `dsk:ready`, and `dsk:error` with
  `{ message }` when it cannot render. See [events](config-and-events.md#events).

## Full screen

`<dsk-diagram>`, `<dsk-flow>`, `<dsk-board>` and `<dsk-openapi>` show a
full-screen button on hover (always on touch screens). The element goes full
screen with the Fullscreen API — or, where that is not available (plain
elements in iOS Safari), fills the window over the page. Escape or the button
leaves it; a flow and a board fit their content to the new size. Players have
their own full screen.

- `fullscreen="false"` — no button.
- Methods `enterFullscreen()`, `exitFullscreen()`; getter `fullscreen`.
- Event `dsk:fullscreen` `{ active }`.

## `<dsk-video>`

```html
<dsk-video poster="/media/intro.jpg" label="Product tour" aspect-ratio="16:9">
  <source src="/media/intro.webm" type="video/webm" data-label="720p">
  <source src="/media/intro.mp4" type="video/mp4">
  <source src="/media/hls/master.m3u8">
  <track kind="chapters" src="/media/chapters.vtt" srclang="en" default>
  <track kind="subtitles" src="/media/en.vtt" srclang="en" label="English">
</dsk-video>
```

Sources come from `<source>` children (`data-label` names a quality in the
menu), the `sources` JSON attribute, or `src`. An `.m3u8` address is played
through the kit's own HLS adapter (`@dskripchenko/ui/hls`), fetched on first
use. Tracks: `<track>` children or the `tracks` JSON attribute; `kind` is
`subtitles`, `captions` or `chapters`.

| Attribute | Property | |
|---|---|---|
| `src` | `src` | One source. |
| `sources` | `sources` | JSON: `[{ "src", "type"?, "label"? }]`. Wins over `<source>` children. |
| `tracks` | `tracks` | JSON: `[{ "src", "kind"?, "srclang"?, "label"?, "default"? }]`. Wins over `<track>` children. |
| `poster` | `poster` | Image shown before playing. |
| `thumbnails` | `thumbnails` | WebVTT with sprite thumbnails (`sprite.jpg#xywh=…`) over the scrub bar. |
| `label` | `label` | The player's accessible name. (Not `title`: that would be the browser's tooltip over the whole player.) |
| `aspect-ratio` | `aspectRatio` | `16:9`, `4/3` or a number — the box before the video size is known. |
| `autoplay`, `muted`, `loop` | same | Booleans. Autoplay starts muted (browsers block sound). |
| `controls` | `controls` | `controls="false"` hides the kit's controls. |
| `preload` | `preload` | `none`, `metadata`, `auto`. |
| `crossorigin` | `crossorigin` | `anonymous` or `use-credentials`. |
| `exclusive` | `exclusive` | Starting this player pauses the other exclusive players. |
| `resume-key` | `resumeKey` | Remembers the position in localStorage under this key. |
| `rates` | `rates` | Playback rates, e.g. `0.5, 1, 1.5, 2`. |
| `hotkeys` | `hotkeys` | Keyboard shortcuts. |
| `auto-hide` | `autoHide` | Milliseconds before the controls hide while playing. |
| `hls-options` | `hlsOptions` | JSON options of the HLS adapter. |

Methods: `play()`, `pause()`, `toggle()`, `seek(seconds)`,
`playChapter(indexOrTitle)` (seeks to a chapter of the chapters track — by
index, exact title, or a part of it — and plays), `loadChapters()` (resolves
once the kit has read the chapters track).
Getters: `state` (playing, currentTime, duration, volume, …), `media` (the
`<video>`), `chapters` (`[{ index, title, start, end }]`, as the kit read
them from the chapters track).

Events: `dsk:play`, `dsk:pause`, `dsk:ended`, `dsk:timeupdate` — detail
`{ currentTime, duration, src }`; `dsk:chapter` — the chapter
`playChapter()` played; `dsk:chapterchange` — `{ index, title, start, end }`
(or `null`) whenever playback enters another chapter;
`dsk:qualitychange` `{ label }`, `dsk:audiotrackchange` `{ label }`,
`dsk:error` — the kit's error `{ kind, detail? }`.

## `<dsk-audio>`

```html
<dsk-audio waveform show-playlist>
  <source src="/a/1.mp3" data-title="Intro" data-artist="Ann">
  <source src="/a/2.mp3" data-title="Outro" data-artist="Ann" data-duration="185">
</dsk-audio>

<dsk-audio src="/a/note.mp3" track-title="Voice note" variant="mini"></dsk-audio>
```

One `<source>` (or `src`) is one track; several make a playlist with
next/previous, a track list and auto-advance. Children take `data-title`,
`data-artist`, `data-duration` (seconds, shown before metadata loads) and
`data-peaks` (precomputed waveform, comma-separated 0…1).

| Attribute | Property | |
|---|---|---|
| `src`, `type` | same | One track. |
| `tracks` | `tracks` | JSON: `[{ "src", "title"?, "artist"?, "duration"?, "peaks"? }]`. |
| `track-title`, `artist` | `trackTitle`, `artist` | For a single track. |
| `variant` | `variant` | `default` or `mini` (a compact inline player). |
| `waveform` | `waveform` | Draw the waveform as the scrub bar (decoded in the browser). |
| `peaks` | `peaks` | Precomputed peaks; implies the waveform without decoding. |
| `waveform-max-bytes`, `waveform-max-duration` | camelCase | Limits for decoding. |
| `auto-advance`, `loop` | same | Playlist behaviour; `loop` repeats the track or the list. |
| `show-volume`, `show-rate`, `show-playlist` | camelCase | Controls shown. |
| `index` | `index` | The current playlist track. |
| `preload`, `crossorigin`, `exclusive`, `resume-key`, `rates`, `hotkeys`, `hls-options` | | As on `<dsk-video>`. |

Methods: `play()`, `pause()`, `toggle()`, `seek(seconds)`, `next()`,
`prev()`. Getters: `state`, `media`. Events: as `<dsk-video>`, plus
`dsk:trackchange` `{ index }`.

## `<dsk-diagram>`

```html
<dsk-diagram label="Checkout">
  sequenceDiagram
    Shop->>Payments: charge
    Payments-->>Shop: ok
</dsk-diagram>

<dsk-diagram src="/docs/architecture.mmd"></dsk-diagram>
```

Mermaid source — flowchart, sequence, state, class, ER, C4, gantt, pie,
timeline, xychart, mindmap — rendered to SVG by `@dskripchenko/diagrams`. No
Vue is loaded for a diagram. Colours follow the theme (the embed maps the
diagram's `--dg-*` custom properties onto the kit's tokens; override any of
them in your CSS).

| Attribute | Property | |
|---|---|---|
| `src` | `src` | Fetch the source from a URL instead of the content. |
| `label` | `label` | The SVG's accessible title. |
| `syntax` | `syntax` | `mermaid`, `plantuml`, `dot`, `d2`, `dbml`, `structurizr` or `wardley`; recognised from the source when omitted. |

Getter: `svg` (the `<svg>` element). Events: `dsk:render` `{ type, width, height }`;
`dsk:error` `{ message, line, column, hint }` — the element also shows the
message, with the position, in place of the diagram.

Besides Mermaid, the element reads PlantUML (`@startuml`), Graphviz DOT,
D2, DBML, Structurizr DSL and Wardley maps; the syntax is recognised from the
source, or named with `syntax`.

## `<dsk-openapi>`

Four modes.

**Reference** (default) — the whole reference: navigation, search,
operations with try-it, request samples in 13 languages, TypeScript types,
downloads.

```html
<dsk-openapi src="/openapi.yaml" height="720"></dsk-openapi>

<dsk-openapi specs='[
  {"id": "v2", "name": "API v2", "src": "/openapi/v2.json"},
  {"id": "v1", "name": "API v1", "src": "/openapi/v1.json"}
]'></dsk-openapi>
```

**Operation** — one operation as a card; set by `operation` (an
`operationId`, `METHOD /path`, or an anchor):

```html
<dsk-openapi src="/openapi.yaml" operation="createOrder" reference-url="/docs/api"></dsk-openapi>
```

**Block** — `mode="block"`: the YAML/JSON of an API block (one request,
several, or a whole document; the [format](https://github.com/dskripchenko/openapi/blob/main/docs/en/blocks.md))
as the live widget; `editable` adds the Source and Constructor tabs.

```html
<dsk-openapi mode="block" editable>
  <script type="text/yaml">
    method: POST
    url: https://api.example.com/v1/orders
    body:
      example: { sku: TEE-M, quantity: 2 }
  </script>
</dsk-openapi>
```

**Editor** — `mode="editor"`: the whole spec in the visual editor — a tree
of the document (info, servers, tags, security, paths and operations,
schemas) and a form for the chosen part, with Source and Preview views.
Edits come out as `dsk:change` `{ source }`, in the format of the text.

```html
<dsk-openapi mode="editor" height="640" view="visual">
  <script type="text/yaml">openapi: 3.1.0 …</script>
</dsk-openapi>
```

The spec comes from `src`, `specs`, the `spec` property (text or an object),
or the content. Specs of the same URL are fetched once per page.

| Attribute | Property | |
|---|---|---|
| `mode` | `mode` | `reference`, `operation`, `block`, `editor`. Default: `operation` when `operation` is set, else `reference`. |
| `view` | `view` | Editor mode: the view to open with — `visual` (default), `source`, `preview`. |
| `src` | `src` | The spec's URL (YAML or JSON). |
| `specs` | `specs` | JSON: `[{ "id", "name"?, "src" \| "content" }]` — several specs with a switcher. |
| — | `spec` | The spec as text or an object (script only). |
| `active` | `active` | The open spec of `specs`. |
| `operation` | `operation` | Operation mode: the operation to show. |
| `reference-url`, `spec-id` | camelCase | Operation mode: "Open in reference" link and the spec's id there. |
| `try-it` | `tryIt` | `try-it="false"` hides try-it (samples stay). |
| `proxy` | `proxy` | An endpoint that performs try-it requests for the page — [openapi's proxy contract](https://github.com/dskripchenko/openapi/blob/main/docs/en/standalone.md#the-proxy) (the request as JSON in, the response as JSON out; Laravel's `csrf-token` meta is sent along). For APIs that do not allow the page's origin. |
| `base-url` | `baseUrl` | Base for relative server URLs. |
| `snippet-targets`, `default-snippet` | camelCase | Languages of request samples (`curl, js, python, …`) and the first one. |
| `persist-credentials` | `persistCredentials` | `true`/`session`/`local`: keep API keys between visits. |
| `hash-navigation` | `hashNavigation` | `false`: do not write `location.hash`. |
| `heading` | `heading` | The reference header's title. |
| `editable` | `editable` | Block mode: editing tabs. |
| `height` | `height` | A fixed height with its own scroll (`720`, `80vh`); or the CSS variable `--dsk-openapi-height` (per breakpoint). The reference's sticky navigation then fills the box (`--oa-viewport-h` is set to the same height). |
| — | `send` | `(request) => Promise<response>` — send try-it your own way; wins over `proxy`. |
| — | `labels` | Overrides of interface strings. |

Methods: `go(target, { tryIt? })` — scroll to an operation (`createOrder`,
`operation/createOrder`), a schema (`schema/Order`) or a tag; `open(id)` —
switch to a spec of `specs`; `print()`. Getters: `loaded` (the loaded
spec), `value` (block and editor modes: the current text).

Events: `dsk:loaded` `{ id, title }`, `dsk:error` `{ id, message }`,
`dsk:active` `{ id }` (spec switched), `dsk:change` `{ source }` (block
and editor modes, after an edit).

## `<dsk-flow>`

A process model — JSON (the [model](https://github.com/dskripchenko/flow/blob/main/docs/en/model.md)),
or Mermaid `stateDiagram-v2` / `flowchart` source — as an interactive view:
pan, zoom, minimap, sub-processes, details, live monitoring, toggles. With
`editable`, the editor.

```html
<dsk-flow src="/processes/order.json"
          poll-url="/processes/order/state" poll-interval="5000"
          toggle-url="/processes/order/toggle"
          subgraph-url="/processes/{ref}"
          height="480"></dsk-flow>

<dsk-flow>
  <script type="text/plain">
    stateDiagram-v2
      [*] --> Draft
      Draft --> Review: submit
      Review --> [*]: approve
  </script>
</dsk-flow>
```

**HTTP conventions** — a backend serves these, no script needed on the page:

| Attribute | Request | |
|---|---|---|
| `src` | `GET` → the model (JSON) | |
| `poll-url` | `GET` → a monitoring snapshot, every `poll-interval` ms (5000) | Inside a sub-process the query carries `path` (node ids from the root, comma-separated) and `ref` (the sub-process reference). A non-2xx answer shows an error and backs off. The [snapshot format](https://github.com/dskripchenko/flow/blob/main/docs/en/integration.md#monitoring-snapshot). |
| `toggle-url` | `POST` JSON `{ kind, id, enabled, path }` when a node or an edge is switched | Makes the view toggleable. A non-2xx answer rolls the switch back and shows the error. |
| `subgraph-url` | `GET` → the model of a referenced sub-process | `{ref}` in the URL is replaced by the reference (`/processes/{ref}`); without it `?ref=` is appended. |

Requests are same-origin `fetch` with the page's cookies
(`credentials: 'same-origin'`).

| Attribute | Property | |
|---|---|---|
| `src` | `src` | The model's URL. |
| — | `graph` | The model as an object (script only); wins over `src` and content. Reading it gives the current model (with the editor's edits). |
| `state` | `state` | JSON: a first snapshot (e.g. rendered by the server); polling replaces it. |
| `poll-url`, `poll-interval` | camelCase | Monitoring, as above. |
| `toggle-url` | `toggleUrl` | Toggles, as above. |
| — | `persistToggle` | `(change) => Promise` — persist toggles yourself instead (script only); reject to roll back. |
| `subgraph-url` | `subgraphUrl` | Sub-processes, as above. |
| — | `loadSubgraph` | `(ref, node) => Promise<model>` — load them yourself (script only). |
| `editable` | `editable` | The editor (palette, connect, undo/redo, properties, Mermaid import). |
| `readonly` | `readonly` | Editor: read-only. |
| `palette` | `palette` | Editor: node types in the palette, `task, decision, …`. |
| `name` | `name` | Editor: keeps a hidden `<input name>` with the model's JSON inside the element — a plain form submits it. |
| `direction` | `direction` | `TB` or `LR`; by default the model's `meta.direction`, else chosen by the box's shape (a tall box lays out top to bottom). |
| `edge-style` | `edgeStyle` | `orthogonal` or `smooth`. |
| `wheel` | `wheel` | `zoom` or `pan`. |
| `minimap`, `controls`, `details`, `status-bar` | camelCase | Parts of the view; `details="false"` turns off the details drawer a click opens. |
| `height` | `height` | Default 480 (600 for the editor); or the CSS variable `--dsk-flow-height`. |
| `openapi-target` | `openapiTarget` | A selector of a `<dsk-openapi>`: a clicked node's `data.operation` opens there. |
| `media-target` | `mediaTarget` | A selector of a `<dsk-video>`/`<dsk-audio>`: a clicked node's `data.chapter` (title or index) or `data.time` (seconds) plays there. |
| — | `labels`, `registry` | Interface strings; custom node types (script only). |

Methods: `fit()`, `select(id)`, `enter(nodeId)`, `back()`, `refresh()`
(poll now), `undo()`, `redo()` (editor). Getters: `graph`, `stack` (the
sub-process levels entered).

Events: `dsk:node` `{ id, path, node, data }` — a node was clicked;
`dsk:select` `{ kind, id, path, element }` or `null`; `dsk:toggle`
`{ kind, id, enabled, path, ok, rolledBack? }` — after the toggle was
persisted (`ok: true`) or refused (`ok: false`, rolled back);
`dsk:toggle-error` `{ change, message }`;
`dsk:navigate` `{ path }`; `dsk:poll-error` `{ message }`; `dsk:load`
`{ nodes, edges }`; editor: `dsk:change` `{ graph, description, source }`,
`dsk:validate` `{ issues }`.

## `<dsk-board>`

An infinite whiteboard ([`@dskripchenko/board`](https://github.com/dskripchenko/board)):
shapes, sticky notes, frames, titles and text, connectors, emoji, pen and
marker. A read-only view by default; `editable` turns on the editor;
`board-url` makes it a shared board several people edit at once.

```html
<!-- A board from a file, read-only -->
<dsk-board src="/boards/retro.json" height="560"></dsk-board>

<!-- An editor in a form: the board's JSON goes in a hidden input -->
<form method="post">
  <dsk-board editable name="board"></dsk-board>
</form>

<!-- A shared board: real-time editing through the server -->
<dsk-board board-url="/api/boards/42" user-name="Anna" user-color="#ec4899"></dsk-board>
```

**The shared board** talks to `board-url` by
[the HTTP contract of the board](https://github.com/dskripchenko/board/blob/main/docs/en/collaboration.md#the-http-contract):
`GET {base}/snapshot`, `POST {base}/batches`, `GET {base}/batches?after=N&wait=S`
(long polling), `POST {base}/presence`. The package's `BoardServer` is the
reference server logic. Requests carry the page's cookies.

| Attribute | Property | |
|---|---|---|
| `src` | `src` | The board's URL (JSON). The element's text (JSON in a `<script type="application/json">`) works too. |
| — | `board` | The board as an object (script only); wins over `src` and content. |
| `board-url` | `boardUrl` | The shared board's base URL: collaboration. |
| `poll-interval` | `pollInterval` | Shared board: ask for changes every N ms (at least 250) instead of long polling — for servers that cannot hold a request open. |
| — | `provider` | Any other transport (script only): a `BoardProvider` — a WebSocket, a `MemoryHub`. |
| `editable` | `editable` | The editor (for a board from `src` or content). |
| `readonly` | `readonly` | Shared board: view only. |
| `lockable` | `lockable` | May lock and unlock the board for everyone (default `true`); set `false` for people who must not. |
| `user-name`, `user-color`, `user-id` | camelCase | Who edits: shown to the others on a shared board. |
| `name` | `name` | Keeps a hidden `<input name>` with the board's JSON inside the element — a plain form submits it. |
| `minimap` | `minimap` | The minimap (default on). |
| `height` | `height` | Default 560; or the CSS variable `--dsk-board-height`. |
| — | `labels` | Interface strings (script only). |

Methods: `fit()`, `select(ids)`, `toPng()` (a `Blob`), `toSvg()`
(`{ svg, width, height }`), `undo()`, `redo()`. Getter: `value` (the board).

Events: `dsk:change` `{ board, ops, origin }`; `dsk:select` `{ ids }`;
`dsk:load` `{ objects }`.

## `<dsk-bpmn>` and `<dsk-dmn>`

```html
<dsk-bpmn src="/processes/order.bpmn" highlight="Task_Check"></dsk-bpmn>
<dsk-bpmn src="/processes/order.bpmn" editable properties name="process"></dsk-bpmn>
<dsk-dmn src="/decisions/loan.dmn" decision="Decision_Risk"></dsk-dmn>
```

BPMN 2.0 processes and DMN decisions through `@dskripchenko/bpmn`, drawn as
the modeler that saved them laid them out (Camunda Modeler, bpmn.io and
others). A view pans, zooms and reports clicks; `editable` makes it the
editor — palette, context pad, properties panel, undo — and `name` puts the
edited XML in a hidden input for a form. A `<dsk-dmn>` opens a decision's
table on a double-click, or at once with `decision`.

| Attribute | Property | |
|---|---|---|
| `src` | `src` | Fetch the file from a URL instead of the content. |
| `editable` | `editable` | The editor instead of the view. |
| `properties` | `properties` | (`dsk-bpmn`, editor) The properties panel open from the start. |
| `diagram` | `diagram` | (`dsk-bpmn`) Which diagram of the file. |
| `decision` | `decision` | (`dsk-dmn`) Open this decision's logic. |
| `highlight` | `highlight` | Element ids to outline, comma-separated. |
| `height` | `height` | Height; `--dsk-bpmn-height` / `--dsk-dmn-height` in CSS. |
| `name` | `name` | A hidden input with the XML, for a form. |

Methods: `fit()`, `undo()`, `redo()`, `toSvg()`, `open(decision)` (DMN).
Getter: `value` (the XML). Events: `dsk:change` `{ xml }`, `dsk:select`
`{ ids }`, `dsk:element` `{ id }` (a click), `dsk:open` `{ decision }` (DMN),
`dsk:error` `{ message }`.

## `<dsk-drawio>`

```html
<dsk-drawio src="/docs/architecture.drawio" page="Overview"></dsk-drawio>
```

draw.io (diagrams.net) files through `@dskripchenko/drawio`: compressed or
plain pages and `.drawio.svg`. A file with several pages gets page tabs. No
Vue is loaded. Labels are read as text, never as markup; shapes of vendor
libraries become labelled placeholders, and images on the web are not loaded
unless `external-images` allows them.

| Attribute | Property | |
|---|---|---|
| `src` | `src` | Fetch the file from a URL instead of the content. |
| `page` | `page` | The page shown first: its index, id or name. |
| `label` | `label` | The SVG's accessible title. |
| `external-images` | `externalImages` | Load images from http(s) addresses. |

Method: `showPage(page)`. Getters: `svg`, `pages` (names), `page` (index).
Events: `dsk:render` `{ page, pages, width, height, warnings }`, `dsk:error`.

## `<dsk-asyncapi>`

```html
<dsk-asyncapi src="/api/events.yaml"></dsk-asyncapi>
```

An AsyncAPI 2.x or 3.0 document of an event-driven API as a reference:
servers, operations (send / receive) with their channels, messages,
schemas, examples and replies. The `spec` property takes a parsed object.

| Attribute | Property | |
|---|---|---|
| `src` | `src` | Fetch the document from a URL instead of the content. |
| `height` | `height` | Height of a scrolling box; the page's height by default. |

Getter: `loaded`. Events: `dsk:load`, `dsk:error` `{ message }`.

## `<dsk-kanban>`

```html
<dsk-kanban editable lockable name="plan">
  <script type="text/plain">
    # Release 3.0
    lanes: Payments, Refunds
    tags: payments=info, refunds=warning

    ## Backlog
    - Instant payments #payments {lane: Payments, who: Anna, due: 2026-11-15}
    - Partial refunds over the API #refunds !high {lane: Refunds}
      Merchants ask to refund part of an amount without a call.

    ## In progress {wip: 3}
    - [ACME-398](https://jira.example.com/browse/ACME-398) Antifraud v2 {who: Oleg}

    ## Done {done}
    - Signed webhooks #payments
  </script>
</dsk-kanban>
```

A board of columns and cards written as markup and drawn with the kit's
`UidBoard`. The markup reads like markdown:

- `# …` — the board's title; `key: value` lines before the first column —
  settings: `lanes` (swimlanes, in order), `tags` (a tone per tag:
  `info`, `success`, `warning`, `danger`).
- `## Column {wip: 3, done}` — a column; `wip` is a work-in-progress limit
  (the counter turns red above it), `done` marks the column of finished
  cards (struck through, never overdue).
- `- Card title #tag !high {lane: …, who: …, due: YYYY-MM-DD, any: value}` — a
  card. The title takes inline markdown (links, code, bold); `!high` /
  `!low` — priority; properties in braces; lines indented under it — the
  card's description in markdown. `<!-- comments -->` are kept.

A click on a card opens its details. With `editable`, cards are dragged
between columns and lanes, `+` in a column adds a card, the panel edits or
deletes one, and the **Source** tab edits the markup itself with problems by
line. Every change rewrites only the lines it touches — comments, blank
lines and the rest of the text stay as they were — and is sent as
`dsk:change` with the whole new source. Filters by tag and by person are
above the board.

`locked` makes the board read-only for everyone; `lockable` shows the lock
button, which sends `dsk:lock` `{ locked }`: the host saves it (as an
attribute or wherever it keeps the source), as it saves the source on
`dsk:change`.

| Attribute | Property | |
|---|---|---|
| `src` | `src` | Fetch the markup from a URL instead of the content. |
| `editable` | `editable` | Drag and drop, new and changed cards, the source tab. |
| `locked` | `locked` | Read-only, whatever `editable` says. |
| `lockable` | `lockable` | Show the lock button. |
| `name` | `name` | A hidden input with the markup, for a form. |

Getters: `value` (the markup), `board` (the parsed board). Events:
`dsk:change` `{ source }`, `dsk:lock` `{ locked }`, `dsk:open` `{ card }`,
`dsk:load` `{ problems }`, `dsk:error` `{ message }`.

## `<dsk-calendar>`

```html
<dsk-calendar view="month" editable lockable name="events">
  <script type="text/plain">
    # Releases and duty
    tags: release=danger

    2026-11-03 10:00-11:00 Release demo #release {where: Room 4}
    2026-11-10..2026-11-14 Code freeze #release
    every mon 11:00-11:30 Sprint planning {from: 2026-11-02, until: 2026-12-28, except: 2026-11-30}
    every 2 weeks fri 16:00-17:00 Retro {from: 2026-11-06}
    every month last fri Release to production #release
    every year 12-31 New year freeze
  </script>
</dsk-calendar>
```

Events written as markup in the kit's `UidCalendar`: day, week, month, year
and agenda. Settings (`key: value`) come first — `view` (the view shown
first), `date` (the date shown first), `tags` (a tone per tag) — then one
event per line:

- **When**: a date `2026-11-03` or a range `2026-11-10..2026-11-14`, then
  an optional time `10:00` or `10:00-11:00` (none — all day).
- **What**: the title (inline markdown), `#tags` (the first gives the
  colour), `{properties}` — `where`, `who`, `url`, `description` or your own.
- **Repeats** start with `every` instead of a date — an RFC 5545 RRULE subset
  in words:

  | Line | Repeats |
  |---|---|
  | `every day`, `every 3 days` | every (third) day |
  | `every mon,wed`, `every 2 weeks fri` | on those weekdays, every (other) week |
  | `every month 15`, `every month last` | on that day of the month, on its last day |
  | `every month 2nd tue`, `every month last fri` | on the n-th / last weekday |
  | `every year 12-31` | every year on that date |

  Bounds and exceptions go in the properties: `from` (the first date;
  needed for `count` and for "every N"), `until`, `count`, `except` (dates,
  comma-separated). `{rrule: FREQ=WEEKLY;BYDAY=MO,WE;INTERVAL=2}` takes a
  rule as it is, for one copied from iCal. Repeats are expanded only for the
  days on screen.

With `editable`: drag an event to another day or hour, stretch it in the day
and week views, click an empty slot (or a day in the month, or **+ Event**)
for a new event. The **event builder** puts an event together from choices —
date or range, all day or a time, the repeat ("every 2 weeks on Mon and
Wed", "the last Friday of every month", until a date / N times), skipped
dates — and shows the line it writes. Editing one occurrence of a repeat asks
whether to change that one or the whole series: that one becomes an event of
its own and the series skips its date (dragging an occurrence does the
same). The **Source** tab edits the markup with problems by line. Every
change rewrites one line (two for a detached occurrence) and is sent as
`dsk:change` with the whole new source. `locked` and `lockable` work as in
`<dsk-kanban>`.

| Attribute | Property | |
|---|---|---|
| `src` | `src` | Fetch the markup from a URL instead of the content. |
| `view` | `view` | `day`, `week`, `month`, `year` or `agenda` — the view shown first. |
| `date` | `date` | The date shown first (`YYYY-MM-DD`); today by default. |
| `views` | `views` | The views offered, comma-separated; all five by default. |
| `editable` | `editable` | Drag, resize, the event builder, the source tab. |
| `locked` | `locked` | Read-only, whatever `editable` says. |
| `lockable` | `lockable` | Show the lock button. |
| `name` | `name` | A hidden input with the markup, for a form. |

Getter: `value` (the markup). Events: `dsk:change` `{ source }`, `dsk:lock`
`{ locked }`, `dsk:open` `{ event }`, `dsk:range` `{ view, start, end }`
(the days on screen), `dsk:load` `{ problems }`, `dsk:error` `{ message }`.

## `<dsk-markdown>`

```html
<dsk-markdown toc>
  <script type="text/markdown">
    ## Paying an order

    ```mermaid
    sequenceDiagram
      Shop->>Payments: charge
    ```

    ```openapi
    method: POST
    url: https://api.example.com/v1/orders/{id}/pay
    ```
  </script>
</dsk-markdown>

<dsk-markdown src="/docs/guide.md" link-base="/docs/"></dsk-markdown>
```

Markdown through the kit's UidMarkdown — tables, callouts, code
highlighting — with **every registered block renderer**: ```` ```mermaid ````,
```` ```openapi ````, ```` ```flow ````, ```` ```video ````, ```` ```audio ````
and the page's own ([blocks](blocks.md)).

| Attribute | Property | |
|---|---|---|
| `src` | `src` | Fetch the markdown from a URL. |
| `toc`, `toc-depth` | camelCase | A table of contents (headings 2…`toc-depth`). |
| `link-base`, `image-base` | camelCase | Bases for relative links and images. |

Getter: `value` (the markdown shown). Events: `dsk:error` when `src` fails.

## `<dsk-editor>`

```html
<form method="post" action="/posts">
  <dsk-editor name="body" placeholder="Write…" min-height="240px">
    <template>
      <p>Initial <strong>HTML</strong>.</p>
      <pre><code class="language-openapi">method: GET
url: /v1/orders</code></pre>
    </template>
  </dsk-editor>
  <button>Save</button>
</form>
```

The WYSIWYG editor (`@dskripchenko/wysiwyg`) — toolbar (in the element's
locale), markdown shortcuts,
slash menu, tables, source mode — with **every registered block renderer
live**: a code block of a registered language shows its widget, and a widget
that edits (the API block's constructor) writes its source back into the
HTML. The value is HTML; code blocks are stored as
`<pre><code class="language-…">`, so the saved HTML becomes live on any
page with [`renderBlocks()`](blocks.md#renderblocks).

The initial value: the `value` attribute, else a `<template>` child, else the
bound input's value.

| Attribute | Property | |
|---|---|---|
| `value` | `value` | The HTML. Reading the property gives the current content; setting it replaces the content. |
| `name` | `name` | Keeps a hidden `<input name>` inside the element in sync — a plain form submits it. |
| `input` | `input` | A selector of an existing `<input>`/`<textarea>` to keep in sync (and to read the initial value from). |
| `placeholder` | `placeholder` | |
| `readonly` | `readonly` | |
| `toolbar` | `toolbar` | `toolbar="false"` hides the toolbar. |
| `min-height`, `max-height` | camelCase | CSS lengths. |
| `resizable` | `resizable` | The resize handle. |

Methods: `focus()`. Getters: `value`, `controller` (the editor's command
API: `controller.chain().focus().bold().run()`).

Events — like a form control:

- `input` (a plain `Event`) after every change, and `dsk:input` `{ value }`;
- `change` when the editor loses focus with a changed value, and `dsk:change` `{ value }`;
- `dsk:editor-ready` `{ controller }`.

The editor's own internal `input`/`change` events do not leave the element,
so `el.addEventListener('input', () => el.value)` always reads the HTML.
