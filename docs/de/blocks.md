# Blöcke

Ein **Block** ist ein umzäunter Codeblock einer registrierten Sprache —
```` ```mermaid ```` in Markdown, `<pre><code class="language-mermaid">` in
HTML — der als das angezeigt wird, was er beschreibt, statt als Code. Eine
seitenweite Registry bedient jede Stelle, an der Blöcke vorkommen:

- `<dsk-markdown>`,
- `<dsk-editor>` (live und bearbeitbar, wo das Widget bearbeitet),
- `DskEmbed.renderBlocks()` über HTML, das bereits auf der Seite steht,
- Markdown innerhalb der Komponenten selbst (z. B. OpenAPI-Beschreibungen).

## Eingebaute Blöcke

| Sprache | Wird zu | Lädt |
|---|---|---|
| `mermaid` | SVG-Diagramm | diagrams |
| `plantuml` (`puml`), `dot` (`graphviz`), `d2`, `dbml`, `structurizr`, `wardley` | SVG-Diagramm in dieser Syntax | diagrams |
| `bpmn` | einen BPMN-2.0-Prozess im Layout des Modelers | bpmn |
| `dmn` | das Entscheidungsanforderungsdiagramm und die Tabelle jeder Entscheidung | bpmn |
| `drawio` | die erste Seite einer draw.io-Datei (einfach oder komprimiert) | drawio |
| `asyncapi` | eine AsyncAPI-2.x-/3.0-Referenz | openapi |
| `openapi` | das lebendige API-Widget: eine Anfrage, mehrere oder ein ganzes Dokument | openapi |
| `flow` | eine Prozessansicht, aus JSON oder Mermaid-Quelltext (state/flowchart) | flow |
| `board` | ein schreibgeschütztes Whiteboard, aus dem JSON des Boards | board |
| `kanban` | ein schreibgeschütztes Kanban-Board, aus dem Kanban-Markup | kanban |
| `calendar` | ein Kalender der Termine (Wiederholungen aufgelöst) | calendar |
| `video` | der Videoplayer des Kits | kit |
| `audio` | der Audioplayer oder die Playlist des Kits | kit |

Jeder lädt sein Plugin beim ersten Block seiner Art.

```` ```video ```` und ```` ```audio ```` nehmen eine URL (eine pro Zeile für
Alternativen oder eine Playlist), JSON oder ein wenig YAML — die Syntax der
Medienblöcke von laravel-admin:

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

Schlüssel für Video: `src` / `sources`, `poster`, `tracks`, `thumbnails`,
`title`, `aspectRatio`, `autoplay`, `muted`, `loop`, `preload`, `maxWidth`. Audio: `src` /
`tracks`, `title`, `artist`, `waveform`, `peaks`, `loop`, `mini`, `preload`,
`maxWidth`. Relative Pfade werden gegen das `image-base` des Markdowns
aufgelöst, wie seine Bilder.

Ein Block-Player beantwortet die Methoden des Elements über `blockEl.dskPlayer`
(`play()`, `seek()`, `playChapter()`, …), und seine Events bubbeln vom Block
aus wie die eines Elements.

## Eigene Blöcke

```js
DskEmbed.blocks.register('chart', (code, { language, index }) => {
  const values = code.split(',').map(Number)
  return { html: renderChartSvg(values) }   // selbst gebautes Markup, Benutzertext escaped
})
```

Der Vertrag ist der Live-Block-Vertrag des UidMarkdown aus dem Kit und des
WYSIWYG-Editors. Ein Renderer nimmt den Quelltext des Blocks und gibt — direkt
oder als Promise — eines der folgenden zurück:

| Ergebnis | |
|---|---|
| `{ html }` | Markup, das anstelle des Blocks eingefügt wird. Es wird unverändert eingefügt: Bauen Sie es selbst und escapen Sie jedes Stück Benutzertext. |
| `{ mount(el, ctx) }` | Ein lebendiges Widget: Mounten Sie es in `el`. Geben Sie `{ update(code), destroy() }` oder eine Aufräumfunktion zurück. |
| `{ error }` | Der Block kann nicht gerendert werden; er wird als Code mit der Meldung angezeigt. |

`ctx` von `mount`:

| | |
|---|---|
| `code`, `language` | Der Quelltext und die Sprache. |
| `editable` | `true` innerhalb von `<dsk-editor>`: Das Widget darf seinen Quelltext ändern. |
| `setCode(code)` | Schreibt einen neuen Quelltext zurück (der Editor aktualisiert sein HTML). |

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

`register(language, rendererOrResult)` nimmt auch ein festes Ergebnis
(`{ html }` oder `{ mount }`) und gibt eine Funktion zurück, die die
Registrierung wieder aufhebt. Das Registrieren einer eingebauten Sprache
ersetzt den eingebauten Renderer. Weitere Aufrufe:
`DskEmbed.blocks.unregister(language)`, `has(language)`, `list()`.

Registrieren Sie, bevor der Inhalt rendert — in einem Script direkt nach dem
Loader —, damit schon das erste Rendern die Sprache kennt.

## renderBlocks

HTML aus einem CMS, einer Datenbank oder einem Static-Site-Generator hat seine
Codeblöcke bereits als `<pre><code class="language-…">`. Ein Aufruf macht sie
lebendig:

```js
await DskEmbed.renderBlocks(document.querySelector('article'))  // → die Anzahl gerenderter Blöcke
```

Oder am Script-Tag, für die ganze Seite, sobald sie geparst ist:

```html
<script src="…/embed.js" data-render-blocks="article"></script>
```

- Die Sprache wird aus `language-x` / `lang-x` am `<code>` oder am `<pre>`
  gelesen, oder aus `data-lang`.
- Nur registrierte Sprachen werden angefasst; anderer Code bleibt, wie er ist.
  `renderBlocks(root, { languages: ['mermaid'] })` schränkt das weiter ein.
- **Idempotent**: Ein Block wird einmal gerendert, egal wie oft Sie es
  aufrufen — rufen Sie es nach dem Einfügen von weiterem HTML erneut auf.
- Ein Block, der fehlschlägt, bleibt Code; sein `<pre>` bekommt
  `data-dsk-failed` und den Grund in `title` und wird nicht erneut versucht.
- Code innerhalb von `<dsk-markdown>`, `<dsk-editor>` und `contenteditable`
  wird diesen überlassen.
- `DskEmbed.unrenderBlocks(root)` zerstört die Widgets und setzt das
  ursprüngliche `<pre>` wieder ein.

Ein gerenderter Block ist ein `<div class="dsk-block dsk-block--<language>" data-dsk-block="<language>">`.
