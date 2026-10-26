# Konfiguration und Events

## Konfiguration

```js
DskEmbed.configure({ theme: 'dark', locale: 'ru' })
DskEmbed.config  // { theme, resolvedTheme, locale, cdnBase, versions }
```

### Theme

| `theme` | |
|---|---|
| `null` (Standard) | Der Seite folgen: ihrem `<html data-theme>` oder den hellen Farben des Kits, wenn die Seite keines setzt. |
| `'light'`, `'dark'` | Wird in `<html data-theme>` geschrieben. |
| `'system'` | `prefers-color-scheme`, live verfolgt, in `<html data-theme>` geschrieben. |

Die Themes des Kits hängen an `<html data-theme>`, daher **gilt das Theme
seitenweit**: Menüs und Dialoge, die die Komponenten öffnen, werden an
`<body>` angehängt, und ein Theme pro Element würde sie nicht erreichen. Eine
Seite, die ihr eigenes `data-theme` umschaltet, wird verfolgt — kein Aufruf
nötig:

```js
document.documentElement.dataset.theme = 'dark'   // jedes Element folgt
```

Ohne Theme und ohne das Attribut sind die hellen Tokens des Kits auf
`:root:not([data-theme])` definiert — nur Custom Properties (`--uid-*`),
nichts, was die Seite selbst verwendet.

Farben sind CSS Custom Properties. Überschreiben Sie die Tokens des Kits auf
`:root` (oder `:root[data-theme='dark']`), z. B. `--uid-accent`; Diagramme
lesen `--dg-*` (standardmäßig auf die Tokens des Kits abgebildet).

### Locale

`'en'` oder `'ru'`. Standard: das `<html lang>` der Seite (`ru…` → `ru`, alles
andere → `en`), verfolgt, wenn die Seite es ändert. `configure({ locale })`
legt sie fest; `configure({ locale: null })` kehrt zu der der Seite zurück.
Das eigene Attribut `locale` eines Elements hat für dieses Element Vorrang.

Die Locale erreicht die Komponenten des Kits (Player-Bedienelemente, Dialoge,
Leerzustände), die OpenAPI-Widgets, die Flow-Ansichten und die Werkzeugleiste
des Editors.

### Ort der Laufzeit

`cdnBase` und `versions` bestimmen, von wo der Loader die Laufzeit holt. Sie
werden einmal gelesen, bevor die Import Map geschrieben wird: Setzen Sie sie
am Script-Tag (`data-cdn-base`) oder in `window.DskEmbedConfig` vor dem
Loader, nicht später über `configure()`. Siehe
[Self-Hosting](getting-started.md#self-hosting).

## Events

Jedes Event ist ein bubbelndes DOM-`CustomEvent` namens `dsk:<name>`, mit der
Payload in `detail`. Die Events eines Elements starten am Element;
`DskEmbed.emit` ohne Ziel sendet auf `document`. Lauschen Sie auf beide
Arten:

```js
// Der Bus: lauscht auf document, hört jedes Element.
const off = DskEmbed.on('node', (detail, event) => {
  console.log(detail.id, 'in', event.target.id)
})
off()

DskEmbed.once('ready', (detail, event) => { /* das erste Element hat gerendert */ })

// Reines DOM, an jedem Vorfahren oder am Element selbst.
document.querySelector('#process').addEventListener('dsk:node', (e) => console.log(e.detail))
```

`DskEmbed.emit(name, detail?, target?)` sendet Ihre eigenen
`dsk:<name>`-Events auf demselben Bus — eine Seite kann ihre eigenen Widgets
auf dieselbe Weise mit den Elementen koordinieren.

| Event | Von | `detail` |
|---|---|---|
| `dsk:ready` | jedem Element | `{ tag }` |
| `dsk:error` | jedem Element | `{ message, … }` |
| `dsk:config` | `document` | `{ theme, resolvedTheme, locale }` bei jeder Änderung |
| `dsk:play`, `dsk:pause`, `dsk:ended`, `dsk:timeupdate` | video, audio, Medienblöcken | `{ currentTime, duration, src }` |
| `dsk:chapter`, `dsk:chapterchange` | video | `{ index, title, start, end }` (`chapterchange`: oder `null`) |
| `dsk:trackchange` | audio | `{ index }` |
| `dsk:qualitychange`, `dsk:audiotrackchange` | video | `{ label }` |
| `dsk:render` | diagram | `{ type, width, height }` |
| `dsk:loaded`, `dsk:active` | openapi | `{ id, title }`, `{ id }` |
| `dsk:change` | openapi (Block), flow (Editor), editor | `{ source }`, `{ graph, description, source }`, `{ value }` |
| `dsk:node` | flow, Flow-Blöcken | `{ id, path, node, data }` |
| `dsk:select`, `dsk:navigate` | flow | `{ kind, id, path, element }`, `{ path }` |
| `dsk:toggle`, `dsk:toggle-error` | flow | die Änderung mit `ok` (und `rolledBack` bei Ablehnung); `{ change, message }` |
| `dsk:poll-error`, `dsk:load`, `dsk:validate` | flow | `{ message }`, `{ nodes, edges }`, `{ issues }` |
| `dsk:input`, `dsk:editor-ready` | editor | `{ value }`, `{ controller }` |
| `dsk:embed-ready` | `document` | `{ version, mode }` — die API ist definiert |

## Zusammenspiel

Die Elemente wissen nichts voneinander; die Seite verbindet sie über Events
und Methoden. Zwei Rezepte.

### Ein Prozessschritt öffnet seine API-Operation

Ein Flow-Knoten trägt seine Operation in `data` (auch in den Details des
Knotens angezeigt):

```json
{ "id": "pay", "type": "task", "label": "Pay", "data": { "operation": "payOrder" } }
```

Deklarativ — `openapi-target` scrollt eine Referenz zur Operation:

```html
<dsk-flow src="/process.json" openapi-target="#api"></dsk-flow>
<dsk-openapi id="api" src="/openapi.yaml"></dsk-openapi>
```

Oder über den Bus — hier wechselt eine Operationskarte neben dem Prozess:

```html
<dsk-flow src="/process.json" details="false"></dsk-flow>
<dsk-openapi id="card" src="/openapi.yaml" operation="createOrder"></dsk-openapi>
<script>
  DskEmbed.on('node', ({ data }) => {
    if (data.operation) document.querySelector('#card').operation = data.operation
  })
</script>
```

### Ein Prozessschritt spielt seinen Teil eines Videos ab

```json
{ "id": "pay", "type": "task", "label": "Pay", "data": { "chapter": "Payment" } }
```

```html
<dsk-flow src="/process.json" media-target="#tour"></dsk-flow>
<dsk-video id="tour" src="/tour.mp4">
  <track kind="chapters" src="/tour.chapters.vtt" default>
</dsk-video>
```

`data.chapter` ist der Titel eines Kapitels (oder ein Teil davon) oder sein
Index; `data.time` ist eine Position in Sekunden. Von Hand:

```js
DskEmbed.on('node', ({ data }) => {
  const video = document.querySelector('#tour')
  if (data.chapter !== undefined) video.playChapter(data.chapter)
  else if (data.time !== undefined) video.seek(data.time).then(() => video.play())
})
```

Umgekehrt — der Prozess folgt dem Video:

```js
document.querySelector('#tour').addEventListener('dsk:chapter', (e) => {
  document.querySelector('dsk-flow').select(STEP_OF_CHAPTER[e.detail.title])
})
```
