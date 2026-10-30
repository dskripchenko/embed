/** dist/bundles/flow.js — the flow plugin alone, with Vue and the kit inside; joins any other bundle on the page. */
import { bootBundle } from '../bundleBoot'
import { PLUGIN_STYLES } from '../core/plugins'
import { STYLES } from './styles'
import * as flow from '../plugins/flow'

bootBundle({ flow }, PLUGIN_STYLES.flow.map((id) => [id, STYLES[id as keyof typeof STYLES]] as const))
