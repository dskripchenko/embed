/**
 * Our dist/ address. A CDN range (`@1`, `@latest`) is pinned to `version`,
 * so the plugins always match the loader that asks for them.
 */
export function embedBaseOf(src: string, version: string): string {
  const pinned = src.replace(/(@dskripchenko\/embed)@[^/]+\//, `$1@${version}/`)
  return pinned.replace(/[?#].*$/, '').replace(/[^/]*$/, '')
}

/** The npm CDN root the loader came from (`…/npm/`), when it came from one. */
export function cdnBaseOf(src: string): string | null {
  const m = /^(.*\/)@dskripchenko\/embed@[^/]+\//.exec(src)
  return m ? m[1]! : null
}
