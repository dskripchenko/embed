# Print

A page with embed's elements prints as a document: what is a control on
screen stays off paper, and what is a live canvas or a player is replaced by
a static form of itself.

```js
// Reliable: wait for every form, print, put the widgets back.
const restore = await DskEmbed.print.prepare()
window.print()          // or a host's own print to PDF
restore()
```

The browser's own print (Ctrl+P / ⌘P) does the same by itself through
`beforeprint` and `afterprint`; forms that take a moment to build (an API
reference) are only certain to be there when `prepare()` was awaited first.
`prepare()` first waits (up to ten seconds) for the widgets that are still
drawing — an element loading, a markdown block not mounted yet — so it can
be called the moment the content is on the page. `prepare(root)` limits it
to a part of the page.

## What each widget prints

| Widget | On paper |
|---|---|
| `<dsk-diagram>`, diagram blocks | the diagram as drawn |
| `<dsk-bpmn>`, `<dsk-dmn>` | the whole diagram, not the part in view; a DMN file with every decision's table under its diagram |
| `<dsk-drawio>` | every page one after another, each named when there are several |
| `<dsk-flow>`, ```` ```flow ```` | the whole process, whatever part of it the canvas showed |
| `<dsk-board>`, ```` ```board ```` | the whole board as one picture |
| `<dsk-openapi>` (reference, operation) | the static print view: every operation with parameters, bodies, responses and request samples, then the schemas; an operation alone as its card |
| `<dsk-openapi>` (block, editor), `<dsk-asyncapi>` | as shown, without scroll boxes or fixed heights |
| `<dsk-video>`, ```` ```video ```` | the poster (else the frame on screen), the title, the address, the chapters with their times |
| `<dsk-audio>`, ```` ```audio ```` | the title and address, or the playlist |
| `<dsk-kanban>`, `<dsk-calendar>` | the board or the period shown, without filters, switches, arrows or the lock |
| `<dsk-markdown>` | one column without its table of contents; code wraps; blocks are not split across sheets |

Never on paper: the full-screen button, toolbars and the kit's controls.
A ```` ```drawio ```` block in markdown prints its first page; the
`<dsk-drawio>` element prints them all.

## How it works

Each widget that is not paper by itself registers a print form. `prepare()`
builds them all, puts each right after its widget and marks the widget
`dsk-print-hidden`; under `@media print` the widget is hidden and the form
shown (`.dsk-print-form`), on screen the other way round — so the page does
not move while the forms are in place. Style the forms with
`.dsk-print-form` in your own print CSS.
