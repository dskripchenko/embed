// Browser check: the loader against a local mirror of the CDN (the import map
// resolved for real, cross-origin), the fat bundle, Chromium and WebKit.
// Every element renders; markdown and the editor hold live blocks; theme and
// locale switch everywhere; the elements cooperate through events; one Vue
// per page; no console errors. Screenshots go to tests/browser/output (and to
// EMBED_SHOTS_DIR when set).
//
// Usage: node scripts/browser-check.mjs [--only=substring] [--browsers=chromium,webkit]
// PLAYWRIGHT may point at playwright/index.mjs when it is not resolvable.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { log as serverLog, startServers } from '../tests/browser/server.mjs'

const root = resolve(import.meta.dirname, '..')
const out = resolve(root, 'tests/browser/output')
mkdirSync(out, { recursive: true })
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const pw = await import(process.env.PLAYWRIGHT ?? 'playwright')

if (!existsSync(resolve(root, 'dist/embed.js')) || process.env.EMBED_BUILD) execFileSync('node', ['scripts/build.mjs'], { cwd: root, stdio: 'inherit' })
if (!existsSync(resolve(root, 'tests/browser/fixtures/media/walkthrough.webm'))) execFileSync('node', ['scripts/fixtures.mjs'], { cwd: root, stdio: 'inherit' })

const server = await startServers()
const BASE = server.page
const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}
const only = args.only
const wants = (name) => !only || name.includes(only)

// WebKit has no --mute-audio: every media element is muted before it plays.
const MUTE = () => {
  const play = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    this.muted = true
    return play.call(this)
  }
}

const browsers = {}
for (const name of (args.browsers ?? 'chromium,webkit').split(',')) {
  browsers[name] = await pw[name].launch(name === 'chromium' ? { args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] } : {})
}

async function open(browserName, path, { viewport = DESKTOP, phone = false } = {}) {
  const context = await browsers[browserName].newContext({ viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone && browserName === 'chromium', hasTouch: phone })
  const page = await context.newPage()
  await page.addInitScript(MUTE)
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return
    const text = m.text()
    // A media fetch the browser cancels on its own (seek, source switch) is not an error of ours.
    if (/Failed to load resource.*(net::ERR_ABORTED|aborted)/i.test(text)) return
    // The refused toggle the check provokes on purpose.
    if (/status of 409 \(Conflict\)/.test(text) && path.startsWith('/check.html')) return
    errors.push(`${m.type()}: ${text}`)
  })
  await page.goto(BASE + path)
  return { page, errors, close: () => context.close() }
}

/** Waits until every element on the page is ready (or failed). */
async function settle(page, timeout = 20000) {
  await page.waitForFunction(
    () => [...document.querySelectorAll('dsk-video,dsk-audio,dsk-diagram,dsk-openapi,dsk-flow,dsk-board,dsk-markdown,dsk-editor')]
      .filter((e) => e.getAttribute('loading') !== 'lazy' || e.hasAttribute('data-dsk-state'))
      .every((e) => ['ready', 'error'].includes(e.getAttribute('data-dsk-state'))),
    null,
    { timeout },
  )
  await page.waitForFunction(() => !document.querySelector('.dsk-block[data-dsk-state="loading"]'), null, { timeout })
  await sleep(400)
}

/** One Vue: every mount shares one app context, and only one Vue file was fetched. */
async function oneVue(page) {
  return page.evaluate(() => {
    const roots = [...document.querySelectorAll('[data-dsk-root], .dsk-block')].map((el) => el._vnode).filter(Boolean)
    const contexts = new Set(roots.map((v) => v.appContext))
    const versions = new Set(roots.map((v) => v.appContext?.app?.version))
    const vueFiles = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /\/vue@[^/]+\/|\/\+esm|vue\.(runtime\.)?esm/.test(n))
    const kitFiles = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /@dskripchenko\/ui@[^/]+\/dist\/index\.mjs/.test(n))
    return { mounts: roots.length, contexts: contexts.size, versions: [...versions], vueFiles, kitFiles }
  })
}

/** Text and accessible names of an element's subtree, to tell one language from another. */
async function strings(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return ''
    const parts = [el.innerText]
    for (const n of el.querySelectorAll('[aria-label],[title],[placeholder]')) parts.push(n.getAttribute('aria-label') ?? '', n.getAttribute('title') ?? '', n.getAttribute('placeholder') ?? '')
    return parts.join('|')
  }, selector)
}

