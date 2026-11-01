---
'@dskripchenko/embed': patch
---

`DskEmbed.print.prepare()` waits (up to ten seconds) for the widgets in its scope that are still drawing — an element loading, a markdown block not mounted yet — before it builds the print forms, so it can be called the moment the content is on the page. The printer is set up when any plugin with Vue loads, not only with the first print form.
