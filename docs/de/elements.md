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
- **`data-dsk`** — jedes Element setzt dieses Attribut beim Verbinden;
  die Basisstile des Embeds wählen Elemente darüber aus.
- **Zustand** — `data-dsk-state` ist `loading`, `ready` oder `error`; stylen
  Sie Platzhalter darüber. Während des Ladens reserviert das Element eine Box
  plausibler Größe.
- **Events** — bubbelnde `CustomEvent`s namens `dsk:<name>` mit der Payload
  in `detail`; jedes Element sendet `dsk:ready` sowie `dsk:error` mit
  `{ message }`, wenn es nicht rendern kann. Siehe [Events](config-and-events.md#events).

## Vollbild

`<dsk-diagram>`, `<dsk-flow>`, `<dsk-board>` und `<dsk-openapi>` zeigen beim
Überfahren (auf Touchscreens immer) eine Vollbild-Schaltfläche. Das Element
geht über die Fullscreen API ins Vollbild — oder füllt, wo sie fehlt (einfache
Elemente in Safari auf iOS), das Fenster über der Seite. Escape oder die
Schaltfläche beenden es; Flow und Board passen ihren Inhalt an die neue Größe
an. Die Player haben ein eigenes Vollbild.

- `fullscreen="false"` — keine Schaltfläche.
- Methoden `enterFullscreen()`, `exitFullscreen()`; Getter `fullscreen`.
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
Index, exaktem Titel oder einem Teil davon — und spielt ab), `loadChapters()`
(wird aufgelöst, sobald das Kit die Kapitelspur gelesen hat).
Getter: `state` (playing, currentTime, duration, volume, …), `media` (das
`<video>`), `chapters` (`[{ index, title, start, end }]`, so wie das Kit sie
aus der Kapitelspur gelesen hat).

Events: `dsk:play`, `dsk:pause`, `dsk:ended`, `dsk:timeupdate` — detail
`{ currentTime, duration, src }`; `dsk:chapter` — das Kapitel, das
`playChapter()` abgespielt hat; `dsk:chapterchange` — `{ index, title, start, end }`
(oder `null`), sobald die Wiedergabe in ein anderes Kapitel eintritt;
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
| `syntax` | `syntax` | `mermaid`, `plantuml`, `dot`, `d2`, `dbml`, `structurizr` oder `wardley`; ohne Angabe aus der Quelle erkannt. |

Getter: `svg` (das `<svg>`-Element). Events: `dsk:render` `{ type, width, height }`;
`dsk:error` `{ message, line, column, hint }` — das Element zeigt die Meldung
mitsamt Position außerdem anstelle des Diagramms an.

Neben Mermaid liest das Element PlantUML (`@startuml`), Graphviz DOT, D2,
DBML, Structurizr DSL und Wardley Maps; die Syntax wird aus der Quelle
erkannt oder mit `syntax` genannt.

## `<dsk-openapi>`

Vier Modi.

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

**Editor** — `mode="editor"`: die ganze Spezifikation im visuellen Editor —
ein Baum des Dokuments (info, Server, Tags, Sicherheit, Pfade und
Operationen, Schemas) und ein Formular für den gewählten Teil, dazu die
Ansichten Quelltext und Vorschau. Änderungen kommen als `dsk:change`
`{ source }`, im Format des Textes.

```html
<dsk-openapi mode="editor" height="640" view="visual">
  <script type="text/yaml">openapi: 3.1.0 …</script>
</dsk-openapi>
```

Die Spezifikation kommt aus `src`, `specs`, der Property `spec` (Text oder ein
Objekt) oder dem Inhalt. Spezifikationen mit derselben URL werden pro Seite
einmal geholt.

