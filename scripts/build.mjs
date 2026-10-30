// Builds dist/:
//   embed.js              the loader (classic script, no Vue)
//   plugins/*.js, chunks/ the plugin modules (ESM; vue and the packages external, via the import map)
//   embed.bundle.js       the fat bundle (classic script, everything inside)
//   bundles/*.js          one plugin per classic script; several on a page share one runtime
//   importmap.json        the runtime's import map on jsDelivr, for pages that write their own
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { build } from 'vite'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

/** The runtime packages, pinned to the exact versions installed (and tested). */
const RUNTIME = ['vue', '@dskripchenko/ui', '@dskripchenko/wysiwyg', '@dskripchenko/diagrams', '@dskripchenko/openapi', '@dskripchenko/flow', '@dskripchenko/board', '@dskripchenko/bpmn', '@dskripchenko/drawio']
// Not every package exports ./package.json: read it from node_modules directly.
const pkgDir = (name) => realpathSync(resolve(root, 'node_modules', name))
const versions = Object.fromEntries(RUNTIME.map((name) => [name, JSON.parse(readFileSync(join(pkgDir(name), 'package.json'), 'utf8')).version]))
for (const name of RUNTIME) {
  const declared = pkg.devDependencies[name]
  if (declared !== versions[name]) throw new Error(`${name}: package.json pins ${declared}, installed ${versions[name]} — pin exact versions`)
}

const define = {
  __EMBED_VERSION__: JSON.stringify(pkg.version),
  __EMBED_VERSIONS__: JSON.stringify(versions),
}

/** The kit's light theme block on `:root:not([data-theme])`. */
function lightFallback() {
  const themes = readFileSync(join(pkgDir('@dskripchenko/ui'), 'dist/styles/themes.css'), 'utf8')
  const block = /:root\[data-theme='light'\]\s*\{[^}]*\}/.exec(themes)?.[0]
  if (!block) throw new Error('light theme block not found in @dskripchenko/ui themes.css')
  return block.replace(":root[data-theme='light']", ':root:not([data-theme])').replace(/\s+/g, ' ')
}

const virtualLight = {
  name: 'dsk-light-fallback',
  resolveId: (id) => (id === 'virtual:dsk-light-fallback' ? '\0dsk-light' : null),
  load: (id) => (id === '\0dsk-light' ? `export default ${JSON.stringify(lightFallback())}` : null),
}

const vueFlags = {
  'process.env.NODE_ENV': JSON.stringify('production'),
  __VUE_OPTIONS_API__: 'true',
  __VUE_PROD_DEVTOOLS__: 'false',
  __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
}

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

