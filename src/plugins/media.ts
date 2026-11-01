/**
 * `<dsk-video>`, `<dsk-audio>` and the ```video / ```audio blocks: the kit's
 * UidVideo and UidAudio. An HLS stream loads the kit's own adapter
 * (`@dskripchenko/ui/hls`) on first use.
 */
import { shallowReactive, watch } from 'vue'
import { UidAudio, UidVideo } from '@dskripchenko/ui'
import { audioProps, videoProps } from '../core/media'
import { cssLength } from '../core/attrs'
import { findChapter, type Chapter } from '../core/chapters'
import { MediaBlockError, audioBlockProps, resolveMediaUrls, videoBlockProps } from '../core/mediaBlock'
import type { BlockRenderer, ElementContext, ElementInstance, Host } from '../core/types'
import { instanceRef, mountElementView, mountView, runtimeHost, setupRuntime, hc } from './runtime'
import { printable } from './print'

export function setup(host: Host): void {
  setupRuntime(host)
}

type Player = {
  play(): Promise<void>
  pause(): void
  toggle(): void
  seek(time: number): void
  next?(): void
  prev?(): void
  state: Record<string, unknown>
  media: HTMLMediaElement | null
  /** UidVideo (ui 1.16): the chapters track, read by the kit. */
  chapters?: { start: number; end: number; title: string }[]
  chapterIndex?: number
  seekToChapter?(target: number | string): boolean
}

export type { Chapter }

function whenMetadata(media: HTMLMediaElement): Promise<void> {
  if (media.readyState >= 1) return Promise.resolve()
  return new Promise((resolve) => media.addEventListener('loadedmetadata', () => resolve(), { once: true }))
}

/** The detail of the player events. */
function detailOf(player: Player | null): Record<string, unknown> {
  const media = player?.media
  return { currentTime: media?.currentTime ?? 0, duration: media?.duration ?? 0, src: media?.currentSrc ?? '' }
}

/** Events, methods and getters of one player, shared by the elements and the blocks. */
function playerBindings(emit: (name: string, detail?: unknown) => void) {
  const player = instanceRef<Player>()
  let media: HTMLMediaElement | null = null
  const onTime = (): void => emit('timeupdate', detailOf(player.ref.value))
  const stop = watch(
    () => player.ref.value?.media ?? null,
    (next) => {
      media?.removeEventListener('timeupdate', onTime)
      media = next
      media?.addEventListener('timeupdate', onTime)
    },
  )
  const handlers = {
    ref: player.set,
    onPlay: () => emit('play', detailOf(player.ref.value)),
    onPause: () => emit('pause', detailOf(player.ref.value)),
    onEnded: () => emit('ended', detailOf(player.ref.value)),
    onError: (error: unknown) => emit('error', error),
    onQualitychange: (label: string) => emit('qualitychange', { label }),
    onAudiotrackchange: (label: string) => emit('audiotrackchange', { label }),
    onTrackchange: (index: number) => emit('trackchange', { index }),
    onChapterchange: (chapter: { start: number; end: number; title: string } | null, index: number) =>
      emit('chapterchange', chapter ? { index, title: chapter.title, start: chapter.start, end: chapter.end } : null),
  }
  const p = (): Player => {
    const v = player.ref.value
    if (!v) throw new Error('the player is not ready')
    return v
  }
  const api = {
    play: () => p().play(),
    pause: () => p().pause(),
    toggle: () => p().toggle(),
    async seek(time: number) {
      const m = p().media
      if (m) await whenMetadata(m)
      p().seek(Number(time))
    },
    next: () => p().next?.(),
    prev: () => p().prev?.(),
    get state() {
      return player.ref.value?.state
    },
    get media() {
      return player.ref.value?.media ?? null
    },
    /** The video's chapters, as the kit read them from its chapters track. */
    get chapters(): Chapter[] {
      return (player.ref.value?.chapters ?? []).map((c, index) => ({ index, title: c.title, start: c.start, end: c.end }))
    },
    /** Resolves with the chapters once the kit has read the track (empty without one, or after `timeout` ms). */
    async loadChapters(timeout = 4000): Promise<Chapter[]> {
      const started = Date.now()
      while (api.chapters.length === 0 && Date.now() - started < timeout) {
        await new Promise((r) => setTimeout(r, 50))
      }
      return api.chapters
    },
    /** Seeks to a chapter — its index, title, or a part of the title — and plays. */
    async playChapter(which: number | string) {
      const chapter = findChapter(await api.loadChapters(), which)
      if (!chapter) throw new Error(`no chapter "${String(which)}"`)
      const v = p()
      if (v.seekToChapter) v.seekToChapter(chapter.index)
      else await api.seek(chapter.start)
      await v.play()
      emit('chapter', chapter)
      return chapter
    },
    dispose() {
      stop()
      media?.removeEventListener('timeupdate', onTime)
    },
  }
  return { handlers, api }
}

