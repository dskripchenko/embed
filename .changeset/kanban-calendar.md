---
'@dskripchenko/embed': minor
---

`<dsk-kanban>` and `<dsk-calendar>`, with ```` ```kanban ```` and ```` ```calendar ```` blocks. Both are written as markup in the element's body (or `src`): a kanban board — columns with WIP limits, swimlanes, cards with tags, priority, assignee, due date and a description; a calendar — dates, ranges, times and repeats in words (an RRULE subset, or `{rrule: …}`), shown by day, week, month, year or as an agenda. With `editable`, cards and events are dragged, edited in a panel (the calendar's event builder puts repeats together from choices; one occurrence of a series can be changed on its own), and the markup has a source tab; each edit rewrites only its own lines and is reported as `dsk:change` with the new source. `locked` / `lockable` and `dsk:lock` give a lock the host keeps. Elements now mark themselves `data-dsk`, and the base styles select them by it. Runtime: @dskripchenko/ui 1.18.0.
