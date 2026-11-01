/**
 * `<dsk-bpmn>`, `<dsk-dmn>`, and ```bpmn / ```dmn blocks through
 * @dskripchenko/bpmn: BPMN 2.0 processes and DMN decisions as they were laid
 * out in the modeler that saved them — a view with pan, zoom and clicks, or,
 * with `editable`, the editor. Blocks are static drawings (and, for DMN, the
 * decision tables under the diagram).
 *
 * `src` — GET → the file. `name` — a hidden input in the element carries the
 * edited XML, for a form.
 */
import { h, shallowRef } from 'vue'
import { renderDecision, renderDmn, render as renderBpmn, BpmnError, parseDmn } from '@dskripchenko/bpmn'
import { BpmnEditor, BpmnView, DmnEditor, DmnView } from '@dskripchenko/bpmn/vue'
import { cssLength } from '../core/attrs'
import type { BlockRenderer, ElementContext, ElementInstance, Host } from '../core/types'
import { errorText, fetchText, instanceRef, mountElementView, setupRuntime, hc } from './runtime'
import { withFullscreen } from './fullscreen'
import { printable } from './print'

export function setup(host: Host): void {
  setupRuntime(host)
}

let sequence = 0

type EditorApi = { fit?: () => void; undo?: () => void; redo?: () => void; toSvg?: () => string }

function message(error: unknown): string {
  if (error instanceof BpmnError) {
    const where = error.line > 0 ? ` (line ${error.line}${error.column > 0 ? `, column ${error.column}` : ''})` : ''
    return `${error.message}${where}${error.hint ? `. ${error.hint}` : ''}`
  }
  return errorText(error)
}

export function mountElement(ctx: ElementContext): ElementInstance {
  const dmn = ctx.tag === 'dsk-dmn'
  const comp = instanceRef<EditorApi>()
  const xml = shallowRef<string | null>(null)
  const failure = shallowRef<string | null>(null)
  let input: HTMLInputElement | null = null
  let loadedFrom = ''

  function syncInput(): void {
    const name = ctx.props().name
    if (typeof name !== 'string' || name === '') return
    if (!input) {
      input = document.createElement('input')
      input.type = 'hidden'
      ctx.el.appendChild(input)
    }
    input.name = name
    input.value = xml.value ?? ''
  }

  async function load(): Promise<void> {
    const props = ctx.props()
    const key = typeof props.src === 'string' && props.src !== '' ? `src:${props.src}` : `source:${ctx.source()}`
    if (key === loadedFrom) return
    loadedFrom = key
    try {
      const text = typeof props.src === 'string' && props.src !== '' ? await fetchText(props.src) : ctx.source().trim()
      xml.value = text === '' ? null : text
      failure.value = null
      syncInput()
      ctx.emit('load', {})
    } catch (error) {
      failure.value = message(error)
      ctx.emit('error', { message: failure.value })
    }
  }

  const onError = (error: Error) => ctx.emit('error', { message: message(error) })

  const v = mountElementView(ctx, (view) => {
    const props = view.props
    if (failure.value) return h('div', { class: 'dsk-error', role: 'alert' }, failure.value)
    const height = `var(--dsk-${dmn ? 'dmn' : 'bpmn'}-height, ${cssLength(props.height, props.editable ? '600px' : '480px')})`
    const highlight = Array.isArray(props.highlight) ? (props.highlight as string[]) : []
    const common = { ref: comp.set, locale: view.locale, style: { height: '100%' }, onError }
    let content
    if (props.editable) {
      const Editor = dmn ? DmnEditor : BpmnEditor
      content = hc(Editor, {
        ...common,
        modelValue: xml.value,
        ...(dmn ? { decision: typeof props.decision === 'string' ? props.decision : undefined } : { properties: props.properties === true, diagram: typeof props.diagram === 'string' ? props.diagram : undefined }),
        ...(props.labels && typeof props.labels === 'object' ? { labels: props.labels } : {}),
        'onUpdate:modelValue': (next: string) => {
          xml.value = next
          syncInput()
        },
        onChange: (next: string) => ctx.emit('change', { xml: next }),
        onSelect: (ids: string[]) => ctx.emit('select', { ids }),
        onElementClick: (id: string) => ctx.emit('element', { id }),
        ...(dmn ? { onOpen: (decision: string | null) => ctx.emit('open', { decision }) } : {}),
      })
    } else {
      const View = dmn ? DmnView : BpmnView
      content = hc(View, {
        ...common,
        xml: xml.value,
        highlight,
        ...(dmn ? { decision: typeof props.decision === 'string' ? props.decision : undefined } : { diagram: typeof props.diagram === 'string' ? props.diagram : undefined }),
        ...(props.labels && typeof props.labels === 'object' ? { labels: props.labels } : {}),
        onElementClick: (id: string) => ctx.emit('element', { id }),
        ...(dmn ? { onOpen: (decision: string | null) => ctx.emit('open', { decision }) } : {}),
      })
    }
    return h('div', { class: 'dsk-bpmn-frame', style: { height } }, [content])
  })

  void load()

  const call = (name: keyof EditorApi) => (...args: unknown[]) => {
    const fn = comp.ref.value?.[name]
    if (typeof fn !== 'function') throw new Error(`${String(name)}() is not available here`)
    return (fn as (...a: unknown[]) => unknown)(...args)
  }

  const fs = withFullscreen(ctx, () => comp.ref.value?.fit?.())
  // On paper the whole diagram as drawn statically (and, for DMN, every decision's table): no canvas, no palette.
  const unprint = printable(ctx.host, ctx.container, () => {
    if (!xml.value) return null
    const prefix = `dsk-bpp-${++sequence}`
    return dmn ? dmnHtml(xml.value, prefix) : renderBpmn(xml.value, { idPrefix: prefix }).svg
  })
  return {
    update() {
      v.refresh()
      void load()
    },
    destroy() {
      unprint()
      fs?.destroy()
      v.unmount()
      input?.remove()
    },
    api: {
      fit: call('fit'),
      undo: call('undo'),
      redo: call('redo'),
      toSvg: () => {
        if (!xml.value) return ''
        return dmn ? renderDmn(xml.value).svg : renderBpmn(xml.value).svg
      },
      open: (decision: string | null) => {
        // Exposed refs are unwrapped on the instance: assigning sets the ref.
        const editor = comp.ref.value as Record<string, unknown> | null
        if (editor && 'opened' in editor) editor.opened = decision
      },
      enterFullscreen: () => fs?.enter(),
      exitFullscreen: () => fs?.exit(),
      get fullscreen() {
        return fs?.active ?? false
      },
      get value() {
        return xml.value
      },
    },
  }
}

/** The decision requirements diagram, then each decision's table or expression. */
function dmnHtml(code: string, idPrefix: string): string {
  const model = parseDmn(code)
  const parts = [renderDmn(model, { idPrefix }).svg]
  for (const d of model.decisions) if (d.logic && d.logic.kind !== 'other') parts.push(renderDecision(model, d.id, { idPrefix }).html)
  return `<div class="dsk-dmn-block">${parts.join('')}</div>`
}

export const renderers: Record<string, BlockRenderer> = {
  bpmn(code) {
    try {
      return { html: renderBpmn(code, { idPrefix: `dsk-bp-${++sequence}` }).svg }
    } catch (error) {
      return { error: message(error) }
    }
  },
  dmn(code) {
    try {
      return { html: dmnHtml(code, `dsk-dm-${++sequence}`) }
    } catch (error) {
      return { error: message(error) }
    }
  },
}
