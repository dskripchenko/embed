/** dist/bundles/drawio.js — the draw.io plugin alone; joins any other bundle on the page. */
import { bootBundle } from '../bundleBoot'
import { PLUGIN_STYLES } from '../core/plugins'
import { STYLES } from './styles'
import * as drawio from '../plugins/drawio'

bootBundle({ drawio }, PLUGIN_STYLES.drawio.map((id) => [id, STYLES[id as keyof typeof STYLES]] as const))
