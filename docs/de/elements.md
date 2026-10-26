# Elemente

Allen Elementen gemeinsam:

- **Light DOM.** Ein Element rendert in ein `<div data-dsk-root>` in sich
  selbst; die Stylesheets des Kits und das CSS der Seite greifen. Daten-Kinder
  (`<script type="text/…">`, `<template>`, `<source>`, `<track>`) bleiben
  erhalten und werden nie angezeigt; anderer Inhalt wird gelesen und entfernt.
- **Textinhalt.** Für eine Quelle mit Markup darin (`<`, `&`) umschließen Sie
  sie mit einem Daten-Script — der Browser parst sie weder noch zeigt er sie an,
  und die Einrückung wird für Sie entfernt:

  ```html
  <dsk-markdown>
    <script type="text/markdown">
      # Title — `a < b` stays as written
    </script>
  </dsk-markdown>
  ```

  Ein `<template>`-Kind liefert sein Markup (das initiale HTML des Editors);
  einfacher Textinhalt funktioniert für kurze Quellen ohne Markup.
- **Attribute und Properties.** Jedes Attribut hat eine camelCase-Property
  (`poll-url` → `pollUrl`). Eine per Script gesetzte Property hat Vorrang vor
  dem Attribut; sie auf `undefined` zu setzen, gibt dem Attribut den Vorrang
  zurück. Änderungen werden an Ort und Stelle neu gerendert. Boolesche
  Attribute: vorhanden ist `true`; `"false"`, `"0"`, `"off"`, `"no"` sind
  `false`; fehlend belässt den Standard der Komponente. Listen nehmen
  `a, b, c` oder ein JSON-Array; JSON-Attribute nehmen JSON.
- **`source`** — die Textquelle als Property: lesen Sie sie oder setzen Sie
  eine neue. **`refresh()`** liest die Daten-Kinder erneut.
- **`ready`** — ein Promise, das aufgelöst wird, sobald das Element gerendert
  hat. Methoden, die vorher aufgerufen werden, warten darauf (sie geben ein
  Promise zurück).
- **`locale`** — `en` oder `ru` nur für dieses Element; Standard: die globale
  Locale ([Konfiguration](config-and-events.md)).
- **`loading="lazy"`** — erst laden und rendern, wenn das Element in die Nähe
  des Viewports kommt.
- **Zustand** — `data-dsk-state` ist `loading`, `ready` oder `error`; stylen
  Sie Platzhalter darüber. Während des Ladens reserviert das Element eine Box
  plausibler Größe.
