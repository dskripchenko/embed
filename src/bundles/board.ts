/** dist/bundles/board.js — the board plugin alone, with Vue and the kit inside; joins any other bundle on the page. */
import { bootBundle } from '../bundleBoot'
import { PLUGIN_STYLES } from '../core/plugins'
import { STYLES } from './styles'
import * as board from '../plugins/board'

bootBundle({ board }, PLUGIN_STYLES.board.map((id) => [id, STYLES[id as keyof typeof STYLES]] as const))
