// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { defineComponent, h, useId } from 'vue'
import { mountView, setupRuntime } from '../../src/plugins/runtime'
import type { Host } from '../../src/core/types'

const host = {
  config: () => ({ locale: 'en', resolvedTheme: 'light' }),
  onConfig: () => () => {},
  blocks: { all: () => ({}), subscribe: () => () => {} },
} as unknown as Host

const WithId = defineComponent({
  setup() {
    const id = useId()
    return () => h('span', { id })
  },
})

describe('runtime', () => {
  it('gives every mounted element ids of its own', () => {
    setupRuntime(host)
    const a = document.createElement('div')
    const b = document.createElement('div')
    mountView(a, () => h(WithId))
    mountView(b, () => h(WithId), () => 'en')
    const idA = a.querySelector('span')?.id
    const idB = b.querySelector('span')?.id
    expect(idA).toBeTruthy()
    expect(idB).toBeTruthy()
    expect(idA).not.toBe(idB)
  })
})
