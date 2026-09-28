## 2.11.0 — 2026-09-28

### Надёжность и инфраструктура
- Исправлен CORS preflight для `DELETE`, необходимый для удаления профиля и OnePass/push-подписок.
- Убрано логирование полного тела невалидного JSON-запроса из Directory API.
- Восстановлены `package-lock.json` для корневого приложения и Directory API для воспроизводимой установки зависимостей.
- Добавлена регрессионная проверка API-критичных настроек.

## 2.10.0 — 2026-09-28

### Аккаунт и безопасность
- Регистрация теперь создаёт полноценный аккаунт каталога с 6-значным PIN.
- PIN не хранится в открытом виде: сервер использует соль + PBKDF2 и временную блокировку после серии неверных попыток.
- Добавлен вход по WTinkID + PIN.
- Добавлен необязательный OnePass на базе WebAuthn/passkey: включается вручную в настройках после входа.
- Добавлена миграция D1 `0005_auth.sql` для PIN, WebAuthn-credential и одноразовых challenge.
- Выход из аккаунта очищает только сессию; локальные рабочие данные сохраняются.

### Настройки
- Безопасность вынесена в верхний компактный блок.
- Доход, график, Push, история доходов, импорт/экспорт, заметки и тема сгруппированы компактнее.

## 2.9.0 — 2026-09-28

### Профиль и WTinkID
- WTinkID теперь отображается строго в формате `WTinkID-123456`; старые варианты регистра автоматически нормализуются.
- Добавлено полное удаление профиля через подтверждающее кастомное окно.
- Удаление очищает профиль, заявки, P2P-сессии и push-подписки в каталоге, а также локальные данные WorkerTink.
- Добавлено изменение имени и должности с автоматической синхронизацией каталога.

### Аватар
- Добавлено добавление, изменение и удаление аватара.
- Добавлен редактор аватара с позиционированием и масштабированием.
- Один и тот же редактор используется при регистрации и в профиле.

### Push-уведомления
- Добавлен Web Push через VAPID и Cloudflare Worker.
- Push-подписки хранятся в D1 только как технические данные подписки.
- Добавлены уведомления о заявках в друзья, принятии заявки и новых P2P-сообщениях.
- Добавлены серверные напоминания о сменах, периодах отсутствия и датах выплат; расписание напоминаний формируется локально и синхронизируется только при включённых уведомлениях.
- Добавлены настройки категорий уведомлений и тестовая отправка.
- Добавлен custom service worker с обработкой `push` и `notificationclick`.

### API / инфраструктура
- Добавлена миграция `0003_push_subscriptions.sql`.
- Добавлена миграция `0004_push_reminders.sql`.
- Добавлен Cron Trigger для доставки запланированных push-уведомлений.
- Добавлены VAPID secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

## 2.8.1 — 2026-09-28
- Полностью переработан жизненный цикл автоматического WebRTC-подключения: один активный сигналинг-сеанс на пару, защита от повторного применения SDP Answer, последовательный polling, корректная обработка DataChannel/ICE/connection states и автоматический retry после сетевого сбоя.
- Старые `pending/answered` peer-сессии отменяются при новом подключении, чтобы старые SDP не пересекались с новым handshake.
- Серверный ответ на уже отменённую peer-сессию теперь корректно отклоняется.

## 2.8.0 — 2026-09-28

### Automatic P2P connection
- Убран ручной обмен WebRTC offer/answer-кодами из основного сценария чата.
- После принятия заявки друзья автоматически устанавливают WebRTC DataChannel через Directory API signaling.
- Добавлена детерминированная сторона-инициатор, чтобы два клиента не создавали встречные подключения одновременно.
- Добавлено автоматическое ожидание и повторная проверка signaling-сессии.
- Добавлен короткоживущий D1 signaling для SDP offer/answer; сообщения, профили и заметки по-прежнему не хранятся на сервере.
- Добавлен endpoint выдачи ICE-конфигурации с STUN по умолчанию и опциональным Cloudflare Realtime TURN.
- Добавлены дополнительные STUN-серверы для повышения шансов прямого соединения.
- Интерфейс чата упрощён: вместо технического кода отображается обычная кнопка «Подключиться».

## 2.7.0 — 2026-09-28

### WTinkID и заявки в друзья
- Короткий публичный ID профиля вида `WTinkID-592391` вместо длинного технического идентификатора.
- Поиск пользователя по WTinkID.
- Отправка заявок в друзья без ручного обмена приглашениями.
- Входящие «Заявки в друзья»: принять / отклонить.
- «Исходящие заявки» со статусами ожидания, принятия и отклонения.
- Добавлена миграция storage до schema v6.
- Добавлен отдельный минимальный Directory API (`server/index.mjs`) для каталога и заявок.
- P2P-чат и передача заметок/профилей остаются отдельным прямым WebRTC-каналом.

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

## 2.7.1

### Cloudflare Directory API
- Production Directory API перенесён на Cloudflare Workers + D1.
- Добавлена SQL-схема и версионируемые D1-миграции.
- Профили хранятся в D1 только с SHA-256 хешем directory-токена.
- Добавлена проверка владельца профиля при изменении данных.
- Заявки защищены от дублей и одновременных встречных pending-заявок через уникальный pair key.
- Добавлены `/health` и `/friends`.
- Добавлена поддержка CORS с возможностью ограничения точным origin GitHub Pages.
- Добавлен GitHub Actions workflow для автоматического деплоя Directory API и миграций.
- Старый Node.js + JSON API сохранён только как legacy/local fallback.
- При коллизии шестизначного WTinkID клиент автоматически генерирует новый ID и повторяет регистрацию.
- Обновлена документация по Cloudflare + D1.