/** Clicks the centre of an element: active flow nodes pulse, and never count as "stable" for a locator click. */
async function clickAt(page, selector) {
  const box = await page.locator(selector).first().boundingBox()
  if (!box) throw new Error(`nothing to click: ${selector}`)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

const shotsDir = process.env.EMBED_SHOTS_DIR
async function shot(page, name, opts = {}) {
  // A full-page capture of a scrolled page draws sticky headers mid-page.
  await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(300)
  const file = resolve(out, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true, ...opts })
  if (shotsDir) {
    mkdirSync(shotsDir, { recursive: true })
    copyFileSync(file, resolve(shotsDir, `${name}.png`))
  }
}

// ---------------------------------------------------------------- the demo page, both builds, both engines
for (const browserName of Object.keys(browsers)) {
  for (const variant of ['loader', 'bundle']) {
    const tag = `${browserName}/${variant}`
    if (!wants(tag)) continue
    const { page, errors, close } = await open(browserName, `/demo.html?embed=${variant}`)
    try {
      await settle(page)
      // The lazy reference starts when scrolled to.
      await page.locator('#reference-el').scrollIntoViewIfNeeded()
      await page.waitForFunction(() => document.querySelector('#reference-el')?.getAttribute('data-dsk-state') === 'ready', null, { timeout: 15000 })
      await page.waitForSelector('#reference-el .oa-reference', { timeout: 15000 })
      await page.waitForSelector('#reference-el .oa-op__doc', { timeout: 15000 }).catch(() => {})
      await page.evaluate(() => window.scrollTo(0, 0))

      // Nothing on the page shows a rendering error on load: blocks, widgets, diagrams.
      const blockErrors = await page.evaluate(() =>
        [...document.querySelectorAll('.oa-bk__error, .uid-markdown__block-error, .dsk-wysiwyg__preview-error, .dsk-error, pre[data-dsk-failed], .fl-layout-error')]
          .map((e) => `${e.closest('[id]')?.id ?? '?'}: ${e.textContent.trim().slice(0, 80)}`))
      check(`${tag}: no block or widget shows an error on load`, blockErrors.length === 0, blockErrors.join(' | '))
      // A spec of ≤ 40 operations renders all its cards at once (openapi 1.1.1).
      const cards = await page.evaluate(() => document.querySelectorAll('#reference-el .oa-op__doc').length)
      check(`${tag}: the two-spec reference is filled (all 5 operations rendered)`, cards >= 5, `${cards} cards`)

      const r = await page.evaluate(() => {
        const q = (s) => document.querySelector(s)
        return {
          mode: window.DskEmbed.mode,
          video: !!q('#walkthrough .uid-video video'),
          audio: q('#playlist .uid-audio') !== null,
          playlist: document.querySelectorAll('#playlist .uid-audio [class*="playlist"] li, #playlist .uid-audio [role="listitem"], #playlist .uid-audio [role="option"]').length,
          diagram: !!q('dsk-diagram svg'),
          flowNodes: document.querySelectorAll('#process-flow [data-node-id]').length,
          opCard: q('#op-card .oa-embed')?.innerText.includes('/orders') ?? false,
          reference: !!q('#reference-el .oa-reference'),
          mdMermaid: !!q('#doc .uid-markdown svg'),
          mdOpenapi: !!q('#doc .oa-bk'),
          mdFlow: document.querySelectorAll('#doc [data-node-id]').length,
          mdVideo: !!q('#doc .uid-video video'),
          editor: !!q('#body-editor [contenteditable="true"]'),
          editorBlock: !!q('#body-editor .oa-bk.oa-bk--editable'),
          hidden: q('#post input[type=hidden][name=body]')?.value ?? null,
          cmsPie: !!q('#cms .dsk-block--mermaid svg'),
          cmsJsKept: !!q('#cms code.language-js'),
        }
      })
      check(`${tag}: mode`, r.mode === variant, r.mode)
      check(`${tag}: <dsk-video> renders the kit player`, r.video)
      check(`${tag}: <dsk-audio> renders a playlist`, r.audio)
      check(`${tag}: <dsk-diagram> renders SVG from inline source`, r.diagram)
      check(`${tag}: <dsk-flow> renders the process`, r.flowNodes === 7, `${r.flowNodes} nodes`)
      check(`${tag}: <dsk-openapi operation> renders the card`, r.opCard)
      check(`${tag}: <dsk-openapi> lazy reference with two specs renders`, r.reference)
      check(`${tag}: markdown: mermaid / openapi / flow / video blocks are live`, r.mdMermaid && r.mdOpenapi && r.mdFlow > 0 && r.mdVideo, JSON.stringify({ m: r.mdMermaid, o: r.mdOpenapi, f: r.mdFlow, v: r.mdVideo }))
      check(`${tag}: editor holds a live openapi block`, r.editor && r.editorBlock)
      check(`${tag}: editor fills its hidden input`, typeof r.hidden === 'string' && r.hidden.includes('language-openapi'), `${r.hidden?.length} chars`)
      check(`${tag}: renderBlocks: pie live, js kept`, r.cmsPie && r.cmsJsKept)

      // Spec switcher of the reference.
      const specs = await page.evaluate(async () => {
        const el = document.querySelector('#reference-el')
        const seen = []
        el.addEventListener('dsk:active', (e) => seen.push(e.detail.id))
        await el.open('catalog')
        await new Promise((r) => setTimeout(r, 600))
        const text = el.innerText.includes('List products')
        await el.open('orders')
        return { seen, text }
      })
      check(`${tag}: reference switches specs (open('catalog'))`, specs.text, JSON.stringify(specs.seen))

      // Cross-plugin: a flow step opens its operation and plays its chapter.
      const coop = await page.evaluate(() => {
        window.__events = []
        for (const n of ['node', 'chapter', 'play']) window.DskEmbed.on(n, (d) => window.__events.push([n, d.id ?? d.title ?? '']))
        return true
      })
      void coop
      await page.locator('#process-flow').scrollIntoViewIfNeeded()
      await clickAt(page, '#process-flow [data-node-id="pay"] .fl-node__body')
      await page.waitForFunction(() => window.__events.some((e) => e[0] === 'chapter'), null, { timeout: 10000 }).catch(() => {})
      await sleep(600)
      const after = await page.evaluate(() => ({
        events: window.__events,
        card: document.querySelector('#op-card').operation,
        cardText: document.querySelector('#op-card .oa-embed')?.innerText ?? '',
        time: document.querySelector('#walkthrough video')?.currentTime ?? -1,
        log: document.querySelector('#log')?.innerText ?? '',
      }))
      check(`${tag}: click on a flow step emits dsk:node`, after.events.some((e) => e[0] === 'node' && e[1] === 'pay'), JSON.stringify(after.events))
      check(`${tag}: … the operation card switches to payOrder`, after.card === 'payOrder' && after.cardText.includes('/pay'), after.card)
      check(`${tag}: … the video plays the "Payment" chapter`, after.time >= 7.9 && after.time < 12 && after.events.some((e) => e[0] === 'chapter' && e[1] === 'Payment'), `t=${after.time.toFixed?.(2)}`)
      check(`${tag}: … the page's event log shows it`, after.log.includes('dsk:node') && after.log.includes('dsk:chapter'))
      await page.evaluate(() => document.querySelector('#walkthrough').pause())

      // Editor ↔ value: typing, the input event, the property.
      const editorArea = page.locator('#body-editor .dsk-wysiwyg__content').first()
      await page.evaluate(() => {
        window.__inputs = 0
        document.querySelector('#body-editor').addEventListener('input', () => window.__inputs++)
      })
      await editorArea.scrollIntoViewIfNeeded()
      // The last paragraph: click its end, past the header bar.
      const lastP = page.locator('#body-editor .dsk-wysiwyg__content > p').last()
      const pbox = await lastP.boundingBox()
      await page.mouse.click(pbox.x + pbox.width - 2, pbox.y + pbox.height / 2)
      await page.keyboard.press('End')
      await page.keyboard.type(' Typed by the check.')
      await sleep(400)
      const typed = await page.evaluate(() => ({
        value: document.querySelector('#body-editor').value,
        hidden: document.querySelector('#post input[name=body]').value,
        inputs: window.__inputs,
      }))
      check(`${tag}: typing updates value, the hidden input and fires input`, typed.value.includes('Typed by the check.') && typed.hidden === typed.value && typed.inputs > 0, `inputs=${typed.inputs}`)
      // Edit inside the live openapi block: its source flows back into the editor's HTML.
      let blockEdit = {}
      try {
        await page.locator('#body-editor .oa-bk button', { hasText: /^(Source|Исходник)$/ }).first().click()
        const area = page.locator('#body-editor .oa-bk textarea, #body-editor .oa-bk [contenteditable="true"]').first()
        await area.waitFor({ timeout: 5000 })
        await area.click()
        await page.keyboard.press(browserName === 'webkit' ? 'Meta+ArrowDown' : 'Control+End')
        await page.keyboard.type('\n# edited in the block')
        await sleep(1500)
        blockEdit = await page.evaluate(() => ({ value: document.querySelector('#body-editor').value }))
      } catch (e) {
        blockEdit = { error: e.message.split('\n')[0] }
      }
      check(`${tag}: editing the live block writes back into the editor value`, !!blockEdit.value?.includes('# edited in the block'), blockEdit.error ?? '')
      const original = await page.evaluate(() => {
        const el = document.querySelector('#body-editor')
        const before = el.value
        el.value = '<p>Set from script</p>'
        return before
      })
      await sleep(300)
      const set = await page.evaluate(() => ({
        text: document.querySelector('#body-editor [contenteditable="true"]').innerText,
        hidden: document.querySelector('#post input[name=body]').value,
      }))
      check(`${tag}: setting .value replaces the content and the input`, set.text.includes('Set from script') && set.hidden === '<p>Set from script</p>')
      await page.evaluate((html) => (document.querySelector('#body-editor').value = html), original)
      await page.waitForSelector('#body-editor .oa-bk', { timeout: 10000 })

      // One Vue.
      const vue = await oneVue(page)
      check(`${tag}: one app context for every mount`, vue.mounts > 5 && vue.contexts === 1 && vue.versions.length === 1, `${vue.mounts} mounts, ${vue.contexts} contexts, vue ${vue.versions}`)
      if (variant === 'loader') {
        check(`${tag}: exactly one Vue file fetched`, vue.vueFiles.length === 1 && vue.vueFiles[0].includes('vue@3.5.44/dist/vue.runtime.esm-browser.prod.js'), vue.vueFiles.join(', '))
        check(`${tag}: exactly one kit fetched`, vue.kitFiles.length === 1, vue.kitFiles.join(', '))
      } else {
        check(`${tag}: no runtime fetched from the CDN`, vue.vueFiles.length === 0 && vue.kitFiles.length === 0)
      }

      // Screenshots in light, then theme and locale.
      const probe = () => ({
        flow: getComputedStyle(document.querySelector('#process-flow .dsk-flow-frame')).backgroundColor,
        card: getComputedStyle(document.querySelector('#op-card .oa-embed')).color,
        audio: getComputedStyle(document.querySelector('#playlist .uid-audio')).color,
        editor: getComputedStyle(document.querySelector('#body-editor .dsk-wysiwyg')).backgroundColor,
      })
      const light = await page.evaluate(probe)
      const before = {}
      const SUBJECTS = { video: '#walkthrough', audio: '#playlist', flow: '#process-flow', operation: '#op-card', reference: '#reference-el', markdown: '#doc', editor: '#body-editor' }
      for (const [k, sel] of Object.entries(SUBJECTS)) before[k] = await strings(page, sel)
      check(`${tag}: editor toolbar is English on an English page`, /Bold/.test(before.editor) && !/Жирный/.test(before.editor))
      if (browserName === 'chromium' && variant === 'loader') await shot(page, 'demo-desktop-light')
      if (browserName === 'webkit' && variant === 'loader') await shot(page, 'demo-webkit-desktop-light')
      if (browserName === 'chromium' && variant === 'bundle') await shot(page, 'demo-bundle-desktop-light')

      await page.evaluate(() => window.scrollTo(0, 0))
      await clickAt(page, '[data-group="theme"] [data-value="dark"]')
      await sleep(400)
      const dark = await page.evaluate(probe)
      const attr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
      const same = Object.keys(light).filter((k) => light[k] === dark[k])
      check(`${tag}: theme → dark reaches the elements`, attr === 'dark' && same.length === 0, same.length ? `unchanged: ${same.join(', ')}` : `${light.flow} → ${dark.flow}`)

      await clickAt(page, '[data-group="locale"] [data-value="ru"]')
      await sleep(800)
      const changed = []
      const unchanged = []
      for (const [k, sel] of Object.entries(SUBJECTS)) ((await strings(page, sel)) !== before[k] ? changed : unchanged).push(k)
      check(`${tag}: locale → ru reaches every element with strings`, unchanged.length === 0, unchanged.length ? `unchanged: ${unchanged.join(', ')}` : changed.join(', '))
      const ru = await page.evaluate(() => document.querySelector('#walkthrough button[aria-label]')?.getAttribute('aria-label') ?? '')
      check(`${tag}: … the kit's player speaks Russian`, /[а-яё]/i.test(ru), ru)
      if (browserName === 'chromium' && variant === 'loader') await shot(page, 'demo-desktop-dark-ru')

      // The editor's toolbar follows the locale (wysiwyg 0.5.1), and back.
      const toolbar = () => page.evaluate(() => [...document.querySelectorAll('#body-editor [title], #body-editor [aria-label]')].map((e) => `${e.getAttribute('title') ?? ''} ${e.getAttribute('aria-label') ?? ''}`).join('|'))
      const ruBar = await toolbar()
      await clickAt(page, '[data-group="locale"] [data-value="en"]')
      await sleep(600)
      const enBar = await toolbar()
      check(`${tag}: editor toolbar RU → EN`, /Жирный/.test(ruBar) && /Bold/.test(enBar) && !/Жирный/.test(enBar), `${ruBar.slice(0, 40)} → ${enBar.slice(0, 40)}`)
      // Every package bundles its icons: they draw, and no icon library is fetched.
      const icons = await page.evaluate(() => ({
        toolbar: document.querySelectorAll('#body-editor .dsk-wysiwyg-toolbar svg').length,
        lucide: performance.getEntriesByType('resource').filter((e) => /lucide/.test(e.name)).map((e) => e.name),
      }))
      check(`${tag}: icons drawn (editor toolbar), no icon library fetched`, icons.toolbar > 10 && icons.lucide.length === 0, JSON.stringify(icons).slice(0, 160))

      check(`${tag}: no console errors`, errors.length === 0, errors.slice(0, 5).join(' | '))
    } catch (error) {
      check(`${tag}: ran to the end`, false, error.message.split('\n')[0])
    } finally {
      await close()
    }
  }
}

