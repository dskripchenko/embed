# 配置与事件

## 配置

```js
DskEmbed.configure({ theme: 'dark', locale: 'ru' })
DskEmbed.config  // { theme, resolvedTheme, locale, cdnBase, versions }
```

### 主题

| `theme` | |
|---|---|
| `null`（默认） | 跟随页面：页面的 `<html data-theme>`；页面未设置时使用组件库的浅色配色。 |
| `'light'`、`'dark'` | 写入 `<html data-theme>`。 |
| `'system'` | `prefers-color-scheme`，实时跟随，写入 `<html data-theme>`。 |

组件库的主题以 `<html data-theme>` 为依据，因此**主题是页面级的**：组件打开的菜单和对话框
挂载在 `<body>` 上，按元素设置的主题无法作用到它们。页面自行切换 `data-theme` 时会被跟随——
无需任何调用：

```js
document.documentElement.dataset.theme = 'dark'   // 所有元素随之切换
```

既没有设置主题也没有该特性时，组件库的浅色 token 定义在 `:root:not([data-theme])` 上——仅为
自定义属性（`--uid-*`），不涉及页面自身使用的任何内容。

颜色是 CSS 自定义属性。在 `:root`（或 `:root[data-theme='dark']`）上覆盖组件库的 token，
例如 `--uid-accent`；图表读取 `--dg-*`（默认映射到组件库的 token）。

### 语言

`'en'` 或 `'ru'`。默认：页面的 `<html lang>`（`ru…` → `ru`，其他 → `en`），页面修改时
随之变化。`configure({ locale })` 固定语言；`configure({ locale: null })` 恢复为跟随页面。
元素自身的 `locale` 特性对该元素优先。

语言会作用于组件库的组件（播放器控件、对话框、空状态）、OpenAPI 组件和流程视图。

### 运行时位置

`cdnBase` 和 `versions` 决定加载器从哪里获取运行时。它们只在写入 import map 之前读取一次：
请在 script 标签上（`data-cdn-base`）或在加载器之前的 `window.DskEmbedConfig` 中设置，而不是
之后通过 `configure()` 设置。见[自托管](getting-started.md#自托管)。

## 事件

每个事件都是名为 `dsk:<name>` 的冒泡 DOM `CustomEvent`，负载位于 `detail` 中。元素的事件
从元素本身开始；不带 target 的 `DskEmbed.emit` 在 `document` 上派发。两种方式都可以监听：

```js
// 事件总线：在 document 上监听，能收到所有元素的事件。
const off = DskEmbed.on('node', (detail, event) => {
  console.log(detail.id, 'in', event.target.id)
})
off()

DskEmbed.once('ready', (detail, event) => { /* 第一个元素已渲染 */ })

// 原生 DOM，在任意祖先节点或元素本身上监听。
document.querySelector('#process').addEventListener('dsk:node', (e) => console.log(e.detail))
```

`DskEmbed.emit(name, detail?, target?)` 在同一总线上派发你自己的 `dsk:<name>` 事件——页面
可以用同样的方式让自己的组件与各元素协同。

| 事件 | 来源 | `detail` |
|---|---|---|
| `dsk:ready` | 所有元素 | `{ tag }` |
| `dsk:error` | 所有元素 | `{ message, … }` |
| `dsk:config` | `document` | 每次变化时为 `{ theme, resolvedTheme, locale }` |
| `dsk:play`、`dsk:pause`、`dsk:ended`、`dsk:timeupdate` | video、audio、媒体块 | `{ currentTime, duration, src }` |
| `dsk:chapter` | video | `{ index, title, start, end }` |
| `dsk:trackchange` | audio | `{ index }` |
| `dsk:qualitychange`、`dsk:audiotrackchange` | video | `{ label }` |
| `dsk:render` | diagram | `{ type, width, height }` |
| `dsk:loaded`、`dsk:active` | openapi | `{ id, title }`、`{ id }` |
| `dsk:change` | openapi（块）、flow（编辑器）、editor | `{ source }`、`{ graph, description, source }`、`{ value }` |
| `dsk:node` | flow、flow 块 | `{ id, path, node, data }` |
| `dsk:select`、`dsk:navigate` | flow | `{ kind, id, path, element }`、`{ path }` |
| `dsk:toggle`、`dsk:toggle-error` | flow | 变更内容；`{ change, message }` |
| `dsk:poll-error`、`dsk:load`、`dsk:validate` | flow | `{ message }`、`{ nodes, edges }`、`{ issues }` |
| `dsk:input`、`dsk:editor-ready` | editor | `{ value }`、`{ controller }` |
| `dsk:embed-ready` | `document` | `{ version, mode }`——API 已定义 |

## 协同

各元素互不知晓；由页面通过事件和方法把它们连接起来。下面是两个示例。

### 流程步骤打开对应的 API 操作

流程节点在 `data` 中携带其操作（也会显示在节点详情中）：

```json
{ "id": "pay", "type": "task", "label": "Pay", "data": { "operation": "payOrder" } }
```

声明式写法——`openapi-target` 让参考文档滚动到该操作：

```html
<dsk-flow src="/process.json" openapi-target="#api"></dsk-flow>
<dsk-openapi id="api" src="/openapi.yaml"></dsk-openapi>
```

或者使用事件总线——这里切换的是流程旁边的操作卡片：

```html
<dsk-flow src="/process.json" details="false"></dsk-flow>
<dsk-openapi id="card" src="/openapi.yaml" operation="createOrder"></dsk-openapi>
<script>
  DskEmbed.on('node', ({ data }) => {
    if (data.operation) document.querySelector('#card').operation = data.operation
  })
</script>
```

### 流程步骤播放对应的视频片段

```json
{ "id": "pay", "type": "task", "label": "Pay", "data": { "chapter": "Payment" } }
```

```html
<dsk-flow src="/process.json" media-target="#tour"></dsk-flow>
<dsk-video id="tour" src="/tour.mp4">
  <track kind="chapters" src="/tour.chapters.vtt" default>
</dsk-video>
```

`data.chapter` 是章节的标题（或标题的一部分）或索引；`data.time` 是以秒为单位的位置。手动实现：

```js
DskEmbed.on('node', ({ data }) => {
  const video = document.querySelector('#tour')
  if (data.chapter !== undefined) video.playChapter(data.chapter)
  else if (data.time !== undefined) video.seek(data.time).then(() => video.play())
})
```

反过来——让流程跟随视频：

```js
document.querySelector('#tour').addEventListener('dsk:chapter', (e) => {
  document.querySelector('dsk-flow').select(STEP_OF_CHAPTER[e.detail.title])
})
```
