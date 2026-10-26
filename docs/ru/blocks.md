# Блоки

**Блок** — это огороженный блок кода на зарегистрированном языке
(```` ```mermaid ```` в markdown, `<pre><code class="language-mermaid">` в
HTML), который показывается как то, что он описывает, а не как код. Один
реестр на всю страницу обслуживает все места, где появляются блоки:

- `<dsk-markdown>`,
- `<dsk-editor>` (в живом режиме и с редактированием, если виджет умеет редактировать),
- `DskEmbed.renderBlocks()` поверх HTML, который уже есть на странице,
- markdown внутри самих компонентов (например, описания OpenAPI).

## Встроенные блоки

| Язык | Превращается в | Загружает |
|---|---|---|
| `mermaid` | SVG-диаграмму | diagrams |
| `openapi` | живой API-виджет: один запрос, несколько или целый документ | openapi |
| `flow` | просмотр процесса из JSON или исходника Mermaid state/flowchart | flow |
| `video` | видеоплеер кита | кит |
| `audio` | аудиоплеер или плейлист кита | кит |

Каждый загружает свой плагин на первом блоке своего вида.

```` ```video ```` и ```` ```audio ```` принимают URL (по одному на строку для
альтернатив или плейлиста), JSON или немного YAML — синтаксис медиаблоков
laravel-admin:

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

Ключи видео: `src` / `sources`, `poster`, `tracks`, `thumbnails`, `title`,
`aspectRatio`, `autoplay`, `muted`, `loop`, `maxWidth`. Аудио: `src` /
`tracks`, `title`, `artist`, `waveform`, `peaks`, `loop`, `mini`, `maxWidth`.

Плеер-блок отвечает на методы элемента через `blockEl.dskPlayer`
(`play()`, `seek()`, `playChapter()`, …), а его события всплывают от блока
так же, как у элемента.

## Собственные блоки

```js
DskEmbed.blocks.register('chart', (code, { language, index }) => {
  const values = code.split(',').map(Number)
  return { html: renderChartSvg(values) }   // разметка, которую вы собрали сами, с экранированным пользовательским текстом
})
```

Контракт — это контракт живых блоков UidMarkdown кита и WYSIWYG-редактора.
Рендерер получает исходник блока и возвращает — напрямую или промисом — одно
из:

| Результат | |
|---|---|
| `{ html }` | Разметка, которая вставляется вместо блока. Вставляется как есть: собирайте её сами и экранируйте каждый фрагмент пользовательского текста. |
| `{ mount(el, ctx) }` | Живой виджет: смонтируйте его в `el`. Верните `{ update(code), destroy() }` или функцию очистки. |
| `{ error }` | Блок не может быть отрисован; он показывается как код с сообщением. |

`ctx` у `mount`:

| | |
|---|---|
| `code`, `language` | Исходник и язык. |
| `editable` | `true` внутри `<dsk-editor>`: виджет может менять свой исходник. |
| `setCode(code)` | Записывает новый исходник обратно (редактор обновляет свой HTML). |

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

`register(language, rendererOrResult)` принимает и фиксированный результат
(`{ html }` или `{ mount }`) и возвращает функцию, которая отменяет
регистрацию. Регистрация встроенного языка заменяет встроенный рендерер.
Остальные вызовы: `DskEmbed.blocks.unregister(language)`, `has(language)`,
`list()`.

Регистрируйте до того, как отрисуется содержимое, — в скрипте сразу после
загрузчика, — чтобы уже первый рендер знал о языке.

## renderBlocks

В HTML из CMS, базы данных или генератора статических сайтов блоки кода уже
лежат как `<pre><code class="language-…">`. Один вызов делает их живыми:

```js
await DskEmbed.renderBlocks(document.querySelector('article'))  // → количество отрисованных
```

Или в теге скрипта — для всей страницы, когда она разобрана:

```html
<script src="…/embed.js" data-render-blocks="article"></script>
```

- Язык читается из `language-x` / `lang-x` на `<code>` или `<pre>` либо из
  `data-lang`.
- Затрагиваются только зарегистрированные языки; остальной код остаётся как
  есть. `renderBlocks(root, { languages: ['mermaid'] })` сужает выбор ещё
  сильнее.
- **Идемпотентность**: блок отрисовывается один раз, сколько бы раз вы ни
  вызывали функцию, — вызывайте её снова после вставки нового HTML.
- Блок, который не удалось отрисовать, остаётся кодом; его `<pre>` получает
  `data-dsk-failed` и причину в `title`, повторных попыток не будет.
- Код внутри `<dsk-markdown>`, `<dsk-editor>` и `contenteditable` остаётся на
  их попечении.
- `DskEmbed.unrenderBlocks(root)` уничтожает виджеты и возвращает исходный
  `<pre>`.

Отрисованный блок — это `<div class="dsk-block dsk-block--<language>" data-dsk-block="<language>">`.
