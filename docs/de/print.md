# Druck

Eine Seite mit den Elementen von embed druckt sich als Dokument: Was auf dem
Bildschirm Bedienung ist, bleibt vom Papier fern, und eine lebendige
Zeichenfläche oder ein Player wird durch eine statische Form seiner selbst
ersetzt.

```js
// Verlässlich: auf alle Formen warten, drucken, die Widgets zurückholen.
const restore = await DskEmbed.print.prepare()
window.print()          // oder der eigene PDF-Druck einer Anwendung
restore()
```

Der Druck des Browsers selbst (Strg+P / ⌘P) erledigt das von allein über
`beforeprint` und `afterprint`; Formen, die einen Moment brauchen (eine
API-Referenz), sind nur sicher da, wenn zuvor auf `prepare()` gewartet wurde.
`prepare()` wartet zuerst (bis zu zehn Sekunden) auf Widgets, die noch
zeichnen — ein Element, das lädt, ein noch nicht eingehängter Markdown-Block —,
kann also aufgerufen werden, sobald der Inhalt auf der Seite ist.
`prepare(root)` beschränkt es auf einen Teil der Seite.

## Was jedes Widget druckt

| Widget | Auf Papier |
|---|---|
| `<dsk-diagram>`, Diagrammblöcke | das Diagramm wie gezeichnet |
| `<dsk-bpmn>`, `<dsk-dmn>` | das ganze Diagramm, nicht der sichtbare Teil; eine DMN-Datei mit der Tabelle jeder Entscheidung unter dem Diagramm |
| `<dsk-drawio>` | alle Seiten nacheinander, benannt, wenn es mehrere sind |
| `<dsk-flow>`, ```` ```flow ```` | der ganze Prozess, welchen Teil die Zeichenfläche auch zeigte |
| `<dsk-board>`, ```` ```board ```` | das ganze Board als ein Bild |
| `<dsk-openapi>` (Referenz, Operation) | die statische Druckansicht: jede Operation mit Parametern, Bodys, Antworten und Anfragebeispielen, dann die Schemas; eine einzelne Operation als ihre Karte |
| `<dsk-openapi>` (Block, Editor), `<dsk-asyncapi>` | wie angezeigt, ohne Scrollboxen oder feste Höhen |
| `<dsk-video>`, ```` ```video ```` | das Posterbild (sonst das Bild auf dem Schirm), der Titel, die Adresse, die Kapitel mit ihren Zeiten |
| `<dsk-audio>`, ```` ```audio ```` | Titel und Adresse oder die Playlist |
| `<dsk-kanban>`, `<dsk-calendar>` | das Board oder der gezeigte Zeitraum, ohne Filter, Umschalter, Pfeile oder Sperre |
| `<dsk-markdown>` | einspaltig ohne Inhaltsverzeichnis; Code bricht um; Blöcke werden nicht über Blätter getrennt |

Nie auf Papier: der Vollbildknopf, Werkzeugleisten und die Bedienelemente des
Kits. Ein ```` ```drawio ````-Block in Markdown druckt seine erste Seite; das
Element `<dsk-drawio>` alle.

## Wie es funktioniert

Jedes Widget, das nicht selbst schon Papier ist, registriert eine Druckform.
`prepare()` baut sie alle, setzt jede direkt hinter ihr Widget und markiert
das Widget mit `dsk-print-hidden`; unter `@media print` ist das Widget
verborgen und die Form sichtbar (`.dsk-print-form`), auf dem Bildschirm
umgekehrt — die Seite verschiebt sich also nicht, solange die Formen da sind.
Gestalten lassen sich die Formen über `.dsk-print-form` im eigenen Druck-CSS.
