# Changelog

## 2.6.1 — 2026-09-28

- Адаптивные таблицы в WYSIWYG-редакторе заметок: таблица теперь полностью помещается по ширине мобильного экрана без горизонтального скролла.
- Добавлен постоянный пустой ряд-ввод: после заполнения последнего ряда автоматически появляется следующий; если его очистить, он всё равно остаётся доступным для ввода.
- Добавлено расширение таблиц по строкам и столбцам через меню управления таблицей.
- ПКМ по таблице открывает управление таблицей на десктопе.
- Долгое нажатие по таблице на мобильном открывает отдельное меню действий.
- Быстрое удаление таблицы из контекстного/мобильного меню.
- Пустой служебный ряд не попадает в сохранённый Markdown и автоматически восстанавливается при открытии заметки.

## 2.6.0 — Profile & P2P

- Добавлена обязательная локальная регистрация перед мастером настройки: имя, должность и аватар.
- Добавлена отдельная красивая страница профиля с рабочими показателями и настройками аватара.
- Добавлены друзья и чат на прямом WebRTC P2P-канале без серверного хранения сообщений.
- Добавлен ручной обмен offer/answer-кодами для установления P2P-соединения без собственного signaling-сервера.
- Добавлена пересылка профиля в чат с активацией профиля прямо из сообщения.
- Добавлена пересылка заметок смен с датой и типом смены; полученную заметку можно активировать на исходную дату.
- Хранилище обновлено до schema v5 с миграцией старых профилей.

## 2.5.0

### Calculation core
- Reworked shift-hour accounting: planned hours, manual extra shifts and actual work are separated.
- Added configurable night-shift premium with a 20% default.
- Holiday premium is now calculated from worked hours, including 24-hour `full` shifts.
- Manual work added to a scheduled day off is treated as an extra paid shift instead of changing the monthly salary denominator.
- Income history is sorted chronologically before averaging.
- `7/0` now uses the configured 1–6 month continuous work period; after the selected period the schedule becomes `off` until a new start date is configured.
- Dates before `startDate` remain outside the schedule and payroll.

### Storage
- Introduced schema version `4`.
- Added normalization for imported JSON as well as normal loads.
- Added migration handling for legacy `v2`/`v3` storage keys.
- Invalid storage is copied to a recovery snapshot when possible before falling back to defaults.

### Vacation and absence
- Vacation usage in the overview now excludes non-working federal holidays from the used vacation-day count.

### Notes
- Moved Markdown/WYSIWYG conversion logic out of `App.tsx` into `src/markdown.ts`.
- Preserved the inline WYSIWYG editor, mobile toolbar and Markdown table support.

### Documentation / CI
- Rewrote README to match the actual product and its limitations.
- GitHub Pages workflow now runs the test suite before production build.
- Added regression coverage for night premiums, extra shifts, income ordering, vacation holidays and storage migration.
