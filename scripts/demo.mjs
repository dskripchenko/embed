// Builds the demo page for a host site (laravel-admin-demo serves it at /embed):
//
//   <outDir>/index.html        loads the embed from jsDelivr (works once the package is published)
//   <outDir>/local.html        loads it from <outDir>/npm/ — the same files, self-hosted (`--local`)
//   <outDir>/data/, media/     the specs, the process models and the media the page shows
//
// Usage: node scripts/demo.mjs <outDir> [--base=/embed/] [--local]
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const outArg = args.find((a) => !a.startsWith('--'))
if (!outArg) {
  console.error('usage: node scripts/demo.mjs <outDir> [--base=/embed/] [--local]')
  process.exit(1)
}
const out = resolve(outArg)
const base = (args.find((a) => a.startsWith('--base='))?.slice(7) ?? '/embed/').replace(/\/?$/, '/')
const local = args.includes('--local')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const major = pkg.version.split('.')[0]

const media = resolve(root, 'tests/browser/fixtures/media')
if (!existsSync(join(media, 'walkthrough.webm'))) execFileSync('node', ['scripts/fixtures.mjs'], { cwd: root, stdio: 'inherit' })

mkdirSync(join(out, 'data'), { recursive: true })
mkdirSync(join(out, 'media'), { recursive: true })
for (const f of readdirSync(resolve(root, 'examples/demo/data'))) copyFileSync(resolve(root, 'examples/demo/data', f), join(out, 'data', f))
for (const f of ['walkthrough.webm', 'walkthrough.mp4', 'poster.jpg', 'chapters.vtt', 'captions-en.vtt', 'captions-ru.vtt', 'track-1.mp3', 'track-2.mp3']) {
  copyFileSync(join(media, f), join(out, 'media', f))
}

const template = readFileSync(resolve(root, 'examples/demo/page.html'), 'utf8')
const page = (src) => template.replaceAll('{{EMBED_SRC}}', src).replaceAll('{{BASE}}', base)
writeFileSync(join(out, 'index.html'), page(`https://cdn.jsdelivr.net/npm/@dskripchenko/embed@${major}/dist/embed.js`))
writeFileSync(join(out, 'local.html'), page(`${base}npm/@dskripchenko/embed@${pkg.version}/dist/embed.js`))
if (local) execFileSync('node', ['scripts/mirror.mjs', out], { cwd: root, stdio: 'inherit' })
console.log(`demo written to ${out} (base ${base}${local ? ', with the local mirror' : ''})`)
