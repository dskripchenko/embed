# Getting started

`@dskripchenko/embed` puts the author's components on any web page as HTML
tags — plain HTML, a CMS template, WordPress, Blade, React, Vue — loaded from a
CDN. The elements share one Vue, one copy of the UI kit and one set of
block renderers, and they talk to each other through DOM events.

| Element | What it is | Built on |
|---|---|---|
| `<dsk-video>` | video player: sources, quality menu, subtitles, chapters, thumbnails, HLS | `@dskripchenko/ui` UidVideo |
| `<dsk-audio>` | audio player, playlist, waveform | `@dskripchenko/ui` UidAudio |
| `<dsk-diagram>` | Mermaid diagram (11 types) → SVG | `@dskripchenko/diagrams` |
| `<dsk-openapi>` | OpenAPI reference, one operation, or an API block | `@dskripchenko/openapi` |
| `<dsk-flow>` | process view with monitoring, or the process editor | `@dskripchenko/flow` |
| `<dsk-markdown>` | markdown with live blocks | `@dskripchenko/ui` UidMarkdown |
| `<dsk-editor>` | WYSIWYG editor with live blocks, form-ready | `@dskripchenko/wysiwyg` |

## The loader (recommended)

```html
<head>
  <script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js"></script>
</head>
<body>
  <dsk-diagram>
    flowchart LR
      A[Write] --> B[Publish]
  </dsk-diagram>
</body>
```

