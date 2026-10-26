# Настройка и события

## Настройка

```js
DskEmbed.configure({ theme: 'dark', locale: 'ru' })
DskEmbed.config  // { theme, resolvedTheme, locale, cdnBase, versions }
```

### Тема

| `theme` | |
|---|---|
| `null` (по умолчанию) | Следовать за страницей: её `<html data-theme>` или светлые цвета кита, если страница тему не задаёт. |
| `'light'`, `'dark'` | Записывается в `<html data-theme>`. |
| `'system'` | `prefers-color-scheme`, отслеживается на лету, записывается в `<html data-theme>`. |

Темы кита завязаны на `<html data-theme>`, поэтому **тема действует на всю
страницу**: меню и диалоги, которые открывают компоненты, прикрепляются к
`<body>`, и тема отдельного элемента до них бы не дошла. Если страница сама
переключает свой `data-theme`, элементы следуют за ней — вызов не нужен:

```js
document.documentElement.dataset.theme = 'dark'   // все элементы следуют за ней
```

Без темы и без атрибута светлые токены кита определяются на
`:root:not([data-theme])` — только пользовательские свойства (`--uid-*`),
ничего из того, что использует сама страница.

Цвета — пользовательские CSS-свойства. Переопределяйте токены кита на `:root`
(или `:root[data-theme='dark']`), например `--uid-accent`; диаграммы читают
`--dg-*` (по умолчанию сопоставлены с токенами кита).

### Локаль

`'en'` или `'ru'`. По умолчанию — `<html lang>` страницы (`ru…` → `ru`, всё
остальное → `en`), с отслеживанием, когда страница его меняет.
`configure({ locale })` фиксирует локаль; `configure({ locale: null })`
возвращает локаль страницы. Собственный атрибут `locale` элемента
приоритетнее для этого элемента.

Локаль доходит до компонентов кита (элементы управления плеера, диалоги,
пустые состояния), виджетов OpenAPI и просмотров процессов.

### Расположение рантайма

`cdnBase` и `versions` определяют, откуда загрузчик скачивает рантайм. Они
читаются один раз, до записи import map: задавайте их в теге скрипта
(`data-cdn-base`) или в `window.DskEmbedConfig` до загрузчика, а не позже
через `configure()`. См. [самостоятельный хостинг](getting-started.md#самостоятельный-хостинг).

## События

Каждое событие — всплывающее DOM-событие `CustomEvent` с именем `dsk:<name>`
и данными в `detail`. События элемента начинаются на элементе; `DskEmbed.emit`
без цели отправляет событие на `document`. Слушать можно обоими способами:

```js
// Шина: слушает на document, слышит все элементы.
const off = DskEmbed.on('node', (detail, event) => {
  console.log(detail.id, 'in', event.target.id)
})
off()

DskEmbed.once('ready', (detail, event) => { /* первый элемент отрисовался */ })

// Обычный DOM, на любом предке или на самом элементе.
document.querySelector('#process').addEventListener('dsk:node', (e) => console.log(e.detail))
```

`DskEmbed.emit(name, detail?, target?)` отправляет ваши собственные события
`dsk:<name>` по той же шине — страница может согласовывать свои виджеты с
элементами тем же способом.

| Событие | Откуда | `detail` |
|---|---|---|
| `dsk:ready` | все элементы | `{ tag }` |
| `dsk:error` | все элементы | `{ message, … }` |
| `dsk:config` | `document` | `{ theme, resolvedTheme, locale }` при каждом изменении |
| `dsk:play`, `dsk:pause`, `dsk:ended`, `dsk:timeupdate` | video, audio, медиаблоки | `{ currentTime, duration, src }` |
| `dsk:chapter` | video | `{ index, title, start, end }` |
| `dsk:trackchange` | audio | `{ index }` |
| `dsk:qualitychange`, `dsk:audiotrackchange` | video | `{ label }` |
| `dsk:render` | diagram | `{ type, width, height }` |
| `dsk:loaded`, `dsk:active` | openapi | `{ id, title }`, `{ id }` |
| `dsk:change` | openapi (блок), flow (редактор), editor | `{ source }`, `{ graph, description, source }`, `{ value }` |
| `dsk:node` | flow, блоки flow | `{ id, path, node, data }` |
| `dsk:select`, `dsk:navigate` | flow | `{ kind, id, path, element }`, `{ path }` |
| `dsk:toggle`, `dsk:toggle-error` | flow | изменение; `{ change, message }` |
| `dsk:poll-error`, `dsk:load`, `dsk:validate` | flow | `{ message }`, `{ nodes, edges }`, `{ issues }` |
| `dsk:input`, `dsk:editor-ready` | editor | `{ value }`, `{ controller }` |
| `dsk:embed-ready` | `document` | `{ version, mode }` — API определён |

## Взаимодействие

Элементы ничего не знают друг о друге; страница связывает их событиями и
методами. Два рецепта.

### Шаг процесса открывает свою операцию API

Узел процесса хранит свою операцию в `data` (она также показывается в
подробностях узла):

```json
{ "id": "pay", "type": "task", "label": "Pay", "data": { "operation": "payOrder" } }
```

Декларативно — `openapi-target` прокручивает справочник к операции:

```html
<dsk-flow src="/process.json" openapi-target="#api"></dsk-flow>
<dsk-openapi id="api" src="/openapi.yaml"></dsk-openapi>
```

Или через шину — здесь переключается карточка операции рядом с процессом:

```html
<dsk-flow src="/process.json" details="false"></dsk-flow>
<dsk-openapi id="card" src="/openapi.yaml" operation="createOrder"></dsk-openapi>
<script>
  DskEmbed.on('node', ({ data }) => {
    if (data.operation) document.querySelector('#card').operation = data.operation
  })
</script>
```

### Шаг процесса воспроизводит свою часть видео

```json
{ "id": "pay", "type": "task", "label": "Pay", "data": { "chapter": "Payment" } }
```

```html
<dsk-flow src="/process.json" media-target="#tour"></dsk-flow>
<dsk-video id="tour" src="/tour.mp4">
  <track kind="chapters" src="/tour.chapters.vtt" default>
</dsk-video>
```

`data.chapter` — название главы (или его часть) либо её индекс;
`data.time` — позиция в секундах. Вручную:

```js
DskEmbed.on('node', ({ data }) => {
  const video = document.querySelector('#tour')
  if (data.chapter !== undefined) video.playChapter(data.chapter)
  else if (data.time !== undefined) video.seek(data.time).then(() => video.play())
})
```

В обратную сторону — процесс следует за видео:

```js
document.querySelector('#tour').addEventListener('dsk:chapter', (e) => {
  document.querySelector('dsk-flow').select(STEP_OF_CHAPTER[e.detail.title])
})
```
