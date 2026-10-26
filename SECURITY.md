# Security policy

The elements show content that someone other than the reader often wrote —
markdown from a CMS, an OpenAPI spec, a process model, monitoring data — on
someone else's page. The embed is built so that none of it becomes active
content.

## What is guaranteed

- **No HTML from attributes or data.** Attribute values are parsed as text,
  numbers, booleans or JSON; none is inserted as markup. Models, snapshots
  and specs are rendered through the packages' components (Vue
  interpolation), which escape text.
- **Markdown** is rendered by the kit's UidMarkdown, which escapes raw HTML
  in the source. The editor sanitizes its HTML through an allow-list
  (`@dskripchenko/wysiwyg`'s `sanitizeHtml`), on load and on paste.
- **Diagrams** are SVG built by `@dskripchenko/diagrams`, which escapes every
  label by construction.
- **Block renderers are the page's code.** A renderer that returns `{ html }`
  is trusted to have built that markup itself with user text escaped; the
  built-in ones do. Register only renderers you control.
- **No evaluation.** Nothing uses `eval`, `new Function` or inline event
  handlers.
- **Requests are the page's.** The elements fetch only the URLs the page
  gives them (`src`, `poll-url`, `toggle-url`, `subgraph-url`, specs), as
  same-origin `fetch` with the page's cookies. OpenAPI try-it sends requests
  only when the reader presses "Send", to the servers the spec names (or
  through the page's `send`).
- **Pinned runtime.** The loader fetches exact versions of Vue, the kit and
  the plugin packages from the CDN, never a range. A page that needs
  integrity guarantees beyond the CDN's should [self-host](docs/en/getting-started.md#self-hosting)
  the mirrored files; see also the CSP notes there.

## Reporting a vulnerability

Please report security issues privately to the author through GitHub's
"Report a vulnerability" on the repository, not in public issues.