`embed.js` is about 9 KB gzipped. It is a **classic** script on purpose: it
runs where it stands, writes an [import map](#import-maps) for the shared
runtime, defines the elements and `window.DskEmbed`, and nothing else. Vue,
the kit and each plugin package are fetched from the CDN the moment the first
element that needs them appears; a page with one diagram loads the diagrams
package and nothing more.

Put it in `<head>`, before any `<script type="module">` of the page.

`@1` follows the latest 1.x release. The loader pins everything it fetches —
its own plugins and the runtime packages — to the exact versions that release
was built and tested with, so a range on the script tag never mixes versions.
Pin the tag too (`@1.0.0`) for a page that must never change.

### Script-tag options

```html
<script src="…/embed.js"
        data-theme="system"
        data-locale="ru"
        data-render-blocks="article"></script>
```

| Attribute | |
|---|---|
| `data-theme` | `light`, `dark` or `system`; see [configuration](config-and-events.md#theme). |
| `data-locale` | `en` or `ru`. Default: the page's `<html lang>`. |
| `data-cdn-base` | Where the runtime comes from (default: the CDN the loader came from, else jsDelivr). |
| `data-render-blocks` | Renders the code blocks under this selector once the page is parsed (empty value: `body`). See [blocks](blocks.md). |

The same options, and `versions` to override single pins, can be set before
the loader as `window.DskEmbedConfig = { theme, locale, cdnBase, versions }`.

## The fat bundle

```html
<script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.bundle.js"></script>
```

One file with Vue, the kit, every plugin package and all styles inside: no
import map, no further requests. The same elements and the same `DskEmbed`
API. It is the whole runtime at once — about 2 MB, **563 KB gzipped** —
where the loader fetches only what the page uses. Use it where import maps
are not available, or where nothing may be loaded at run time.

Use one or the other on a page, not both (the second one to load is ignored
with a warning).

## Self-hosting

Everything the loader fetches can be served from your own server, in the
CDN's layout. From a checkout of the package:

```bash
pnpm install && pnpm build
node scripts/mirror.mjs public/static     # → public/static/npm/<pkg>@<version>/…
```

```html
<script src="/static/npm/@dskripchenko/embed@1.0.0/dist/embed.js"></script>
```

The loader takes the CDN root from its own address (the part before
`@dskripchenko/embed@`), so a mirrored copy needs no configuration. For any
other layout, set `data-cdn-base` and keep the `<pkg>@<version>/` paths.

## Import maps

Browsers resolve bare imports (`import 'vue'`) through import maps, and a map
only counts if it is in the document before the first module that needs it
loads. That is why the loader is a classic script in `<head>`.

The map it writes (also published as `dist/importmap.json`):

| Specifier | Points at |
|---|---|
| `vue` | `vue@3.5.44/dist/vue.runtime.esm-browser.prod.js` |
| `@dskripchenko/ui`, `/icons`, `/hls` | `@dskripchenko/ui@1.16.0/dist/…` |
| `@dskripchenko/wysiwyg` | `@dskripchenko/wysiwyg@0.5.1/dist/index.mjs` |
| `@dskripchenko/diagrams` | `@dskripchenko/diagrams@1.1.0/dist/index.mjs` |
| `@dskripchenko/openapi`, `/vue` | `@dskripchenko/openapi@1.1.1/dist/…` |
| `@dskripchenko/flow`, `/vue`, `/mermaid` | `@dskripchenko/flow@1.0.2/dist/…` |
| `lucide-vue-next` | the embed's own one-file build of the icons openapi, flow and the editor use |

The icons are a special case. The kit bundles its own icons; openapi and flow
import theirs through `@dskripchenko/ui/icons`, which re-exports
`lucide-vue-next`, and the editor's toolbar imports `lucide-vue-next` itself.
That package's ESM build is one module per icon — some 1 500 requests through
a map — so the embed ships the 76 icons those packages import as one file
(5 KB gzipped).

**A page with its own import map.** Entries the page maps itself stay the
page's; the embed adds a second map with the rest, which browsers with
multiple import maps merge (Chromium since 133; the browser check passes in
current Chromium and WebKit — check other engines before relying on it).
If the page maps `vue` or the kit to another file, the loader warns: two
copies of Vue break the elements. Map them to the very files above — then the
page's own Vue code and the elements share one Vue:

```html
<script type="importmap">
  { "imports": { "vue": "https://cdn.jsdelivr.net/npm/vue@3.5.44/dist/vue.runtime.esm-browser.prod.js" } }
</script>
<script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js"></script>
```

For browsers without multiple import maps, copy the entries of
`dist/importmap.json` into your one map and still load `embed.js` after it.

**As a module.** `<script type="module" src="…/embed.js">` works too, in
browsers with multiple import maps; the loader then warns once, since in
older browsers the map would come too late.

## Browsers

Current Chromium, Safari and Firefox. The loader needs import maps (Chrome
89+, Safari 16.4+, Firefox 108+); the fat bundle runs wherever ES2022 does.
There is no legacy build.

## Content Security Policy

The loader needs:

- `script-src` — the CDN origin (`https://cdn.jsdelivr.net`), and the import
  map: an inline `<script type="importmap">` counts as an inline script. Under
  a strict policy, write the map yourself — the entries of
  `dist/importmap.json` in a `<script type="importmap" nonce="…">` before
  `embed.js`; the loader then finds every entry in place and writes nothing.
  (Under `'strict-dynamic'` the map the loader inserts is script-created and
  usually allowed, but the explicit map is the portable way.)
- `style-src` — the CDN origin (the kit's stylesheets come as `<link>`), and
  `'unsafe-inline'` or a nonce for the embed's own small `<style>` and for
  the components' inline `style` attributes.
- `connect-src` — whatever your elements fetch: `src`, `poll-url`,
  `toggle-url`, specs, and the APIs try-it calls.
- `media-src` / `img-src` — your media; `blob:` for HLS (MediaSource).
- `worker-src` is not needed.

The fat bundle needs `script-src` for its own URL and the same `style-src`,
`connect-src` and media rules. Nothing uses `eval`.

## Versioning

Semantic versioning, with one rule on top: a release pins its runtime. The
versions of Vue, the kit and the plugin packages are part of the release —
`DskEmbed.versions` lists them — and a new pin is a new embed release (a
patch for patches of the packages, a minor for their features). Element
attributes, properties, events and the `DskEmbed` API follow semver.

## Next

- [Elements](elements.md) — every attribute, property, method and event
- [Blocks](blocks.md) — the block-renderer registry and `renderBlocks()`
- [Configuration and events](config-and-events.md) — theme, locale, the event bus, cooperation
- [Frameworks](frameworks.md) — React, Vue, WordPress, Blade, plain forms
