/** The embed's own version, injected at build time. */
declare const __EMBED_VERSION__: string
/** Exact versions of the shared runtime packages, injected at build time. */
declare const __EMBED_VERSIONS__: Record<string, string>

declare module '*.css?inline' {
  const css: string
  export default css
}

declare module 'virtual:dsk-light-fallback' {
  /** The kit's light theme block, re-targeted to `:root:not([data-theme])`. */
  const css: string
  export default css
}
