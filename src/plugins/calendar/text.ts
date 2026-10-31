export interface CalendarText {
  calendar: string
  source: string
  lock: string
  unlock: string
  addEvent: string
  newEvent: string
  event: string
  title: string
  allDay: string
  date: string
  endDate: string
  start: string
  end: string
  repeat: string
  freq: { none: string; daily: string; weekly: string; monthly: string; yearly: string }
  every: string
  units: { daily: string; weekly: string; monthly: string; yearly: string }
  onDays: string
  monthMode: { day: string; nth: string; last: string }
  dayOfMonth: string
  ordinals: Record<'1' | '2' | '3' | '4' | '-1', string>
  ends: string
  endsMode: { never: string; until: string; count: string }
  times: string
  skipped: string
  scope: string
  scopeOne: string
  scopeAll: string
  tags: string
  where: string
  extra: string
  line: string
  save: string
  cancel: string
  delete: string
  skip: string
  weekdays: string[]
  repeats: string
}

const ru: CalendarText = {
  calendar: 'Календарь',
  source: 'Исходник',
  lock: 'Запретить изменения',
  unlock: 'Разрешить изменения',
  addEvent: 'Событие',
  newEvent: 'Новое событие',
  event: 'Событие',
  title: 'Название',
  allDay: 'Весь день',
  date: 'Дата',
  endDate: 'По дату',
  start: 'Начало',
  end: 'Конец',
  repeat: 'Повтор',
  freq: { none: 'Не повторять', daily: 'Каждый день', weekly: 'Каждую неделю', monthly: 'Каждый месяц', yearly: 'Каждый год' },
  every: 'Раз в',
  units: { daily: 'дн.', weekly: 'нед.', monthly: 'мес.', yearly: 'г.' },
  onDays: 'По дням',
  monthMode: { day: 'Число месяца', nth: 'День недели', last: 'Последний день' },
  dayOfMonth: 'Число',
  ordinals: { 1: 'Первый', 2: 'Второй', 3: 'Третий', 4: 'Четвёртый', [-1]: 'Последний' },
  ends: 'Окончание',
  endsMode: { never: 'Без конца', until: 'До даты', count: 'Число повторов' },
  times: 'Раз',
  skipped: 'Пропущенные даты',
  scope: 'Изменить',
  scopeOne: 'Только это событие',
  scopeAll: 'Всю серию',
  tags: 'Теги',
  where: 'Место',
  extra: 'Другие свойства',
  line: 'Строка',
  save: 'Сохранить',
  cancel: 'Отмена',
  delete: 'Удалить',
  skip: 'Пропустить эту дату',
  weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  repeats: 'Повторяется',
}

const en: CalendarText = {
  calendar: 'Calendar',
  source: 'Source',
  lock: 'Lock changes',
  unlock: 'Allow changes',
  addEvent: 'Event',
  newEvent: 'New event',
  event: 'Event',
  title: 'Title',
  allDay: 'All day',
  date: 'Date',
  endDate: 'Until date',
  start: 'Start',
  end: 'End',
  repeat: 'Repeat',
  freq: { none: 'Does not repeat', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' },
  every: 'Every',
  units: { daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' },
  onDays: 'On',
  monthMode: { day: 'Day of month', nth: 'Weekday', last: 'Last day' },
  dayOfMonth: 'Day',
  ordinals: { 1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth', [-1]: 'Last' },
  ends: 'Ends',
  endsMode: { never: 'Never', until: 'On a date', count: 'After' },
  times: 'Times',
  skipped: 'Skipped dates',
  scope: 'Change',
  scopeOne: 'This event only',
  scopeAll: 'The whole series',
  tags: 'Tags',
  where: 'Where',
  extra: 'Other properties',
  line: 'Line',
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  skip: 'Skip this date',
  weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  repeats: 'Repeats',
}

export function calendarText(locale: string): CalendarText {
  return locale === 'ru' ? ru : en
}
