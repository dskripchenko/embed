// Two local origins for the browser check:
//
//   CDN  (http://127.0.0.1:<cdnPort>)  a mirror of jsDelivr's layout: /npm/<pkg>@<version>/<path>.
//        Package files come from node_modules and only at the exact installed
//        version (anything else is a 404, as a wrong pin would be); any version
//        of @dskripchenko/embed serves this repository's dist/. CORS is open,
//        as on jsDelivr, and the origin differs from the page's — module
//        scripts and the import map are exercised cross-origin, for real.
//   Page (http://127.0.0.1:<pagePort>) the test pages, the demo, fixtures, and
//        fake endpoints for flow monitoring, toggles and sub-processes.
import { createServer } from 'node:http'
import { createReadStream, existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')

const TYPES = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.vtt': 'text/vtt; charset=utf-8',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.m4s': 'video/iso.segment',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
}

/** Streams a file, with Range support (media seeking needs it). */
function sendFile(req, res, file, headers = {}) {
  let stat
  try {
    stat = statSync(file)
    if (!stat.isFile()) throw new Error('not a file')
  } catch {
    res.writeHead(404, headers).end('not found')
    return
  }
  const type = TYPES[extname(file)] ?? 'application/octet-stream'
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', ...headers }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
  if (range) {
    const start = range[1] === '' ? stat.size - Number(range[2]) : Number(range[1])
    const end = range[1] !== '' && range[2] !== '' ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1
    res.writeHead(206, { ...base, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 })
    createReadStream(file, { start, end }).pipe(res)
    return
  }
  res.writeHead(200, { ...base, 'Content-Length': stat.size })
  if (req.method === 'HEAD') res.end()
  else createReadStream(file).pipe(res)
}

/** A path under `base`, or null when it would escape it. */
function inside(base, rel) {
  const p = normalize(join(base, rel))
  return p.startsWith(base) ? p : null
}

export const log = { cdn: [] }

function cdnHandler(req, res) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' }
  const url = new URL(req.url, 'http://x')
  log.cdn.push(url.pathname)
  const m = /^\/npm\/((?:@[^/]+\/)?[^/@]+)@([^/]+)\/(.*)$/.exec(decodeURIComponent(url.pathname))
  if (!m) return res.writeHead(404, cors).end('not a package path')
  const [, name, version, path] = m
  if (name === '@dskripchenko/embed') {
    const file = inside(resolve(root, 'dist'), path.replace(/^dist\//, ''))
    return file ? sendFile(req, res, file, cors) : res.writeHead(404, cors).end()
  }
  const dir = resolve(root, 'node_modules', name)
  if (!existsSync(dir)) return res.writeHead(404, cors).end(`no package ${name}`)
  const real = realpathSync(dir)
  const installed = JSON.parse(readFileSync(join(real, 'package.json'), 'utf8')).version
  if (installed !== version) return res.writeHead(404, cors).end(`${name}@${version} is not mirrored (installed ${installed})`)
  const file = inside(real, path)
  return file ? sendFile(req, res, file, cors) : res.writeHead(404, cors).end()
}

/** A shared board for <dsk-board board-url>: the reference server of @dskripchenko/board behind its HTTP contract. */
const { BoardServer } = await import(realpathSync(resolve(root, 'node_modules/@dskripchenko/board/dist/index.mjs')))
let board = new BoardServer()
const boardWaiters = new Set()

function readJson(req) {
  return new Promise((done) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => done(raw ? JSON.parse(raw) : {}))
  })
}

async function boardApi(req, res, url) {
  const send = (body, status = 200) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(body))
  const sub = url.pathname.slice('/api/board'.length)
  if (sub === '/snapshot') return send(board.snapshot())
  if (sub === '/reset' && req.method === 'POST') {
    board = new BoardServer()
    return send({ ok: true })
  }
  if (sub === '/batches' && req.method === 'POST') {
    const { batch, fresh } = board.receive(await readJson(req))
    if (fresh) for (const w of boardWaiters) w()
    return send({ seq: batch.seq })
  }
  if (sub === '/batches') {
    const after = Number(url.searchParams.get('after') ?? 0)
    const wait = Math.min(Number(url.searchParams.get('wait') ?? 0), 25) * 1000
    const answer = () => {
      const batches = board.since(after)
      if (batches === null) return send({ error: 'too old' }, 410)
      send({ batches })
    }
    if ((board.since(after) ?? [1]).length > 0 || wait === 0) return answer()
    // Long polling: answer when a batch arrives, or after the wait.
    let timer
    const wake = () => {
      clearTimeout(timer)
      boardWaiters.delete(wake)
      answer()
    }
    boardWaiters.add(wake)
    timer = setTimeout(wake, wait)
    req.on('close', () => {
      clearTimeout(timer)
      boardWaiters.delete(wake)
    })
    return
  }
  if (sub === '/presence' && req.method === 'POST') return send({ presence: board.touch(await readJson(req)) })
  send({ error: 'not found' }, 404)
}

