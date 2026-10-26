// Media fixtures for the browser check and the demo page (generated, not committed):
// a 16-second walkthrough video with four chapters (slides rendered by a
// browser, encoded by ffmpeg) as WebM (VP9/Opus) and MP4 (H.264/AAC), a
// poster, chapter and caption tracks, an HLS (fMP4) rendition, and two audio
// tracks for a playlist.
// Usage: node scripts/fixtures.mjs [outDir]   (needs ffmpeg; PLAYWRIGHT may point at playwright/index.mjs)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = resolve(process.argv[2] ?? join(root, 'tests/browser/fixtures/media'))
const FF = process.env.FFMPEG ?? 'ffmpeg'
const Q = ['-hide_banner', '-loglevel', 'error', '-y']
const ff = (...args) => execFileSync(FF, [...Q, ...args], { cwd: out, stdio: 'inherit' })

if (existsSync(join(out, 'walkthrough.webm')) && !process.env.FIXTURES_FORCE) {
  console.log(`fixtures present in ${out}`)
  process.exit(0)
}
mkdirSync(out, { recursive: true })

export const CHAPTERS = [
  { title: 'Cart', en: 'The customer fills a cart', color: '#0d9488' },
  { title: 'Create order', en: 'POST /orders creates the order', color: '#2563eb' },
  { title: 'Payment', en: 'POST /orders/{id}/pay charges the card', color: '#7c3aed' },
  { title: 'Shipping', en: 'The warehouse ships the parcel', color: '#ea580c' },
]
const SECONDS = 4

const pw = await import(process.env.PLAYWRIGHT ?? 'playwright')
const browser = await pw.chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
for (const [i, c] of CHAPTERS.entries()) {
  await page.setContent(`<!doctype html><html><body style="margin:0;width:1280px;height:720px;display:grid;place-items:center;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#fff;
    background:radial-gradient(circle at 20% 15%, ${c.color}ee, #0b1020 75%)">
    <div style="text-align:center">
      <div style="font-size:30px;letter-spacing:.2em;text-transform:uppercase;opacity:.75">Chapter ${i + 1} of ${CHAPTERS.length}</div>
      <div style="font-size:112px;font-weight:700;margin:18px 0 10px">${c.title}</div>
      <div style="font-size:36px;opacity:.85">${c.en}</div>
      <div style="display:flex;gap:14px;justify-content:center;margin-top:48px">
        ${CHAPTERS.map((_, j) => `<span style="width:${j === i ? 56 : 14}px;height:14px;border-radius:7px;background:#fff;opacity:${j === i ? 1 : 0.35}"></span>`).join('')}
      </div>
    </div></body></html>`)
  await page.screenshot({ path: join(out, `slide-${i}.png`) })
}
await browser.close()

// Slides with fades, and a soft two-tone pad as the soundtrack.
const inputs = CHAPTERS.flatMap((_, i) => ['-loop', '1', '-t', String(SECONDS), '-framerate', '30', '-i', `slide-${i}.png`])
const fades = CHAPTERS.map((_, i) => `[${i}:v]format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=${SECONDS - 0.4}:d=0.4[v${i}]`).join(';')
const concat = `${CHAPTERS.map((_, i) => `[v${i}]`).join('')}concat=n=${CHAPTERS.length}:v=1:a=0[v]`
const total = SECONDS * CHAPTERS.length
const pad = `aevalsrc='0.25*sin(2*PI*220*t)*(0.6+0.4*sin(0.5*t))+0.18*sin(2*PI*330*t)|0.25*sin(2*PI*277*t)*(0.6+0.4*sin(0.4*t))+0.18*sin(2*PI*440*t)':s=48000:d=${total}`
const audioIndex = CHAPTERS.length
// ffmpeg wants every input before the filter graph's outputs are mapped.
const base = [...inputs, '-f', 'lavfi', '-i', pad, '-filter_complex', `${fades};${concat}`, '-map', '[v]', '-map', `${audioIndex}:a`, '-shortest']
ff(...base, '-c:v', 'libvpx-vp9', '-b:v', '300k', '-deadline', 'good', '-cpu-used', '4', '-c:a', 'libopus', '-b:a', '48k', 'walkthrough.webm')
ff(...base, '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-g', '60', '-crf', '28', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', 'walkthrough.mp4')
ff('-ss', String(SECONDS + 1), '-i', 'walkthrough.mp4', '-frames:v', '1', '-q:v', '4', 'poster.jpg')

const ts = (s) => `00:00:${s.toFixed(3).padStart(6, '0')}`
writeFileSync(
  join(out, 'chapters.vtt'),
  'WEBVTT\n\n' + CHAPTERS.map((c, i) => `${ts(i * SECONDS)} --> ${ts((i + 1) * SECONDS)}\n${c.title}\n`).join('\n'),
)
writeFileSync(
  join(out, 'captions-en.vtt'),
  'WEBVTT\n\n' + CHAPTERS.map((c, i) => `${ts(i * SECONDS + 0.5)} --> ${ts((i + 1) * SECONDS - 1)}\n${c.en}\n`).join('\n'),
)
const RU = ['Покупатель собирает корзину', 'POST /orders создаёт заказ', 'POST /orders/{id}/pay списывает оплату', 'Склад отправляет посылку']
writeFileSync(join(out, 'captions-ru.vtt'), 'WEBVTT\n\n' + RU.map((t, i) => `${ts(i * SECONDS + 1)} --> ${ts((i + 1) * SECONDS - 1)}\n${t}\n`).join('\n'))

// HLS, fMP4 segments, 2 renditions.
mkdirSync(join(out, 'hls'), { recursive: true })
ff(
  '-i', 'walkthrough.mp4',
  '-filter_complex', '[0:v]split=2[a][b];[a]scale=640:360[v360];[b]scale=1280:720[v720]',
  '-map', '[v360]', '-map', '0:a', '-map', '[v720]', '-map', '0:a',
  '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
  '-b:v:0', '300k', '-b:v:1', '900k', '-c:a', 'aac', '-b:a', '64k', '-ac', '2',
  '-f', 'hls', '-hls_time', '2', '-hls_playlist_type', 'vod', '-hls_segment_type', 'fmp4',
  '-hls_segment_filename', 'hls/v%v/seg%03d.m4s', '-master_pl_name', 'master.m3u8',
  '-var_stream_map', 'v:0,a:0,name:360p v:1,a:1,name:720p', 'hls/v%v/index.m3u8',
)

// Two short tracks for the audio playlist.
const tone = (f1, f2, d) => `aevalsrc='0.3*sin(2*PI*${f1}*t)*(0.5+0.5*sin(1.1*t))+0.2*sin(2*PI*${f2}*t)*(0.5+0.5*sin(0.7*t+1))':s=44100:d=${d}`
ff('-f', 'lavfi', '-i', tone(262, 392, 14), '-c:a', 'libmp3lame', '-b:a', '96k', 'track-1.mp3')
ff('-f', 'lavfi', '-i', tone(294, 440, 10), '-c:a', 'libmp3lame', '-b:a', '96k', 'track-2.mp3')
ff('-f', 'lavfi', '-i', tone(330, 494, 10), '-c:a', 'libopus', '-b:a', '64k', 'track-2.ogg')
console.log(`fixtures written to ${out}`)
