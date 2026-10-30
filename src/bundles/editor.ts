/** dist/bundles/editor.js — the editor plugin alone, with Vue and the kit inside; joins any other bundle on the page. */
import { bootBundle } from '../bundleBoot'
import { PLUGIN_STYLES } from '../core/plugins'
import { STYLES } from './styles'
import * as editor from '../plugins/editor'

bootBundle({ editor }, PLUGIN_STYLES.editor.map((id) => [id, STYLES[id as keyof typeof STYLES]] as const))