- **Events** — bubbelnde `CustomEvent`s namens `dsk:<name>` mit der Payload
  in `detail`; jedes Element sendet `dsk:ready` sowie `dsk:error` mit
  `{ message }`, wenn es nicht rendern kann. Siehe [Events](config-and-events.md#events).

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

Quellen kommen aus `<source>`-Kindern (`data-label` benennt eine Qualität im
Menü), dem JSON-Attribut `sources` oder aus `src`. Eine `.m3u8`-Adresse wird
über den eigenen HLS-Adapter des Kits (`@dskripchenko/ui/hls`) abgespielt, der
bei der ersten Verwendung geholt wird. Spuren: `<track>`-Kinder oder das
JSON-Attribut `tracks`; `kind` ist `subtitles`, `captions` oder `chapters`.

| Attribut | Property | |
|---|---|---|
| `src` | `src` | Eine Quelle. |
| `sources` | `sources` | JSON: `[{ "src", "type"?, "label"? }]`. Hat Vorrang vor `<source>`-Kindern. |
| `tracks` | `tracks` | JSON: `[{ "src", "kind"?, "srclang"?, "label"?, "default"? }]`. Hat Vorrang vor `<track>`-Kindern. |
| `poster` | `poster` | Bild, das vor dem Abspielen angezeigt wird. |
| `thumbnails` | `thumbnails` | WebVTT mit Sprite-Vorschaubildern (`sprite.jpg#xywh=…`) über der Zeitleiste. |
| `label` | `label` | Der zugängliche Name des Players. (Nicht `title`: Das wäre der Browser-Tooltip über dem ganzen Player.) |
| `aspect-ratio` | `aspectRatio` | `16:9`, `4/3` oder eine Zahl — die Box, bevor die Videogröße bekannt ist. |
| `autoplay`, `muted`, `loop` | gleich | Boolesche Werte. Autoplay startet stummgeschaltet (Browser blockieren Ton). |
| `controls` | `controls` | `controls="false"` blendet die Bedienelemente des Kits aus. |
| `preload` | `preload` | `none`, `metadata`, `auto`. |
| `crossorigin` | `crossorigin` | `anonymous` oder `use-credentials`. |
| `exclusive` | `exclusive` | Das Starten dieses Players pausiert die anderen exklusiven Player. |
| `resume-key` | `resumeKey` | Merkt sich die Position im localStorage unter diesem Schlüssel. |
| `rates` | `rates` | Wiedergabegeschwindigkeiten, z. B. `0.5, 1, 1.5, 2`. |
| `hotkeys` | `hotkeys` | Tastenkürzel. |
| `auto-hide` | `autoHide` | Millisekunden, bevor die Bedienelemente während der Wiedergabe ausgeblendet werden. |
| `hls-options` | `hlsOptions` | JSON-Optionen des HLS-Adapters. |

Methoden: `play()`, `pause()`, `toggle()`, `seek(seconds)`,
`playChapter(indexOrTitle)` (springt zu einem Kapitel der Kapitelspur — per
Index, exaktem Titel oder einem Teil davon — und spielt ab), `loadChapters()`.
Getter: `state` (playing, currentTime, duration, volume, …), `media` (das
`<video>`), `chapters` (`[{ index, title, start, end }]`, nach dem ersten
`loadChapters()`/`playChapter()`).

Events: `dsk:play`, `dsk:pause`, `dsk:ended`, `dsk:timeupdate` — detail
`{ currentTime, duration, src }`; `dsk:chapter` — das abgespielte Kapitel;
`dsk:qualitychange` `{ label }`, `dsk:audiotrackchange` `{ label }`,
`dsk:error` — der Fehler des Kits `{ kind, detail? }`.

## `<dsk-audio>`

```html
<dsk-audio waveform show-playlist>
  <source src="/a/1.mp3" data-title="Intro" data-artist="Ann">
  <source src="/a/2.mp3" data-title="Outro" data-artist="Ann" data-duration="185">
</dsk-audio>

<dsk-audio src="/a/note.mp3" track-title="Voice note" variant="mini"></dsk-audio>
```

Ein `<source>` (oder `src`) ist ein Track; mehrere ergeben eine Playlist mit
Weiter/Zurück, einer Trackliste und automatischem Weiterschalten. Kinder nehmen
`data-title`, `data-artist`, `data-duration` (Sekunden, angezeigt, bevor die
Metadaten geladen sind) und `data-peaks` (vorberechnete Wellenform,
kommagetrennt 0…1).

| Attribut | Property | |
|---|---|---|
| `src`, `type` | gleich | Ein Track. |
| `tracks` | `tracks` | JSON: `[{ "src", "title"?, "artist"?, "duration"?, "peaks"? }]`. |
| `track-title`, `artist` | `trackTitle`, `artist` | Für einen einzelnen Track. |
| `variant` | `variant` | `default` oder `mini` (ein kompakter Inline-Player). |
| `waveform` | `waveform` | Die Wellenform als Zeitleiste zeichnen (im Browser dekodiert). |
| `peaks` | `peaks` | Vorberechnete Peaks; impliziert die Wellenform ohne Dekodierung. |
| `waveform-max-bytes`, `waveform-max-duration` | camelCase | Grenzen für die Dekodierung. |
| `auto-advance`, `loop` | gleich | Verhalten der Playlist; `loop` wiederholt den Track oder die Liste. |
| `show-volume`, `show-rate`, `show-playlist` | camelCase | Angezeigte Bedienelemente. |
| `index` | `index` | Der aktuelle Track der Playlist. |
| `preload`, `crossorigin`, `exclusive`, `resume-key`, `rates`, `hotkeys`, `hls-options` | | Wie bei `<dsk-video>`. |

Methoden: `play()`, `pause()`, `toggle()`, `seek(seconds)`, `next()`,
`prev()`. Getter: `state`, `media`. Events: wie bei `<dsk-video>`, plus
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

Mermaid-Quelltext — flowchart, sequence, state, class, ER, C4, gantt, pie,
timeline, xychart, mindmap — von `@dskripchenko/diagrams` zu SVG gerendert.
Für ein Diagramm wird kein Vue geladen. Die Farben folgen dem Theme (das Embed
bildet die Custom Properties `--dg-*` des Diagramms auf die Tokens des Kits
ab; überschreiben Sie beliebige davon in Ihrem CSS).

| Attribut | Property | |
|---|---|---|
| `src` | `src` | Den Quelltext von einer URL holen statt aus dem Inhalt. |
| `label` | `label` | Der zugängliche Titel des SVG. |

Getter: `svg` (das `<svg>`-Element). Events: `dsk:render` `{ type, width, height }`;
`dsk:error` `{ message, line, column, hint }` — das Element zeigt die Meldung
mitsamt Position außerdem anstelle des Diagramms an.

## `<dsk-openapi>`

Drei Modi.

**Referenz** (Standard) — die ganze Referenz: Navigation, Suche, Operationen
mit Try-it, Anfragebeispiele in 13 Sprachen, TypeScript-Typen, Downloads.

```html
<dsk-openapi src="/openapi.yaml" height="720"></dsk-openapi>

<dsk-openapi specs='[
  {"id": "v2", "name": "API v2", "src": "/openapi/v2.json"},
  {"id": "v1", "name": "API v1", "src": "/openapi/v1.json"}
]'></dsk-openapi>
```

**Operation** — eine Operation als Karte; gesetzt über `operation` (eine
`operationId`, `METHOD /path` oder ein Anker):

```html
<dsk-openapi src="/openapi.yaml" operation="createOrder" reference-url="/docs/api"></dsk-openapi>
```

**Block** — `mode="block"`: das YAML/JSON eines API-Blocks (eine Anfrage,
mehrere oder ein ganzes Dokument; das [Format](https://github.com/dskripchenko/openapi/blob/main/docs/en/blocks.md))
als lebendiges Widget; `editable` fügt die Tabs Quelltext und Konstruktor hinzu.

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

Die Spezifikation kommt aus `src`, `specs`, der Property `spec` (Text oder ein
Objekt) oder dem Inhalt. Spezifikationen mit derselben URL werden pro Seite
einmal geholt.

| Attribut | Property | |
|---|---|---|
| `mode` | `mode` | `reference`, `operation`, `block`. Standard: `operation`, wenn `operation` gesetzt ist, sonst `reference`. |
| `src` | `src` | Die URL der Spezifikation (YAML oder JSON). |
| `specs` | `specs` | JSON: `[{ "id", "name"?, "src" \| "content" }]` — mehrere Spezifikationen mit Umschalter. |
| — | `spec` | Die Spezifikation als Text oder Objekt (nur per Script). |
| `active` | `active` | Die geöffnete Spezifikation aus `specs`. |
| `operation` | `operation` | Operationsmodus: die anzuzeigende Operation. |
| `reference-url`, `spec-id` | camelCase | Operationsmodus: Link „In Referenz öffnen“ und die id der Spezifikation dort. |
| `try-it` | `tryIt` | `try-it="false"` blendet Try-it aus (die Beispiele bleiben). |
| `base-url` | `baseUrl` | Basis für relative Server-URLs. |
| `snippet-targets`, `default-snippet` | camelCase | Sprachen der Anfragebeispiele (`curl, js, python, …`) und die erste davon. |
| `persist-credentials` | `persistCredentials` | `true`/`session`/`local`: API-Schlüssel zwischen Besuchen behalten. |
| `hash-navigation` | `hashNavigation` | `false`: `location.hash` nicht schreiben. |
| `heading` | `heading` | Der Titel im Kopf der Referenz. |
| `editable` | `editable` | Blockmodus: Bearbeitungs-Tabs. |
| `height` | `height` | Eine feste Höhe mit eigenem Scrollen (`720`, `80vh`); oder die CSS-Variable `--dsk-openapi-height` (pro Breakpoint). |
| — | `send` | `(request) => Promise<response>` — Try-it über Ihren Proxy senden. |
| — | `labels` | Überschreibungen von Oberflächentexten. |

Methoden: `go(target, { tryIt? })` — zu einer Operation (`createOrder`,
`operation/createOrder`), einem Schema (`schema/Order`) oder einem Tag
scrollen; `open(id)` — zu einer Spezifikation aus `specs` wechseln; `print()`.
Getter: `loaded` (die geladene Spezifikation), `value` (Blockmodus: der
aktuelle Text).

Events: `dsk:loaded` `{ id, title }`, `dsk:error` `{ id, message }`,
`dsk:active` `{ id }` (Spezifikation gewechselt), `dsk:change` `{ source }`
(Blockmodus, nach einer Bearbeitung).

## `<dsk-flow>`

Ein Prozessmodell — JSON (das [Modell](https://github.com/dskripchenko/flow/blob/main/docs/en/model.md))
oder Mermaid-Quelltext `stateDiagram-v2` / `flowchart` — als interaktive
Ansicht: Verschieben, Zoom, Minimap, Teilprozesse, Details, Live-Monitoring,
Schalter. Mit `editable` der Editor.

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

**HTTP-Konventionen** — ein Backend bedient diese, auf der Seite ist kein
Script nötig:

| Attribut | Request | |
|---|---|---|
| `src` | `GET` → das Modell (JSON) | |
| `poll-url` | `GET` → ein Monitoring-Snapshot, alle `poll-interval` ms (5000) | Innerhalb eines Teilprozesses trägt die Query `path` (Knoten-ids ab der Wurzel, kommagetrennt) und `ref` (die Referenz des Teilprozesses). Eine Nicht-2xx-Antwort zeigt einen Fehler an und lässt das Polling zurückfahren. Das [Snapshot-Format](https://github.com/dskripchenko/flow/blob/main/docs/en/integration.md#monitoring-snapshot). |
| `toggle-url` | `POST` JSON `{ kind, id, enabled, path }`, wenn ein Knoten oder eine Kante umgeschaltet wird | Macht die Ansicht umschaltbar. Eine Nicht-2xx-Antwort setzt den Schalter zurück und zeigt den Fehler an. |
| `subgraph-url` | `GET` → das Modell eines referenzierten Teilprozesses | `{ref}` in der URL wird durch die Referenz ersetzt (`/processes/{ref}`); ohne es wird `?ref=` angehängt. |

Requests sind Same-Origin-`fetch` mit den Cookies der Seite
(`credentials: 'same-origin'`).

| Attribut | Property | |
|---|---|---|
| `src` | `src` | Die URL des Modells. |
| — | `graph` | Das Modell als Objekt (nur per Script); hat Vorrang vor `src` und Inhalt. Beim Lesen liefert es das aktuelle Modell (mit den Bearbeitungen des Editors). |
| `state` | `state` | JSON: ein erster Snapshot (z. B. vom Server gerendert); das Polling ersetzt ihn. |
| `poll-url`, `poll-interval` | camelCase | Monitoring, wie oben. |
| `toggle-url` | `toggleUrl` | Schalter, wie oben. |
| — | `onToggle` | `(change) => Promise` — Schalter stattdessen selbst persistieren (nur per Script); ablehnen zum Zurücksetzen. |
| `subgraph-url` | `subgraphUrl` | Teilprozesse, wie oben. |
| — | `loadSubgraph` | `(ref, node) => Promise<model>` — sie selbst laden (nur per Script). |
| `editable` | `editable` | Der Editor (Palette, Verbinden, Rückgängig/Wiederholen, Eigenschaften, Mermaid-Import). |
| `readonly` | `readonly` | Editor: schreibgeschützt. |
| `palette` | `palette` | Editor: Knotentypen in der Palette, `task, decision, …`. |
| `name` | `name` | Editor: hält ein verstecktes `<input name>` mit dem JSON des Modells im Element — ein einfaches Formular sendet es mit. |
| `direction` | `direction` | `TB` oder `LR`; standardmäßig das `meta.direction` des Modells, sonst nach der Form der Box gewählt (eine hohe Box wird von oben nach unten angeordnet). |
| `edge-style` | `edgeStyle` | `orthogonal` oder `smooth`. |
| `wheel` | `wheel` | `zoom` oder `pan`. |
| `minimap`, `controls`, `details`, `status-bar` | camelCase | Teile der Ansicht; `details="false"` schaltet die Detail-Schublade ab, die ein Klick öffnet. |
| `height` | `height` | Standard 480 (600 für den Editor); oder die CSS-Variable `--dsk-flow-height`. |
| `openapi-target` | `openapiTarget` | Ein Selektor eines `<dsk-openapi>`: Das `data.operation` eines angeklickten Knotens wird dort geöffnet. |
| `media-target` | `mediaTarget` | Ein Selektor eines `<dsk-video>`/`<dsk-audio>`: Das `data.chapter` (Titel oder Index) oder `data.time` (Sekunden) eines angeklickten Knotens wird dort abgespielt. |
| — | `labels`, `registry` | Oberflächentexte; eigene Knotentypen (nur per Script). |

Methoden: `fit()`, `select(id)`, `enter(nodeId)`, `back()`, `refresh()`
(jetzt pollen), `undo()`, `redo()` (Editor). Getter: `graph`, `stack` (die
betretenen Teilprozessebenen).

Events: `dsk:node` `{ id, path, node, data }` — ein Knoten wurde angeklickt;
`dsk:select` `{ kind, id, path, element }` oder `null`; `dsk:toggle`
`{ kind, id, enabled, path }`; `dsk:toggle-error` `{ change, message }`;
`dsk:navigate` `{ path }`; `dsk:poll-error` `{ message }`; `dsk:load`
`{ nodes, edges }`; Editor: `dsk:change` `{ graph, description, source }`,
`dsk:validate` `{ issues }`.

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

Markdown über das UidMarkdown des Kits — Tabellen, Callouts,
Code-Hervorhebung — mit **jedem registrierten Block-Renderer**:
```` ```mermaid ````, ```` ```openapi ````, ```` ```flow ````,
```` ```video ````, ```` ```audio ```` und den eigenen der Seite
([Blöcke](blocks.md)).

| Attribut | Property | |
|---|---|---|
| `src` | `src` | Das Markdown von einer URL holen. |
| `toc`, `toc-depth` | camelCase | Ein Inhaltsverzeichnis (Überschriften 2…`toc-depth`). |
| `link-base`, `image-base` | camelCase | Basen für relative Links und Bilder. |

Getter: `value` (das angezeigte Markdown). Events: `dsk:error`, wenn `src`
fehlschlägt.

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

Der WYSIWYG-Editor (`@dskripchenko/wysiwyg`) — Werkzeugleiste,
Markdown-Kürzel, Slash-Menü, Tabellen, Quelltextmodus — mit **jedem
registrierten Block-Renderer live**: Ein Codeblock einer registrierten Sprache
zeigt sein Widget, und ein Widget, das bearbeitet (der Konstruktor des
API-Blocks), schreibt seinen Quelltext zurück ins HTML. Der Wert ist HTML;
Codeblöcke werden als `<pre><code class="language-…">` gespeichert, sodass das
gespeicherte HTML auf jeder Seite mit [`renderBlocks()`](blocks.md#renderblocks)
lebendig wird.

Der Anfangswert: das Attribut `value`, sonst ein `<template>`-Kind, sonst der
Wert des gebundenen Eingabefelds.

| Attribut | Property | |
|---|---|---|
| `value` | `value` | Das HTML. Das Lesen der Property liefert den aktuellen Inhalt; das Setzen ersetzt den Inhalt. |
| `name` | `name` | Hält ein verstecktes `<input name>` im Element synchron — ein einfaches Formular sendet es mit. |
| `input` | `input` | Ein Selektor eines vorhandenen `<input>`/`<textarea>`, das synchron gehalten wird (und aus dem der Anfangswert gelesen wird). |
| `placeholder` | `placeholder` | |
| `readonly` | `readonly` | |
| `toolbar` | `toolbar` | `toolbar="false"` blendet die Werkzeugleiste aus. |
| `min-height`, `max-height` | camelCase | CSS-Längen. |
| `resizable` | `resizable` | Der Griff zum Ändern der Größe. |

Methoden: `focus()`. Getter: `value`, `controller` (die Befehls-API des
Editors: `controller.chain().focus().bold().run()`).

Events — wie bei einem Formularelement:

- `input` (ein einfaches `Event`) nach jeder Änderung, und `dsk:input` `{ value }`;
- `change`, wenn der Editor mit geändertem Wert den Fokus verliert, und `dsk:change` `{ value }`;
- `dsk:editor-ready` `{ controller }`.

Die eigenen internen `input`/`change`-Events des Editors verlassen das Element
nicht, daher liest `el.addEventListener('input', () => el.value)` immer das
HTML.
