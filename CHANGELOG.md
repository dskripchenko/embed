# @dskripchenko/embed

## 1.6.0

### Minor Changes

- 12996b1: The kanban and the calendar now come from the kit (`UidKanban`, `UidEventCalendar` in @dskripchenko/ui 1.20), the markup format and behaviour unchanged; their plugins shrink to about 1.5 KB. Their classes follow the kit: `uid-kanban__…` and `uid-event-calendar__…` instead of `dsk-kanban__…` and `dsk-cal__…` — update custom CSS that targeted the old ones. Diagrams 1.3.3: edges pass nodes without cutting their corners, frame titles are drawn above the edges.

## 1.5.3

### Patch Changes

- 3636ada: Diagrams 1.3.2: edges between clusters no longer loop around the frames.

## 1.5.2

### Patch Changes

- 9977f1e: Diagrams 1.3.1 and BPMN 0.4.1: left-to-right DOT/Mermaid clusters follow one another, Structurizr `autolayout` follows the relationships, Wardley labels stay inside the map, DMN auto-layout detours no longer run under neighbouring inputs.

## 1.5.1

### Patch Changes

- 33e1d06: `<dsk-calendar>`: the markup's `view:` and `date:` settings apply once the markup has loaded (from `src` or the element's body) — they were read before it arrived, so the calendar opened on today's month. The `view` / `date` attributes still win, and a reader who has already moved stays where they are.

## 1.5.0

### Minor Changes

- f10ef05: `<dsk-kanban>` and `<dsk-calendar>`, with ```` ```kanban ```` and ```` ```calendar ```` blocks. Both are written as markup in the element's body (or `src`): a kanban board — columns with WIP limits, swimlanes, cards with tags, priority, assignee, due date and a description; a calendar — dates, ranges, times and repeats in words (an RRULE subset, or `{rrule: …}`), shown by day, week, month, year or as an agenda. With `editable`, cards and events are dragged, edited in a panel (the calendar's event builder puts repeats together from choices; one occurrence of a series can be changed on its own), and the markup has a source tab; each edit rewrites only its own lines and is reported as `dsk:change` with the new source. `locked` / `lockable` and `dsk:lock` give a lock the host keeps. Elements now mark themselves `data-dsk`, and the base styles select them by it. Runtime: @dskripchenko/ui 1.18.1.

## 1.4.1

### Patch Changes

- 51df863: Runtime: @dskripchenko/board 0.3.0 — workshop templates (event storming, customer journey map, user story map, retrospective) in the board editor's Templates button.

## 1.4.0 — 2026-10-31

### Added
- **More diagram syntaxes**: `<dsk-diagram>` and blocks draw PlantUML
  (```` ```plantuml ````, ```` ```puml ````), Graphviz DOT (```` ```dot ````,
  ```` ```graphviz ````), D2, DBML, Structurizr DSL and Wardley maps
  (@dskripchenko/diagrams 1.3.0); `syntax` names the syntax when it is not
  recognised from the source.
- **`<dsk-bpmn>` and `<dsk-dmn>`** (new `bpmn` plugin, @dskripchenko/bpmn
  0.4.0): BPMN 2.0 processes and DMN decisions as laid out in their modeler —
  a view with pan, zoom, highlight and clicks, or with `editable` the editor
  (`name` keeps the XML in a form field). ```` ```bpmn ```` and
  ```` ```dmn ```` blocks draw the diagram (and DMN decision tables).
- **`<dsk-drawio>`** (new `drawio` plugin, @dskripchenko/drawio 0.1.0):
  draw.io files — compressed or plain pages, `.drawio.svg` — with page tabs;
  ```` ```drawio ```` blocks. No Vue.
- **`<dsk-asyncapi>`** and ```` ```asyncapi ```` blocks: AsyncAPI 2.x / 3.0
  references (@dskripchenko/openapi 1.2.0).
- Per-plugin bundles `bundles/bpmn.js` and `bundles/drawio.js`.
- The new elements in the base styles: block boxes, hidden source before the
  upgrade, loading placeholders, full screen (BPMN / DMN fill the screen,
  AsyncAPI follows `--dsk-openapi-height`), and draw.io page tabs.

### Changed
- Runtime: @dskripchenko/ui 1.17.0, diagrams 1.3.0, flow 1.2.0 (EPC, DFD
  and IDEF0 notations), openapi 1.2.0; bpmn 0.4.0 and drawio 0.1.0 added to
  the import map.

## 1.3.0 — 2026-10-30

### Added
- **Per-plugin bundles** — `dist/bundles/<plugin>.js` (`media`, `diagram`,
  `openapi`, `flow`, `markdown`, `editor`, `board`): one plugin with Vue and
  the kit, defining only its elements and block languages. Several on a page
  share one `DskEmbed`: a bundle loaded later adds its plugins, and blocks of
  its languages in markdown and the editor start to draw.
- `DskEmbed.extend(plugins)` and `DskEmbed.plugins()`.

### Changed
- The bundles put each stylesheet in once by its own id (`tokens`,
  `themes`, `kit`, `openapi`, `flow`, `editor`, `board`) instead of one
  combined `kit` style.

## 1.2.0 — 2026-10-29

### Added
- **Full screen** for `<dsk-diagram>`, `<dsk-flow>`, `<dsk-board>` and
  `<dsk-openapi>`: a button on hover puts the element full screen (the
  Fullscreen API, or the whole window where it is not available); Escape or
  the button leaves. Flows and boards fit their content to the new size.
  `fullscreen="false"` hides the button; `enterFullscreen()`,
  `exitFullscreen()`, `fullscreen`, `dsk:fullscreen` `{ active }`.

## 1.1.0 — 2026-10-29

### Added
- **`<dsk-board>`** — an infinite whiteboard from
  [`@dskripchenko/board`](https://github.com/dskripchenko/board): a
  read-only view (`src`, the element's JSON, or the `board` property), an
  editor (`editable`, with a form input through `name`), or a shared board
  several people edit at once (`board-url`, the board's HTTP contract;
  `provider` for any other transport) with cursors, names and the board
  lock (`lockable`); `poll-interval` polls instead of long polling. Methods `fit`, `select`, `toPng`, `toSvg`, `undo`,
  `redo`; events `dsk:change`, `dsk:select`, `dsk:load`.
- **```board blocks** in markdown, the editor and `renderBlocks`: a
  read-only board from its JSON.

## 1.0.6 — 2026-10-28

### Added
- **`<dsk-openapi mode="editor">`** — the whole spec in openapi's visual
  editor: a tree of the document (info, servers, tags, security, paths and
  operations, schemas) and a form for the chosen part, with Source and
  Preview views; `view` picks the one to open with. Edits come out as
  `dsk:change` `{ source }` and through `value`. Block mode's constructor
  builds compact requests only; this is the constructor for a whole document.

## 1.0.5 — 2026-10-28

### Fixed
- **Ids of their own in every element.** Each element renders as its own Vue
  root, and `useId()` numbered from zero in each: two `<dsk-flow>` on a page
  shared one grid pattern id, so the second canvas drew the first one's grid
  and panning one moved the dots of both; arrow markers and form labels
  (`for` / `aria-*`) collided the same way. Each element's ids now carry a
  prefix of their own.

## 1.0.4 — 2026-10-28

### Fixed
- **An embedded OpenAPI reference no longer pulls the page while it scrolls**
  (openapi 1.1.3). In a box on a longer page whose top had scrolled past the
  window, the reference's navigation followed each section by scrolling the
  page back to its link, and scrolling jerked back and forth. The navigation
  and the search hits now scroll only their own list.

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
