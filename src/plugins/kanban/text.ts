export interface KanbanText {
  board: string
  source: string
  lock: string
  unlock: string
  addCard: string
  newCard: string
  editCard: string
  cardTitle: string
  column: string
  lane: string
  tags: string
  who: string
  due: string
  description: string
  extra: string
  priorityLabel: string
  priority: { high: string; low: string; none: string }
  save: string
  cancel: string
  delete: string
  filterTag: string
  everyone: string
  line: string
}

const ru: KanbanText = {
  board: 'Доска',
  source: 'Исходник',
  lock: 'Запретить изменения',
  unlock: 'Разрешить изменения',
  addCard: 'Добавить карточку',
  newCard: 'Новая карточка',
  editCard: 'Карточка',
  cardTitle: 'Заголовок',
  column: 'Колонка',
  lane: 'Дорожка',
  tags: 'Теги',
  who: 'Исполнитель',
  due: 'Срок',
  description: 'Описание',
  extra: 'Другие свойства',
  priorityLabel: 'Приоритет',
  priority: { high: 'Высокий', low: 'Низкий', none: 'Обычный' },
  save: 'Сохранить',
  cancel: 'Отмена',
  delete: 'Удалить',
  filterTag: 'Фильтр по тегу',
  everyone: 'Все исполнители',
  line: 'Строка',
}

const en: KanbanText = {
  board: 'Board',
  source: 'Source',
  lock: 'Lock changes',
  unlock: 'Allow changes',
  addCard: 'Add a card',
  newCard: 'New card',
  editCard: 'Card',
  cardTitle: 'Title',
  column: 'Column',
  lane: 'Lane',
  tags: 'Tags',
  who: 'Assignee',
  due: 'Due',
  description: 'Description',
  extra: 'Other properties',
  priorityLabel: 'Priority',
  priority: { high: 'High', low: 'Low', none: 'Normal' },
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  filterTag: 'Filter by tag',
  everyone: 'Everyone',
  line: 'Line',
}

export function kanbanText(locale: string): KanbanText {
  return locale === 'ru' ? ru : en
}
