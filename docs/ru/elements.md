# Элементы

Общее для всех элементов:

- **Light DOM.** Элемент рендерится в `<div data-dsk-root>` внутри себя;
  таблицы стилей кита и CSS страницы применяются. Дочерние элементы с данными
  (`<script type="text/…">`, `<template>`, `<source>`, `<track>`) остаются на
  месте и никогда не показываются; остальное содержимое считывается и
  удаляется.
- **Текстовое содержимое.** Если в исходнике есть разметка (`<`, `&`),
  оберните его в скрипт с данными — браузер не разбирает и не показывает его,
  а отступы убираются автоматически:

  ```html
  <dsk-markdown>
    <script type="text/markdown">
      # Title — `a < b` stays as written
    </script>
  </dsk-markdown>
  ```

  Дочерний `<template>` отдаёт свою разметку (начальный HTML редактора);
  обычное текстовое содержимое подходит для коротких исходников без разметки.
- **Атрибуты и свойства.** У каждого атрибута есть свойство в camelCase
  (`poll-url` → `pollUrl`). Свойство, заданное из скрипта, приоритетнее
  атрибута; если присвоить ему `undefined`, снова действует атрибут. Изменения
  перерисовываются на месте. Булевы атрибуты: наличие — `true`; `"false"`,
  `"0"`, `"off"`, `"no"` — `false`; отсутствие оставляет значение компонента по
  умолчанию. Списки принимают `a, b, c` или JSON-массив; JSON-атрибуты
  принимают JSON.
- **`source`** — текстовый исходник в виде свойства: прочитайте его или
  задайте новый. **`refresh()`** заново считывает дочерние элементы с данными.
- **`ready`** — промис, который разрешается, когда элемент отрисовался.
  Методы, вызванные раньше, ждут его (и возвращают промис).
- **`locale`** — `en` или `ru` только для этого элемента; по умолчанию —
  глобальная локаль ([настройка](config-and-events.md)).
- **`loading="lazy"`** — загружать и рендерить, только когда элемент
  приближается к области просмотра.
- **Состояние** — `data-dsk-state` равен `loading`, `ready` или `error`;
  стилизуйте по нему заглушки. Во время загрузки элемент резервирует блок
  правдоподобного размера.
