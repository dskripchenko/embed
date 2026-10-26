# Frameworks and hosts

The elements are standard custom elements: any host that renders HTML can
use them. Load the loader once per page, in `<head>`.

## Plain HTML and forms

```html
<form method="post" action="/posts">
  <dsk-editor name="body"></dsk-editor>
  <button>Save</button>
</form>
```

`name` keeps a hidden input in sync, so the form needs no script. To fill an
existing field instead: `<dsk-editor input="#body">` with
`<textarea id="body" name="body" hidden>`.

## React

React renders the tags as they are. Pass strings as attributes; pass objects
and functions through a ref — and listen through the ref, since `dsk:*` event
names are not React props:

```jsx
import { useEffect, useRef } from 'react'

export function Process({ graph, onNode }) {
  const ref = useRef(null)

  useEffect(() => {
    ref.current.graph = graph            // an object: a property, not an attribute
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

With TypeScript, declare the tags once:

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

Unmounting a React component removes the element; the element unmounts its
widget with it.

## Vue (a host app of your own)

Tell the compiler the tags are custom elements:

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

`.graph` sets a property (Vue 3.2+). If your app has its own Vue, make it the
same file the embed uses — see [import maps](getting-started.md#import-maps):
one Vue on the page. An app built with a bundler already ships its own Vue;
there, use the packages themselves (`@dskripchenko/ui`, `/openapi/vue`, …)
rather than the embed.

## WordPress

Enqueue the loader in the header, not the footer:

```php
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_script('dsk-embed', 'https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js', [], null, false);
});
```

`false` as the last argument keeps it in `<head>`, before any module script.
Use the tags in a Custom HTML block, or make the code blocks of posts live:

```php
add_filter('script_loader_tag', function ($tag, $handle) {
    return $handle === 'dsk-embed' ? str_replace(' src=', ' data-render-blocks=".entry-content" src=', $tag) : $tag;
}, 10, 2);
```

The block editor stores code blocks as `<pre class="wp-block-code"><code>`;
give them the language with the block's "Additional CSS class" —
`language-mermaid` — and `renderBlocks` picks them up.

## Blade

```blade
{{-- layouts/app.blade.php, in <head> --}}
<script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js" data-locale="{{ app()->getLocale() }}"></script>

{{-- a view --}}
<dsk-openapi src="{{ route('api.spec') }}" height="720"></dsk-openapi>

<dsk-flow src="{{ route('processes.show', $process) }}"
          poll-url="{{ route('processes.state', $process) }}"
          toggle-url="{{ route('processes.toggle', $process) }}"></dsk-flow>

<form method="post" action="{{ route('posts.update', $post) }}">
    @csrf @method('put')
    <dsk-editor name="body" value="{{ $post->body }}"></dsk-editor>
</form>
```

`toggle-url` posts JSON with the page's cookies; for Laravel's CSRF check,
either exclude the route from `VerifyCsrfToken`, or persist toggles yourself
through the `persistToggle` property with the `X-CSRF-TOKEN` header:

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

## Single-page apps

Elements added later upgrade by themselves; removed ones unmount. After
inserting HTML with code blocks, call `DskEmbed.renderBlocks(container)`
again — it skips what it already rendered.
