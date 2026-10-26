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
import { MediaBlockError, audioBlockProps, videoBlockProps } from '../core/mediaBlock'
import type { BlockRenderer, ElementContext, ElementInstance, Host } from '../core/types'
import { instanceRef, mountElementView, mountView, runtimeHost, setupRuntime, hc } from './runtime'

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
  return {
    update: () => v.refresh(),
    destroy() {
      api.dispose()
      v.unmount()
    },
    api,
  }
}

function blockRenderer(kind: 'video' | 'audio'): BlockRenderer {
  return (code) => {
    const toProps = kind === 'video' ? videoBlockProps : audioBlockProps
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
        return {
          update(next) {
            try {
              view.props = toProps(next)
            } catch {
              // A half-typed source keeps the last good player.
            }
          },
          destroy() {
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
