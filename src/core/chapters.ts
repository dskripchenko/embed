/** A chapter of a video, as the kit reads it from the chapters track. */
export interface Chapter {
  index: number
  title: string
  start: number
  end: number
}

/** A chapter by index (number or digits), else title: exact first, then a part of it; case-insensitive. */
export function findChapter(chapters: Chapter[], which: number | string): Chapter | undefined {
  if (typeof which === 'number' || /^\d+$/.test(String(which).trim())) return chapters[Number(which)]
  const key = String(which).trim().toLowerCase()
  return chapters.find((c) => c.title.toLowerCase() === key) ?? chapters.find((c) => c.title.toLowerCase().includes(key))
}
