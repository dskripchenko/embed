/**
 * WebVTT cues, enough for chapters: start, end and the cue's text. The kit
 * reads a video's chapters track itself and does not expose it, so the
 * element reads the same file to seek by chapter.
 */
export interface Cue {
  index: number
  start: number
  end: number
  title: string
}

/** `01:02:03.500`, `02:03.5` → seconds. */
export function parseTimestamp(value: string): number {
  const parts = value.trim().split(':').map(Number)
  if (parts.some((n) => !Number.isFinite(n))) return NaN
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

export function parseVtt(text: string): Cue[] {
  const cues: Cue[] = []
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n{2,}/)
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '')
    const at = lines.findIndex((l) => l.includes('-->'))
    if (at < 0) continue
    const [from, rest] = lines[at]!.split('-->')
    const start = parseTimestamp(from ?? '')
    const end = parseTimestamp((rest ?? '').trim().split(/\s+/)[0] ?? '')
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    const title = lines.slice(at + 1).join(' ').replace(/<[^>]*>/g, '').trim()
    cues.push({ index: cues.length, start, end, title })
  }
  return cues
}

/** A chapter by index (number or digits) or title (exact, then partial; case-insensitive). */
export function findChapter(cues: Cue[], which: number | string): Cue | undefined {
  if (typeof which === 'number' || /^\d+$/.test(String(which).trim())) return cues[Number(which)]
  const key = String(which).trim().toLowerCase()
  return cues.find((c) => c.title.toLowerCase() === key) ?? cues.find((c) => c.title.toLowerCase().includes(key))
}
