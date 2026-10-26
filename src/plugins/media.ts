/**
 * `<dsk-video>`, `<dsk-audio>` and the ```video / ```audio blocks: the kit's
 * UidVideo and UidAudio. An HLS stream loads the kit's own adapter
 * (`@dskripchenko/ui/hls`) on first use.
 */
import { shallowReactive, watch } from 'vue'
import { UidAudio, UidVideo } from '@dskripchenko/ui'
import { audioProps, videoProps } from '../core/media'
import { cssLength } from '../core/attrs'
import { findChapter, parseVtt, type Cue } from '../core/vtt'
import { MediaBlockError, audioBlockProps, videoBlockProps } from '../core/mediaBlock'
import type { BlockRenderer, ElementContext, ElementInstance, Host } from '../core/types'
import { instanceRef, mountElementView, mountView, runtimeHost, setupRuntime, state, hc } from './runtime'

export function setup(host: Host): void {
  setupRuntime(host)
}

export type { Cue as Chapter } from '../core/vtt'

const vttCache = new Map<string, Promise<Cue[]>>()

/** The chapters of a video: its `kind: chapters` track, fetched once per URL. */
function loadChapters(tracks: unknown): Promise<Cue[]> {
  const list = Array.isArray(tracks) ? (tracks as { kind?: string; src?: string }[]) : []
  const url = list.find((t) => t.kind === 'chapters')?.src
  if (!url) return Promise.resolve([])
  let p = vttCache.get(url)
  if (!p) {
    p = fetch(url, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
        return r.text()
      })
      .then(parseVtt)
    p.catch(() => vttCache.delete(url))
    vttCache.set(url, p)
  }
  return p
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
}

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
function playerBindings(emit: (name: string, detail?: unknown) => void, tracks: () => unknown = () => []) {
  let chapters: Cue[] = []
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
    /** The chapters loaded so far (after the first `playChapter` or `loadChapters`). */
    get chapters() {
      return chapters
    },
    async loadChapters() {
      chapters = await loadChapters(tracks())
      return chapters
    },
    /** Seeks to a chapter (its index or title) and plays. */
    async playChapter(which: number | string) {
      chapters = await loadChapters(tracks())
      const chapter = findChapter(chapters, which)
      if (!chapter) throw new Error(`no chapter "${String(which)}"`)
      await api.seek(chapter.start)
      await p().play()
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
  let current: Record<string, unknown> = {}
  const { handlers, api } = playerBindings(ctx.emit, () => current.tracks)
  const v = mountElementView(ctx, (view) => {
    const props = isVideo ? videoProps(view.props, view.children) : audioProps(view.props, view.children)
    current = props
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
        const { handlers, api } = playerBindings((name, detail) => host.emit(name, detail, el), () => (kind === 'video' ? videoProps(view.props).tracks : []))
        // The block answers the same calls as the element: el.dskPlayer.play().
        ;(el as HTMLElement & { dskPlayer?: unknown }).dskPlayer = api
        const mounted = mountView(el, () => state.locale, () => {
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
