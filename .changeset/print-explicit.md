---
'@dskripchenko/embed': patch
---

Print forms a page prepared itself (`await DskEmbed.print.prepare()`) stay through `beforeprint` / `afterprint`: a print to PDF fires those events too, and the automatic handling took the forms away and rebuilt them too late, so the live widgets were printed.
