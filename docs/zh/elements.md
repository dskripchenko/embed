# 元素

所有元素的共性：

- **Light DOM。** 元素渲染到自身内部的 `<div data-dsk-root>` 中；组件库的样式表和页面的 CSS
  都会生效。数据子节点（`<script type="text/…">`、`<template>`、`<source>`、`<track>`）
  保留且永不显示；其他内容会被读取后移除。
- **文本内容。** 对于含有标记字符（`<`、`&`）的源，把它包在数据 script 中——浏览器既不会解析
  也不会显示它，缩进也会自动去除：

  ```html
  <dsk-markdown>
    <script type="text/markdown">
      # Title — `a < b` stays as written
    </script>
  </dsk-markdown>
  ```

  `<template>` 子节点提供其中的标记（编辑器的初始 HTML）；对于不含标记的简短源，直接写纯文本
  内容即可。
- **特性（attribute）与属性（property）。** 每个特性都有一个 camelCase 属性
  （`poll-url` → `pollUrl`）。通过脚本设置的属性优先于特性；把它设为 `undefined` 则重新以
  特性为准。变更会就地重新渲染。布尔特性：存在即为 `true`；`"false"`、`"0"`、`"off"`、
  `"no"` 为 `false`；不存在则使用组件的默认值。列表接受 `a, b, c` 或 JSON 数组；JSON 特性接受
  JSON。
- **`source`**——以属性形式提供的文本源：可以读取，也可以设置新值。**`refresh()`** 重新读取
  数据子节点。
- **`ready`**——一个 promise，元素完成渲染后 resolve。在此之前调用的方法会等待它（这些方法
  返回 promise）。
- **`locale`**——仅对当前元素生效的 `en` 或 `ru`；默认：全局语言
  （[配置](config-and-events.md)）。
- **`loading="lazy"`**——仅当元素接近视口时才加载和渲染。
- **状态**——`data-dsk-state` 为 `loading`、`ready` 或 `error`；可据此为占位内容设置样式。
  加载期间，元素会预留一个尺寸合理的区域。
