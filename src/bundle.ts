/**
 * dist/embed.bundle.js — the fat bundle: Vue, the kit, every plugin package
 * and all styles in one classic script, no import map and no further
 * requests. The same elements and the same `DskEmbed` API as the loader:
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.bundle.js"></script>
 *
 * For a page that cannot use import maps or wants no CDN at run time. It is
 * the whole runtime at once — see the README for its size; a page that needs
 * a few elements takes the per-plugin bundles (dist/bundles/) instead.
 */
import { bootBundle } from './bundleBoot'
import { STYLES } from './bundles/styles'
import * as media from './plugins/media'
import * as diagram from './plugins/diagram'
import * as openapi from './plugins/openapi'
import * as flow from './plugins/flow'
import * as bpmn from './plugins/bpmn'
import * as drawio from './plugins/drawio'
import * as kanban from './plugins/kanban'
import * as markdown from './plugins/markdown'
import * as editor from './plugins/editor'
import * as board from './plugins/board'

bootBundle({ media, diagram, openapi, flow, markdown, editor, board, bpmn, drawio, kanban }, Object.entries(STYLES))
