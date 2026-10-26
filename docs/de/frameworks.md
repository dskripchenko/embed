# Frameworks und Hosts

Die Elemente sind standardkonforme Custom Elements: Jeder Host, der HTML
rendert, kann sie verwenden. Laden Sie den Loader einmal pro Seite, im
`<head>`.

## Reines HTML und Formulare

```html
<form method="post" action="/posts">
  <dsk-editor name="body"></dsk-editor>
  <button>Save</button>
</form>
```

`name` hält ein verstecktes Eingabefeld synchron, daher braucht das Formular
kein Script. Um stattdessen ein vorhandenes Feld zu füllen:
`<dsk-editor input="#body">` mit `<textarea id="body" name="body" hidden>`.

## React

React rendert die Tags so, wie sie sind. Übergeben Sie Strings als Attribute;
übergeben Sie Objekte und Funktionen über eine Ref — und lauschen Sie über die
Ref, da `dsk:*`-Eventnamen keine React-Props sind:

```jsx
import { useEffect, useRef } from 'react'

export function Process({ graph, onNode }) {
  const ref = useRef(null)

  useEffect(() => {
    ref.current.graph = graph            // ein Objekt: eine Property, kein Attribut
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

Mit TypeScript deklarieren Sie die Tags einmalig:

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

Das Unmounten einer React-Komponente entfernt das Element; das Element
unmountet sein Widget mit.

## Vue (eine eigene Host-App)

Teilen Sie dem Compiler mit, dass die Tags Custom Elements sind:

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

`.graph` setzt eine Property (Vue 3.2+). Hat Ihre App ein eigenes Vue, machen
Sie es zu derselben Datei, die das Embed verwendet — siehe
[Import Maps](getting-started.md#import-maps): ein Vue auf der Seite. Eine mit
einem Bundler gebaute App liefert ihr eigenes Vue bereits mit; verwenden Sie
dort die Pakete selbst (`@dskripchenko/ui`, `/openapi/vue`, …) statt des
Embeds.

## WordPress

Binden Sie den Loader im Header ein, nicht im Footer:

```php
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_script('dsk-embed', 'https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js', [], null, false);
});
```

`false` als letztes Argument hält ihn im `<head>`, vor jedem Modul-Script.
Verwenden Sie die Tags in einem Block „Individuelles HTML“, oder machen Sie die
Codeblöcke von Beiträgen lebendig:

```php
add_filter('script_loader_tag', function ($tag, $handle) {
    return $handle === 'dsk-embed' ? str_replace(' src=', ' data-render-blocks=".entry-content" src=', $tag) : $tag;
}, 10, 2);
```

Der Block-Editor speichert Codeblöcke als `<pre class="wp-block-code"><code>`;
geben Sie ihnen die Sprache über die „Zusätzliche(n) CSS-Klasse(n)“ des Blocks
— `language-mermaid` —, und `renderBlocks` greift sie auf.

## Blade

```blade
{{-- layouts/app.blade.php, im <head> --}}
<script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js" data-locale="{{ app()->getLocale() }}"></script>

{{-- eine View --}}
<dsk-openapi src="{{ route('api.spec') }}" height="720"></dsk-openapi>

<dsk-flow src="{{ route('processes.show', $process) }}"
          poll-url="{{ route('processes.state', $process) }}"
          toggle-url="{{ route('processes.toggle', $process) }}"></dsk-flow>

<form method="post" action="{{ route('posts.update', $post) }}">
    @csrf @method('put')
    <dsk-editor name="body" value="{{ $post->body }}"></dsk-editor>
</form>
```

`toggle-url` sendet JSON mit den Cookies der Seite; für die CSRF-Prüfung von
Laravel nehmen Sie entweder die Route von `VerifyCsrfToken` aus, oder Sie
persistieren Schalter selbst über die Property `onToggle` mit dem Header
`X-CSRF-TOKEN`:

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

## Single-Page-Apps

Später hinzugefügte Elemente werden von selbst initialisiert (Upgrade); entfernte
unmounten. Rufen Sie nach dem Einfügen von HTML mit Codeblöcken
`DskEmbed.renderBlocks(container)` erneut auf — es überspringt, was es bereits
gerendert hat.