// ---------------------------------------------------------------- phone screenshots and layout
for (const theme of ['light', 'dark']) {
  const tag = `chromium/phone-${theme}`
  if (!wants(tag) || !browsers.chromium) continue
  const { page, errors, close } = await open('chromium', `/demo.html?theme=${theme}`, { viewport: PHONE, phone: true })
  try {
    await settle(page)
    await page.locator('#reference-el').scrollIntoViewIfNeeded()
    await page.waitForSelector('#reference-el .oa-reference', { timeout: 15000 })
      await page.waitForSelector('#reference-el .oa-op__doc', { timeout: 15000 }).catch(() => {})
    await sleep(500)
    await page.evaluate(() => window.scrollTo(0, 0))
    const overflow = await page.evaluate(() => {
      const w = document.documentElement.clientWidth
      const wide = [...document.querySelectorAll('dsk-video,dsk-audio,dsk-diagram,dsk-openapi,dsk-flow,dsk-markdown,dsk-editor')].filter((e) => e.getBoundingClientRect().right > w + 1).map((e) => e.id || e.tagName)
      return { scroll: document.documentElement.scrollWidth - w, wide }
    })
    check(`${tag}: no horizontal page scroll`, overflow.scroll <= 0 && overflow.wide.length === 0, JSON.stringify(overflow))
    const ref = await page.evaluate(() => {
      const box = document.querySelector('#reference-el .dsk-openapi')
      return { box: box.clientWidth, content: box.scrollWidth }
    })
    // Reported, not failed: the reference's own header sets the width (see the README's known issues).
    console.log(`info ${tag}: two-spec reference ${ref.content}px wide in a ${ref.box}px box`)
    await shot(page, `demo-phone-${theme}`)
    check(`${tag}: no console errors`, errors.length === 0, errors.slice(0, 5).join(' | '))
  } catch (error) {
    check(`${tag}: ran to the end`, false, error.message.split('\n')[0])
  } finally {
    await close()
  }
}

