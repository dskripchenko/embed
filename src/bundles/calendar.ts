/** dist/bundles/calendar.js — the calendar plugin alone, with Vue and the kit inside; joins any other bundle on the page. */
import { bootBundle } from '../bundleBoot'
import { PLUGIN_STYLES } from '../core/plugins'
import { STYLES } from './styles'
import * as calendar from '../plugins/calendar'

bootBundle({ calendar }, PLUGIN_STYLES.calendar.map((id) => [id, STYLES[id as keyof typeof STYLES]] as const))