/** The fake monitoring endpoint: the active step moves on every poll. */
let tick = 0
const STEPS = ['create', 'pay', 'paid', 'ship']

function pageHandler(cdnOrigin) {
  return async (req, res) => {
    const url = new URL(req.url, 'http://x')
    const p = decodeURIComponent(url.pathname)
    if (p.startsWith('/api/board/')) return boardApi(req, res, url)
    if (p === '/api/state') {
      const path = url.searchParams.get('path') ?? ''
      log.polls = [...(log.polls ?? []), path]
      const state = JSON.parse(readFileSync(resolve(root, 'examples/demo/data/state.json'), 'utf8'))
      if (path === '') {
        const active = STEPS[tick++ % STEPS.length]
        for (const id of STEPS) state.nodes[id] = { ...state.nodes[id], status: id === active ? 'active' : state.nodes[id].status === 'active' ? 'done' : state.nodes[id].status }
        state.current = [active]
        state.updatedAt = Date.now()
      } else {
        // Inside "ship": the sub-process's own snapshot.
        Object.assign(state, { nodes: { pick: { status: 'done', count: 12 }, pack: { status: 'active', count: 5 }, handover: { count: 2 } }, edges: {}, current: ['pack'] })
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Path': path }).end(JSON.stringify(state))
      return
    }
    if (p === '/api/toggle' && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) body += chunk
      const change = JSON.parse(body || '{}')
      log.toggles = [...(log.toggles ?? []), change]
      // "done" refuses to be switched off: the viewer rolls the switch back.
      if (change.id === 'done') return res.writeHead(409, { 'Content-Type': 'application/json' }).end('{"message":"The end state cannot be disabled"}')
      return res.writeHead(204).end()
    }
    if (p === '/api/proxy' && req.method === 'POST') {
      // The openapi proxy contract: the HttpRequest in, the HttpResponse out.
      let body = ''
      for await (const chunk of req) body += chunk
      log.proxied = [...(log.proxied ?? []), JSON.parse(body || '{}')]
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({ status: 200, statusText: 'OK', headers: [['content-type', 'application/json']], body: '{"data":[{"id":"ord_1"}],"next":null}', duration: 3 }),
      )
    }
    const sub = /^\/api\/process\/([\w-]+)$/.exec(p)
    if (sub) return sendFile(req, res, resolve(root, `examples/demo/data/${sub[1]}.json`))
    if (p.startsWith('/fixtures/')) return sendFile(req, res, inside(resolve(root, 'tests/browser/fixtures'), p.slice('/fixtures/'.length)) ?? '')
    if (p.startsWith('/data/')) return sendFile(req, res, inside(resolve(root, 'examples/demo/data'), p.slice('/data/'.length)) ?? '')
    if (p.startsWith('/media/')) return sendFile(req, res, inside(resolve(root, 'tests/browser/fixtures/media'), p.slice('/media/'.length)) ?? '')
    // Pages: templates with {{CDN}} → the CDN origin's /npm/ root.
    const name = p === '/' ? 'index.html' : p.slice(1)
    const pageFile =
      name === 'demo.html' ? resolve(root, 'examples/demo/page.html') : inside(resolve(root, 'tests/browser/pages'), name)
    if (!pageFile || !existsSync(pageFile)) return res.writeHead(404).end('not found')
    if (pageFile.endsWith('.html')) {
      const variant = url.searchParams.get('embed') ?? 'loader'
      const html = readFileSync(pageFile, 'utf8')
        .replaceAll('{{CDN}}', `${cdnOrigin}/npm/`)
        .replaceAll('{{EMBED_SRC}}', `${cdnOrigin}/npm/@dskripchenko/embed@1/dist/${variant === 'bundle' ? 'embed.bundle.js' : 'embed.js'}`)
        .replaceAll('{{BASE}}', '')
      return res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' }).end(html)
    }
    return sendFile(req, res, pageFile)
  }
}

export async function startServers({ pagePort = 5401, cdnPort = 5402 } = {}) {
  const cdnOrigin = `http://127.0.0.1:${cdnPort}`
  const cdn = createServer(cdnHandler)
  const page = createServer(pageHandler(cdnOrigin))
  await new Promise((r) => cdn.listen(cdnPort, '127.0.0.1', r))
  await new Promise((r) => page.listen(pagePort, '127.0.0.1', r))
  return {
    page: `http://127.0.0.1:${pagePort}`,
    cdn: cdnOrigin,
    close: () => Promise.all([new Promise((r) => cdn.close(r)), new Promise((r) => page.close(r))]),
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await startServers()
  console.log(`page ${s.page}  cdn ${s.cdn}  (demo: ${s.page}/demo.html, bundle: ?embed=bundle)`)
}
