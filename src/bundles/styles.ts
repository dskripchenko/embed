/** The stylesheets the bundles carry, by id (see PLUGIN_STYLES for who needs which). */
import tokens from '@dskripchenko/ui/styles/tokens.css?inline'
import themes from '@dskripchenko/ui/styles/themes.css?inline'
import kit from '@dskripchenko/ui/styles/index.css?inline'
import openapi from '@dskripchenko/openapi/style.css?inline'
import flow from '@dskripchenko/flow/style.css?inline'
import editor from '@dskripchenko/wysiwyg/style.css?inline'
import board from '@dskripchenko/board/style.css?inline'

export const STYLES = { tokens, themes, kit, openapi, flow, editor, board } as const