// ---------------------------------------------------------------- dark desktop shot
if (browsers.chromium && wants('chromium/desktop-dark')) {
  const { page, close } = await open('chromium', '/demo.html?theme=dark')
  await settle(page)
  await page.locator('#reference-el').scrollIntoViewIfNeeded()
  await page.waitForSelector('#reference-el .oa-reference', { timeout: 15000 })
      await page.waitForSelector('#reference-el .oa-op__doc', { timeout: 15000 }).catch(() => {})
  await sleep(500)
  await page.evaluate(() => window.scrollTo(0, 0))
  await shot(page, 'demo-desktop-dark')
  await close()
}

// ---------------------------------------------------------------- technical page
for (const browserName of Object.keys(browsers)) {
  for (const variant of ['loader', 'bundle']) {
    const tag = `${browserName}/${variant}/check`
    if (!wants(tag)) continue
    // Each run starts with an empty shared board.
    await fetch(`${BASE}/api/board/reset`, { method: 'POST' })
    const { page, errors, close } = await open(browserName, `/check.html?embed=${variant}`)
    try {
      await settle(page)
      // Polling: the snapshot endpoint is called every poll-interval.
      serverLog.polls = []
      await sleep(2000)
      const polls = serverLog.polls.length
      check(`${tag}: poll-url polls the snapshot endpoint`, polls >= 2, `${polls} polls in 2 s at 600 ms`)

      // Toggle: accepted, then refused and rolled back.
      serverLog.toggles = []
      const toggles = await page.evaluate(() => {
        window.__toggle = []
        document.addEventListener('dsk:toggle', (e) => window.__toggle.push(['toggle', e.detail.id, e.detail.enabled, e.detail.ok]))
        document.addEventListener('dsk:toggle-error', (e) => window.__toggle.push(['error', e.detail.change.id]))
        return true
      })
      void toggles
      // Through the details drawer's "Enabled" switch (the hover bar needs a real hover).
      for (const id of ['create', 'done']) {
        await clickAt(page, `#api-flow [data-node-id="${id}"] .fl-node__body, #api-flow [data-node-id="${id}"]`)
        const sw = page.locator('.uid-drawer .uid-switch input, .uid-drawer [role="switch"]').first()
        await sw.waitFor({ state: 'attached', timeout: 5000 })
        // The switch's input is visually hidden: click it the way its label does.
        await sw.evaluate((input) => input.click())
        await sleep(900)
        await page.keyboard.press('Escape')
        await page.waitForSelector('.uid-drawer', { state: 'detached', timeout: 5000 }).catch(() => {})
        await sleep(300)
      }
      const tg = await page.evaluate(() => window.__toggle)
      // The clicks above opened create → createOrder in the openapi-target reference.
      const target = await page.evaluate(() => {
        const box = document.querySelector('#ref2 .dsk-openapi')
        const op = [...box.querySelectorAll('[id]')].find((e) => /createOrder/.test(e.id))
        const b = box.getBoundingClientRect()
        const o = op?.getBoundingClientRect()
        return { scrolled: box.scrollTop, visible: !!o && o.top >= b.top - 2 && o.top < b.bottom }
      })
      check(`${tag}: openapi-target: a clicked node opens its operation in the reference`, target.scrolled > 0 && target.visible, JSON.stringify(target))
      check(`${tag}: each toggle is POSTed once`, serverLog.toggles.length === 2, `${serverLog.toggles.length} requests`)
      check(`${tag}: toggle-url: accepted (ok) and refused (rolled back) toggles`, tg.some((t) => t[0] === 'toggle' && t[1] === 'create' && t[3] === true) && tg.some((t) => t[0] === 'toggle' && t[1] === 'done' && t[3] === false) && tg.some((t) => t[0] === 'error' && t[1] === 'done'), JSON.stringify(tg))

      // Sub-process: drill into "ship" through subgraph-url; the poll gets the path.
      const nav = await page.evaluate(async () => {
        const el = document.querySelector('#api-flow')
        const seen = []
        el.addEventListener('dsk:navigate', (e) => seen.push(e.detail.path))
        await el.enter('ship')
        await new Promise((r) => setTimeout(r, 1200))
        const nodes = [...el.querySelectorAll('[data-node-id]')].map((n) => n.getAttribute('data-node-id'))
        el.back()
        return { seen, nodes }
      })
      check(`${tag}: inside a sub-process the poll carries path=ship`, (serverLog.polls ?? []).includes('ship'), JSON.stringify([...new Set(serverLog.polls)]))
      check(`${tag}: subgraph-url loads a referenced sub-process`, nav.nodes.includes('pack') && nav.seen.some((p) => p.join() === 'ship'), JSON.stringify(nav))

      // <dsk-board>: a view, an editor with a form input, a shared board and a markdown block.
      const bd = await page.evaluate(() => ({
        view: document.querySelectorAll('#view-board .bd-sticky, #view-board .bd-shape').length,
        viewTools: !!document.querySelector('#view-board .bd-tools'),
        editTools: !!document.querySelector('#edit-board .bd-tools'),
        block: document.querySelectorAll('#md-board .bd-sticky').length,
      }))
      check(`${tag}: <dsk-board> renders a board read-only`, bd.view === 2 && !bd.viewTools, JSON.stringify(bd))
      check(`${tag}: <dsk-board editable> has the tools`, bd.editTools)
      check(`${tag}: a \`\`\`board block in markdown`, bd.block === 1, JSON.stringify(bd))
      const eb = await page.locator('#edit-board .bd-canvas').boundingBox()
      await page.locator('#edit-board').scrollIntoViewIfNeeded()
      const eb2 = await page.locator('#edit-board .bd-canvas').boundingBox()
      await page.mouse.dblclick(eb2.x + eb2.width / 2, eb2.y + eb2.height / 2)
      await page.keyboard.type('Typed in embed')
      await page.keyboard.press('Escape')
      await sleep(300)
      const input = await page.evaluate(() => document.querySelector('#edit-board input[name=board]')?.value ?? '')
      check(`${tag}: editing a board fills its form input`, input.includes('Typed in embed'), input.slice(0, 80))
      void eb
      // Shared: a sticky made in A appears in B through board-url (on a fresh board).
      await page.locator('#shared-a').scrollIntoViewIfNeeded()
      const sa = await page.locator('#shared-a .bd-canvas').boundingBox()
      const before = await page.locator('#shared-b .bd-sticky').count()
      await page.mouse.dblclick(sa.x + sa.width / 2, sa.y + sa.height / 2)
      await page.keyboard.type('Shared')
      await page.keyboard.press('Escape')
      await page.waitForFunction((n) => document.querySelectorAll('#shared-b .bd-sticky').length > n, before, { timeout: 8000 }).catch(() => {})
      const shared = await page.evaluate(() => ({ b: document.querySelectorAll('#shared-b .bd-sticky').length, text: document.querySelector('#shared-b .bd-sticky text')?.textContent ?? '' }))
      check(`${tag}: board-url: a sticky made in one element appears in the other`, shared.b === before + 1, JSON.stringify(shared))

      const r = await page.evaluate(() => ({
        mermaidFlow: document.querySelectorAll('#mermaid-flow [data-node-id]').length,
        editorFlow: !!document.querySelector('#editor-flow .fl-editor, #editor-flow [class*="editor"]'),
        editorInput: document.querySelector('#editor-flow input[name=process]')?.value ?? '',
        hlsVideo: !!document.querySelector('#hls .uid-video video'),
        block: !!document.querySelector('#block-mode .oa-block'),
        broken: document.querySelector('#broken .dsk-error')?.textContent ?? '',
        fromSrc: !!document.querySelector('#from-src svg'),
        chart: document.querySelector('#cms .host-chart')?.textContent ?? '',
        cmsVideo: !!document.querySelector('#cms .dsk-block--video video'),
        cmsFlow: document.querySelectorAll('#cms .dsk-block--flow [data-node-id]').length,
      }))
      check(`${tag}: flow from Mermaid source`, r.mermaidFlow >= 3, `${r.mermaidFlow} nodes`)
      check(`${tag}: editable flow → FlowEditor with a form input`, r.editorFlow && r.editorInput.includes('"nodes"'))
      check(`${tag}: openapi block mode (editable)`, r.block)

      // Editor mode: the visual editor over the whole spec; an edit comes out as dsk:change.
      const ed = await page.evaluate(async () => {
        const el = document.querySelector('#editor-mode')
        el.scrollIntoView()
        const changes = []
        el.addEventListener('dsk:change', (e) => changes.push(e.detail.source))
        const visual = !!el.querySelector('.oa-editor') && el.innerText.includes('List orders')
        const source = [...el.querySelectorAll('.oa-editor__bar button, .oa-editor__bar [role=tab]')].find((b) => /source|исходник/i.test(b.textContent))
        source?.click()
        await new Promise((r) => setTimeout(r, 300))
        const area = el.querySelector('textarea')
        if (area) {
          area.value = area.value.replace('Editor check', 'Edited title')
          area.dispatchEvent(new Event('input', { bubbles: true }))
        }
        await new Promise((r) => setTimeout(r, 600))
        return { visual, area: !!area, changed: changes.some((t) => t.includes('Edited title')), value: el.value?.includes('Edited title') }
      })
      check(`${tag}: openapi editor mode: the visual editor, edits as dsk:change and value`, ed.visual && ed.area && ed.changed && ed.value, JSON.stringify(ed))
      check(`${tag}: diagram error is shown with its position`, /line/.test(r.broken), r.broken)
      check(`${tag}: diagram from src`, r.fromSrc)
      check(`${tag}: renderBlocks: host renderer, video and flow blocks`, r.chart === '3 bars' && r.cmsVideo && r.cmsFlow === 2, JSON.stringify({ c: r.chart, v: r.cmsVideo, f: r.cmsFlow }))

      // proxy: try-it goes through the host's endpoint (openapi's proxySend contract).
      serverLog.proxied = []
      try {
        await page.locator('#proxied').scrollIntoViewIfNeeded()
        await page.locator('#proxied button', { hasText: /^Send$/ }).first().click()
        await page.waitForFunction(() => /200/.test(document.querySelector('#proxied').innerText), null, { timeout: 8000 })
      } catch {
        // reported below
      }
      const prox = serverLog.proxied ?? []
      check(`${tag}: proxy attribute sends try-it through the endpoint`, prox.length === 1 && prox[0].method === 'GET' && /\/v1\/orders/.test(prox[0].url), JSON.stringify(prox.map((p) => `${p.method} ${p.url}`)))

      // HLS through the kit's adapter: plays and advances.
      const hls = await page.evaluate(async () => {
        const el = document.querySelector('#hls')
        try {
          await el.play()
        } catch (e) {
          return { error: String(e) }
        }
        await new Promise((r) => setTimeout(r, 2500))
        const v = el.querySelector('video')
        // Whether this browser build can decode the fixture at all (H.264 + AAC).
        const h264 = typeof window.MediaSource !== 'undefined'
          && window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')
        return { t: v.currentTime, err: v.error?.code ?? null, alert: el.querySelector('[role=alert]')?.textContent ?? null, h264 }
      })
      const hlsOk = hls.t > 0.5 && !hls.err
      // Builds without an H.264 decoder cannot play the fixture: open-source
      // Chromium (it says so through isTypeSupported) and Playwright's WebKit on
      // Linux, whose GStreamer lacks the decoder although isTypeSupported says
      // yes. There the kit must report the format instead of failing silently;
      // everywhere else the stream has to play.
      const noDecoder = !hls.h264 || (browserName === 'webkit' && process.platform === 'linux')
      check(`${tag}: HLS (fMP4) via @dskripchenko/ui/hls`, hlsOk || (noDecoder && !!hls.alert), JSON.stringify(hls))

      // renderBlocks is idempotent; dynamic elements upgrade.
      const again = await page.evaluate(async () => {
        const n = await window.DskEmbed.renderBlocks(document.querySelector('#cms'))
        const host = document.querySelector('#dynamic')
        host.innerHTML = '<dsk-diagram id="late">graph LR; X-->Y</dsk-diagram>'
        await document.querySelector('#late').ready
        return { n, late: !!document.querySelector('#late svg'), blocks: document.querySelectorAll('#cms [data-dsk-block]').length }
      })
      check(`${tag}: renderBlocks twice renders nothing twice`, again.n === 0 && again.blocks === 4, JSON.stringify(again))
      check(`${tag}: an element added later upgrades`, again.late)

      // A property set from script re-renders.
      const prop = await page.evaluate(async () => {
        const el = document.querySelector('#mermaid-flow')
        el.graph = { version: 1, nodes: [{ id: 'p', type: 'start', label: 'P' }, { id: 'q', type: 'state', label: 'Q' }, { id: 'r', type: 'end' }], edges: [] }
        await new Promise((r) => setTimeout(r, 500))
        return el.querySelectorAll('[data-node-id]').length
      })
      check(`${tag}: .graph property replaces the model`, prop === 3, `${prop} nodes`)

      const vue = await oneVue(page)
      check(`${tag}: one app context`, vue.contexts === 1, `${vue.mounts} mounts`)
      if (browserName === 'chromium' && variant === 'loader') await shot(page, 'check-desktop-light')
      check(`${tag}: no console errors`, errors.length === 0, errors.slice(0, 5).join(' | '))
    } catch (error) {
      check(`${tag}: ran to the end`, false, error.message.split('\n')[0])
    } finally {
      await close()
    }
  }
}

