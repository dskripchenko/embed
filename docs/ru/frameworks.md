# Фреймворки и хосты

Элементы — стандартные custom elements: их может использовать любой хост,
который рендерит HTML. Подключайте загрузчик один раз на страницу, в `<head>`.

## Обычный HTML и формы

```html
<form method="post" action="/posts">
  <dsk-editor name="body"></dsk-editor>
  <button>Save</button>
</form>
```

`name` синхронизирует скрытое поле ввода, поэтому форме не нужен скрипт. Чтобы
вместо этого заполнять существующее поле: `<dsk-editor input="#body">` с
`<textarea id="body" name="body" hidden>`.

## React

React рендерит теги как есть. Строки передавайте атрибутами; объекты и
функции — через ref, и слушайте тоже через ref, поскольку имена событий
`dsk:*` не являются пропсами React:

```jsx
import { useEffect, useRef } from 'react'

export function Process({ graph, onNode }) {
  const ref = useRef(null)

  useEffect(() => {
    ref.current.graph = graph            // объект: свойство, а не атрибут
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

С TypeScript объявите теги один раз:

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

Размонтирование React-компонента удаляет элемент; элемент вместе с собой
размонтирует и свой виджет.

## Vue (собственное хост-приложение)

Сообщите компилятору, что теги — custom elements:

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

`.graph` задаёт свойство (Vue 3.2+). Если у вашего приложения свой Vue,
сделайте его тем же файлом, что использует embed, — см.
[import maps](getting-started.md#import-maps): на странице должен быть один
Vue. Приложение, собранное бандлером, уже поставляет собственный Vue; там
используйте сами пакеты (`@dskripchenko/ui`, `/openapi/vue`, …), а не embed.

## WordPress

Подключайте загрузчик в шапке, а не в подвале:

```php
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_script('dsk-embed', 'https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js', [], null, false);
});
```

`false` последним аргументом оставляет его в `<head>`, до любого
модульного скрипта. Используйте теги в блоке «Произвольный HTML» или сделайте
живыми блоки кода в записях:

```php
add_filter('script_loader_tag', function ($tag, $handle) {
    return $handle === 'dsk-embed' ? str_replace(' src=', ' data-render-blocks=".entry-content" src=', $tag) : $tag;
}, 10, 2);
```

Блочный редактор хранит блоки кода как `<pre class="wp-block-code"><code>`;
укажите им язык через «Дополнительный CSS-класс» блока — `language-mermaid`, —
и `renderBlocks` их подхватит.

## Blade

```blade
{{-- layouts/app.blade.php, в <head> --}}
<script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js" data-locale="{{ app()->getLocale() }}"></script>

{{-- представление --}}
<dsk-openapi src="{{ route('api.spec') }}" height="720"></dsk-openapi>

<dsk-flow src="{{ route('processes.show', $process) }}"
          poll-url="{{ route('processes.state', $process) }}"
          toggle-url="{{ route('processes.toggle', $process) }}"></dsk-flow>

<form method="post" action="{{ route('posts.update', $post) }}">
    @csrf @method('put')
    <dsk-editor name="body" value="{{ $post->body }}"></dsk-editor>
</form>
```

`toggle-url` отправляет JSON с cookies страницы; для CSRF-проверки Laravel
либо исключите маршрут из `VerifyCsrfToken`, либо сохраняйте переключения
сами через свойство `onToggle` с заголовком `X-CSRF-TOKEN`:

```html
<script>
  document.querySelector('dsk-flow').onToggle = (change) =>
    fetch('/processes/1/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': '{{ csrf_token() }}' },
      body: JSON.stringify(change),
    }).then((r) => { if (!r.ok) throw new Error(r.statusText) })
</script>
```

## Одностраничные приложения

Элементы, добавленные позже, инициализируются сами; удалённые размонтируются.
После вставки HTML с блоками кода снова вызовите
`DskEmbed.renderBlocks(container)` — уже отрисованное он пропустит.
