/** dist/bundles/bpmn.js — the BPMN/DMN plugin alone, with Vue and the kit inside; joins any other bundle on the page. */
import { bootBundle } from '../bundleBoot'
import { PLUGIN_STYLES } from '../core/plugins'
import { STYLES } from './styles'
import * as bpmn from '../plugins/bpmn'

bootBundle({ bpmn }, PLUGIN_STYLES.bpmn.map((id) => [id, STYLES[id as keyof typeof STYLES]] as const))
