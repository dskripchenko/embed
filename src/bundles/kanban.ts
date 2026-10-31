/** dist/bundles/kanban.js — the kanban plugin alone, with Vue and the kit inside; joins any other bundle on the page. */
import { bootBundle } from '../bundleBoot'
import { PLUGIN_STYLES } from '../core/plugins'
import { STYLES } from './styles'
import * as kanban from '../plugins/kanban'

bootBundle({ kanban }, PLUGIN_STYLES.kanban.map((id) => [id, STYLES[id as keyof typeof STYLES]] as const))
