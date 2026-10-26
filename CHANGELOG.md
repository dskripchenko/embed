# @dskripchenko/embed

## 1.0.3 — 2026-10-26

### Changed
- **No icon library in the import map.** openapi 1.1.2, flow 1.1.1 and
  wysiwyg 0.5.3 bundle their icons, as the kit does since 1.16: the loader no
  longer maps `lucide-vue-next` (nor `@dskripchenko/ui/icons`) and the
  `dist/vendor/lucide-vue-next.js` file is gone. The build fails if a package
  imports icons at run time again.
- openapi 1.1.2: PDF of an operation on iPhone/iPad prints the operation, not
  the whole page; print margins hold when a dialog drops `@page`.

## 1.0.2 — 2026-10-26

### Changed
- `<dsk-flow>` runs `@dskripchenko/flow` 1.1.0: the `parallel` (regions and
  join), `timer`, `wait` and `any` node types, edge triggers (`trigger:
  'timer' | 'event'`) and the `unknown` / `compensated` statuses. The loader's
  import map, the fat bundle and the vendored icons follow.

## 1.0.1 — 2026-10-26

### Fixed
- `<dsk-editor>`: typing after a slash item chosen with Enter (or a block
  change from the toolbar) goes into the new block, not the previous
  paragraph — the loader's import map and the fat bundle now carry
  `@dskripchenko/wysiwyg` 0.5.2.

## 1.0.0 — 2026-10-26

First release.

- **Loader** `dist/embed.js` (≈ 9 KB gzipped): a classic script that writes
  the import map of the shared runtime — Vue 3.5.44, `@dskripchenko/ui`
  1.16.0, `wysiwyg` 0.5.1, `diagrams` 1.1.0, `openapi` 1.1.1, `flow` 1.0.2,
  pinned — composes with a page's own import map, defines the elements and
  `window.DskEmbed`, and fetches each plugin when its first element appears.
- **Fat bundle** `dist/embed.bundle.js` (≈ 563 KB gzipped): the same elements
  and API with everything inside, no import map.
- **Elements**: `<dsk-video>`, `<dsk-audio>`, `<dsk-diagram>`,
  `<dsk-openapi>` (reference, operation, block), `<dsk-flow>` (view with
  `poll-url` / `toggle-url` / `subgraph-url` conventions, or the editor),
  `<dsk-markdown>`, `<dsk-editor>` (form-ready: `name`, `input`, `input` /
  `change` events). Light DOM, attributes ↔ properties, `loading="lazy"`.
- **Blocks**: a page-wide registry (`DskEmbed.blocks.register`) with the
  live-block contract of the kit and the editor; built-in `mermaid`,
  `openapi`, `flow`, `video`, `audio`; `DskEmbed.renderBlocks(root)` makes
  stored HTML live, idempotently.
- **Configuration**: theme (`light`, `dark`, `system`, or the page's
  `data-theme`) and locale (`en`, `ru`, or the page's `lang`) for every
  element from one place; one Vue app context for every mount.
- **Events**: bubbling `dsk:*` DOM events and `DskEmbed.on/once/off/emit`;
  `openapi-target` and `media-target` wire a process to an API reference and
  a video declaratively.
- The kit's locale is provided app-wide (`provideAppLocale`); the editor's
  toolbar follows it. Video chapters come from the kit (`chapters`,
  `seekToChapter`), with `playChapter()` and `dsk:chapter` /
  `dsk:chapterchange` on top. Flow toggles persist through `persistToggle`
  and report `{ ok }` in `dsk:toggle`. `<dsk-openapi proxy>` sends try-it
  through the host (`proxySend`); a fixed `height` also sizes the
  reference's sticky navigation (`--oa-viewport-h`).
- The icons the packages import from `lucide-vue-next` (76, now only
  openapi, flow and the editor's toolbar) are served as one file; pages
  with players or markdown alone no longer fetch them.
- `scripts/mirror.mjs` for self-hosting in the CDN's layout;
  `dist/importmap.json` for pages that write their own map.
