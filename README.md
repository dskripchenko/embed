# @dskripchenko/embed

[![npm](https://img.shields.io/npm/v/@dskripchenko/embed.svg)](https://www.npmjs.com/package/@dskripchenko/embed)
[![license](https://img.shields.io/npm/l/@dskripchenko/embed.svg)](LICENSE)

Video and audio players, Mermaid diagrams, OpenAPI references, process flows,
live markdown and a WYSIWYG editor — as HTML tags on **any** page: plain HTML,
a CMS, WordPress, Blade, React. One script from a CDN. The elements share one
Vue and one UI kit, render each other's blocks, and talk through DOM events.

[**English**](docs/en/getting-started.md) · [Русский](docs/ru/getting-started.md) · [Deutsch](docs/de/getting-started.md) · [中文](docs/zh/getting-started.md)

```html
<head>
  <script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js"></script>
</head>
<body>
  <dsk-flow src="/process.json" poll-url="/process/state" openapi-target="#api" media-target="#tour"></dsk-flow>
  <dsk-video id="tour" src="/tour.mp4">
    <track kind="chapters" src="/tour.chapters.vtt" default>
  </dsk-video>
  <dsk-openapi id="api" src="/openapi.yaml" height="720"></dsk-openapi>

  <dsk-markdown>
    <script type="text/markdown">
      ```mermaid
      sequenceDiagram
        Shop->>Payments: charge
      ```
    </script>
  </dsk-markdown>

  <form method="post"><dsk-editor name="body"></dsk-editor></form>
</body>
```

Clicking a process step opens its API operation and plays its chapter of the
video; the markdown's diagram is live; the editor submits HTML with the form.

## Elements

| | | Built on |
|---|---|---|
| `<dsk-video>` | player: sources and quality menu, subtitles, chapters, thumbnails, HLS | [`@dskripchenko/ui`](https://github.com/dskripchenko/ui) |
| `<dsk-audio>` | player, playlist, waveform | `@dskripchenko/ui` |
| `<dsk-diagram>` | Mermaid, PlantUML, Graphviz DOT, D2, DBML, Structurizr, Wardley → SVG, no Vue loaded | [`@dskripchenko/diagrams`](https://github.com/dskripchenko/diagrams) |
| `<dsk-openapi>` | full reference (several specs), one operation, or a live API block | [`@dskripchenko/openapi`](https://github.com/dskripchenko/openapi) |
| `<dsk-flow>` | process view with monitoring, toggles and sub-processes over plain HTTP — or the editor | [`@dskripchenko/flow`](https://github.com/dskripchenko/flow) |
| `<dsk-asyncapi>` | AsyncAPI 2.x / 3.0 reference of an event-driven API | `@dskripchenko/openapi` |
| `<dsk-bpmn>`, `<dsk-dmn>` | BPMN processes and DMN decisions as laid out in the modeler — a view or the editor | [`@dskripchenko/bpmn`](https://github.com/dskripchenko/bpmn) |
| `<dsk-drawio>` | draw.io files to SVG, page tabs, no Vue loaded | [`@dskripchenko/drawio`](https://github.com/dskripchenko/drawio) |
| `<dsk-kanban>` | a kanban board written as markup: columns, lanes, tags, WIP limits; drag cards, edit them, a lock | `@dskripchenko/ui` |
| `<dsk-calendar>` | events written as markup, with repeats: day, week, month, year, agenda; drag, an event builder, a lock | `@dskripchenko/ui` |
| `<dsk-board>` | infinite whiteboard: shapes, stickies, frames, connectors, pen — a view, an editor, or a shared board edited in real time | [`@dskripchenko/board`](https://github.com/dskripchenko/board) |
| `<dsk-markdown>` | markdown with live blocks: diagrams in every syntax above, `bpmn`, `dmn`, `drawio`, `openapi`, `asyncapi`, `flow`, `board`, `kanban`, `calendar`, `video`, `audio` | `@dskripchenko/ui` |
| `<dsk-editor>` | WYSIWYG with the same live blocks; a form field | [`@dskripchenko/wysiwyg`](https://github.com/dskripchenko/wysiwyg) |

All of them: attributes ↔ properties, `dsk:*` events, `ready`, `loading="lazy"`,
light DOM (your CSS applies); diagrams, processes, flows, boards and references open full screen. → [Elements](docs/en/elements.md)

## Working together

- **One runtime.** The loader writes an import map pinning Vue, the kit and
  the plugin packages to the exact versions of the release; every element and
  live block renders in one Vue app context — one locale, one theme, one set
  of block renderers.
- **Blocks.** `DskEmbed.blocks.register('chart', renderer)` — the live-block
  contract of the kit and the editor — makes ```` ```chart ```` live in
  markdown, in the editor and in `DskEmbed.renderBlocks(root)`, which turns
  stored HTML (`<pre><code class="language-…">`) into widgets. → [Blocks](docs/en/blocks.md)
- **Configuration.** `DskEmbed.configure({ theme: 'light' | 'dark' | 'system', locale: 'en' | 'ru' })`,
  or just the page's `<html data-theme lang>`. → [Configuration and events](docs/en/config-and-events.md)
- **Events.** `DskEmbed.on('node', …)`, or `addEventListener('dsk:node', …)` on
  any ancestor; React and other hosts use refs and plain listeners. →
  [Frameworks](docs/en/frameworks.md)

## Loader or bundle

| | gzipped | |
|---|---|---|
| `dist/embed.js` — the loader | **9.1 KB** | Classic script; elements, API, import map. Everything else on demand. |
| `dist/embed.bundle.js` — the fat bundle | **563 KB** (2.0 MB) | Everything inside; no import map, no further requests. |
| `dist/bundles/<plugin>.js` — one plugin each | **91–227 KB** | Vue and the kit inside; several on a page share one runtime. → [Getting started](docs/en/getting-started.md#per-plugin-bundles) |

What the loader fetches on demand (gzip -9 of the published files; jsDelivr
serves Brotli, a little smaller):

| First element of… | Fetches | |
|---|---|---|
| any Vue element | Vue runtime 41.5 KB, `@dskripchenko/ui` 102.6 KB (its icons inside) + CSS 30.1 KB | once per page |
| `<dsk-video>` / `<dsk-audio>` | plugin 3.5 KB; the HLS adapter 14.6 KB only for `.m3u8` | |
| `<dsk-diagram>` | plugin 0.8 KB, `@dskripchenko/diagrams` 99.7 KB, kit tokens 2.4 KB | no Vue, no kit components |
| `<dsk-openapi>` | plugin 1.4 KB, `@dskripchenko/openapi` 180.5 KB + CSS 10.5 KB, icons 5.2 KB | |
| `<dsk-flow>` | plugin 2.5 KB, `@dskripchenko/flow` 79.9 KB + CSS 4.6 KB, icons 5.2 KB; the Mermaid import (2.4 KB + diagrams) only for Mermaid sources and the editor | |
| `<dsk-board>` | plugin 1.3 KB, `@dskripchenko/board` 46.4 KB (its icons inside) + CSS 1.9 KB | |
| `<dsk-markdown>` | plugin 0.5 KB | blocks load their own plugins |
| `<dsk-editor>` | plugin 1.1 KB, `@dskripchenko/wysiwyg` 18.2 KB + CSS 2.3 KB, icons 5.2 KB | |

The icons file (76 icons, one file) is shared: fetched once, by the first of
openapi, flow and the editor.

→ [Getting started](docs/en/getting-started.md): snippets, self-hosting,
composing with your own import map, CSP, versioning.

## Browsers

Current Chromium, Safari and Firefox. The loader needs import maps; there is
no legacy build. Tested in Chromium and WebKit (Playwright): both builds,
both themes, both languages, desktop and phone.

## Known limitations

- **The theme is page-wide** (`<html data-theme>`): the kit's themes are
  defined on `:root`, and its menus and dialogs live in `<body>`.

## Development

```bash
pnpm install
pnpm build              # dist/ and the size table
pnpm test               # unit tests (vitest, jsdom)
pnpm lint && pnpm typecheck
node scripts/fixtures.mjs           # media fixtures for the browser check (ffmpeg)
pnpm check:browser                  # Chromium + WebKit against a local mirror of the CDN
node scripts/mirror.mjs <dir>       # self-hosting: the runtime in the CDN's layout
node scripts/demo.mjs <dir> --local # the demo page (examples/demo) for a host site
```

The browser check serves `node_modules` the way jsDelivr serves npm
(`/npm/<pkg>@<version>/…`, exact versions only) from a second origin, so the
import map, cross-origin module loading and the version pins are exercised
for real.

## License

[MIT](LICENSE)