const clock = (t: number): string => {
  const s = Math.max(0, Math.floor(t))
  const hms = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
  return (hms[0] ? `${hms[0]}:${String(hms[1]).padStart(2, '0')}` : `${hms[1]}`) + `:${String(hms[2]).padStart(2, '0')}`
}

/** The frame on screen, as a picture: none before the video has one, or from another origin without CORS. */
function frameOf(media: HTMLMediaElement | null): HTMLImageElement | null {
  if (!(media instanceof HTMLVideoElement) || media.readyState < 2 || !media.videoWidth) return null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = media.videoWidth
    canvas.height = media.videoHeight
    canvas.getContext('2d')!.drawImage(media, 0, 0)
    const img = document.createElement('img')
    img.src = canvas.toDataURL('image/jpeg', 0.85)
    return img
  } catch {
    return null
  }
}

/**
 * A player on paper: the poster (else the frame on screen), the title, where
 * the media is, and the chapters or the playlist — nothing that plays.
 */
function mediaForm(kind: 'video' | 'audio', props: Record<string, unknown>, api: { media: HTMLMediaElement | null; chapters: Chapter[] }): HTMLElement {
  const fig = document.createElement('figure')
  fig.className = 'dsk-print-media'
  fig.style.margin = '0'
  if (kind === 'video') {
    let picture: HTMLImageElement | null
    if (typeof props.poster === 'string' && props.poster !== '') {
      picture = document.createElement('img')
      picture.src = props.poster
    } else picture = frameOf(api.media)
    if (picture) {
      picture.alt = typeof props.title === 'string' ? props.title : ''
      fig.append(picture)
    }
  }
  const sources = kind === 'video' ? ((props.sources as { src: string }[] | undefined) ?? []) : []
  const tracks = kind === 'audio' ? ((props.tracks as { src: string; title?: string }[] | undefined) ?? (typeof props.src === 'string' ? [{ src: props.src, title: props.title as string | undefined }] : [])) : []
  const where = sources[0]?.src ?? tracks[0]?.src
  const cap = document.createElement('figcaption')
  const title = typeof props.title === 'string' ? props.title : kind === 'audio' && tracks.length === 1 ? tracks[0]!.title : undefined
  if (title) {
    const strong = document.createElement('strong')
    strong.textContent = title
    cap.append(strong)
  }
  if (where) {
    if (title) cap.append(' — ')
    const a = document.createElement('a')
    a.className = 'dsk-print-link'
    a.href = new URL(where, document.baseURI).href
    a.textContent = a.href
    cap.append(a)
  }
  if (cap.childNodes.length) fig.append(cap)
  const items = kind === 'video' ? api.chapters.map((c) => `${clock(c.start)} — ${c.title}`) : tracks.length > 1 ? tracks.map((t, i) => t.title ?? `${i + 1}. ${t.src.split('/').pop()}`) : []
  if (items.length) {
    const list = document.createElement('ol')
    list.className = 'dsk-print-list'
    for (const item of items) {
      const li = document.createElement('li')
      li.textContent = item
      list.append(li)
    }
    if (kind === 'video') list.style.listStyle = 'none'
    fig.append(list)
  }
  return fig
}

