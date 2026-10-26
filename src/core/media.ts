/**
 * Element props and block sources → the props of the kit's UidVideo and
 * UidAudio. Pure functions: no Vue, unit-tested.
 */
import { aspectRatio } from './attrs'

export const HLS_TYPE = 'application/x-mpegURL'

export interface MediaSource {
  src: string
  type?: string
  label?: string
}

export interface MediaTrack {
  src: string
  kind: 'subtitles' | 'captions' | 'chapters'
  srclang?: string
  label?: string
  default?: boolean
}

export interface AudioTrack {
  src: string
  type?: string
  title?: string
  artist?: string
  peaks?: number[]
  duration?: number
}

type Children = { sources: Record<string, string>[]; tracks: Record<string, string>[] }

export function isHlsUrl(url: string): boolean {
  return /\.m3u8$/i.test(url.replace(/[?#].*$/, ''))
}

function text(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

function finite(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

function asList(value: unknown): unknown[] {
  if (value === null || value === undefined || value === '') return []
  return Array.isArray(value) ? value : [value]
}

function urlOf(item: unknown): string | undefined {
  if (typeof item === 'string') return text(item)
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>
    return text(o.src) ?? text(o.url)
  }
  return undefined
}

/** The type the kit is told: the stated one, or HLS for an `.m3u8` address. */
function typeOf(src: string, item: unknown): string | undefined {
  const stated = item && typeof item === 'object' ? text((item as Record<string, unknown>).type) : undefined
  if (stated) return stated
  return isHlsUrl(src) ? HLS_TYPE : undefined
}

export function toSources(value: unknown): MediaSource[] {
  const out: MediaSource[] = []
  for (const item of asList(value)) {
    const src = urlOf(item)
    if (!src) continue
    const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const type = typeOf(src, item)
    const label = text(o.label)
    out.push({ src, ...(type ? { type } : {}), ...(label ? { label } : {}) })
  }
  return out
}

export function toTracks(value: unknown): MediaTrack[] {
  const out: MediaTrack[] = []
  for (const item of asList(value)) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const src = text(o.src)
    if (!src) continue
    const kind = o.kind === 'captions' || o.kind === 'chapters' ? o.kind : 'subtitles'
    const isDefault = o.default === true || o.default === '' || o.default === 'true' || o.default === 'default'
    out.push({
      src,
      kind,
      ...(text(o.srclang) ? { srclang: o.srclang as string } : {}),
      ...(text(o.label) ? { label: o.label as string } : {}),
      ...(isDefault ? { default: true } : {}),
    })
  }
  return out
}

export function toAudioTracks(value: unknown): AudioTrack[] {
  const out: AudioTrack[] = []
  for (const item of asList(value)) {
    const src = urlOf(item)
    if (!src) continue
    const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const type = typeOf(src, item)
    const peaks = Array.isArray(o.peaks)
      ? o.peaks.filter((p): p is number => typeof p === 'number')
      : typeof o.peaks === 'string'
        ? o.peaks.split(',').map(Number).filter((n) => Number.isFinite(n))
        : undefined
    const duration = finite(o.duration)
    out.push({
      src,
      ...(type ? { type } : {}),
      ...(text(o.title) ? { title: o.title as string } : {}),
      ...(text(o.artist) ? { artist: o.artist as string } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(peaks && peaks.length > 0 ? { peaks } : {}),
    })
  }
  return out
}

const VIDEO_PASS = ['poster', 'thumbnails', 'autoplay', 'muted', 'loop', 'preload', 'controls', 'crossorigin', 'exclusive', 'resumeKey', 'rates', 'hotkeys', 'autoHide', 'hlsOptions']

/** UidVideo's props from `<dsk-video>`: attributes/properties, then `<source>`/`<track>` children. */
export function videoProps(props: Record<string, unknown>, children: Children = { sources: [], tracks: [] }): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of VIDEO_PASS) if (props[key] !== undefined) out[key] = props[key]
  let sources = toSources(props.sources)
  if (sources.length === 0) sources = toSources(children.sources)
  if (sources.length === 0 && typeof props.src === 'string' && props.src !== '') sources = toSources(props.src)
  out.sources = sources
  const tracks = toTracks(props.tracks !== undefined ? props.tracks : children.tracks)
  out.tracks = tracks
  const ratio = aspectRatio(props.aspectRatio)
  if (ratio) out.aspectRatio = ratio
  if (typeof props.label === 'string') out.title = props.label
  return out
}

const AUDIO_PASS = ['loop', 'preload', 'crossorigin', 'exclusive', 'resumeKey', 'rates', 'hotkeys', 'hlsOptions', 'variant', 'waveform', 'waveformMaxBytes', 'waveformMaxDuration', 'autoAdvance', 'showVolume', 'showRate', 'showPlaylist']

/** UidAudio's props from `<dsk-audio>`: one track, or a playlist from `tracks` or several `<source>` children. */
export function audioProps(props: Record<string, unknown>, children: Children = { sources: [], tracks: [] }): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of AUDIO_PASS) if (props[key] !== undefined) out[key] = props[key]
  let tracks = toAudioTracks(props.tracks)
  if (tracks.length === 0) tracks = toAudioTracks(children.sources)
  if (tracks.length === 0 && typeof props.src === 'string' && props.src !== '') {
    tracks = toAudioTracks([{ src: props.src, type: props.type }])
  }
  if (tracks.length > 1) {
    out.tracks = tracks
  } else if (tracks.length === 1) {
    const t = tracks[0]!
    out.src = t.src
    if (t.type) out.type = t.type
    const title = text(props.trackTitle) ?? t.title
    const artist = text(props.artist) ?? t.artist
    if (title) out.title = title
    if (artist) out.artist = artist
    if (t.peaks) out.peaks = t.peaks
  }
  if (Array.isArray(props.peaks) && props.peaks.length > 0) out.peaks = props.peaks
  if (typeof props.index === 'number') out.index = props.index
  return out
}
