/**
 * Reading an element's content: the text source of a diagram, a markdown
 * document, a flow model or an OpenAPI block, and the `<source>` / `<track>`
 * children of the players.
 *
 * The safest carrier for text is a `<script type="text/…">` child: the
 * browser neither parses nor shows it, so `<`, `&` and indentation arrive as
 * written. A `<template>` child gives its markup (the editor's initial HTML).
 * Plain text content works too, for short sources without markup.
 */

/** Children an element keeps after the upgrade: they carry data and are never shown. */
export const DATA_CHILDREN = new Set(['SCRIPT', 'TEMPLATE', 'SOURCE', 'TRACK', 'INPUT'])

/** Removes the common indentation and the blank lines around a source. */
export function dedent(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  while (lines.length > 0 && lines[0]!.trim() === '') lines.shift()
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop()
  let indent = Infinity
  for (const line of lines) {
    if (line.trim() === '') continue
    indent = Math.min(indent, line.length - line.trimStart().length)
  }
  if (!Number.isFinite(indent) || indent === 0) return lines.join('\n')
  return lines.map((line) => line.slice(Math.min(indent, line.length - line.trimStart().length))).join('\n')
}

/** Executable script types: never treated as a data carrier. */
function isDataScript(el: Element): boolean {
  const type = (el.getAttribute('type') ?? '').trim().toLowerCase()
  return type !== '' && type !== 'module' && !/javascript|ecmascript/.test(type)
}

/**
 * The element's text source: a data `<script>` child, else a `<template>`
 * child's markup, else the text content of everything that is not a data child.
 */
export function readSource(el: Element): string {
  for (const child of Array.from(el.children)) {
    if (child.tagName === 'SCRIPT' && isDataScript(child)) return dedent(child.textContent ?? '')
  }
  for (const child of Array.from(el.children)) {
    if (child.tagName === 'TEMPLATE') return dedent((child as HTMLTemplateElement).innerHTML)
  }
  let text = ''
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? ''
    else if (node.nodeType === Node.ELEMENT_NODE && !DATA_CHILDREN.has((node as Element).tagName) && !(node as Element).hasAttribute('data-dsk-root')) {
      text += node.textContent ?? ''
    }
  }
  return dedent(text)
}

function attributes(el: Element): Record<string, string> {
  const out: Record<string, string> = {}
  for (const attr of Array.from(el.attributes)) {
    // data-title → title: `title` itself would be a tooltip on nothing visible, but both work.
    const name = attr.name.startsWith('data-') ? attr.name.slice(5) : attr.name
    if (!(name in out) || attr.name.startsWith('data-')) out[name] = attr.value
  }
  return out
}

/** `<source>` and `<track>` children as attribute maps. */
export function readMediaChildren(el: Element): { sources: Record<string, string>[]; tracks: Record<string, string>[] } {
  const sources: Record<string, string>[] = []
  const tracks: Record<string, string>[] = []
  for (const child of Array.from(el.children)) {
    if (child.tagName === 'SOURCE') sources.push(attributes(child))
    else if (child.tagName === 'TRACK') tracks.push(attributes(child))
  }
  return { sources, tracks }
}
