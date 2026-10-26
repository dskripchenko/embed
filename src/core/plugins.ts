import type { PluginName } from './types'
import type { RUNTIME_STYLES } from './importmap'

type StyleName = keyof typeof RUNTIME_STYLES

/** The stylesheets each plugin needs, in cascade order. */
export const PLUGIN_STYLES: Readonly<Record<PluginName, readonly StyleName[]>> = {
  diagram: ['tokens', 'themes'],
  media: ['tokens', 'themes', 'kit'],
  markdown: ['tokens', 'themes', 'kit'],
  openapi: ['tokens', 'themes', 'kit', 'openapi'],
  flow: ['tokens', 'themes', 'kit', 'flow'],
  editor: ['tokens', 'themes', 'kit', 'editor'],
}
