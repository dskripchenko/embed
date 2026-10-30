# Начало работы

`@dskripchenko/embed` вставляет компоненты автора на любую веб-страницу в виде
HTML-тегов — обычный HTML, шаблон CMS, WordPress, Blade, React, Vue — с
загрузкой из CDN. Элементы используют один Vue, одну копию UI-кита и один
набор рендереров блоков и общаются друг с другом через DOM-события.

| Элемент | Что это | На чём построен |
|---|---|---|
| `<dsk-video>` | видеоплеер: источники, меню качества, субтитры, главы, превью, HLS | `@dskripchenko/ui` UidVideo |
| `<dsk-audio>` | аудиоплеер, плейлист, волновая форма | `@dskripchenko/ui` UidAudio |
| `<dsk-diagram>` | диаграмма Mermaid (11 типов) → SVG | `@dskripchenko/diagrams` |
| `<dsk-openapi>` | справочник OpenAPI, одна операция или API-блок | `@dskripchenko/openapi` |
| `<dsk-flow>` | просмотр процесса с мониторингом или редактор процесса | `@dskripchenko/flow` |
| `<dsk-markdown>` | markdown с живыми блоками | `@dskripchenko/ui` UidMarkdown |
| `<dsk-editor>` | WYSIWYG-редактор с живыми блоками, готовый для форм | `@dskripchenko/wysiwyg` |

## Загрузчик (рекомендуется)

```html
<head>
  <script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js"></script>
</head>
<body>
  <dsk-diagram>
    flowchart LR
      A[Write] --> B[Publish]
  </dsk-diagram>
</body>
```