// ---- 1. No icon library at run time ----
// Every package bundles its own icons (ui 1.16, openapi 1.1.2, flow 1.1.1,
// wysiwyg 0.5.3): nothing may import `lucide-vue-next` or `@dskripchenko/ui/icons`
// at run time, or a page would need them in its import map.
for (const [name, file] of [
  ['@dskripchenko/ui', 'dist/index.mjs'],
  ['@dskripchenko/openapi', 'dist/vue.mjs'],
  ['@dskripchenko/flow', 'dist/vue.mjs'],
  ['@dskripchenko/board', 'dist/vue.mjs'],
  ['@dskripchenko/bpmn', 'dist/vue.mjs'],
  ['@dskripchenko/wysiwyg', 'dist/index.mjs'],
]) {
  const code = readFileSync(join(pkgDir(name), file), 'utf8')
  if (/(?:from\s*|import\s*\(\s*)"(?:lucide-vue-next|@dskripchenko\/ui\/icons)"/.test(code)) {
    throw new Error(`${name}/${file} imports icons at run time: bundle them in the package`)
  }
}

// ---- 2. The plugin modules ----
const plugins = ['media', 'diagram', 'openapi', 'flow', 'markdown', 'editor', 'board', 'bpmn', 'drawio']
await build({
  root,
  configFile: false,
  logLevel: 'warn',
  define,
  plugins: [virtualLight],
  build: {
    emptyOutDir: false,
    outDir: dist,
    minify: true,
    target: 'es2022',
    lib: {
      entry: Object.fromEntries(plugins.map((p) => [`plugins/${p}`, resolve(root, `src/plugins/${p}.ts`)])),
      formats: ['es'],
      fileName: (_format, alias) => `${alias}.js`,
    },
    rollupOptions: {
      external: ['vue', /^@dskripchenko\//],
      output: { chunkFileNames: 'chunks/[name]-[hash].js', minify: true },
    },
  },
})

// ---- 3. The loader ----
await build({
  root,
  configFile: false,
  logLevel: 'warn',
  define,
  plugins: [virtualLight],
  build: {
    emptyOutDir: false,
    outDir: dist,
    minify: true,
    target: 'es2022',
    lib: { entry: resolve(root, 'src/loader.ts'), formats: ['iife'], name: 'DskEmbedLoader', fileName: () => 'embed.js' },
  },
})

// ---- 4. The fat bundle ----
await build({
  root,
  configFile: false,
  logLevel: 'warn',
  define: { ...define, ...vueFlags },
  plugins: [virtualLight],
  build: {
    emptyOutDir: false,
    outDir: dist,
    minify: true,
    target: 'es2022',
    cssMinify: true,
    lib: { entry: resolve(root, 'src/bundle.ts'), formats: ['iife'], name: 'DskEmbedBundle', fileName: () => 'embed.bundle.js' },
  },
})

// ---- 4b. The per-plugin bundles: one classic script per plugin, each joins the others on a page ----
for (const p of plugins) {
  await build({
    root,
    configFile: false,
    logLevel: 'warn',
    define: { ...define, ...vueFlags },
    plugins: [virtualLight],
    build: {
      emptyOutDir: false,
      outDir: dist,
      minify: true,
      target: 'es2022',
      cssMinify: true,
      lib: { entry: resolve(root, `src/bundles/${p}.ts`), formats: ['iife'], name: 'DskEmbedBundle', fileName: () => `bundles/${p}.js` },
    },
  })
}

// ---- 5. The import map, for pages that compose their own ----
const cdn = 'https://cdn.jsdelivr.net/npm/'
const files = {
  vue: ['vue', 'dist/vue.runtime.esm-browser.prod.js'],
  '@dskripchenko/ui': ['@dskripchenko/ui', 'dist/index.mjs'],
  '@dskripchenko/ui/hls': ['@dskripchenko/ui', 'dist/hls/index.mjs'],
  '@dskripchenko/wysiwyg': ['@dskripchenko/wysiwyg', 'dist/index.mjs'],
  '@dskripchenko/diagrams': ['@dskripchenko/diagrams', 'dist/index.mjs'],
  '@dskripchenko/openapi': ['@dskripchenko/openapi', 'dist/index.mjs'],
  '@dskripchenko/openapi/vue': ['@dskripchenko/openapi', 'dist/vue.mjs'],
  '@dskripchenko/flow': ['@dskripchenko/flow', 'dist/index.mjs'],
  '@dskripchenko/flow/vue': ['@dskripchenko/flow', 'dist/vue.mjs'],
  '@dskripchenko/flow/mermaid': ['@dskripchenko/flow', 'dist/mermaid.mjs'],
  '@dskripchenko/board': ['@dskripchenko/board', 'dist/index.mjs'],
  '@dskripchenko/board/vue': ['@dskripchenko/board', 'dist/vue.mjs'],
  '@dskripchenko/bpmn': ['@dskripchenko/bpmn', 'dist/index.mjs'],
  '@dskripchenko/bpmn/vue': ['@dskripchenko/bpmn', 'dist/vue.mjs'],
  '@dskripchenko/drawio': ['@dskripchenko/drawio', 'dist/index.mjs'],
}
const imports = Object.fromEntries(Object.entries(files).map(([spec, [name, path]]) => [spec, `${cdn}${name}@${versions[name]}/${path}`]))
writeFileSync(resolve(dist, 'importmap.json'), JSON.stringify({ imports }, null, 2) + '\n')
// Every runtime file the map names must exist in the installed packages.
for (const [name, path] of Object.values(files)) statSync(join(pkgDir(name), path))

// ---- Sizes ----
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}
const kb = (n) => `${(n / 1024).toFixed(1)} KB`
console.log(`\n@dskripchenko/embed ${pkg.version} — runtime: ${Object.entries(versions).map(([k, v]) => `${k}@${v}`).join(', ')}`)
for (const file of walk(dist).sort()) {
  const buf = readFileSync(file)
  console.log(`  ${file.slice(dist.length + 1).padEnd(40)} ${kb(buf.length).padStart(10)}  gzip ${kb(gzipSync(buf, { level: 9 }).length).padStart(9)}`)
}
