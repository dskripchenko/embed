---
'@dskripchenko/embed': minor
---

Print: every element on paper as a document. `DskEmbed.print.prepare(root?)` puts each widget's static print form in its place and resolves with the function that takes them away; the browser's own print does both through `beforeprint`/`afterprint`. BPMN/DMN print the whole diagram (DMN with its decision tables), draw.io every page with its name, flows and boards whole (elements and blocks), the OpenAPI reference and operation their static print views, video its poster, address and chapters, audio its playlist; full-screen buttons and the kit's controls stay off paper, scroll boxes give way. Uses @dskripchenko/openapi 1.3 and @dskripchenko/ui 1.23.1.
