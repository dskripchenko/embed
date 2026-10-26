// Self-hosting: copies everything the loader fetches into <outDir>/npm/, in
// jsDelivr's layout (<pkg>@<version>/<path>), so that
//
//   <script src="/static/npm/@dskripchenko/embed@<version>/dist/embed.js"></script>
//
// loads the runtime from the same server with no configuration: the loader
// takes the CDN root from its own address.
//
// Usage: node scripts/mirror.mjs <outDir>   (run `pnpm build` first)
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const outArg = process.argv[2]
if (!outArg) {
  console.error('usage: node scripts/mirror.mjs <outDir>')
  process.exit(1)
}
const out = resolve(outArg, 'npm')
if (!existsSync(resolve(root, 'dist/embed.js'))) {
  console.error('dist/ is missing: run `pnpm build` first')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const dirOf = (name) => realpathSync(resolve(root, 'node_modules', name))
const versionOf = (name) => JSON.parse(readFileSync(join(dirOf(name), 'package.json'), 'utf8')).version
const skipMaps = (src) => !/standalone\.(js|css)$/.test(src) && !src.endsWith('.map') && !src.endsWith('.d.ts') && !src.endsWith('.cjs') && !src.includes('__tests__')

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

// The embed itself.
cpSync(resolve(root, 'dist'), join(out, `@dskripchenko/embed@${pkg.version}/dist`), { recursive: true })

// Vue: the one browser build the import map names.
const vue = join(out, `vue@${versionOf('vue')}/dist`)
mkdirSync(vue, { recursive: true })
cpSync(join(dirOf('vue'), 'dist/vue.runtime.esm-browser.prod.js'), join(vue, 'vue.runtime.esm-browser.prod.js'))

// The packages: their dist/ (ESM and CSS; maps, types and CommonJS left out).
for (const name of ['@dskripchenko/ui', '@dskripchenko/wysiwyg', '@dskripchenko/diagrams', '@dskripchenko/openapi', '@dskripchenko/flow']) {
  cpSync(join(dirOf(name), 'dist'), join(out, `${name}@${versionOf(name)}/dist`), { recursive: true, filter: skipMaps })
}
console.log(`mirrored into ${out}`)
console.log(`<script src="…/npm/@dskripchenko/embed@${pkg.version}/dist/embed.js"></script>`)
