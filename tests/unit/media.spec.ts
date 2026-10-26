import { HLS_TYPE, audioProps, videoProps } from '../../src/core/media'
import { audioBlockProps, videoBlockProps } from '../../src/core/mediaBlock'
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

import { findChapter, parseTimestamp, parseVtt } from '../../src/core/vtt'
import { dedupeToggle } from '../../src/plugins/flow'

describe('chapters (WebVTT)', () => {
  const vtt = 'WEBVTT\n\nintro\n00:00.000 --> 00:04.000\nCart\n\n00:00:04.000 --> 00:00:08.500 align:start\n<b>Create</b> order\n\nNOTE x\n\n00:08.500 --> 00:12.000\nPayment\n'
  it('parses cues', () => {
    expect(parseTimestamp('01:02:03.5')).toBe(3723.5)
    expect(parseVtt(vtt)).toEqual([
      { index: 0, start: 0, end: 4, title: 'Cart' },
      { index: 1, start: 4, end: 8.5, title: 'Create order' },
      { index: 2, start: 8.5, end: 12, title: 'Payment' },
    ])
  })
  it('finds a chapter by index or title', () => {
    const cues = parseVtt(vtt)
    expect(findChapter(cues, 2)?.title).toBe('Payment')
    expect(findChapter(cues, '1')?.title).toBe('Create order')
    expect(findChapter(cues, 'payment')?.start).toBe(8.5)
    expect(findChapter(cues, 'creat')?.index).toBe(1)
    expect(findChapter(cues, 'nope')).toBeUndefined()
  })
})

describe('flow toggle guard', () => {
  it('a duplicated call (emit + prop) shares one request and keeps the emit copy quiet', async () => {
    const persist = vi.fn(() => Promise.reject(new Error('refused')))
    const guarded = dedupeToggle(persist)
    const change = { id: 'a' }
    const fromEmit = guarded(change)
    const awaited = guarded(change)
    await expect(fromEmit).resolves.toBeUndefined()
    await expect(awaited).rejects.toThrow('refused')
    expect(persist).toHaveBeenCalledOnce()
  })
  it('a single call keeps the rejection, so the switch rolls back', async () => {
    const guarded = dedupeToggle(() => Promise.reject(new Error('refused')))
    await expect(guarded({ id: 'b' })).rejects.toThrow('refused')
  })
})
