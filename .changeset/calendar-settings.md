---
'@dskripchenko/embed': patch
---

`<dsk-calendar>`: the markup's `view:` and `date:` settings apply once the markup has loaded (from `src` or the element's body) — they were read before it arrived, so the calendar opened on today's month. The `view` / `date` attributes still win, and a reader who has already moved stays where they are.
