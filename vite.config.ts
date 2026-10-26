// Vitest only; the build is scripts/build.mjs.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __EMBED_VERSION__: JSON.stringify('0.0.0-test'),
    __EMBED_VERSIONS__: JSON.stringify({ vue: '3.5.44', '@dskripchenko/ui': '1.15.1' }),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.spec.ts'],
  },
})
