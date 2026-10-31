---
'@dskripchenko/embed': minor
---

The kanban and the calendar now come from the kit (`UidKanban`, `UidEventCalendar` in @dskripchenko/ui 1.20), the markup format and behaviour unchanged; their plugins shrink to about 1.5 KB. Their classes follow the kit: `uid-kanban__…` and `uid-event-calendar__…` instead of `dsk-kanban__…` and `dsk-cal__…` — update custom CSS that targeted the old ones. Diagrams 1.3.3: edges pass nodes without cutting their corners, frame titles are drawn above the edges.
