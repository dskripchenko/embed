/** dist/bundles/openapi.js — the openapi plugin alone, with Vue and the kit inside; joins any other bundle on the page. */
import { bootBundle } from '../bundleBoot'
import { PLUGIN_STYLES } from '../core/plugins'
import { STYLES } from './styles'
import * as openapi from '../plugins/openapi'

bootBundle({ openapi }, PLUGIN_STYLES.openapi.map((id) => [id, STYLES[id as keyof typeof STYLES]] as const))