- **事件**——名为 `dsk:<name>` 的冒泡 `CustomEvent`，负载位于 `detail` 中；每个元素都会触发
  `dsk:ready`，无法渲染时触发带 `{ message }` 的 `dsk:error`。见[事件](config-and-events.md#事件)。

## 全屏

`<dsk-diagram>`、`<dsk-flow>`、`<dsk-board>` 和 `<dsk-openapi>` 在悬停时（触摸屏上始终）
显示全屏按钮。元素通过 Fullscreen API 进入全屏；在不支持的地方（iOS Safari 中的普通元素）
则覆盖页面填满窗口。按 Escape 或再次点击按钮退出；流程图和白板会将内容适配到新尺寸。
播放器有自己的全屏模式。

- `fullscreen="false"` — 不显示按钮。
- 方法 `enterFullscreen()`、`exitFullscreen()`；Getter `fullscreen`。
- 事件 `dsk:fullscreen` `{ active }`。

## `<dsk-video>`

```html
<dsk-video poster="/media/intro.jpg" label="Product tour" aspect-ratio="16:9">
  <source src="/media/intro.webm" type="video/webm" data-label="720p">
  <source src="/media/intro.mp4" type="video/mp4">
  <source src="/media/hls/master.m3u8">
  <track kind="chapters" src="/media/chapters.vtt" srclang="en" default>
  <track kind="subtitles" src="/media/en.vtt" srclang="en" label="English">
</dsk-video>
```

源来自 `<source>` 子节点（`data-label` 为菜单中的清晰度命名）、`sources` JSON 特性或
`src`。`.m3u8` 地址通过组件库自带的 HLS 适配器（`@dskripchenko/ui/hls`）播放，首次使用时
获取。轨道：`<track>` 子节点或 `tracks` JSON 特性；`kind` 为 `subtitles`、`captions` 或
`chapters`。

| 特性 | 属性 | |
|---|---|---|
| `src` | `src` | 单个源。 |
| `sources` | `sources` | JSON：`[{ "src", "type"?, "label"? }]`。优先于 `<source>` 子节点。 |
| `tracks` | `tracks` | JSON：`[{ "src", "kind"?, "srclang"?, "label"?, "default"? }]`。优先于 `<track>` 子节点。 |
| `poster` | `poster` | 播放前显示的图片。 |
| `thumbnails` | `thumbnails` | 带雪碧图缩略图（`sprite.jpg#xywh=…`）的 WebVTT，显示在进度条上方。 |
| `label` | `label` | 播放器的无障碍名称。（不是 `title`：那会成为浏览器覆盖整个播放器的 tooltip。） |
| `aspect-ratio` | `aspectRatio` | `16:9`、`4/3` 或数字——在视频尺寸确定之前的区域尺寸。 |
| `autoplay`、`muted`、`loop` | 同名 | 布尔值。自动播放以静音方式开始（浏览器会拦截声音）。 |
| `controls` | `controls` | `controls="false"` 隐藏组件库的控件。 |
| `preload` | `preload` | `none`、`metadata`、`auto`。 |
| `crossorigin` | `crossorigin` | `anonymous` 或 `use-credentials`。 |
| `exclusive` | `exclusive` | 启动此播放器会暂停其他 exclusive 播放器。 |
| `resume-key` | `resumeKey` | 以此键在 localStorage 中记住播放位置。 |
| `rates` | `rates` | 播放速率，例如 `0.5, 1, 1.5, 2`。 |
| `hotkeys` | `hotkeys` | 键盘快捷键。 |
| `auto-hide` | `autoHide` | 播放时控件隐藏前的毫秒数。 |
| `hls-options` | `hlsOptions` | HLS 适配器的 JSON 选项。 |

方法：`play()`、`pause()`、`toggle()`、`seek(seconds)`、`playChapter(indexOrTitle)`
（跳转到章节轨道中的某一章——按索引、完整标题或标题的一部分——并播放）、`loadChapters()`（在组件库读取章节轨道后 resolve）。
Getter：`state`（playing、currentTime、duration、volume 等）、`media`（`<video>`）、
`chapters`（`[{ index, title, start, end }]`，即组件库从章节轨道中读取到的章节）。

事件：`dsk:play`、`dsk:pause`、`dsk:ended`、`dsk:timeupdate`——detail 为
`{ currentTime, duration, src }`；`dsk:chapter`——`playChapter()` 播放的章节；
`dsk:chapterchange`——每当播放进入另一章节时触发，`{ index, title, start, end }`（或 `null`）；
`dsk:qualitychange` `{ label }`、`dsk:audiotrackchange` `{ label }`、`dsk:error`——组件库的错误
`{ kind, detail? }`。

## `<dsk-audio>`

```html
<dsk-audio waveform show-playlist>
  <source src="/a/1.mp3" data-title="Intro" data-artist="Ann">
  <source src="/a/2.mp3" data-title="Outro" data-artist="Ann" data-duration="185">
</dsk-audio>

<dsk-audio src="/a/note.mp3" track-title="Voice note" variant="mini"></dsk-audio>
```

一个 `<source>`（或 `src`）就是一条音轨；多个则构成播放列表，带上一首/下一首、曲目列表和自动
连播。子节点接受 `data-title`、`data-artist`、`data-duration`（秒，在元数据加载前显示）和
`data-peaks`（预先计算的波形，逗号分隔的 0…1）。

| 特性 | 属性 | |
|---|---|---|
| `src`、`type` | 同名 | 单条音轨。 |
| `tracks` | `tracks` | JSON：`[{ "src", "title"?, "artist"?, "duration"?, "peaks"? }]`。 |
| `track-title`、`artist` | `trackTitle`、`artist` | 用于单条音轨。 |
| `variant` | `variant` | `default` 或 `mini`（紧凑的行内播放器）。 |
| `waveform` | `waveform` | 以波形作为进度条（在浏览器中解码）。 |
| `peaks` | `peaks` | 预先计算的峰值；隐含启用波形，无需解码。 |
| `waveform-max-bytes`、`waveform-max-duration` | camelCase | 解码的限制。 |
| `auto-advance`、`loop` | 同名 | 播放列表行为；`loop` 循环当前曲目或整个列表。 |
| `show-volume`、`show-rate`、`show-playlist` | camelCase | 显示的控件。 |
| `index` | `index` | 播放列表中的当前曲目。 |
| `preload`、`crossorigin`、`exclusive`、`resume-key`、`rates`、`hotkeys`、`hls-options` | | 同 `<dsk-video>`。 |

方法：`play()`、`pause()`、`toggle()`、`seek(seconds)`、`next()`、`prev()`。Getter：
`state`、`media`。事件：同 `<dsk-video>`，另加 `dsk:trackchange` `{ index }`。

## `<dsk-diagram>`

```html
<dsk-diagram label="Checkout">
  sequenceDiagram
    Shop->>Payments: charge
    Payments-->>Shop: ok
</dsk-diagram>

<dsk-diagram src="/docs/architecture.mmd"></dsk-diagram>
```

Mermaid 源——flowchart、sequence、state、class、ER、C4、gantt、pie、timeline、xychart、
mindmap——由 `@dskripchenko/diagrams` 渲染为 SVG。图表不会加载 Vue。颜色跟随主题（embed 把
图表的 `--dg-*` 自定义属性映射到组件库的 token 上；可在你的 CSS 中覆盖其中任意一个）。

| 特性 | 属性 | |
|---|---|---|
| `src` | `src` | 从 URL 获取源，而不是使用元素内容。 |
| `label` | `label` | SVG 的无障碍标题。 |

Getter：`svg`（`<svg>` 元素）。事件：`dsk:render` `{ type, width, height }`；
`dsk:error` `{ message, line, column, hint }`——元素还会在图表的位置显示该消息及出错位置。

## `<dsk-openapi>`

四种模式。

**参考文档**（默认）——完整的参考文档：导航、搜索、带 try-it（在线调试）的操作、13 种语言的
请求示例、TypeScript 类型、下载。

```html
<dsk-openapi src="/openapi.yaml" height="720"></dsk-openapi>

<dsk-openapi specs='[
  {"id": "v2", "name": "API v2", "src": "/openapi/v2.json"},
  {"id": "v1", "name": "API v1", "src": "/openapi/v1.json"}
]'></dsk-openapi>
```

**操作**——以卡片形式展示单个操作；通过 `operation` 设置（`operationId`、`METHOD /path`
或锚点）：

```html
<dsk-openapi src="/openapi.yaml" operation="createOrder" reference-url="/docs/api"></dsk-openapi>
```

**块**——`mode="block"`：把 API 块的 YAML/JSON（一个请求、多个请求或整个文档；
[格式说明](https://github.com/dskripchenko/openapi/blob/main/docs/en/blocks.md)）显示为实时组件；
`editable` 会加上“源码”和“构造器”标签页。

```html
<dsk-openapi mode="block" editable>
  <script type="text/yaml">
    method: POST
    url: https://api.example.com/v1/orders
    body:
      example: { sku: TEE-M, quantity: 2 }
  </script>
</dsk-openapi>
```

**编辑器**——`mode="editor"`：在可视化编辑器中编辑整个规范——文档树（info、服务器、
标签、安全、路径与操作、schema）和所选部分的表单，另有“源码”和“预览”视图。修改以
`dsk:change` `{ source }` 发出，保持文本原有格式。

```html
<dsk-openapi mode="editor" height="640" view="visual">
  <script type="text/yaml">openapi: 3.1.0 …</script>
</dsk-openapi>
```

规范来自 `src`、`specs`、`spec` 属性（文本或对象）或元素内容。同一 URL 的规范在每个页面上
只获取一次。

| 特性 | 属性 | |
|---|---|---|
| `mode` | `mode` | `reference`、`operation`、`block`、`editor`。默认：设置了 `operation` 时为 `operation`，否则为 `reference`。 |
| `view` | `view` | 编辑器模式：打开时的视图——`visual`（默认）、`source`、`preview`。 |
| `src` | `src` | 规范的 URL（YAML 或 JSON）。 |
| `specs` | `specs` | JSON：`[{ "id", "name"?, "src" \| "content" }]`——带切换器的多个规范。 |
| — | `spec` | 以文本或对象形式提供的规范（仅限脚本）。 |
| `active` | `active` | `specs` 中当前打开的规范。 |
| `operation` | `operation` | 操作模式：要展示的操作。 |
| `reference-url`、`spec-id` | camelCase | 操作模式：“在参考文档中打开”链接，以及该规范在其中的 id。 |
| `try-it` | `tryIt` | `try-it="false"` 隐藏 try-it（示例保留）。 |
| `proxy` | `proxy` | 替页面执行 try-it 请求的端点——[openapi 的代理约定](https://github.com/dskripchenko/openapi/blob/main/docs/en/standalone.md#the-proxy)（请求以 JSON 传入，响应以 JSON 返回；会一并发送 Laravel 的 `csrf-token` meta）。用于不允许页面来源（origin）访问的 API。 |
| `base-url` | `baseUrl` | 相对服务器 URL 的基址。 |
| `snippet-targets`、`default-snippet` | camelCase | 请求示例的语言（`curl, js, python, …`）以及默认显示的第一个。 |
| `persist-credentials` | `persistCredentials` | `true`/`session`/`local`：在多次访问之间保留 API 密钥。 |
| `hash-navigation` | `hashNavigation` | `false`：不写入 `location.hash`。 |
| `heading` | `heading` | 参考文档页眉的标题。 |
| `editable` | `editable` | 块模式：编辑标签页。 |
| `height` | `height` | 带独立滚动的固定高度（`720`、`80vh`）；或使用 CSS 变量 `--dsk-openapi-height`（可按断点设置）。此时参考文档的粘性导航会填满该区域（`--oa-viewport-h` 被设为同一高度）。 |
| — | `send` | `(request) => Promise<response>`——以你自己的方式发送 try-it 请求；优先于 `proxy`。 |
| — | `labels` | 覆盖界面文本。 |

方法：`go(target, { tryIt? })`——滚动到某个操作（`createOrder`、
`operation/createOrder`）、schema（`schema/Order`）或 tag；`open(id)`——切换到 `specs`
中的某个规范；`print()`。Getter：`loaded`（已加载的规范）、`value`（块模式和编辑器模式：当前文本）。

事件：`dsk:loaded` `{ id, title }`、`dsk:error` `{ id, message }`、`dsk:active`
`{ id }`（规范已切换）、`dsk:change` `{ source }`（块模式和编辑器模式，编辑之后）。

## `<dsk-flow>`

流程模型——JSON（[模型](https://github.com/dskripchenko/flow/blob/main/docs/en/model.md)），
或 Mermaid `stateDiagram-v2` / `flowchart` 源——以交互式视图呈现：平移、缩放、小地图、
子流程、详情、实时监控、开关。设置 `editable` 后则为编辑器。

```html
<dsk-flow src="/processes/order.json"
          poll-url="/processes/order/state" poll-interval="5000"
          toggle-url="/processes/order/toggle"
          subgraph-url="/processes/{ref}"
          height="480"></dsk-flow>

<dsk-flow>
  <script type="text/plain">
    stateDiagram-v2
      [*] --> Draft
      Draft --> Review: submit
      Review --> [*]: approve
  </script>
</dsk-flow>
```

**HTTP 约定**——由后端提供，页面上无需任何脚本：

| 特性 | 请求 | |
|---|---|---|
| `src` | `GET` → 模型（JSON） | |
| `poll-url` | `GET` → 监控快照，每 `poll-interval` 毫秒一次（5000） | 在子流程内部，查询参数带有 `path`（从根开始的节点 id，逗号分隔）和 `ref`（子流程引用）。非 2xx 响应会显示错误并退避重试。[快照格式](https://github.com/dskripchenko/flow/blob/main/docs/en/integration.md#monitoring-snapshot)。 |
| `toggle-url` | 切换节点或连线时 `POST` JSON `{ kind, id, enabled, path }` | 使视图可切换。非 2xx 响应会回滚该切换并显示错误。 |
| `subgraph-url` | `GET` → 被引用子流程的模型 | URL 中的 `{ref}` 会被替换为引用（`/processes/{ref}`）；没有它时会追加 `?ref=`。 |

请求是带页面 cookie 的同源 `fetch`（`credentials: 'same-origin'`）。

| 特性 | 属性 | |
|---|---|---|
| `src` | `src` | 模型的 URL。 |
| — | `graph` | 以对象形式提供的模型（仅限脚本）；优先于 `src` 和元素内容。读取它会得到当前模型（包含编辑器中的修改）。 |
| `state` | `state` | JSON：初始快照（例如由服务器渲染）；轮询会替换它。 |
| `poll-url`、`poll-interval` | camelCase | 监控，见上文。 |
| `toggle-url` | `toggleUrl` | 开关，见上文。 |
| — | `persistToggle` | `(change) => Promise`——改为自己持久化开关状态（仅限脚本）；reject 即回滚。 |
| `subgraph-url` | `subgraphUrl` | 子流程，见上文。 |
| — | `loadSubgraph` | `(ref, node) => Promise<model>`——自己加载子流程（仅限脚本）。 |
| `editable` | `editable` | 编辑器（面板、连线、撤销/重做、属性、Mermaid 导入）。 |
| `readonly` | `readonly` | 编辑器：只读。 |
| `palette` | `palette` | 编辑器：面板中的节点类型，`task, decision, …`。 |
| `name` | `name` | 编辑器：在元素内部维护一个包含模型 JSON 的隐藏 `<input name>`——普通表单即可提交它。 |
| `direction` | `direction` | `TB` 或 `LR`；默认取模型的 `meta.direction`，否则根据区域形状选择（较高的区域从上到下布局）。 |
| `edge-style` | `edgeStyle` | `orthogonal` 或 `smooth`。 |
| `wheel` | `wheel` | `zoom` 或 `pan`。 |
| `minimap`、`controls`、`details`、`status-bar` | camelCase | 视图的组成部分；`details="false"` 关闭点击时打开的详情抽屉。 |
| `height` | `height` | 默认 480（编辑器为 600）；或使用 CSS 变量 `--dsk-flow-height`。 |
| `openapi-target` | `openapiTarget` | 某个 `<dsk-openapi>` 的选择器：被点击节点的 `data.operation` 会在那里打开。 |
| `media-target` | `mediaTarget` | 某个 `<dsk-video>`/`<dsk-audio>` 的选择器：被点击节点的 `data.chapter`（标题或索引）或 `data.time`（秒）会在那里播放。 |
| — | `labels`、`registry` | 界面文本；自定义节点类型（仅限脚本）。 |

方法：`fit()`、`select(id)`、`enter(nodeId)`、`back()`、`refresh()`（立即轮询）、
`undo()`、`redo()`（编辑器）。Getter：`graph`、`stack`（已进入的子流程层级）。

事件：`dsk:node` `{ id, path, node, data }`——某个节点被点击；`dsk:select`
`{ kind, id, path, element }` 或 `null`；`dsk:toggle`
`{ kind, id, enabled, path, ok, rolledBack? }`——在开关已持久化（`ok: true`）或被拒绝（`ok: false`，已回滚）之后触发；
`dsk:toggle-error` `{ change, message }`；`dsk:navigate` `{ path }`；`dsk:poll-error`
`{ message }`；`dsk:load` `{ nodes, edges }`；编辑器：`dsk:change`
`{ graph, description, source }`、`dsk:validate` `{ issues }`。

## `<dsk-board>`

无限白板（[`@dskripchenko/board`](https://github.com/dskripchenko/board)）：
图形、便签、框架、标题和文本、连接线、表情、画笔和记号笔。默认是只读视图；
`editable` 开启编辑器；`board-url` 使其成为多人同时编辑的共享白板。

```html
<!-- A board from a file, read-only -->
<dsk-board src="/boards/retro.json" height="560"></dsk-board>

<!-- An editor in a form: the board's JSON goes in a hidden input -->
<form method="post">
  <dsk-board editable name="board"></dsk-board>
</form>

<!-- A shared board: real-time editing through the server -->
<dsk-board board-url="/api/boards/42" user-name="Anna" user-color="#ec4899"></dsk-board>
```

**共享白板**按照
[白板的 HTTP 约定](https://github.com/dskripchenko/board/blob/main/docs/en/collaboration.md#the-http-contract)
与 `board-url` 通信：`GET {base}/snapshot`、`POST {base}/batches`、
`GET {base}/batches?after=N&wait=S`（长轮询）、`POST {base}/presence`。包中的
`BoardServer` 是参考服务端逻辑。请求会带上页面的 cookie。

| 特性 | 属性 | |
|---|---|---|
| `src` | `src` | 白板的 URL（JSON）。也可以使用元素的文本（`<script type="application/json">` 中的 JSON）。 |
| — | `board` | 以对象形式提供的白板（仅限脚本）；优先于 `src` 和元素内容。 |
| `board-url` | `boardUrl` | 共享白板的基础 URL：协作。 |
| `poll-interval` | `pollInterval` | 共享白板：每 N 毫秒（至少 250）请求一次更改，而不是长轮询——适用于无法保持请求打开的服务器。 |
| — | `provider` | 任何其他传输方式（仅限脚本）：一个 `BoardProvider`——WebSocket、`MemoryHub`。 |
| `editable` | `editable` | 编辑器（用于来自 `src` 或元素内容的白板）。 |
| `readonly` | `readonly` | 共享白板：仅查看。 |
| `lockable` | `lockable` | 可以为所有人锁定和解锁白板（默认 `true`）；对不应拥有此权限的人设为 `false`。 |
| `user-name`、`user-color`、`user-id` | camelCase | 编辑者：在共享白板上向其他人显示。 |
| `name` | `name` | 在元素内部维护一个包含白板 JSON 的隐藏 `<input name>`——普通表单即可提交它。 |
| `minimap` | `minimap` | 小地图（默认开启）。 |
| `height` | `height` | 默认 560；或使用 CSS 变量 `--dsk-board-height`。 |
| — | `labels` | 界面文本（仅限脚本）。 |

方法：`fit()`、`select(ids)`、`toPng()`（一个 `Blob`）、`toSvg()`
（`{ svg, width, height }`）、`undo()`、`redo()`。Getter：`value`（白板）。

事件：`dsk:change` `{ board, ops, origin }`；`dsk:select` `{ ids }`；
`dsk:load` `{ objects }`。

## `<dsk-markdown>`

```html
<dsk-markdown toc>
  <script type="text/markdown">
    ## Paying an order

    ```mermaid
    sequenceDiagram
      Shop->>Payments: charge
    ```

    ```openapi
    method: POST
    url: https://api.example.com/v1/orders/{id}/pay
    ```
  </script>
</dsk-markdown>

<dsk-markdown src="/docs/guide.md" link-base="/docs/"></dsk-markdown>
```

通过组件库的 UidMarkdown 渲染的 markdown——表格、提示框（callout）、代码高亮——并支持
**所有已注册的块渲染器**：```` ```mermaid ````、```` ```openapi ````、```` ```flow ````、
```` ```video ````、```` ```audio ```` 以及页面自己注册的（[块](blocks.md)）。

| 特性 | 属性 | |
|---|---|---|
| `src` | `src` | 从 URL 获取 markdown。 |
| `toc`、`toc-depth` | camelCase | 目录（2…`toc-depth` 级标题）。 |
| `link-base`、`image-base` | camelCase | 相对链接和图片的基址。 |

Getter：`value`（显示的 markdown）。事件：`src` 加载失败时触发 `dsk:error`。

## `<dsk-editor>`

```html
<form method="post" action="/posts">
  <dsk-editor name="body" placeholder="Write…" min-height="240px">
    <template>
      <p>Initial <strong>HTML</strong>.</p>
      <pre><code class="language-openapi">method: GET
url: /v1/orders</code></pre>
    </template>
  </dsk-editor>
  <button>Save</button>
</form>
```

WYSIWYG 编辑器（`@dskripchenko/wysiwyg`）——工具栏（使用元素的语言）、markdown 快捷输入、斜杠菜单、表格、
源码模式——并且**所有已注册的块渲染器都实时生效**：已注册语言的代码块显示为对应组件，而可编辑的
组件（API 块的构造器）会把它的源写回 HTML。值是 HTML；代码块以
`<pre><code class="language-…">` 形式存储，因此保存下来的 HTML 在任何页面上通过
[`renderBlocks()`](blocks.md#renderblocks) 都能变为实时内容。

初始值：`value` 特性，否则取 `<template>` 子节点，否则取绑定输入框的值。

| 特性 | 属性 | |
|---|---|---|
| `value` | `value` | HTML。读取该属性得到当前内容；设置它则替换内容。 |
| `name` | `name` | 在元素内部同步维护一个隐藏的 `<input name>`——普通表单即可提交它。 |
| `input` | `input` | 某个已有 `<input>`/`<textarea>` 的选择器，与之保持同步（并从中读取初始值）。 |
| `placeholder` | `placeholder` | |
| `readonly` | `readonly` | |
| `toolbar` | `toolbar` | `toolbar="false"` 隐藏工具栏。 |
| `min-height`、`max-height` | camelCase | CSS 长度。 |
| `resizable` | `resizable` | 调整大小的拖动手柄。 |

方法：`focus()`。Getter：`value`、`controller`（编辑器的命令 API：
`controller.chain().focus().bold().run()`）。

事件——与表单控件一致：

- 每次变更后触发 `input`（普通 `Event`）和 `dsk:input` `{ value }`；
- 编辑器在值已改变的情况下失去焦点时触发 `change` 和 `dsk:change` `{ value }`；
- `dsk:editor-ready` `{ controller }`。

编辑器内部自身的 `input`/`change` 事件不会传出元素，因此
`el.addEventListener('input', () => el.value)` 读到的始终是 HTML。
