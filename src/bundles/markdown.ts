/** dist/bundles/markdown.js — the markdown plugin alone, with Vue and the kit inside; joins any other bundle on the page. */
import { bootBundle } from '../bundleBoot'
import { PLUGIN_STYLES } from '../core/plugins'
import { STYLES } from './styles'
import * as markdown from '../plugins/markdown'

bootBundle({ markdown }, PLUGIN_STYLES.markdown.map((id) => [id, STYLES[id as keyof typeof STYLES]] as const))
