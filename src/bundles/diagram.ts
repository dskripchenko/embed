/** dist/bundles/diagram.js — the diagram plugin alone, with Vue and the kit inside; joins any other bundle on the page. */
import { bootBundle } from '../bundleBoot'
import { PLUGIN_STYLES } from '../core/plugins'
import { STYLES } from './styles'
import * as diagram from '../plugins/diagram'

bootBundle({ diagram }, PLUGIN_STYLES.diagram.map((id) => [id, STYLES[id as keyof typeof STYLES]] as const))