- **События** — всплывающие `CustomEvent` с именами `dsk:<name>` и данными в
  `detail`; каждый элемент отправляет `dsk:ready`, а также `dsk:error` с
  `{ message }`, если не может отрисоваться. См. [события](config-and-events.md#события).

## Полноэкранный режим

У `<dsk-diagram>`, `<dsk-flow>`, `<dsk-board>` и `<dsk-openapi>` при наведении
(на сенсорных экранах — всегда) появляется кнопка полноэкранного режима.
Элемент разворачивается через Fullscreen API, а где он недоступен (обычные
элементы в Safari на iOS) — заполняет окно поверх страницы. Выход — Esc или
та же кнопка; схема процесса и доска вписывают содержимое в новый размер. У
плееров свой полноэкранный режим.

- `fullscreen="false"` — без кнопки.
- Методы `enterFullscreen()`, `exitFullscreen()`; геттер `fullscreen`.
- Событие `dsk:fullscreen` `{ active }`.

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

Источники берутся из дочерних `<source>` (`data-label` задаёт название
качества в меню), JSON-атрибута `sources` или `src`. Адрес `.m3u8`
воспроизводится через собственный HLS-адаптер кита (`@dskripchenko/ui/hls`),
который скачивается при первом использовании. Дорожки: дочерние `<track>` или
JSON-атрибут `tracks`; `kind` — `subtitles`, `captions` или `chapters`.

| Атрибут | Свойство | |
|---|---|---|
| `src` | `src` | Один источник. |
| `sources` | `sources` | JSON: `[{ "src", "type"?, "label"? }]`. Приоритетнее дочерних `<source>`. |
| `tracks` | `tracks` | JSON: `[{ "src", "kind"?, "srclang"?, "label"?, "default"? }]`. Приоритетнее дочерних `<track>`. |
| `poster` | `poster` | Изображение до начала воспроизведения. |
| `thumbnails` | `thumbnails` | WebVTT со спрайтовыми превью (`sprite.jpg#xywh=…`) над полосой перемотки. |
| `label` | `label` | Доступное имя плеера. (Не `title`: это была бы браузерная подсказка над всем плеером.) |
| `aspect-ratio` | `aspectRatio` | `16:9`, `4/3` или число — размер блока, пока размер видео неизвестен. |
| `autoplay`, `muted`, `loop` | те же | Булевы. Автовоспроизведение начинается без звука (браузеры блокируют звук). |
| `controls` | `controls` | `controls="false"` скрывает элементы управления кита. |
| `preload` | `preload` | `none`, `metadata`, `auto`. |
| `crossorigin` | `crossorigin` | `anonymous` или `use-credentials`. |
| `exclusive` | `exclusive` | Запуск этого плеера ставит на паузу остальные эксклюзивные плееры. |
| `resume-key` | `resumeKey` | Запоминает позицию в localStorage под этим ключом. |
| `rates` | `rates` | Скорости воспроизведения, например `0.5, 1, 1.5, 2`. |
| `hotkeys` | `hotkeys` | Горячие клавиши. |
| `auto-hide` | `autoHide` | Через сколько миллисекунд элементы управления скрываются во время воспроизведения. |
| `hls-options` | `hlsOptions` | JSON-параметры HLS-адаптера. |

Методы: `play()`, `pause()`, `toggle()`, `seek(seconds)`,
`playChapter(indexOrTitle)` (переходит к главе из дорожки глав — по индексу,
точному названию или его части — и запускает воспроизведение),
`loadChapters()` (завершается, когда кит прочитал дорожку глав). Геттеры:
`state` (playing, currentTime, duration, volume, …), `media` (`<video>`),
`chapters` (`[{ index, title, start, end }]` — в том виде, в каком кит прочитал
их из дорожки глав).

События: `dsk:play`, `dsk:pause`, `dsk:ended`, `dsk:timeupdate` — detail
`{ currentTime, duration, src }`; `dsk:chapter` — глава, которую запустил
`playChapter()`; `dsk:chapterchange` — `{ index, title, start, end }`
(или `null`) всякий раз, когда воспроизведение переходит в другую главу;
`dsk:qualitychange` `{ label }`, `dsk:audiotrackchange` `{ label }`,
`dsk:error` — ошибка кита `{ kind, detail? }`.

## `<dsk-audio>`

```html
<dsk-audio waveform show-playlist>
  <source src="/a/1.mp3" data-title="Intro" data-artist="Ann">
  <source src="/a/2.mp3" data-title="Outro" data-artist="Ann" data-duration="185">
</dsk-audio>

<dsk-audio src="/a/note.mp3" track-title="Voice note" variant="mini"></dsk-audio>
```

Один `<source>` (или `src`) — один трек; несколько образуют плейлист с
переходом к следующему/предыдущему, списком треков и автопереходом. Дочерние
элементы принимают `data-title`, `data-artist`, `data-duration` (в секундах,
показывается до загрузки метаданных) и `data-peaks` (заранее рассчитанная
волновая форма, значения 0…1 через запятую).

| Атрибут | Свойство | |
|---|---|---|
| `src`, `type` | те же | Один трек. |
| `tracks` | `tracks` | JSON: `[{ "src", "title"?, "artist"?, "duration"?, "peaks"? }]`. |
| `track-title`, `artist` | `trackTitle`, `artist` | Для одиночного трека. |
| `variant` | `variant` | `default` или `mini` (компактный встроенный в строку плеер). |
| `waveform` | `waveform` | Рисовать волновую форму в качестве полосы перемотки (декодируется в браузере). |
| `peaks` | `peaks` | Заранее рассчитанные пики; включают волновую форму без декодирования. |
| `waveform-max-bytes`, `waveform-max-duration` | camelCase | Ограничения для декодирования. |
| `auto-advance`, `loop` | те же | Поведение плейлиста; `loop` повторяет трек или список. |
| `show-volume`, `show-rate`, `show-playlist` | camelCase | Показываемые элементы управления. |
| `index` | `index` | Текущий трек плейлиста. |
| `preload`, `crossorigin`, `exclusive`, `resume-key`, `rates`, `hotkeys`, `hls-options` | | Как у `<dsk-video>`. |

Методы: `play()`, `pause()`, `toggle()`, `seek(seconds)`, `next()`,
`prev()`. Геттеры: `state`, `media`. События: как у `<dsk-video>`, плюс
`dsk:trackchange` `{ index }`.

## `<dsk-diagram>`

```html
<dsk-diagram label="Checkout">
  sequenceDiagram
    Shop->>Payments: charge
    Payments-->>Shop: ok
</dsk-diagram>

<dsk-diagram src="/docs/architecture.mmd"></dsk-diagram>
```

Исходник Mermaid — flowchart, sequence, state, class, ER, C4, gantt, pie,
timeline, xychart, mindmap — рендерится в SVG через `@dskripchenko/diagrams`.
Для диаграммы Vue не загружается. Цвета следуют теме (embed сопоставляет
пользовательские свойства диаграммы `--dg-*` с токенами кита; любое из них
можно переопределить в своём CSS).

| Атрибут | Свойство | |
|---|---|---|
| `src` | `src` | Скачать исходник по URL вместо содержимого. |
| `label` | `label` | Доступный заголовок SVG. |
| `syntax` | `syntax` | `mermaid`, `plantuml`, `dot`, `d2`, `dbml`, `structurizr` или `wardley`; без него — по тексту источника. |

Геттер: `svg` (элемент `<svg>`). События: `dsk:render` `{ type, width, height }`;
`dsk:error` `{ message, line, column, hint }` — элемент также показывает
сообщение с позицией вместо диаграммы.

Кроме Mermaid элемент читает PlantUML (`@startuml`), Graphviz DOT, D2,
DBML, Structurizr DSL и карты Уордли; синтаксис распознаётся по тексту или
задаётся атрибутом `syntax`.

## `<dsk-openapi>`

Четыре режима.

**Справочник** (по умолчанию) — справочник целиком: навигация, поиск,
операции с try-it, примеры запросов на 13 языках, типы TypeScript, загрузки.

```html
<dsk-openapi src="/openapi.yaml" height="720"></dsk-openapi>

<dsk-openapi specs='[
  {"id": "v2", "name": "API v2", "src": "/openapi/v2.json"},
  {"id": "v1", "name": "API v1", "src": "/openapi/v1.json"}
]'></dsk-openapi>
```

**Операция** — одна операция в виде карточки; задаётся через `operation`
(`operationId`, `METHOD /path` или якорь):

```html
<dsk-openapi src="/openapi.yaml" operation="createOrder" reference-url="/docs/api"></dsk-openapi>
```

**Блок** — `mode="block"`: YAML/JSON API-блока (один запрос, несколько или
целый документ; [формат](https://github.com/dskripchenko/openapi/blob/main/docs/en/blocks.md))
в виде живого виджета; `editable` добавляет вкладки «Исходник» и «Конструктор».

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

**Редактор** — `mode="editor"`: вся спецификация в визуальном редакторе —
дерево документа (info, серверы, теги, безопасность, пути и операции, схемы)
и форма выбранной части, плюс виды «Исходник» и «Просмотр». Правки приходят
событием `dsk:change` `{ source }`, в формате текста.

```html
<dsk-openapi mode="editor" height="640" view="visual">
  <script type="text/yaml">openapi: 3.1.0 …</script>
</dsk-openapi>
```

Спецификация берётся из `src`, `specs`, свойства `spec` (текст или объект)
или содержимого. Спецификации с одним и тем же URL скачиваются один раз на
страницу.

| Атрибут | Свойство | |
|---|---|---|
| `mode` | `mode` | `reference`, `operation`, `block`, `editor`. По умолчанию — `operation`, если задан `operation`, иначе `reference`. |
| `view` | `view` | Режим редактора: вид при открытии — `visual` (по умолчанию), `source`, `preview`. |
| `src` | `src` | URL спецификации (YAML или JSON). |
| `specs` | `specs` | JSON: `[{ "id", "name"?, "src" \| "content" }]` — несколько спецификаций с переключателем. |
| — | `spec` | Спецификация текстом или объектом (только из скрипта). |
| `active` | `active` | Открытая спецификация из `specs`. |
| `operation` | `operation` | Режим операции: какую операцию показать. |
| `reference-url`, `spec-id` | camelCase | Режим операции: ссылка «Открыть в справочнике» и id спецификации там. |
| `try-it` | `tryIt` | `try-it="false"` скрывает try-it (примеры остаются). |
| `proxy` | `proxy` | Эндпоинт, который выполняет запросы try-it за страницу, — [контракт прокси openapi](https://github.com/dskripchenko/openapi/blob/main/docs/en/standalone.md#the-proxy) (запрос — JSON на входе, ответ — JSON на выходе; мета-тег Laravel `csrf-token` передаётся вместе с ним). Для API, которые не разрешают origin страницы. |
| `base-url` | `baseUrl` | База для относительных URL серверов. |
| `snippet-targets`, `default-snippet` | camelCase | Языки примеров запросов (`curl, js, python, …`) и первый из них. |
| `persist-credentials` | `persistCredentials` | `true`/`session`/`local`: сохранять API-ключи между посещениями. |
| `hash-navigation` | `hashNavigation` | `false`: не записывать `location.hash`. |
| `heading` | `heading` | Заголовок в шапке справочника. |
| `editable` | `editable` | Режим блока: вкладки редактирования. |
| `height` | `height` | Фиксированная высота с собственной прокруткой (`720`, `80vh`); либо CSS-переменная `--dsk-openapi-height` (по брейкпоинтам). Липкая навигация справочника тогда заполняет этот блок (`--oa-viewport-h` получает ту же высоту). |
| — | `send` | `(request) => Promise<response>` — отправлять try-it по-своему; приоритетнее `proxy`. |
| — | `labels` | Переопределения строк интерфейса. |

Методы: `go(target, { tryIt? })` — прокрутить к операции (`createOrder`,
`operation/createOrder`), схеме (`schema/Order`) или тегу; `open(id)` —
переключиться на спецификацию из `specs`; `print()`. Геттеры: `loaded`
(загруженная спецификация), `value` (режимы блока и редактора: текущий текст).

События: `dsk:loaded` `{ id, title }`, `dsk:error` `{ id, message }`,
`dsk:active` `{ id }` (спецификация переключена), `dsk:change` `{ source }`
(режимы блока и редактора, после правки).

## `<dsk-flow>`

Модель процесса — JSON ([модель](https://github.com/dskripchenko/flow/blob/main/docs/en/model.md))
или исходник Mermaid `stateDiagram-v2` / `flowchart` — в виде интерактивного
просмотра: панорамирование, масштаб, миникарта, подпроцессы, подробности,
живой мониторинг, переключатели. С `editable` — редактор.

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

**HTTP-соглашения** — их обслуживает бэкенд, скрипт на странице не нужен:

| Атрибут | Запрос | |
|---|---|---|
| `src` | `GET` → модель (JSON) | |
| `poll-url` | `GET` → снимок мониторинга каждые `poll-interval` мс (5000) | Внутри подпроцесса запрос несёт `path` (id узлов от корня через запятую) и `ref` (ссылку на подпроцесс). Ответ не 2xx показывает ошибку и увеличивает интервал. [Формат снимка](https://github.com/dskripchenko/flow/blob/main/docs/en/integration.md#monitoring-snapshot). |
| `toggle-url` | `POST` JSON `{ kind, id, enabled, path }` при переключении узла или ребра | Делает просмотр переключаемым. Ответ не 2xx откатывает переключение и показывает ошибку. |
| `subgraph-url` | `GET` → модель подпроцесса, на который есть ссылка | `{ref}` в URL заменяется ссылкой (`/processes/{ref}`); без него добавляется `?ref=`. |

Запросы — `fetch` в пределах того же origin с cookies страницы
(`credentials: 'same-origin'`).

| Атрибут | Свойство | |
|---|---|---|
| `src` | `src` | URL модели. |
| — | `graph` | Модель объектом (только из скрипта); приоритетнее `src` и содержимого. При чтении отдаёт текущую модель (с правками редактора). |
| `state` | `state` | JSON: первый снимок (например, отрисованный сервером); опрос его заменяет. |
| `poll-url`, `poll-interval` | camelCase | Мониторинг, как выше. |
| `toggle-url` | `toggleUrl` | Переключатели, как выше. |
| — | `persistToggle` | `(change) => Promise` — сохранять переключения самостоятельно (только из скрипта); отклонение промиса откатывает изменение. |
| `subgraph-url` | `subgraphUrl` | Подпроцессы, как выше. |
| — | `loadSubgraph` | `(ref, node) => Promise<model>` — загружать их самостоятельно (только из скрипта). |
| `editable` | `editable` | Редактор (палитра, соединение, undo/redo, свойства, импорт Mermaid). |
| `readonly` | `readonly` | Редактор: только чтение. |
| `palette` | `palette` | Редактор: типы узлов в палитре, `task, decision, …`. |
| `name` | `name` | Редактор: держит внутри элемента скрытый `<input name>` с JSON модели — обычная форма его отправит. |
| `direction` | `direction` | `TB` или `LR`; по умолчанию `meta.direction` модели, иначе выбирается по форме блока (высокий блок раскладывается сверху вниз). |
| `edge-style` | `edgeStyle` | `orthogonal` или `smooth`. |
| `wheel` | `wheel` | `zoom` или `pan`. |
| `minimap`, `controls`, `details`, `status-bar` | camelCase | Части просмотра; `details="false"` отключает панель подробностей, которая открывается по клику. |
| `height` | `height` | По умолчанию 480 (600 для редактора); либо CSS-переменная `--dsk-flow-height`. |
| `openapi-target` | `openapiTarget` | Селектор `<dsk-openapi>`: там открывается `data.operation` узла, по которому кликнули. |
| `media-target` | `mediaTarget` | Селектор `<dsk-video>`/`<dsk-audio>`: там воспроизводится `data.chapter` (название или индекс) или `data.time` (секунды) узла, по которому кликнули. |
| — | `labels`, `registry` | Строки интерфейса; собственные типы узлов (только из скрипта). |

Методы: `fit()`, `select(id)`, `enter(nodeId)`, `back()`, `refresh()`
(опросить сейчас), `undo()`, `redo()` (редактор). Геттеры: `graph`, `stack`
(уровни подпроцессов, в которые вошли).

События: `dsk:node` `{ id, path, node, data }` — клик по узлу;
`dsk:select` `{ kind, id, path, element }` или `null`; `dsk:toggle`
`{ kind, id, enabled, path, ok, rolledBack? }` — после того как переключение
сохранено (`ok: true`) или отклонено (`ok: false`, откачено);
`dsk:toggle-error` `{ change, message }`;
`dsk:navigate` `{ path }`; `dsk:poll-error` `{ message }`; `dsk:load`
`{ nodes, edges }`; редактор: `dsk:change` `{ graph, description, source }`,
`dsk:validate` `{ issues }`.

## `<dsk-board>`

Бесконечная доска ([`@dskripchenko/board`](https://github.com/dskripchenko/board)):
фигуры, стикеры, блоки, заголовки и текст, связи, эмодзи, карандаш и
маркер. По умолчанию — просмотр только для чтения; `editable` включает
редактор; `board-url` делает её совместной доской, которую одновременно
правят несколько человек.

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

**Совместная доска** общается с `board-url` по
[HTTP-соглашению доски](https://github.com/dskripchenko/board/blob/main/docs/en/collaboration.md#the-http-contract):
`GET {base}/snapshot`, `POST {base}/batches`, `GET {base}/batches?after=N&wait=S`
(long polling), `POST {base}/presence`. Эталонная серверная логика — `BoardServer`
из пакета. Запросы несут cookies страницы.

| Атрибут | Свойство | |
|---|---|---|
| `src` | `src` | URL доски (JSON). Подходит и текст элемента (JSON в `<script type="application/json">`). |
| — | `board` | Доска объектом (только из скрипта); приоритетнее `src` и содержимого. |
| `board-url` | `boardUrl` | Базовый URL совместной доски: совместная работа. |
| `poll-interval` | `pollInterval` | Совместная доска: спрашивать изменения каждые N мс (не меньше 250) вместо длинного опроса — для серверов, которые не могут держать запрос открытым. |
| — | `provider` | Любой другой транспорт (только из скрипта): `BoardProvider` — WebSocket, `MemoryHub`. |
| `editable` | `editable` | Редактор (для доски из `src` или содержимого). |
| `readonly` | `readonly` | Совместная доска: только просмотр. |
| `lockable` | `lockable` | Может блокировать и разблокировать доску для всех (по умолчанию `true`); `false` — для тех, кому нельзя. |
| `user-name`, `user-color`, `user-id` | camelCase | Кто правит: виден остальным на совместной доске. |
| `name` | `name` | Держит внутри элемента скрытый `<input name>` с JSON доски — обычная форма его отправит. |
| `minimap` | `minimap` | Миникарта (по умолчанию включена). |
| `height` | `height` | По умолчанию 560; либо CSS-переменная `--dsk-board-height`. |
| — | `labels` | Строки интерфейса (только из скрипта). |

Методы: `fit()`, `select(ids)`, `toPng()` (`Blob`), `toSvg()`
(`{ svg, width, height }`), `undo()`, `redo()`. Геттер: `value` (доска).

События: `dsk:change` `{ board, ops, origin }`; `dsk:select` `{ ids }`;
`dsk:load` `{ objects }`.

## `<dsk-bpmn>` и `<dsk-dmn>`

```html
<dsk-bpmn src="/processes/order.bpmn" highlight="Task_Check"></dsk-bpmn>
<dsk-bpmn src="/processes/order.bpmn" editable properties name="process"></dsk-bpmn>
<dsk-dmn src="/decisions/loan.dmn" decision="Decision_Risk"></dsk-dmn>
```

Процессы BPMN 2.0 и решения DMN через `@dskripchenko/bpmn` — в той раскладке,
в какой их сохранил моделер (Camunda Modeler, bpmn.io и другие). Просмотр
двигается, масштабируется и сообщает о щелчках; `editable` превращает его в
редактор — палитра, контекстная панель, панель свойств, отмена, — а `name`
кладёт правленый XML в скрытое поле для формы. `<dsk-dmn>` открывает таблицу
решения по двойному щелчку или сразу — с `decision`.

| Атрибут | Свойство | |
|---|---|---|
| `src` | `src` | Загрузить файл по адресу вместо содержимого. |
| `editable` | `editable` | Редактор вместо просмотра. |
| `properties` | `properties` | (`dsk-bpmn`, редактор) Панель свойств открыта сразу. |
| `diagram` | `diagram` | (`dsk-bpmn`) Какая диаграмма файла. |
| `decision` | `decision` | (`dsk-dmn`) Открыть логику этого решения. |
| `highlight` | `highlight` | Id элементов для обводки, через запятую. |
| `height` | `height` | Высота; в CSS — `--dsk-bpmn-height` / `--dsk-dmn-height`. |
| `name` | `name` | Скрытое поле с XML для формы. |

Методы: `fit()`, `undo()`, `redo()`, `toSvg()`, `open(decision)` (DMN).
Геттер: `value` (XML). События: `dsk:change` `{ xml }`, `dsk:select`
`{ ids }`, `dsk:element` `{ id }` (щелчок), `dsk:open` `{ decision }` (DMN),
`dsk:error` `{ message }`.

## `<dsk-drawio>`

```html
<dsk-drawio src="/docs/architecture.drawio" page="Overview"></dsk-drawio>
```

Файлы draw.io (diagrams.net) через `@dskripchenko/drawio`: сжатые и обычные
страницы и `.drawio.svg`. У файла с несколькими страницами есть вкладки
страниц. Vue не загружается. Подписи читаются как текст, никогда как
разметка; фигуры библиотек поставщиков становятся подписанными заглушками, а
картинки из сети не загружаются, если их не разрешить `external-images`.

| Атрибут | Свойство | |
|---|---|---|
| `src` | `src` | Загрузить файл по адресу вместо содержимого. |
| `page` | `page` | Страница, показанная первой: номер, id или название. |
| `label` | `label` | Доступный заголовок SVG. |
| `external-images` | `externalImages` | Загружать картинки с адресов http(s). |

Метод: `showPage(page)`. Геттеры: `svg`, `pages` (названия), `page` (номер).
События: `dsk:render` `{ page, pages, width, height, warnings }`, `dsk:error`.

## `<dsk-asyncapi>`

```html
<dsk-asyncapi src="/api/events.yaml"></dsk-asyncapi>
```

Документ AsyncAPI 2.x или 3.0 событийного API как справочник: серверы,
операции (отправка / приём) с каналами, сообщениями, схемами, примерами и
ответами. Свойство `spec` принимает разобранный объект.

| Атрибут | Свойство | |
|---|---|---|
| `src` | `src` | Загрузить документ по адресу вместо содержимого. |
| `height` | `height` | Высота прокручиваемой области; по умолчанию — высота страницы. |

Геттер: `loaded`. События: `dsk:load`, `dsk:error` `{ message }`.

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

Markdown через UidMarkdown кита — таблицы, выноски, подсветка кода — со
**всеми зарегистрированными рендерерами блоков**: ```` ```mermaid ````,
```` ```openapi ````, ```` ```flow ````, ```` ```video ````, ```` ```audio ````
и собственными рендерерами страницы ([блоки](blocks.md)).

| Атрибут | Свойство | |
|---|---|---|
| `src` | `src` | Скачать markdown по URL. |
| `toc`, `toc-depth` | camelCase | Оглавление (заголовки уровней 2…`toc-depth`). |
| `link-base`, `image-base` | camelCase | Базы для относительных ссылок и изображений. |

Геттер: `value` (показываемый markdown). События: `dsk:error`, если `src` не
загрузился.

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

WYSIWYG-редактор (`@dskripchenko/wysiwyg`) — панель инструментов (на локали
элемента), markdown-сокращения, slash-меню, таблицы, режим исходника — со **всеми
зарегистрированными рендерерами блоков в живом режиме**: блок кода на
зарегистрированном языке показывает свой виджет, а виджет, который
редактирует (конструктор API-блока), записывает свой исходник обратно в HTML.
Значение — HTML; блоки кода хранятся как `<pre><code class="language-…">`,
поэтому сохранённый HTML становится живым на любой странице с
[`renderBlocks()`](blocks.md#renderblocks).

Начальное значение: атрибут `value`, иначе дочерний `<template>`, иначе
значение привязанного поля ввода.

| Атрибут | Свойство | |
|---|---|---|
| `value` | `value` | HTML. Чтение свойства отдаёт текущее содержимое; присваивание заменяет содержимое. |
| `name` | `name` | Синхронизирует скрытый `<input name>` внутри элемента — обычная форма его отправит. |
| `input` | `input` | Селектор существующего `<input>`/`<textarea>`, который нужно синхронизировать (и из которого читается начальное значение). |
| `placeholder` | `placeholder` | |
| `readonly` | `readonly` | |
| `toolbar` | `toolbar` | `toolbar="false"` скрывает панель инструментов. |
| `min-height`, `max-height` | camelCase | CSS-длины. |
| `resizable` | `resizable` | Ручка изменения размера. |

Методы: `focus()`. Геттеры: `value`, `controller` (API команд редактора:
`controller.chain().focus().bold().run()`).

События — как у элемента формы:

- `input` (обычный `Event`) после каждого изменения и `dsk:input` `{ value }`;
- `change`, когда редактор теряет фокус с изменённым значением, и `dsk:change` `{ value }`;
- `dsk:editor-ready` `{ controller }`.

Внутренние события `input`/`change` самого редактора не выходят за пределы
элемента, поэтому `el.addEventListener('input', () => el.value)` всегда читает
HTML.
