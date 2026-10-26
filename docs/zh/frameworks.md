# 框架与宿主环境

这些元素是标准的 custom element（自定义元素）：任何能渲染 HTML 的宿主都可以使用它们。每个
页面只需在 `<head>` 中加载一次加载器。

## 纯 HTML 与表单

```html
<form method="post" action="/posts">
  <dsk-editor name="body"></dsk-editor>
  <button>Save</button>
</form>
```

`name` 会同步维护一个隐藏输入框，因此表单不需要任何脚本。若要改为填充已有的字段：
`<dsk-editor input="#body">` 搭配 `<textarea id="body" name="body" hidden>`。

## React

React 会原样渲染这些标签。字符串以特性（attribute）传入；对象和函数通过 ref 传入——事件也要
通过 ref 监听，因为 `dsk:*` 事件名不是 React 的 props：

```jsx
import { useEffect, useRef } from 'react'

export function Process({ graph, onNode }) {
  const ref = useRef(null)

  useEffect(() => {
    ref.current.graph = graph            // 对象：用属性（property），而不是特性（attribute）
  }, [graph])

  useEffect(() => {
    const el = ref.current
    const handler = (e) => onNode(e.detail)
    el.addEventListener('dsk:node', handler)
    return () => el.removeEventListener('dsk:node', handler)
  }, [onNode])

  return <dsk-flow ref={ref} height="420" details="false" />
}

export function Editor({ value, onChange }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (el.value !== value) el.value = value
    const handler = () => onChange(el.value)
    el.addEventListener('input', handler)
    return () => el.removeEventListener('input', handler)
  }, [value, onChange])
  return <dsk-editor ref={ref} />
}
```

使用 TypeScript 时，声明一次这些标签：

```ts
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'dsk-flow': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, unknown>
      'dsk-editor': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, unknown>
    }
  }
}
```

卸载 React 组件会移除该元素；元素会随之卸载其内部组件。

## Vue（你自己的宿主应用）

告诉编译器这些标签是 custom element：

```ts
// vite.config.ts
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('dsk-') } } })
```

```vue
<template>
  <dsk-openapi :src="specUrl" operation="createOrder" @dsk:loaded="onLoaded" />
  <dsk-flow .graph="graph" @dsk:node="(e) => select(e.detail)" />
</template>
```

`.graph` 设置的是属性（Vue 3.2+）。如果你的应用有自己的 Vue，让它与 embed 使用同一个文件——
见 [import map](getting-started.md#import-map)：页面上只能有一份 Vue。用打包工具构建的应用
已经自带 Vue；这种情况下请直接使用各个包本身（`@dskripchenko/ui`、`/openapi/vue` 等），
而不是 embed。

## WordPress

在页头而不是页脚中加入加载器：

```php
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_script('dsk-embed', 'https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js', [], null, false);
});
```

最后一个参数 `false` 让它保留在 `<head>` 中，位于所有模块脚本之前。在“自定义 HTML”块中使用
这些标签，或者让文章中的代码块变为实时内容：

```php
add_filter('script_loader_tag', function ($tag, $handle) {
    return $handle === 'dsk-embed' ? str_replace(' src=', ' data-render-blocks=".entry-content" src=', $tag) : $tag;
}, 10, 2);
```

区块编辑器把代码块存储为 `<pre class="wp-block-code"><code>`；通过区块的“附加 CSS 类”为它们
指定语言——`language-mermaid`——`renderBlocks` 就会识别它们。

## Blade

```blade
{{-- layouts/app.blade.php，位于 <head> 中 --}}
<script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js" data-locale="{{ app()->getLocale() }}"></script>

{{-- 某个视图 --}}
<dsk-openapi src="{{ route('api.spec') }}" height="720"></dsk-openapi>

<dsk-flow src="{{ route('processes.show', $process) }}"
          poll-url="{{ route('processes.state', $process) }}"
          toggle-url="{{ route('processes.toggle', $process) }}"></dsk-flow>

<form method="post" action="{{ route('posts.update', $post) }}">
    @csrf @method('put')
    <dsk-editor name="body" value="{{ $post->body }}"></dsk-editor>
</form>
```

`toggle-url` 会携带页面的 cookie 发送 JSON；为通过 Laravel 的 CSRF 校验，要么把该路由从
`VerifyCsrfToken` 中排除，要么通过 `persistToggle` 属性自己持久化开关状态，并带上
`X-CSRF-TOKEN` 请求头：

```html
<script>
  document.querySelector('dsk-flow').persistToggle = (change) =>
    fetch('/processes/1/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': '{{ csrf_token() }}' },
      body: JSON.stringify(change),
    }).then((r) => { if (!r.ok) throw new Error(r.statusText) })
</script>
```

## 单页应用

之后添加的元素会自动升级；被移除的元素会自动卸载。插入含有代码块的 HTML 后，再次调用
`DskEmbed.renderBlocks(container)`——它会跳过已经渲染过的部分。