/** The key that remounts a player when its media changes, not when a flag does. */
function mediaKey(props: Record<string, unknown>): string {
  return JSON.stringify(props.sources ?? props.tracks ?? props.src ?? '')
}

export function mountElement(ctx: ElementContext): ElementInstance {
  const isVideo = ctx.tag === 'dsk-video'
  const { handlers, api } = playerBindings(ctx.emit)
  const v = mountElementView(ctx, (view) => {
    const props = isVideo ? videoProps(view.props, view.children) : audioProps(view.props, view.children)
    return hc(isVideo ? UidVideo : UidAudio, {
      ...props,
      key: mediaKey(props),
      class: 'dsk-media',
      ...handlers,
      ...(isVideo ? {} : { 'onUpdate:index': (index: number) => ctx.emit('trackchange', { index }) }),
    })
  })
  const unprint = printable(ctx.host, ctx.container, () => {
    const props = isVideo ? videoProps(ctx.props(), ctx.children()) : audioProps(ctx.props(), ctx.children())
    return mediaForm(isVideo ? 'video' : 'audio', props, api)
  })
  return {
    update: () => v.refresh(),
    destroy() {
      unprint()
      api.dispose()
      v.unmount()
    },
    api,
  }
}

function blockRenderer(kind: 'video' | 'audio'): BlockRenderer {
  return (code, ctx) => {
    // Paths relative to the markdown — `src: intro.mp4` — resolve as its images do.
    const parse = kind === 'video' ? videoBlockProps : audioBlockProps
    const toProps = (source: string) => resolveMediaUrls(parse(source), ctx?.imageBase ?? ctx?.linkBase)
    let initial: Record<string, unknown>
    try {
      initial = toProps(code)
      const resolved = kind === 'video' ? videoProps(initial) : audioProps(initial)
      if (kind === 'video' && (resolved.sources as unknown[]).length === 0) return { error: 'no video source: give `src` or `sources`' }
      if (kind === 'audio' && !resolved.src && !resolved.tracks) return { error: 'no audio source: give `src` or `tracks`' }
    } catch (error) {
      if (error instanceof MediaBlockError || error instanceof SyntaxError) return { error: error.message }
      throw error
    }
    return {
      mount(el) {
        el.classList.add('dsk-media', `dsk-media--${kind}`)
        const view = shallowReactive({ props: initial })
        const host = runtimeHost()
        const { handlers, api } = playerBindings((name, detail) => host.emit(name, detail, el))
        // The block answers the same calls as the element: el.dskPlayer.play().
        ;(el as HTMLElement & { dskPlayer?: unknown }).dskPlayer = api
        const mounted = mountView(el, () => {
          // A block's width cap: `maxWidth: 520` (pixels) or any CSS length.
          el.style.maxWidth = cssLength(view.props.maxWidth) ?? ''
          const props = kind === 'video' ? videoProps(view.props) : audioProps(view.props)
          return hc(kind === 'video' ? UidVideo : UidAudio, { ...props, key: mediaKey(props), ...handlers })
        })
        const unprint = printable(host, el, () => mediaForm(kind, kind === 'video' ? videoProps(view.props) : audioProps(view.props), api))
        return {
          update(next) {
            try {
              view.props = toProps(next)
            } catch {
              // A half-typed source keeps the last good player.
            }
          },
          destroy() {
            unprint()
            api.dispose()
            mounted.unmount()
          },
        }
      },
    }
  }
}

export const renderers: Record<string, BlockRenderer> = {
  video: blockRenderer('video'),
  audio: blockRenderer('audio'),
}
