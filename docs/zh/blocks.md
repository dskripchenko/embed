# 块

**块**是已注册语言的围栏代码块——markdown 中的 ```` ```mermaid ````，HTML 中的
`<pre><code class="language-mermaid">`——它显示为所描述的内容，而不是代码。一个页面级的
注册表服务于所有出现块的地方：

- `<dsk-markdown>`，
- `<dsk-editor>`（实时生效，组件支持编辑时可编辑），
- 对页面中已有 HTML 调用的 `DskEmbed.renderBlocks()`，
- 组件自身内部的 markdown（例如 OpenAPI 描述）。

## 内置块

| 语言 | 渲染为 | 加载 |
|---|---|---|
| `mermaid` | SVG 图表 | diagrams |
| `plantuml`（`puml`）、`dot`（`graphviz`）、`d2`、`dbml`、`structurizr`、`wardley` | 该语法的 SVG 图表 | diagrams |
| `bpmn` | 按建模工具布局绘制的 BPMN 2.0 流程 | bpmn |
| `dmn` | 决策需求图及每个决策的决策表 | bpmn |
| `drawio` | draw.io 文件（普通或压缩）的第一页 | drawio |
| `asyncapi` | AsyncAPI 2.x / 3.0 参考 | openapi |
| `openapi` | 实时 API 组件：一个请求、多个请求或整个文档 | openapi |
| `flow` | 流程视图，源为 JSON 或 Mermaid state/flowchart | flow |
| `board` | 只读白板，源为白板的 JSON | board |
| `kanban` | 只读看板，源为看板标记 | kanban |
| `calendar` | 事件日历（重复已展开） | calendar |
| `video` | 组件库的视频播放器 | 组件库 |
| `audio` | 组件库的音频播放器或播放列表 | 组件库 |

每种块在遇到该类型的第一个块时加载其插件。

```` ```video ```` 和 ```` ```audio ```` 接受 URL（每行一个，用作备选源或播放列表）、JSON
或少量 YAML——即 laravel-admin 媒体块的语法：

````markdown
```video
src: /media/intro.mp4
poster: /media/intro.jpg
title: Product tour
aspectRatio: 16:9
maxWidth: 640
tracks:
  - src: /media/chapters.vtt
    kind: chapters
```

```audio
- src: /media/1.mp3
  title: Intro
- src: /media/2.mp3
  title: Outro
```
````

视频的键：`src` / `sources`、`poster`、`tracks`、`thumbnails`、`title`、
`aspectRatio`、`autoplay`、`muted`、`loop`、`maxWidth`。音频：`src` / `tracks`、
`title`、`artist`、`waveform`、`peaks`、`loop`、`mini`、`maxWidth`。

块播放器通过 `blockEl.dskPlayer` 提供与元素相同的方法（`play()`、`seek()`、
`playChapter()` 等），其事件也像元素的事件一样从块冒泡。

## 自定义块

```js
DskEmbed.blocks.register('chart', (code, { language, index }) => {
  const values = code.split(',').map(Number)
  return { html: renderChartSvg(values) }   // 你自己构建的标记，用户文本需已转义
})
```

该约定与组件库的 UidMarkdown 以及 WYSIWYG 编辑器的实时块约定相同。渲染器接收块的源，并返回
——直接返回或以 promise 返回——以下之一：

| 结果 | |
|---|---|
| `{ html }` | 用于替换该块的标记。原样插入：请自行构建，并转义其中每一段用户文本。 |
| `{ mount(el, ctx) }` | 实时组件：把它挂载到 `el` 中。返回 `{ update(code), destroy() }` 或一个清理函数。 |
| `{ error }` | 该块无法渲染；它会以代码形式显示，并附带该消息。 |

`mount` 的 `ctx`：

| | |
|---|---|
| `code`、`language` | 源和语言。 |
| `editable` | 在 `<dsk-editor>` 内为 `true`：组件可以修改它的源。 |
| `setCode(code)` | 写回新的源（编辑器会更新其 HTML）。 |

```js
DskEmbed.blocks.register('counter', () => ({
  mount(el, ctx) {
    const button = document.createElement('button')
    let n = Number(ctx.code) || 0
    const draw = () => (button.textContent = `Clicked ${n}`)
    button.onclick = () => { n++; draw(); if (ctx.editable) ctx.setCode(String(n)) }
    draw()
    el.append(button)
    return {
      update(code) { n = Number(code) || 0; draw() },
      destroy() { button.remove() },
    }
  },
}))
```

`register(language, rendererOrResult)` 也接受一个固定结果（`{ html }` 或 `{ mount }`），
并返回一个用于取消注册的函数。注册内置语言会替换内置渲染器。其他调用：
`DskEmbed.blocks.unregister(language)`、`has(language)`、`list()`。

请在内容渲染之前注册——放在紧跟加载器之后的脚本中——这样首次渲染时就已经认识该语言。

## renderBlocks

来自 CMS、数据库或静态站点生成器的 HTML，其代码块已经是 `<pre><code class="language-…">`
形式。一次调用即可让它们变为实时内容：

```js
await DskEmbed.renderBlocks(document.querySelector('article'))  // → 渲染的块数
```

或者在 script 标签上设置，页面解析完成后作用于整个页面：

```html
<script src="…/embed.js" data-render-blocks="article"></script>
```

- 语言从 `<code>` 或 `<pre>` 上的 `language-x` / `lang-x`，或从 `data-lang` 读取。
- 只处理已注册的语言；其他代码保持原样。`renderBlocks(root, { languages: ['mermaid'] })`
  可以进一步限定范围。
- **幂等**：无论调用多少次，一个块只渲染一次——插入更多 HTML 后再调用一次即可。
- 渲染失败的块保持为代码；它的 `<pre>` 会获得 `data-dsk-failed`，原因写入 `title`，且不会
  重试。
- `<dsk-markdown>`、`<dsk-editor>` 和 `contenteditable` 内部的代码交由它们自己处理。
- `DskEmbed.unrenderBlocks(root)` 销毁组件并放回原来的 `<pre>`。

渲染后的块是一个 `<div class="dsk-block dsk-block--<language>" data-dsk-block="<language>">`。
