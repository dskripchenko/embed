# @dskripchenko/embed

## Unreleased

First release.

- **Loader** `dist/embed.js` (≈ 9 KB gzipped): a classic script that writes
  the import map of the shared runtime — Vue 3.5.44, `@dskripchenko/ui`
  1.15.1, `wysiwyg` 0.5.0, `diagrams` 1.1.0, `openapi` 1.1.0, `flow` 1.0.1,
  pinned — composes with a page's own import map, defines the elements and
  `window.DskEmbed`, and fetches each plugin when its first element appears.
- **Fat bundle** `dist/embed.bundle.js` (≈ 558 KB gzipped): the same elements
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
- `scripts/mirror.mjs` for self-hosting in the CDN's layout;
  `dist/importmap.json` for pages that write their own map.
