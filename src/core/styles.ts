/**
 * Stylesheets, loaded once each. They go in front of the page's own styles,
 * so the page can override any of them without `!important`.
 */

const loading = new Map<string, Promise<void>>()

function firstPageStyle(doc: Document): Element | null {
  return doc.head.querySelector('link[rel="stylesheet"]:not([data-dsk-embed]), style:not([data-dsk-embed])')
}

/** The last stylesheet the embed inserted, to keep ours in the order they were asked for. */
function lastOwnStyle(doc: Document): Element | null {
  const own = doc.head.querySelectorAll('link[data-dsk-embed], style[data-dsk-embed]')
  return own.length > 0 ? own[own.length - 1]! : null
}

function insert(doc: Document, el: HTMLElement): void {
  const own = lastOwnStyle(doc)
  if (own) own.after(el)
  else {
    const page = firstPageStyle(doc)
    if (page) page.before(el)
    else doc.head.appendChild(el)
  }
}

/** Adds a `<link rel="stylesheet">`; resolves when it has loaded (or failed — the page still works). */
export function loadStylesheet(href: string, doc: Document = document): Promise<void> {
  const known = loading.get(href)
  if (known) return known
  const existing = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).find((l) => l.href === href)
  if (existing) {
    loading.set(href, Promise.resolve())
    return loading.get(href)!
  }
  const link = doc.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.setAttribute('data-dsk-embed', '')
  const done = new Promise<void>((resolve) => {
    link.addEventListener('load', () => resolve(), { once: true })
    link.addEventListener('error', () => {
      console.error(`[dsk-embed] stylesheet failed to load: ${href}`)
      resolve()
    }, { once: true })
  })
  insert(doc, link)
  loading.set(href, done)
  return done
}

/** Adds a `<style>` with the given CSS once per id. */
export function injectStyle(id: string, css: string, doc: Document = document): void {
  if (doc.querySelector(`style[data-dsk-embed="${id}"]`)) return
  const style = doc.createElement('style')
  style.setAttribute('data-dsk-embed', id)
  style.textContent = css
  insert(doc, style)
}