| Attribut | Property | |
|---|---|---|
| `mode` | `mode` | `reference`, `operation`, `block`, `editor`. Standard: `operation`, wenn `operation` gesetzt ist, sonst `reference`. |
| `view` | `view` | Editor-Modus: die Ansicht beim Öffnen — `visual` (Standard), `source`, `preview`. |
| `src` | `src` | Die URL der Spezifikation (YAML oder JSON). |
| `specs` | `specs` | JSON: `[{ "id", "name"?, "src" \| "content" }]` — mehrere Spezifikationen mit Umschalter. |
| — | `spec` | Die Spezifikation als Text oder Objekt (nur per Script). |
| `active` | `active` | Die geöffnete Spezifikation aus `specs`. |
| `operation` | `operation` | Operationsmodus: die anzuzeigende Operation. |
| `reference-url`, `spec-id` | camelCase | Operationsmodus: Link „In Referenz öffnen“ und die id der Spezifikation dort. |
| `try-it` | `tryIt` | `try-it="false"` blendet Try-it aus (die Beispiele bleiben). |
| `proxy` | `proxy` | Ein Endpunkt, der Try-it-Requests für die Seite ausführt — [der Proxy-Vertrag von openapi](https://github.com/dskripchenko/openapi/blob/main/docs/en/standalone.md#the-proxy) (der Request als JSON hinein, die Antwort als JSON heraus; das `csrf-token`-Meta von Laravel wird mitgesendet). Für APIs, die den Origin der Seite nicht zulassen. |
| `base-url` | `baseUrl` | Basis für relative Server-URLs. |
| `snippet-targets`, `default-snippet` | camelCase | Sprachen der Anfragebeispiele (`curl, js, python, …`) und die erste davon. |
| `persist-credentials` | `persistCredentials` | `true`/`session`/`local`: API-Schlüssel zwischen Besuchen behalten. |
| `hash-navigation` | `hashNavigation` | `false`: `location.hash` nicht schreiben. |
| `heading` | `heading` | Der Titel im Kopf der Referenz. |
| `editable` | `editable` | Blockmodus: Bearbeitungs-Tabs. |
| `height` | `height` | Eine feste Höhe mit eigenem Scrollen (`720`, `80vh`); oder die CSS-Variable `--dsk-openapi-height` (pro Breakpoint). Die sticky Navigation der Referenz füllt dann die Box aus (`--oa-viewport-h` wird auf dieselbe Höhe gesetzt). |
| — | `send` | `(request) => Promise<response>` — Try-it auf Ihre eigene Weise senden; hat Vorrang vor `proxy`. |
| — | `labels` | Überschreibungen von Oberflächentexten. |

Methoden: `go(target, { tryIt? })` — zu einer Operation (`createOrder`,
`operation/createOrder`), einem Schema (`schema/Order`) oder einem Tag
scrollen; `open(id)` — zu einer Spezifikation aus `specs` wechseln; `print()`.
Getter: `loaded` (die geladene Spezifikation), `value` (Block- und Editor-Modus: der
aktuelle Text).

Events: `dsk:loaded` `{ id, title }`, `dsk:error` `{ id, message }`,
`dsk:active` `{ id }` (Spezifikation gewechselt), `dsk:change` `{ source }`
(Block- und Editor-Modus, nach einer Bearbeitung).

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
| — | `persistToggle` | `(change) => Promise` — Schalter stattdessen selbst persistieren (nur per Script); ablehnen zum Zurücksetzen. |
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
`{ kind, id, enabled, path, ok, rolledBack? }` — nachdem der Schalter
persistiert (`ok: true`) oder abgelehnt wurde (`ok: false`, zurückgesetzt);
`dsk:toggle-error` `{ change, message }`;
`dsk:navigate` `{ path }`; `dsk:poll-error` `{ message }`; `dsk:load`
`{ nodes, edges }`; Editor: `dsk:change` `{ graph, description, source }`,
`dsk:validate` `{ issues }`.

## `<dsk-board>`

Ein unendliches Whiteboard ([`@dskripchenko/board`](https://github.com/dskripchenko/board)):
Formen, Haftnotizen, Rahmen, Überschriften und Text, Verbinder, Emoji, Stift
und Marker. Standardmäßig eine schreibgeschützte Ansicht; `editable` schaltet
den Editor ein; `board-url` macht daraus ein gemeinsames Board, das mehrere
Personen gleichzeitig bearbeiten.

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

**Das gemeinsame Board** spricht mit `board-url` über
[den HTTP-Vertrag des Boards](https://github.com/dskripchenko/board/blob/main/docs/en/collaboration.md#the-http-contract):
`GET {base}/snapshot`, `POST {base}/batches`, `GET {base}/batches?after=N&wait=S`
(Long Polling), `POST {base}/presence`. Der `BoardServer` des Pakets ist die
Referenz-Serverlogik. Requests tragen die Cookies der Seite.

| Attribut | Property | |
|---|---|---|
| `src` | `src` | Die URL des Boards (JSON). Der Text des Elements (JSON in einem `<script type="application/json">`) funktioniert ebenfalls. |
| — | `board` | Das Board als Objekt (nur per Script); hat Vorrang vor `src` und Inhalt. |
| `board-url` | `boardUrl` | Die Basis-URL des gemeinsamen Boards: Zusammenarbeit. |
| `poll-interval` | `pollInterval` | Gemeinsames Board: alle N ms (mindestens 250) nach Änderungen fragen statt Long Polling — für Server, die eine Anfrage nicht offen halten können. |
| — | `provider` | Jeder andere Transport (nur per Script): ein `BoardProvider` — ein WebSocket, ein `MemoryHub`. |
| `editable` | `editable` | Der Editor (für ein Board aus `src` oder Inhalt). |
| `readonly` | `readonly` | Gemeinsames Board: nur ansehen. |
| `lockable` | `lockable` | Darf das Board für alle sperren und entsperren (Standard `true`); `false` für Personen, die das nicht dürfen. |
| `user-name`, `user-color`, `user-id` | camelCase | Wer bearbeitet: wird den anderen auf einem gemeinsamen Board angezeigt. |
| `name` | `name` | Hält ein verstecktes `<input name>` mit dem JSON des Boards im Element — ein einfaches Formular sendet es mit. |
| `minimap` | `minimap` | Die Minimap (standardmäßig an). |
| `height` | `height` | Standard 560; oder die CSS-Variable `--dsk-board-height`. |
| — | `labels` | Oberflächentexte (nur per Script). |

Methoden: `fit()`, `select(ids)`, `toPng()` (ein `Blob`), `toSvg()`
(`{ svg, width, height }`), `undo()`, `redo()`. Getter: `value` (das Board).

Events: `dsk:change` `{ board, ops, origin }`; `dsk:select` `{ ids }`;
`dsk:load` `{ objects }`.

## `<dsk-bpmn>` und `<dsk-dmn>`

```html
<dsk-bpmn src="/processes/order.bpmn" highlight="Task_Check"></dsk-bpmn>
<dsk-bpmn src="/processes/order.bpmn" editable properties name="process"></dsk-bpmn>
<dsk-dmn src="/decisions/loan.dmn" decision="Decision_Risk"></dsk-dmn>
```

BPMN-2.0-Prozesse und DMN-Entscheidungen über `@dskripchenko/bpmn`, so
gezeichnet, wie der Modeler sie gespeichert hat (Camunda Modeler, bpmn.io
und andere). Die Ansicht lässt sich verschieben und zoomen und meldet Klicks;
`editable` macht daraus den Editor — Palette, Kontextmenü,
Eigenschaften-Panel, Rückgängig —, und `name` legt das bearbeitete XML in ein
verstecktes Feld für ein Formular. `<dsk-dmn>` öffnet die Tabelle einer
Entscheidung per Doppelklick oder sofort mit `decision`.

| Attribut | Property | |
|---|---|---|
| `src` | `src` | Die Datei von einer URL statt aus dem Inhalt laden. |
| `editable` | `editable` | Der Editor statt der Ansicht. |
| `properties` | `properties` | (`dsk-bpmn`, Editor) Eigenschaften-Panel von Anfang an offen. |
| `diagram` | `diagram` | (`dsk-bpmn`) Welches Diagramm der Datei. |
| `decision` | `decision` | (`dsk-dmn`) Die Logik dieser Entscheidung öffnen. |
| `highlight` | `highlight` | Hervorzuhebende Element-ids, durch Komma getrennt. |
| `height` | `height` | Höhe; in CSS `--dsk-bpmn-height` / `--dsk-dmn-height`. |
| `name` | `name` | Ein verstecktes Feld mit dem XML für ein Formular. |

Methoden: `fit()`, `undo()`, `redo()`, `toSvg()`, `open(decision)` (DMN).
Getter: `value` (das XML). Ereignisse: `dsk:change` `{ xml }`, `dsk:select`
`{ ids }`, `dsk:element` `{ id }` (ein Klick), `dsk:open` `{ decision }`
(DMN), `dsk:error` `{ message }`.

## `<dsk-drawio>`

```html
<dsk-drawio src="/docs/architecture.drawio" page="Overview"></dsk-drawio>
```

draw.io-Dateien (diagrams.net) über `@dskripchenko/drawio`: komprimierte und
einfache Seiten sowie `.drawio.svg`. Eine Datei mit mehreren Seiten bekommt
Seiten-Reiter. Vue wird nicht geladen. Beschriftungen werden als Text
gelesen, nie als Markup; Formen von Herstellerbibliotheken werden zu
beschrifteten Platzhaltern, und Bilder aus dem Netz werden nur mit
`external-images` geladen.

| Attribut | Property | |
|---|---|---|
| `src` | `src` | Die Datei von einer URL statt aus dem Inhalt laden. |
| `page` | `page` | Die zuerst gezeigte Seite: Index, id oder Name. |
| `label` | `label` | Der zugängliche Titel des SVG. |
| `external-images` | `externalImages` | Bilder von http(s)-Adressen laden. |

Methode: `showPage(page)`. Getter: `svg`, `pages` (Namen), `page` (Index).
Ereignisse: `dsk:render` `{ page, pages, width, height, warnings }`, `dsk:error`.

## `<dsk-asyncapi>`

```html
<dsk-asyncapi src="/api/events.yaml"></dsk-asyncapi>
```

Ein AsyncAPI-2.x- oder -3.0-Dokument einer ereignisgesteuerten API als
Referenz: Server, Operationen (Senden / Empfangen) mit ihren Kanälen,
Nachrichten, Schemata, Beispielen und Antworten. Die Property `spec` nimmt
ein geparstes Objekt.

| Attribut | Property | |
|---|---|---|
| `src` | `src` | Das Dokument von einer URL statt aus dem Inhalt laden. |
| `height` | `height` | Höhe eines scrollenden Bereichs; standardmäßig die Höhe der Seite. |

Getter: `loaded`. Ereignisse: `dsk:load`, `dsk:error` `{ message }`.

## `<dsk-kanban>`

```html
<dsk-kanban editable lockable name="plan">
  <script type="text/plain">
    # Release 3.0
    lanes: Zahlungen, Erstattungen
    tags: payments=info, refunds=warning

    ## Backlog
    - Sofortzahlungen #payments {lane: Zahlungen, who: Anna, due: 2026-11-15}
    - Teilerstattungen per API #refunds !high {lane: Erstattungen}
      Händler möchten einen Teil des Betrags ohne Anruf erstatten.

    ## In Arbeit {wip: 3}
    - [ACME-398](https://jira.example.com/browse/ACME-398) Antifraud v2 {who: Oleg}

    ## Erledigt {done}
    - Signierte Webhooks #payments
  </script>
</dsk-kanban>
```

Ein Board aus Spalten und Karten, als Markup geschrieben und mit dem
`UidBoard` des Kits gezeichnet. Das Markup liest sich wie Markdown:

- `# …` — der Titel des Boards; `key: value`-Zeilen vor der ersten Spalte —
  Einstellungen: `lanes` (Swimlanes, in Reihenfolge), `tags` (ein Ton pro
  Tag: `info`, `success`, `warning`, `danger`).
- `## Spalte {wip: 3, done}` — eine Spalte; `wip` ist ein WIP-Limit (der
  Zähler wird darüber rot), `done` markiert die Spalte der erledigten Karten
  (durchgestrichen, nie überfällig).
- `- Kartentitel #tag !high {lane: …, who: …, due: JJJJ-MM-TT, beliebig: Wert}` —
  eine Karte. Der Titel kennt Inline-Markdown (Links, Code, Fett); `!high` /
  `!low` — Priorität; Eigenschaften in geschweiften Klammern; darunter
  eingerückte Zeilen — die Beschreibung der Karte in Markdown.
  `<!-- Kommentare -->` bleiben erhalten.

Ein Klick auf eine Karte öffnet ihre Details. Mit `editable` werden Karten
zwischen Spalten und Lanes gezogen, `+` in einer Spalte fügt eine Karte
hinzu, das Panel ändert oder löscht sie, und der Reiter **Quelltext**
bearbeitet das Markup selbst, mit Problemen pro Zeile. Jede Änderung
schreibt nur die Zeilen um, die sie betrifft — Kommentare, Leerzeilen und
der übrige Text bleiben, wie sie waren — und wird als `dsk:change` mit dem
ganzen neuen Quelltext gemeldet. Über dem Board filtern Tags und Personen.

`locked` macht das Board für alle schreibgeschützt; `lockable` zeigt das
Schloss, das `dsk:lock` `{ locked }` sendet: der Host speichert das (als
Attribut oder dort, wo er den Quelltext ablegt), so wie er den Quelltext bei
`dsk:change` speichert.

| Attribut | Eigenschaft | |
|---|---|---|
| `src` | `src` | Das Markup von einer URL statt aus dem Inhalt laden. |
| `editable` | `editable` | Drag and Drop, neue und geänderte Karten, der Quelltext-Reiter. |
| `locked` | `locked` | Schreibgeschützt, unabhängig von `editable`. |
| `lockable` | `lockable` | Die Schloss-Schaltfläche zeigen. |
| `name` | `name` | Ein verstecktes Feld mit dem Markup, für ein Formular. |

Getter: `value` (das Markup), `board` (das gelesene Board). Ereignisse:
`dsk:change` `{ source }`, `dsk:lock` `{ locked }`, `dsk:open` `{ card }`,
`dsk:load` `{ problems }`, `dsk:error` `{ message }`.

## `<dsk-calendar>`

```html
<dsk-calendar view="month" editable lockable name="events">
  <script type="text/plain">
    # Releases und Bereitschaft
    tags: release=danger

    2026-11-03 10:00-11:00 Release-Demo #release {where: Raum 4}
    2026-11-10..2026-11-14 Code-Freeze #release
    every mon 11:00-11:30 Sprintplanung {from: 2026-11-02, until: 2026-12-28, except: 2026-11-30}
    every 2 weeks fri 16:00-17:00 Retro {from: 2026-11-06}
    every month last fri Release in Produktion #release
    every year 12-31 Neujahrs-Freeze
  </script>
</dsk-calendar>
```

Als Markup geschriebene Termine im `UidCalendar` des Kits: Tag, Woche,
Monat, Jahr und Agenda. Zuerst Einstellungen (`key: value`) — `view` (die
erste Ansicht), `date` (das erste Datum), `tags` (ein Ton pro Tag) —, dann
ein Termin pro Zeile:

- **Wann**: ein Datum `2026-11-03` oder ein Zeitraum `2026-11-10..2026-11-14`,
  dann optional eine Uhrzeit `10:00` oder `10:00-11:00` (ohne — ganztägig).
- **Was**: der Titel (Inline-Markdown), `#Tags` (der erste gibt die Farbe),
  `{Eigenschaften}` — `where`, `who`, `url`, `description` oder eigene.
- **Wiederholungen** beginnen mit `every` statt mit einem Datum — eine
  Teilmenge von RRULE aus RFC 5545 in Worten:

  | Zeile | Wiederholt sich |
  |---|---|
  | `every day`, `every 3 days` | jeden (dritten) Tag |
  | `every mon,wed`, `every 2 weeks fri` | an diesen Wochentagen, jede (zweite) Woche |
  | `every month 15`, `every month last` | an diesem Tag des Monats, am letzten Tag |
  | `every month 2nd tue`, `every month last fri` | am n-ten / letzten Wochentag |
  | `every year 12-31` | jedes Jahr an diesem Datum |

  Grenzen und Ausnahmen stehen in den Eigenschaften: `from` (das erste
  Datum; nötig für `count` und „alle N“), `until`, `count`, `except` (Daten,
  durch Kommas getrennt). `{rrule: FREQ=WEEKLY;BYDAY=MO,WE;INTERVAL=2}` nimmt
  eine Regel, wie sie ist — etwa aus iCal kopiert. Wiederholungen werden nur
  für die sichtbaren Tage aufgelöst.

Mit `editable`: einen Termin auf einen anderen Tag oder eine andere Stunde
ziehen, ihn in Tag- und Wochenansicht verlängern, eine leere Stelle (einen
Tag im Monat oder **+ Termin**) anklicken für einen neuen Termin. Der
**Termin-Builder** setzt einen Termin aus Auswahlen zusammen — Datum oder
Zeitraum, ganztägig oder Uhrzeit, die Wiederholung („alle 2 Wochen Mo und
Mi“, „der letzte Freitag jedes Monats“, bis zu einem Datum / N-mal),
ausgelassene Daten — und zeigt die Zeile, die er schreibt. Beim Bearbeiten
eines Vorkommens fragt er, ob nur dieses oder die ganze Serie geändert wird:
dieses wird ein eigener Termin, und die Serie lässt sein Datum aus (Ziehen
eines Vorkommens tut dasselbe). Der Reiter **Quelltext** bearbeitet das
Markup mit Problemen pro Zeile. Jede Änderung schreibt eine Zeile um (zwei
für ein abgetrenntes Vorkommen) und wird als `dsk:change` mit dem ganzen
neuen Quelltext gemeldet. `locked` und `lockable` wie bei `<dsk-kanban>`.

| Attribut | Eigenschaft | |
|---|---|---|
| `src` | `src` | Das Markup von einer URL statt aus dem Inhalt laden. |
| `view` | `view` | `day`, `week`, `month`, `year` oder `agenda` — die erste Ansicht. |
| `date` | `date` | Das erste Datum (`JJJJ-MM-TT`); standardmäßig heute. |
| `views` | `views` | Die angebotenen Ansichten, durch Kommas getrennt; standardmäßig alle fünf. |
| `editable` | `editable` | Ziehen, Verlängern, der Termin-Builder, der Quelltext-Reiter. |
| `locked` | `locked` | Schreibgeschützt, unabhängig von `editable`. |
| `lockable` | `lockable` | Die Schloss-Schaltfläche zeigen. |
| `name` | `name` | Ein verstecktes Feld mit dem Markup, für ein Formular. |

Getter: `value` (das Markup). Ereignisse: `dsk:change` `{ source }`,
`dsk:lock` `{ locked }`, `dsk:open` `{ event }`, `dsk:range`
`{ view, start, end }` (die sichtbaren Tage), `dsk:load` `{ problems }`,
`dsk:error` `{ message }`.

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

Der WYSIWYG-Editor (`@dskripchenko/wysiwyg`) — Werkzeugleiste (in der Locale
des Elements), Markdown-Kürzel, Slash-Menü, Tabellen, Quelltextmodus — mit **jedem
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