// ---------------------------------------------------------------- the loader as a module script; a page with its own map
for (const browserName of Object.keys(browsers)) {
  if (wants(`${browserName}/module`)) {
    const { page, errors, close } = await open(browserName, '/module.html')
    try {
      await settle(page)
      const r = await page.evaluate(() => ({
        svg: !!document.querySelector('#md svg'),
        audio: !!document.querySelector('#a .uid-audio'),
        maps: document.querySelectorAll('script[type=importmap]').length,
        icons: performance.getEntriesByType('resource').some((e) => e.name.includes('lucide')),
      }))
      check(`${browserName}/module: a page with markdown and audio fetches no icons file`, !r.icons)
      check(`${browserName}/module: loader as <script type="module"> (multiple import maps)`, r.svg && r.audio, JSON.stringify(r))
      check(`${browserName}/module: no console errors`, errors.filter((e) => !/classic <script>/.test(e)).length === 0, errors.slice(0, 3).join(' | '))
    } catch (error) {
      check(`${browserName}/module: ran`, false, error.message.split('\n')[0])
    } finally {
      await close()
    }
  }
  if (wants(`${browserName}/existing-map`)) {
    const { page, errors, close } = await open(browserName, '/existing-map.html')
    try {
      await settle(page)
      await page.waitForSelector('#host-vue', { timeout: 10000 })
      const r = await page.evaluate(() => ({
        host: document.querySelector('#host-vue')?.textContent,
        video: !!document.querySelector('#v .uid-video'),
        vueFiles: performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/vue@')),
      }))
      check(`${browserName}/existing-map: page map composes, host Vue and embed share one Vue`, r.video && r.host === 'host vue 3.5.44' && r.vueFiles.length === 1, JSON.stringify(r))
      check(`${browserName}/existing-map: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
    } catch (error) {
      check(`${browserName}/existing-map: ran`, false, error.message.split('\n')[0])
    } finally {
      await close()
    }
  }
}

for (const b of Object.values(browsers)) await b.close()
await server.close()
console.log(`\n${failures.length === 0 ? 'all checks passed' : `${failures.length} failed:\n  ${failures.join('\n  ')}`}`)
console.log(`screenshots: ${out}${shotsDir ? ` and ${shotsDir}` : ''} (${readdirSync(out).length} files)`)
process.exit(failures.length ? 1 : 0)
