import embedCss from '../embed.css?inline'
import lightFallback from 'virtual:dsk-light-fallback'

/**
 * The embed's base stylesheet: its own rules, and the kit's light tokens for
 * a page without `<html data-theme>` — on `:root:not([data-theme])`, custom
 * properties only, nothing the page itself uses.
 */
export const BASE_CSS = `${lightFallback}\n${embedCss}`
