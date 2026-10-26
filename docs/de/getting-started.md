# Erste Schritte

`@dskripchenko/embed` bringt die Komponenten des Autors als HTML-Tags auf jede
beliebige Webseite — reines HTML, ein CMS-Template, WordPress, Blade, React,
Vue — geladen von einem CDN. Die Elemente teilen sich ein Vue, eine Kopie des
UI-Kits und einen Satz Block-Renderer, und sie kommunizieren über DOM-Events
miteinander.

| Element | Was es ist | Basiert auf |
|---|---|---|
| `<dsk-video>` | Videoplayer: Quellen, Qualitätsmenü, Untertitel, Kapitel, Vorschaubilder, HLS | `@dskripchenko/ui` UidVideo |
| `<dsk-audio>` | Audioplayer, Playlist, Wellenform | `@dskripchenko/ui` UidAudio |
| `<dsk-diagram>` | Mermaid-Diagramm (11 Typen) → SVG | `@dskripchenko/diagrams` |
| `<dsk-openapi>` | OpenAPI-Referenz, eine einzelne Operation oder ein API-Block | `@dskripchenko/openapi` |
| `<dsk-flow>` | Prozessansicht mit Monitoring oder der Prozesseditor | `@dskripchenko/flow` |
| `<dsk-markdown>` | Markdown mit lebendigen Blöcken | `@dskripchenko/ui` UidMarkdown |
| `<dsk-editor>` | WYSIWYG-Editor mit lebendigen Blöcken, formulartauglich | `@dskripchenko/wysiwyg` |

## Der Loader (empfohlen)

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

