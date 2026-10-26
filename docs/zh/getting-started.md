# 快速开始

`@dskripchenko/embed` 以 HTML 标签的形式把作者的组件放到任意网页上——纯 HTML、CMS
模板、WordPress、Blade、React、Vue 均可——组件从 CDN 加载。所有元素共用一份 Vue、一份
UI 组件库和一套块渲染器，彼此之间通过 DOM 事件通信。

| 元素 | 是什么 | 基于 |
|---|---|---|
| `<dsk-video>` | 视频播放器：多个源、清晰度菜单、字幕、章节、缩略图、HLS | `@dskripchenko/ui` UidVideo |
| `<dsk-audio>` | 音频播放器、播放列表、波形 | `@dskripchenko/ui` UidAudio |
| `<dsk-diagram>` | Mermaid 图表（11 种类型）→ SVG | `@dskripchenko/diagrams` |
| `<dsk-openapi>` | OpenAPI 参考文档、单个操作或 API 块 | `@dskripchenko/openapi` |
| `<dsk-flow>` | 带监控的流程视图，或流程编辑器 | `@dskripchenko/flow` |
| `<dsk-markdown>` | 带实时块的 markdown | `@dskripchenko/ui` UidMarkdown |
| `<dsk-editor>` | 带实时块的 WYSIWYG 编辑器，可直接用于表单 | `@dskripchenko/wysiwyg` |

## 加载器（推荐）

```html
<head>
  <script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js"></script>
</head>
<body>
  <dsk-diagram>
    flowchart LR
      A[Write] --> B[Publish]
  </dsk-diagram>
</body>
```

