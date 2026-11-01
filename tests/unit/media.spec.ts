import { HLS_TYPE, audioProps, videoProps } from '../../src/core/media'
import { audioBlockProps, resolveAgainst, resolveMediaUrls, videoBlockProps } from '../../src/core/mediaBlock'
import { readMediaChildren } from '../../src/core/source'

function element(html: string) {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

describe('video and audio props', () => {
  it('<source>/<track> children → UidVideo sources and tracks', () => {
    const el = element(`
      <source src="/a.webm" type="video/webm" data-label="720p">
      <source src="/hls/master.m3u8">
      <track kind="chapters" src="/c.vtt" srclang="en" default>
      <track src="/s.vtt" label="English">`)
    const props = videoProps({ label: 'Intro', aspectRatio: '16:9', muted: true }, readMediaChildren(el))
    expect(props.sources).toEqual([{ src: '/a.webm', type: 'video/webm', label: '720p' }, { src: '/hls/master.m3u8', type: HLS_TYPE }])
    expect(props.tracks).toEqual([{ src: '/c.vtt', kind: 'chapters', srclang: 'en', default: true }, { src: '/s.vtt', kind: 'subtitles', label: 'English' }])
    expect(props).toMatchObject({ title: 'Intro', aspectRatio: '16 / 9', muted: true })
  })

  it('attributes win over children; src alone is one source', () => {
    expect(videoProps({ src: '/v.mp4' }).sources).toEqual([{ src: '/v.mp4' }])
    const el = element('<source src="/child.mp4">')
    expect(videoProps({ sources: [{ src: '/attr.mp4' }] }, readMediaChildren(el)).sources).toEqual([{ src: '/attr.mp4' }])
  })

  it('audio: one track flattens, several make a playlist', () => {
    const one = audioProps({ trackTitle: 'Override' }, readMediaChildren(element('<source src="/a.mp3" data-title="A" data-artist="X">')))
    expect(one).toMatchObject({ src: '/a.mp3', title: 'Override', artist: 'X' })
    const list = audioProps({ waveform: true }, readMediaChildren(element('<source src="/a.mp3" data-title="A"><source src="/b.mp3" data-duration="12">')))
    expect(list.tracks).toEqual([{ src: '/a.mp3', title: 'A' }, { src: '/b.mp3', duration: 12 }])
    expect(list.waveform).toBe(true)
  })

  it('```video and ```audio blocks', () => {
    expect(videoBlockProps('/v.mp4')).toEqual({ sources: [{ src: '/v.mp4' }] })
    expect(videoBlockProps('src: /v.mp4\ntitle: Intro\naspectRatio: 4:3\nmaxWidth: 520')).toMatchObject({ label: 'Intro', aspectRatio: '4:3', maxWidth: 520 })
    expect(videoProps(videoBlockProps('/a.webm\n/b.mp4')).sources).toEqual([{ src: '/a.webm' }, { src: '/b.mp4' }])
    expect(audioProps(audioBlockProps('{"tracks":[{"src":"/1.mp3"},{"src":"/2.mp3"}],"mini":true}'))).toMatchObject({ variant: 'mini', tracks: [{ src: '/1.mp3' }, { src: '/2.mp3' }] })
    expect(() => videoBlockProps('')).toThrow()
  })
})

import { findChapter } from '../../src/core/chapters'

describe('chapters', () => {
  // The shape UidVideo exposes (ui 1.16), indexed by the element.
  const chapters = [
    { index: 0, title: 'Cart', start: 0, end: 4 },
    { index: 1, title: 'Create order', start: 4, end: 8.5 },
    { index: 2, title: 'Payment', start: 8.5, end: 12 },
  ]
  it('finds a chapter by index or title', () => {
    expect(findChapter(chapters, 2)?.title).toBe('Payment')
    expect(findChapter(chapters, '1')?.title).toBe('Create order')
    expect(findChapter(chapters, 'payment')?.start).toBe(8.5)
    expect(findChapter(chapters, 'creat')?.index).toBe(1)
    expect(findChapter(chapters, 'nope')).toBeUndefined()
  })
})

describe('media blocks: paths relative to the markdown', () => {
  it('resolves a relative path against a rooted or absolute base, leaving the rest', () => {
    expect(resolveAgainst('intro.mp4', '/download/attachments/42/')).toBe('/download/attachments/42/intro.mp4')
    expect(resolveAgainst('media/a.vtt', '/download/attachments/42')).toBe('/download/attachments/42/media/a.vtt')
    expect(resolveAgainst('../b.mp3', 'https://cdn.example.com/docs/page/')).toBe('https://cdn.example.com/docs/b.mp3')
    for (const kept of ['/abs.mp4', 'https://x.example/a.mp4', 'data:video/mp4;base64,AA', '#t', '']) {
      expect(resolveAgainst(kept, '/base/')).toBe(kept)
    }
  })

  it('resolves sources, tracks, the poster and thumbnails of a block', () => {
    const props = resolveMediaUrls(
      videoBlockProps('src: intro.mp4\nposter: intro.jpg\nthumbnails: thumbs.vtt\ntracks:\n  - src: intro.en.vtt\n    srclang: en'),
      '/files/7/',
    )
    expect(props.sources).toEqual([expect.objectContaining({ src: '/files/7/intro.mp4' })])
    expect(props.poster).toBe('/files/7/intro.jpg')
    expect(props.thumbnails).toBe('/files/7/thumbs.vtt')
    expect(props.tracks).toEqual([{ src: '/files/7/intro.en.vtt', srclang: 'en' }])
    const audio = resolveMediaUrls(audioBlockProps('- one.mp3\n- https://x.example/two.mp3'), '/files/7/')
    expect(audio.tracks).toEqual(['/files/7/one.mp3', 'https://x.example/two.mp3'])
  })

  it('leaves the props as they are without a base', () => {
    const props = videoBlockProps('intro.mp4')
    expect(resolveMediaUrls(props, undefined)).toBe(props)
  })
})

describe('media blocks: preload', () => {
  it('takes preload none | metadata | auto and ignores anything else', () => {
    expect(videoBlockProps('src: a.mp4\npreload: none').preload).toBe('none')
    expect(audioBlockProps('src: a.mp3\npreload: auto').preload).toBe('auto')
    expect(videoBlockProps('src: a.mp4\npreload: eager').preload).toBeUndefined()
  })
})
