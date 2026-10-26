/**
 * `<dsk-editor>`: the WYSIWYG editor (@dskripchenko/wysiwyg) with every
 * registered block renderer live — an ```openapi block is the API widget,
 * editable in place, its edits written back into the HTML.
 *
 * The value is HTML. It comes from the `value` attribute or property, a
 * `<template>` child, or a bound input; it goes out through the `value`
 * property, `input` / `change` events, and the bound input: `name="body"`
 * creates a hidden `<input name="body">` inside the element (a plain form
 * submits it), `input="#body"` writes to an existing field.
 */
import { shallowRef } from 'vue'
import { DskWysiwyg } from '@dskripchenko/wysiwyg'
import type { ElementContext, ElementInstance, Host } from '../core/types'
import { instanceRef, mountElementView, setupRuntime, state, hc } from './runtime'

export function setup(host: Host): void {
  setupRuntime(host)
}

type Controller = { focus?: () => void; chain?: () => { focus(): { run(): void } } }

/**
 * Markup written by hand in a `<template>`: the indentation between tags
 * (whitespace with a line break) would become empty lines in the editor.
 * Whitespace inside text, and inside <pre>, stays.
 */
export function tidyMarkup(html: string): string {
  const parts = html.split(/(<pre[\s>][\s\S]*?<\/pre>)/i)
  const tidy = (part: string): string =>
    part
      .replace(/>\s*\n\s*</g, '><')
      // Around a <pre>: the gap is split between the parts.
      .replace(/>\s*\n\s*$/, '>')
      .replace(/^\s*\n\s*</, '<')
  return parts.map((part, i) => (i % 2 === 1 ? part : tidy(part))).join('').trim()
}

function boundInput(selector: unknown): HTMLInputElement | HTMLTextAreaElement | null {
  if (typeof selector !== 'string' || selector === '') return null
  const el = document.querySelector(selector)
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null
}

export function mountElement(ctx: ElementContext): ElementInstance {
  const el = ctx.el
  const initialProps = ctx.props()
  const external = boundInput(initialProps.input)
  const initial =
    typeof initialProps.value === 'string' ? initialProps.value : ctx.source() !== '' ? tidyMarkup(ctx.source()) : external ? external.value : ''
  const model = shallowRef(initial)
  let lastPropValue = initialProps.value
  let atFocus: string | null = null
  let hidden: HTMLInputElement | null = null
  const editor = instanceRef<{ controller: Controller | null }>()

  function syncInputs(): void {
    const props = ctx.props()
    if (typeof props.name === 'string' && props.name !== '') {
      if (!hidden) {
        hidden = document.createElement('input')
        hidden.type = 'hidden'
        el.appendChild(hidden)
      }
      hidden.name = props.name
      hidden.value = model.value
    }
    const target = boundInput(props.input)
    if (target && target.value !== model.value) target.value = model.value
  }
  syncInputs()

  // The editor's own DOM events stay inside: outside, `input` and `change` are the element's, with its value.
  const stop = (event: Event): void => {
    if (event.target !== el) event.stopPropagation()
  }
  ctx.container.addEventListener('input', stop)
  ctx.container.addEventListener('change', stop)
  const onFocusIn = (): void => {
    if (atFocus === null) atFocus = model.value
  }
  const onFocusOut = (event: FocusEvent): void => {
    if (event.relatedTarget instanceof Node && el.contains(event.relatedTarget)) return
    if (atFocus !== null && atFocus !== model.value) {
      el.dispatchEvent(new Event('change', { bubbles: true }))
      ctx.emit('change', { value: model.value })
    }
    atFocus = null
  }
  el.addEventListener('focusin', onFocusIn)
  el.addEventListener('focusout', onFocusOut)

  const v = mountElementView(ctx, (view) => {
    const p = view.props
    return hc(DskWysiwyg, {
      ref: editor.set,
      modelValue: model.value,
      // The toolbar's language (wysiwyg 0.5.1+): the element's, which is the kit's unless the element sets its own.
      locale: view.locale,
      blockRenderers: state.renderers,
      ...(p.placeholder !== undefined ? { placeholder: p.placeholder } : {}),
      ...(p.readonly !== undefined ? { readonly: p.readonly } : {}),
      ...(p.toolbar !== undefined ? { toolbar: p.toolbar } : {}),
      ...(p.minHeight !== undefined ? { minHeight: p.minHeight } : {}),
      ...(p.maxHeight !== undefined ? { maxHeight: p.maxHeight } : {}),
      ...(p.resizable !== undefined ? { resizable: p.resizable } : {}),
      'onUpdate:modelValue': (html: string) => {
        if (html === model.value) return
        model.value = html
        syncInputs()
        el.dispatchEvent(new Event('input', { bubbles: true }))
        ctx.emit('input', { value: html })
      },
      onReady: (controller: unknown) => ctx.emit('editor-ready', { controller }),
    })
  })

  return {
    update() {
      const value = ctx.props().value
      // Only a new value from outside replaces the content; typing keeps it.
      if (value !== lastPropValue) {
        lastPropValue = value
        if (typeof value === 'string' && value !== model.value) {
          model.value = value
          syncInputs()
        }
      }
      v.refresh()
    },
    destroy() {
      v.unmount()
      ctx.container.removeEventListener('input', stop)
      ctx.container.removeEventListener('change', stop)
      el.removeEventListener('focusin', onFocusIn)
      el.removeEventListener('focusout', onFocusOut)
      hidden?.remove()
    },
    api: {
      get value() {
        return model.value
      },
      get controller() {
        return editor.ref.value?.controller ?? null
      },
      focus() {
        const area = ctx.container.querySelector<HTMLElement>('[contenteditable="true"]')
        area?.focus()
      },
    },
  }
}