`embed.js` gzip 后约 9 KB。它特意是一个**经典**脚本（classic script）：在所处位置立即
执行，为共享运行时写入一个 [import map](#import-map)（导入映射），定义各元素和
`window.DskEmbed`，除此之外什么也不做。Vue、组件库和各插件包在第一个需要它们的元素出现时
才从 CDN 获取；只有一个图表的页面只会加载 diagrams 包，别的都不加载。

把它放在 `<head>` 中，位于页面任何 `<script type="module">` 之前。

`@1` 跟随最新的 1.x 版本。加载器会把它获取的所有内容——它自己的插件和运行时包——锁定到该
版本构建和测试时所用的确切版本，因此 script 标签上的版本范围永远不会导致版本混用。对于必须
永远不变的页面，把标签也锁定（`@1.0.0`）。

### script 标签选项

```html
<script src="…/embed.js"
        data-theme="system"
        data-locale="ru"
        data-render-blocks="article"></script>
```

| 特性 | |
|---|---|
| `data-theme` | `light`、`dark` 或 `system`；见[配置](config-and-events.md#主题)。 |
| `data-locale` | `en` 或 `ru`。默认：页面的 `<html lang>`。 |
| `data-cdn-base` | 运行时的来源（默认：加载器所在的 CDN，否则为 jsDelivr）。 |
| `data-render-blocks` | 页面解析完成后渲染该选择器下的代码块（值为空时：`body`）。见[块](blocks.md)。 |

同样的选项，以及用于覆盖单个锁定版本的 `versions`，也可以在加载器之前通过
`window.DskEmbedConfig = { theme, locale, cdnBase, versions }` 设置。

## 完整打包版（fat bundle）

```html
<script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.bundle.js"></script>
```

一个文件，内含 Vue、组件库、所有插件包和全部样式：无需 import map，也不会再发起其他请求。
元素和 `DskEmbed` API 完全相同。它是一次性加载的整个运行时——约 2 MB，**gzip 后 563 KB**——
而加载器只获取页面实际用到的部分。在不支持 import map 的环境，或运行时不允许加载任何内容的
场景下使用它。

一个页面上二者选其一，不要同时使用（后加载的那个会被忽略并给出警告）。

## 自托管

加载器获取的所有内容都可以按 CDN 的目录结构由你自己的服务器提供。在该包的检出目录中：

```bash
pnpm install && pnpm build
node scripts/mirror.mjs public/static     # → public/static/npm/<pkg>@<version>/…
```

```html
<script src="/static/npm/@dskripchenko/embed@1.0.0/dist/embed.js"></script>
```

加载器从自身地址中取得 CDN 根路径（`@dskripchenko/embed@` 之前的部分），因此镜像副本无需
任何配置。对于其他目录结构，设置 `data-cdn-base` 并保留 `<pkg>@<version>/` 路径。

## Import map

浏览器通过 import map 解析裸导入（`import 'vue'`），而且只有在第一个需要它的模块加载之前就已
存在于文档中的 map 才会生效。这就是加载器是放在 `<head>` 中的经典脚本的原因。

它写入的 map（也以 `dist/importmap.json` 发布）：

| 说明符 | 指向 |
|---|---|
| `vue` | `vue@3.5.44/dist/vue.runtime.esm-browser.prod.js` |
| `@dskripchenko/ui`、`/icons`、`/hls` | `@dskripchenko/ui@1.16.0/dist/…` |
| `@dskripchenko/wysiwyg` | `@dskripchenko/wysiwyg@0.5.3/dist/index.mjs` |
| `@dskripchenko/diagrams` | `@dskripchenko/diagrams@1.1.0/dist/index.mjs` |
| `@dskripchenko/openapi`、`/vue` | `@dskripchenko/openapi@1.1.2/dist/…` |
| `@dskripchenko/flow`、`/vue`、`/mermaid` | `@dskripchenko/flow@1.1.1/dist/…` |

映射中没有图标库：组件库、openapi、flow 和编辑器都把所用图标打包进各自的构建。

**页面自带 import map。** 页面自己映射的条目仍归页面所有；embed 会再添加一个包含其余条目的
map，支持多个 import map 的浏览器会将它们合并（Chromium 133 起；浏览器检查在当前的 Chromium
和 WebKit 中通过——在依赖它之前请先验证其他引擎）。如果页面把 `vue` 或组件库映射到其他文件，
加载器会发出警告：两份 Vue 会让元素失效。把它们映射到上表中完全相同的文件——这样页面自己的
Vue 代码和各元素就共用同一份 Vue：

```html
<script type="importmap">
  { "imports": { "vue": "https://cdn.jsdelivr.net/npm/vue@3.5.44/dist/vue.runtime.esm-browser.prod.js" } }
</script>
<script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js"></script>
```

对于不支持多个 import map 的浏览器，把 `dist/importmap.json` 的条目复制到你唯一的 map 中，
并且仍然在它之后加载 `embed.js`。

**作为模块。** `<script type="module" src="…/embed.js">` 同样可用，前提是浏览器支持多个
import map；此时加载器会警告一次，因为在较旧的浏览器中 map 会来得太晚。

## 浏览器

当前版本的 Chromium、Safari 和 Firefox。加载器需要 import map（Chrome 89+、Safari 16.4+、
Firefox 108+）；完整打包版在任何支持 ES2022 的环境都能运行。没有面向旧浏览器的构建。

## 内容安全策略（CSP）

加载器需要：

- `script-src`——CDN 源（`https://cdn.jsdelivr.net`），以及 import map：内联的
  `<script type="importmap">` 算作内联脚本。在严格策略下，自己编写 map——在 `embed.js`
  之前的 `<script type="importmap" nonce="…">` 中放入 `dist/importmap.json` 的条目；
  加载器会发现所有条目都已就位，因而不写入任何内容。（在 `'strict-dynamic'` 下，加载器插入的
  map 是由脚本创建的，通常会被允许，但显式的 map 才是可移植的做法。）
- `style-src`——CDN 源（组件库的样式表以 `<link>` 引入），以及 `'unsafe-inline'` 或
  nonce，用于 embed 自己的小段 `<style>` 和组件的内联 `style` 属性。
- `connect-src`——你的元素要请求的一切：`src`、`poll-url`、`toggle-url`、规范文件，以及
  try-it 调用的 API。
- `media-src` / `img-src`——你的媒体资源；HLS（MediaSource）需要 `blob:`。
- 不需要 `worker-src`。

完整打包版需要为它自己的 URL 设置 `script-src`，以及相同的 `style-src`、`connect-src` 和
媒体规则。没有任何地方使用 `eval`。

## 版本管理

遵循语义化版本，外加一条规则：每个版本锁定其运行时。Vue、组件库和插件包的版本是发布版本的
一部分——`DskEmbed.versions` 会列出它们——锁定新版本即发布新的 embed 版本（包的补丁对应
patch，包的新功能对应 minor）。元素的特性（attribute）、属性（property）、事件以及 `DskEmbed`
API 遵循 semver。

## 下一步

- [元素](elements.md)——所有特性、属性、方法和事件
- [块](blocks.md)——块渲染器注册表和 `renderBlocks()`
- [配置与事件](config-and-events.md)——主题、语言、事件总线、协同
- [框架](frameworks.md)——React、Vue、WordPress、Blade、普通表单