`embed.js` ist gzip-komprimiert etwa 9 KB groß. Es ist mit Absicht ein
**klassisches** Script: Es läuft dort, wo es steht, schreibt eine
[Import Map](#import-maps) für die gemeinsame Laufzeit, definiert die Elemente
und `window.DskEmbed` — und sonst nichts. Vue, das Kit und jedes
Plugin-Paket werden vom CDN geholt, sobald das erste Element erscheint, das
sie braucht; eine Seite mit einem Diagramm lädt das Diagramm-Paket und
nichts weiter.

Binden Sie es im `<head>` ein, vor jedem `<script type="module">` der Seite.

`@1` folgt dem neuesten 1.x-Release. Der Loader pinnt alles, was er holt —
seine eigenen Plugins und die Laufzeitpakete — auf genau die Versionen, mit
denen dieses Release gebaut und getestet wurde, sodass ein Versionsbereich im
Script-Tag niemals Versionen mischt. Pinnen Sie auch das Tag (`@1.0.0`) für
eine Seite, die sich nie ändern darf.

### Optionen am Script-Tag

```html
<script src="…/embed.js"
        data-theme="system"
        data-locale="ru"
        data-render-blocks="article"></script>
```

| Attribut | |
|---|---|
| `data-theme` | `light`, `dark` oder `system`; siehe [Konfiguration](config-and-events.md#theme). |
| `data-locale` | `en` oder `ru`. Standard: das `<html lang>` der Seite. |
| `data-cdn-base` | Woher die Laufzeit kommt (Standard: das CDN, von dem der Loader kam, sonst jsDelivr). |
| `data-render-blocks` | Rendert die Codeblöcke unter diesem Selektor, sobald die Seite geparst ist (leerer Wert: `body`). Siehe [Blöcke](blocks.md). |

Dieselben Optionen sowie `versions`, um einzelne Pins zu überschreiben, lassen
sich vor dem Loader als `window.DskEmbedConfig = { theme, locale, cdnBase, versions }`
setzen.

## Das Fat Bundle

```html
<script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.bundle.js"></script>
```

Eine Datei mit Vue, dem Kit, jedem Plugin-Paket und allen Styles darin: keine
Import Map, keine weiteren Requests. Dieselben Elemente und dieselbe
`DskEmbed`-API. Es ist die ganze Laufzeit auf einmal — etwa 2 MB,
**558 KB gzip-komprimiert** — während der Loader nur holt, was die Seite
verwendet. Nutzen Sie es dort, wo Import Maps nicht verfügbar sind oder wo
zur Laufzeit nichts nachgeladen werden darf.

Verwenden Sie auf einer Seite das eine oder das andere, nicht beides (das
zweite, das geladen wird, wird mit einer Warnung ignoriert).

## Self-Hosting

Alles, was der Loader holt, kann von Ihrem eigenen Server ausgeliefert werden,
in der Verzeichnisstruktur des CDN. Aus einem Checkout des Pakets:

```bash
pnpm install && pnpm build
node scripts/mirror.mjs public/static     # → public/static/npm/<pkg>@<version>/…
```

```html
<script src="/static/npm/@dskripchenko/embed@1.0.0/dist/embed.js"></script>
```

Der Loader entnimmt die CDN-Wurzel seiner eigenen Adresse (dem Teil vor
`@dskripchenko/embed@`), daher braucht eine gespiegelte Kopie keine
Konfiguration. Für jede andere Struktur setzen Sie `data-cdn-base` und behalten
die Pfade `<pkg>@<version>/` bei.

## Import Maps

Browser lösen Bare Imports (`import 'vue'`) über Import Maps auf, und eine Map
zählt nur, wenn sie im Dokument steht, bevor das erste Modul lädt, das sie
braucht. Deshalb ist der Loader ein klassisches Script im `<head>`.

Die Map, die er schreibt (auch als `dist/importmap.json` veröffentlicht):

| Specifier | Zeigt auf |
|---|---|
| `vue` | `vue@3.5.44/dist/vue.runtime.esm-browser.prod.js` |
| `@dskripchenko/ui`, `/icons`, `/hls` | `@dskripchenko/ui@1.15.1/dist/…` |
| `@dskripchenko/wysiwyg` | `@dskripchenko/wysiwyg@0.5.0/dist/index.mjs` |
| `@dskripchenko/diagrams` | `@dskripchenko/diagrams@1.1.0/dist/index.mjs` |
| `@dskripchenko/openapi`, `/vue` | `@dskripchenko/openapi@1.1.0/dist/…` |
| `@dskripchenko/flow`, `/vue`, `/mermaid` | `@dskripchenko/flow@1.0.1/dist/…` |
| `lucide-vue-next` | der eigene Ein-Datei-Build des Embeds mit den Icons, die die Pakete verwenden |

Die Icons sind ein Sonderfall: Der ESM-Build von `lucide-vue-next` besteht aus
einem Modul pro Icon — rund 1 500 Requests über eine Map — daher liefert das
Embed die 109 Icons, die seine Pakete importieren, als eine Datei aus
(7 KB gzip-komprimiert).

**Eine Seite mit eigener Import Map.** Einträge, die die Seite selbst mappt,
bleiben die der Seite; das Embed fügt eine zweite Map mit dem Rest hinzu, die
Browser mit Unterstützung für mehrere Import Maps zusammenführen (Chromium seit
133; der Browsertest läuft in aktuellem Chromium und WebKit durch — prüfen Sie
andere Engines, bevor Sie sich darauf verlassen). Mappt die Seite `vue` oder
das Kit auf eine andere Datei, warnt der Loader: Zwei Kopien von Vue machen
die Elemente kaputt. Mappen Sie sie auf genau die Dateien oben — dann teilen
sich der eigene Vue-Code der Seite und die Elemente ein Vue:

```html
<script type="importmap">
  { "imports": { "vue": "https://cdn.jsdelivr.net/npm/vue@3.5.44/dist/vue.runtime.esm-browser.prod.js" } }
</script>
<script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js"></script>
```

Für Browser ohne mehrere Import Maps kopieren Sie die Einträge aus
`dist/importmap.json` in Ihre eine Map und laden `embed.js` trotzdem danach.

**Als Modul.** `<script type="module" src="…/embed.js">` funktioniert ebenfalls,
in Browsern mit mehreren Import Maps; der Loader warnt dann einmal, da die Map
in älteren Browsern zu spät käme.

## Browser

Aktuelles Chromium, Safari und Firefox. Der Loader braucht Import Maps (Chrome
89+, Safari 16.4+, Firefox 108+); das Fat Bundle läuft überall, wo ES2022
läuft. Es gibt keinen Legacy-Build.

## Content Security Policy

Der Loader braucht:

- `script-src` — den CDN-Origin (`https://cdn.jsdelivr.net`) und die Import
  Map: Ein inline `<script type="importmap">` zählt als Inline-Script. Unter
  einer strikten Policy schreiben Sie die Map selbst — die Einträge aus
  `dist/importmap.json` in einem `<script type="importmap" nonce="…">` vor
  `embed.js`; der Loader findet dann jeden Eintrag vor und schreibt nichts.
  (Unter `'strict-dynamic'` ist die vom Loader eingefügte Map per Script
  erzeugt und meist erlaubt, aber die explizite Map ist der portable Weg.)
- `style-src` — den CDN-Origin (die Stylesheets des Kits kommen als `<link>`)
  und `'unsafe-inline'` oder eine Nonce für das eigene kleine `<style>` des
  Embeds und für die Inline-`style`-Attribute der Komponenten.
- `connect-src` — alles, was Ihre Elemente abrufen: `src`, `poll-url`,
  `toggle-url`, Spezifikationen und die APIs, die Try-it aufruft.
- `media-src` / `img-src` — Ihre Medien; `blob:` für HLS (MediaSource).
- `worker-src` wird nicht benötigt.

Das Fat Bundle braucht `script-src` für seine eigene URL sowie dieselben
Regeln für `style-src`, `connect-src` und Medien. Nichts verwendet `eval`.

## Versionierung

Semantic Versioning, mit einer zusätzlichen Regel: Ein Release pinnt seine
Laufzeit. Die Versionen von Vue, dem Kit und den Plugin-Paketen sind Teil des
Releases — `DskEmbed.versions` listet sie auf — und ein neuer Pin ist ein
neues Embed-Release (ein Patch für Patches der Pakete, ein Minor für ihre
Features). Element-Attribute, Properties, Events und die `DskEmbed`-API folgen
SemVer.

## Weiter

- [Elemente](elements.md) — jedes Attribut, jede Property, Methode und jedes Event
- [Blöcke](blocks.md) — die Registry der Block-Renderer und `renderBlocks()`
- [Konfiguration und Events](config-and-events.md) — Theme, Locale, der Event-Bus, Zusammenspiel
- [Frameworks](frameworks.md) — React, Vue, WordPress, Blade, einfache Formulare