`embed.js` весит около 9 КБ в gzip. Это **классический** скрипт, и так
задумано: он выполняется там, где стоит, записывает [import map](#import-maps)
для общего рантайма, определяет элементы и `window.DskEmbed` — и больше ничего.
Vue, кит и пакеты плагинов скачиваются из CDN в тот момент, когда появляется
первый элемент, которому они нужны; страница с одной диаграммой загружает пакет
диаграмм и ничего сверх него.

Подключайте его в `<head>`, до любого `<script type="module">` страницы.

`@1` следует за последним релизом 1.x. Загрузчик фиксирует всё, что скачивает, —
собственные плагины и пакеты рантайма — на точных версиях, с которыми этот
релиз собран и протестирован, поэтому диапазон в теге скрипта никогда не
смешивает версии. Для страницы, которая не должна меняться никогда, зафиксируйте
и версию в теге (`@1.0.0`).

### Параметры тега скрипта

```html
<script src="…/embed.js"
        data-theme="system"
        data-locale="ru"
        data-render-blocks="article"></script>
```

| Атрибут | |
|---|---|
| `data-theme` | `light`, `dark` или `system`; см. [настройку](config-and-events.md#тема). |
| `data-locale` | `en` или `ru`. По умолчанию — `<html lang>` страницы. |
| `data-cdn-base` | Откуда берётся рантайм (по умолчанию — CDN, с которого пришёл загрузчик, иначе jsDelivr). |
| `data-render-blocks` | Рендерит блоки кода под этим селектором, когда страница разобрана (пустое значение — `body`). См. [блоки](blocks.md). |

Те же параметры, а также `versions` для переопределения отдельных версий, можно
задать до загрузчика как `window.DskEmbedConfig = { theme, locale, cdnBase, versions }`.

## Толстый бандл

```html
<script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.bundle.js"></script>
```

Один файл, внутри которого Vue, кит, все пакеты плагинов и все стили: ни import
map, ни дополнительных запросов. Те же элементы и тот же API `DskEmbed`. Это
весь рантайм сразу — около 2 МБ, **563 КБ в gzip**, — тогда как загрузчик
скачивает только то, что использует страница. Применяйте его там, где import
maps недоступны или где во время выполнения ничего загружать нельзя.

На странице используйте что-то одно, не оба сразу (тот, что загрузится вторым,
игнорируется с предупреждением).

## Бандлы по плагинам

```html
<script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/bundles/diagram.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/bundles/markdown.js"></script>
```

Толстый бандл, разрезанный по плагинам: в каждом файле один плагин вместе с
Vue и китом, и определяет он только элементы и языки блоков этого плагина.
Несколько бандлов на странице делят один `DskEmbed`: первый его создаёт,
каждый следующий добавляет свои плагины (`DskEmbed.extend`) — в любом
порядке и в любой момент. Блок ```mermaid в `<dsk-markdown>` остаётся кодом,
пока на странице нет `bundles/diagram.js`, а с ним — рисуется;
`DskEmbed.plugins()` перечисляет, что есть. Повторно загруженный бандл ничего
не добавляет.

| Файл | gzip |
|---|---|
| `bundles/markdown.js` | 91 КБ |
| `bundles/media.js` | 116 КБ |
| `bundles/diagram.js` | 118 КБ |
| `bundles/board.js` | 120 КБ |
| `bundles/editor.js` | 205 КБ |
| `bundles/openapi.js` | 222 КБ |
| `bundles/flow.js` | 227 КБ |

У каждого бандла свои Vue и кит, поэтому два бандла весят больше, чем те же
два плагина через загрузчик; они для хостов, которые поставляют виджеты
по отдельности. Бандлы одной мажорной версии работают вместе.

## Самостоятельный хостинг

Всё, что скачивает загрузчик, можно раздавать со своего сервера в раскладке
CDN. Из рабочей копии пакета:

```bash
pnpm install && pnpm build
node scripts/mirror.mjs public/static     # → public/static/npm/<pkg>@<version>/…
```

```html
<script src="/static/npm/@dskripchenko/embed@1.0.0/dist/embed.js"></script>
```

Корень CDN загрузчик берёт из собственного адреса (часть до
`@dskripchenko/embed@`), поэтому зеркальная копия не требует настройки. Для
любой другой раскладки задайте `data-cdn-base` и сохраните пути
`<pkg>@<version>/`.

## Import maps

Браузеры разрешают «голые» импорты (`import 'vue'`) через import maps, и map
учитывается, только если он оказался в документе до загрузки первого модуля,
которому он нужен. Поэтому загрузчик — классический скрипт в `<head>`.

Map, который он записывает (опубликован также как `dist/importmap.json`):

| Спецификатор | Указывает на |
|---|---|
| `vue` | `vue@3.5.44/dist/vue.runtime.esm-browser.prod.js` |
| `@dskripchenko/ui`, `/hls` | `@dskripchenko/ui@1.16.0/dist/…` |
| `@dskripchenko/wysiwyg` | `@dskripchenko/wysiwyg@0.5.3/dist/index.mjs` |
| `@dskripchenko/diagrams` | `@dskripchenko/diagrams@1.1.0/dist/index.mjs` |
| `@dskripchenko/openapi`, `/vue` | `@dskripchenko/openapi@1.1.3/dist/…` |
| `@dskripchenko/flow`, `/vue`, `/mermaid` | `@dskripchenko/flow@1.1.1/dist/…` |

Библиотеки иконок в карте нет: кит, openapi, flow и редактор встраивают
свои иконки в собственные сборки.

**Страница со своим import map.** Записи, которые страница описала сама,
остаются за ней; embed добавляет второй map с остальными, а браузеры с
поддержкой нескольких import maps их объединяют (Chromium начиная со 133;
проверка в браузере проходит в текущих Chromium и WebKit — прежде чем на это
полагаться, проверьте другие движки). Если страница направляет `vue` или кит
на другой файл, загрузчик предупреждает: две копии Vue ломают элементы.
Направьте их ровно на файлы выше — тогда собственный Vue-код страницы и
элементы используют один Vue:

```html
<script type="importmap">
  { "imports": { "vue": "https://cdn.jsdelivr.net/npm/vue@3.5.44/dist/vue.runtime.esm-browser.prod.js" } }
</script>
<script src="https://cdn.jsdelivr.net/npm/@dskripchenko/embed@1/dist/embed.js"></script>
```

Для браузеров без поддержки нескольких import maps скопируйте записи
`dist/importmap.json` в свой единственный map и всё равно загружайте `embed.js`
после него.

**Как модуль.** `<script type="module" src="…/embed.js">` тоже работает в
браузерах с поддержкой нескольких import maps; загрузчик при этом один раз
предупреждает, поскольку в старых браузерах map пришёл бы слишком поздно.

## Браузеры

Текущие Chromium, Safari и Firefox. Загрузчику нужны import maps (Chrome 89+,
Safari 16.4+, Firefox 108+); толстый бандл работает везде, где работает
ES2022. Legacy-сборки нет.

## Content Security Policy

Загрузчику нужны:

- `script-src` — origin CDN (`https://cdn.jsdelivr.net`) и import map:
  встроенный `<script type="importmap">` считается inline-скриптом. При строгой
  политике запишите map сами — записи `dist/importmap.json` в
  `<script type="importmap" nonce="…">` до `embed.js`; тогда загрузчик найдёт
  все записи на месте и ничего не будет записывать. (При `'strict-dynamic'`
  map, который вставляет загрузчик, создан скриптом и обычно разрешён, но явный
  map — переносимый способ.)
- `style-src` — origin CDN (таблицы стилей кита приходят как `<link>`) и
  `'unsafe-inline'` или nonce для собственного небольшого `<style>` embed и для
  inline-атрибутов `style` компонентов.
- `connect-src` — всё, что запрашивают ваши элементы: `src`, `poll-url`,
  `toggle-url`, спецификации и API, которые вызывает try-it.
- `media-src` / `img-src` — ваши медиа; `blob:` для HLS (MediaSource).
- `worker-src` не нужен.

Толстому бандлу нужен `script-src` для его собственного URL и те же правила
`style-src`, `connect-src` и для медиа. `eval` не используется нигде.

## Версионирование

Семантическое версионирование с одним дополнительным правилом: релиз фиксирует
свой рантайм. Версии Vue, кита и пакетов плагинов — часть релиза
(`DskEmbed.versions` их перечисляет), и новая фиксация — это новый релиз embed
(патч для патчей пакетов, минорный для их новых возможностей). Атрибуты,
свойства и события элементов и API `DskEmbed` следуют semver.

## Дальше

- [Элементы](elements.md) — все атрибуты, свойства, методы и события
- [Блоки](blocks.md) — реестр рендереров блоков и `renderBlocks()`
- [Настройка и события](config-and-events.md) — тема, локаль, шина событий, взаимодействие
- [Фреймворки](frameworks.md) — React, Vue, WordPress, Blade, обычные формы
