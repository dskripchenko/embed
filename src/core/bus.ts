/**
 * The event bus is the DOM itself. Every event is a bubbling `dsk:<name>`
 * CustomEvent: an element's own events start at the element and reach the
 * document; `emit` without a target dispatches on the document. `on` listens
 * on the document, so it hears both — and a host framework can listen with
 * plain `addEventListener` on any ancestor instead.
 */

export const EVENT_PREFIX = 'dsk:'

export type BusListener = (detail: any, event: CustomEvent) => void

export interface Bus {
  on(name: string, fn: BusListener): () => void
  once(name: string, fn: BusListener): () => void
  off(name: string, fn: BusListener): void
  emit(name: string, detail?: unknown, target?: EventTarget): boolean
}

export function eventName(name: string): string {
  return name.startsWith(EVENT_PREFIX) ? name : EVENT_PREFIX + name
}

export function createBus(root: EventTarget = document): Bus {
  const wrapped = new Map<BusListener, Map<string, EventListener>>()

  function add(name: string, fn: BusListener, once: boolean): () => void {
    const type = eventName(name)
    const listener: EventListener = (event) => {
      if (once) off(name, fn)
      fn((event as CustomEvent).detail, event as CustomEvent)
    }
    let byType = wrapped.get(fn)
    if (!byType) wrapped.set(fn, (byType = new Map()))
    // One registration per (name, fn), as addEventListener does.
    if (byType.has(type)) return () => off(name, fn)
    byType.set(type, listener)
    root.addEventListener(type, listener)
    return () => off(name, fn)
  }

  function off(name: string, fn: BusListener): void {
    const type = eventName(name)
    const listener = wrapped.get(fn)?.get(type)
    if (!listener) return
    root.removeEventListener(type, listener)
    wrapped.get(fn)?.delete(type)
  }

  return {
    on: (name, fn) => add(name, fn, false),
    once: (name, fn) => add(name, fn, true),
    off,
    emit(name, detail, target) {
      const event = new CustomEvent(eventName(name), { detail, bubbles: true, composed: true, cancelable: true })
      return (target ?? root).dispatchEvent(event)
    },
  }
}
