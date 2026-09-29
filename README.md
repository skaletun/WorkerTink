# WorkerTink 2.12.0

**WorkerTink** — PWA для рабочего календаря, смен, зарплаты, отпусков, больничных и рабочего общения. Начиная с 2.12.0 приложение развивается как **рабочая социальная сеть**: коллеги могут находить друг друга по `WTinkID`, добавляться в контакты, видеть presence, публиковать рабочие новости, ставить реакции, комментировать записи, обмениваться личными сообщениями и использовать P2P-соединения.

Приложение устанавливается как PWA и поддерживает offline-режим. Локальные расчёты и профиль продолжают работать на устройстве, а социальные функции и межустройственная синхронизация используют Directory API на Cloudflare Workers + D1.

## Возможности

### Рабочий календарь

- графики `5/2`, `4/1`, `3/2`, `3/1`, `6/1`, `2/2`, `7/0`;
- дневные и ночные смены;
- `2/2`: День/День, День/Ночь, Ночь/Ночь;
- `7/0`: День, Ночь или Сутки;
- для `7/0` задаётся непрерывный период вахты от 1 до 6 месяцев;
- дата начала является реальной точкой отсчёта цикла;
- даты до выхода на работу отображаются как «До начала»;
- ручная замена отдельной смены;
- заметки на конкретной дате;
- федеральные праздники и известные переносы для поддерживаемых годов;
- настраиваемый коэффициент праздничной доплаты.

### Расчёт зарплаты

Расчётное ядро разделяет:

- плановые часы по графику;
- фактически отработанные плановые смены;
- дополнительные смены в выходные по графику;
- праздничные часы;
- ночные смены;
- отпускные;
- больничные;
- НДФЛ;
- аванс и остаток.

Для `День` и `Ночь` используется 8 часов, для `Сутки` — 24 часа. Ночная доплата настраивается отдельно; значение по умолчанию — 20%.

Аванс по умолчанию равен 50% указанного оклада и может быть переопределён для каждого месяца.

### Отпуск и больничные

- периоды отпуска и больничного хранятся отдельно;
- праздничные дни внутри ежегодного отпуска не расходуют дни отпуска;
- дни отсутствия исключаются из обычной оплаты смен;
- отпускные используют средний доход за доступную историю 12 месяцев;
- больничные используют доступную историю 24 месяцев и коэффициент по стажу: `<5` лет — 60%, `5–8` — 80%, `8+` — 100%.

Расчёты являются пользовательской моделью планирования и не заменяют официальный расчёт работодателя.

## WorkerTink Community — рабочая социальная сеть

Раздел **Community** использует тот же профиль и `WTinkID`, что и рабочий календарь.

### Лента

- создание публикаций до 4000 символов;
- рабочие новости, опыт и полезные советы;
- лайки;
- комментарии до 1000 символов;
- удаление собственных публикаций;
- административное удаление публикаций;
- шаринг публикации через URL;
- переход сразу к конкретной публикации.

### Люди и контакты

- поиск коллег по `WTinkID`;
- входящие и исходящие заявки в друзья;
- принятие и отклонение заявок;
- список контактов;
- статус `В сети` / `Не в сети`;
- быстрый переход из контакта в личные сообщения;
- dev-бейдж для специального developer-профиля.

### Личные сообщения

Личные сообщения доступны между подтверждёнными друзьями. История сообщений хранится в D1 и синхронизируется между устройствами.

Для новых сообщений создаётся внутреннее уведомление и, если push настроен, push-уведомление.

### Уведомления

Центр уведомлений объединяет социальные события:

- заявки в друзья;
- принятие заявки;
- P2P-запросы;
- личные сообщения;
- реакции на публикации;
- комментарии.

Есть счётчик непрочитанных событий, отметка отдельного уведомления и команда «Отметить всё прочитанным».

P2P-запрос не принимается автоматически: по переходу из push или внутреннего уведомления приложение восстанавливает запрос и показывает модальное окно с именем отправителя и действиями подключения/отклонения.

### Presence

Клиент отправляет heartbeat в Directory API. Состояние контактов обновляется автоматически, поэтому статус присутствия не зависит от локального `localStorage`.

### P2P

P2P-соединение используется для real-time обмена, когда оно необходимо. Signaling выполняется через Directory API, после чего данные могут передаваться через WebRTC DataChannel.

P2P-запросы являются короткоживущими: pending-сессии имеют TTL 30 секунд и не принимаются автоматически.

## Рабочий центр

В приложении предусмотрены рабочие инструменты поверх общего расчётного ядра:

- Smart Dashboard;
- Smart Calendar;
- прогноз зарплаты на будущие месяцы;
- планировщик отпуска;
- симулятор больничного;
- what-if сценарии для зарплаты и графика;
- годовая статистика;
- контекстные подсказки.

Эти инструменты используют те же исходные данные графика и расчётное ядро, а не отдельные несовместимые формулы.

## Профиль, мастер настройки и безопасность

Каждому пользователю назначается идентификатор вида:

```text
WTinkID-592391
```

Профиль содержит имя, должность и аватар.

Первичная настройка аккаунта синхронизируется с Directory API. Если настройки уже существуют для аккаунта, мастер повторно не показывается при входе с другого устройства.

Данные настройки аккаунта передаются в зашифрованном виде. Для server-side шифрования используется секрет Cloudflare Worker:

```text
SETUP_ENCRYPTION_KEY
```

Секрет не должен храниться в Git или `wrangler.jsonc`.

### Security Center

В проекте предусмотрены проверки и управление связанными с аккаунтом механизмами:

- токен Directory API;
- OnePass/WebAuthn;
- состояние push-подписок;
- состояние серверной синхронизации;
- encrypted account setup.

## Роли Dev / Admin

Роли авторизуются на сервере, а не только через `localStorage`.

Специальный developer-профиль:

```text
WTinkID-214994
```

имеет `dev`-признак и административные права. Бейдж отображается рядом с именем в социальных профилях, друзьях, заявках, P2P и административных интерфейсах.

Административный API дополнительно проверяет роль на стороне Worker.

## Данные и резервное копирование

### Локальные данные

- основной профиль и расчётные данные хранятся в `localStorage`;
- схема профиля имеет версию и последовательную нормализацию;
- старые ключи `v2`/`v3` мигрируются автоматически;
- импорт JSON проходит через ту же нормализацию;
- повреждённый профиль сначала сохраняется в recovery-снимок;
- заметки могут экспортироваться в Markdown.

### Зашифрованный backup

Резервная копия поддерживает шифрование AES-GCM с ключом, производным через PBKDF2 от пользовательского пароля.

Backup предназначен для восстановления локальных рабочих данных и не заменяет серверную синхронизацию социальных сущностей.

## Визуальный редактор заметок

Редактор заметок работает как WYSIWYG-редактор:

- жирный, курсив, заголовки;
- списки;
- цитаты;
- код;
- ссылки;
- Markdown-таблицы;
- ПК: `Ctrl/Cmd+B`, `Ctrl/Cmd+I`, `Ctrl/Cmd+K`, `Ctrl/Cmd+Shift+7`, `Ctrl/Cmd+Shift+8`, `Ctrl/Cmd+Shift+X`;
- мобильная toolbar-панель;
- импорт/экспорт Markdown;
- структура заметок `## SHIFT: YYYY-MM-DD`.

Таблицы адаптируются под мобильную ширину. На ПК действия со строками и столбцами доступны через контекстное меню, на мобильных — через долгое нажатие.

## Технологии

- React 19
- TypeScript
- Vite 7
- vite-plugin-pwa
- localStorage
- WebRTC
- WebAuthn / OnePass
- Service Worker
- Cloudflare Workers
- Cloudflare D1 / SQLite
- GitHub Actions / GitHub Pages

## Структура проекта

```text
src/
├── App.tsx              # основная оболочка приложения
├── HomeView.tsx         # рабочий dashboard
├── SocialView.tsx       # WorkerTink Community
├── core.ts              # календарь, графики и расчёты
├── directory.ts         # Directory API client
├── markdown.ts          # Markdown ↔ WYSIWYG
├── notifications.ts     # push и уведомления
├── p2p.ts               # WebRTC/P2P
├── storage.ts           # локальная схема, миграции и backup
├── main.tsx             # entry point
├── sw.js                # Service Worker
└── styles.css           # responsive UI

directory-api/
├── src/index.js         # Cloudflare Worker
├── migrations/
│   ├── 0001_initial.sql
│   ├── 0002_peer_signaling.sql
│   ├── 0003_push_subscriptions.sql
│   ├── 0004_push_reminders.sql
│   ├── 0005_auth.sql
│   ├── 0006_presence.sql
│   ├── 0007_roles.sql
│   ├── 0008_account_setup.sql
│   ├── 0009_dev_role_repair.sql
│   └── 0010_social_network.sql
└── wrangler.jsonc

tests/
├── core.test.mjs
├── regression.test.mjs
├── notes.test.mjs
├── storage.test.mjs
├── smoke.test.cjs
├── motion.test.cjs
├── api-regression.test.cjs
└── social-regression.test.cjs
```

## Запуск фронтенда

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Preview:

```bash
npm run preview
```

Tests:

```bash
npm test
```

Установка зависимостей Directory API:

```bash
npm run directory:install
```

Локальный Directory API:

```bash
npm run directory:dev
```

Деплой Directory API:

```bash
npm run directory:deploy
```

## Directory API — Cloudflare Workers + D1

Production backend расположен в `directory-api/`.

Основные группы API:

```text
GET/POST /profiles
GET/PUT   /profiles/:wtinkId

POST /friend-requests
GET  /friend-requests/incoming
GET  /friend-requests/outgoing
POST /friend-requests/:id/accept
POST /friend-requests/:id/decline
GET  /friends

POST /presence/heartbeat

POST /peer-sessions
GET  /peer-sessions/incoming
GET  /peer-sessions/:id
POST /peer-sessions/:id/answer
POST /peer-sessions/:id/decline

GET  /social/feed
POST /social/posts
DELETE /social/posts/:id
POST /social/posts/:id/like
GET  /social/posts/:id/comments
POST /social/posts/:id/comments

GET  /social/notifications
POST /social/notifications/:id/read
POST /social/notifications/read-all

GET  /social/messages/:profileId
POST /social/messages

GET  /admin/overview
GET  /admin/profiles
```

Приватные методы используют:

```text
Authorization: Bearer <directory-token>
```

В D1 хранится хеш токена, а не его открытое значение.

## D1-схема

Миграции `0001`–`0010` создают и обновляют основные сущности:

- `profiles` — публичный профиль, роли, auth/presence;
- `friend_requests` — заявки и их статусы;
- `peer_sessions` — короткоживущие P2P-сессии;
- `push_subscriptions` — push-подписки;
- `push_reminders` — запланированные push;
- `auth_challenges` и `webauthn_credentials` — OnePass/WebAuthn;
- `account_setup` — зашифрованные настройки аккаунта;
- `social_posts` — публикации;
- `social_post_likes` — реакции;
- `social_post_comments` — комментарии;
- `social_notifications` — внутренние социальные уведомления;
- `social_messages` — личные сообщения.

## Настройка Cloudflare

Требования:

- Node.js;
- аккаунт Cloudflare;
- Wrangler 4.x;
- D1 database.

Перейдите в `directory-api`:

```powershell
cd directory-api
npm install
npx wrangler login
```

Если D1 ещё не создан:

```powershell
npx wrangler d1 create workertink-directory --location weur
```

Укажите полученный `database_id` в `directory-api/wrangler.jsonc`.

### Миграции

Локальная D1:

```powershell
npx wrangler d1 migrations apply workertink-directory --local
```

Production D1:

```powershell
npx wrangler d1 migrations apply workertink-directory --remote
```

### Secret для account setup

Если secret ещё не создан:

```powershell
npx wrangler secret put SETUP_ENCRYPTION_KEY
```

Секрет генерируется локально и вводится непосредственно в Wrangler. Не добавляйте его в Git.

### Push

Для Web Push Worker использует следующие Worker secrets/variables, если push-функции включены:

```text
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

### WebRTC TURN

Для собственного TURN-пути Cloudflare Worker может использовать:

```text
TURN_KEY_ID
TURN_KEY_TOKEN
```

При отсутствии TURN credentials используется fallback ICE configuration, заданный кодом Worker.

### CORS

По умолчанию:

```json
"vars": {
  "ALLOWED_ORIGIN": "*"
}
```

Для production рекомендуется ограничить origin адресом приложения, например:

```json
"vars": {
  "ALLOWED_ORIGIN": "https://username.github.io"
}
```

После изменения:

```powershell
npx wrangler deploy
```

## Production deploy

Полный порядок для Directory API:

```powershell
cd E:\WorkerTink\directory-api
npx wrangler d1 migrations apply workertink-directory --remote
npx wrangler deploy
```

Проверка:

```text
GET https://<worker-domain>/health
```

Ожидается JSON с `ok: true`.

## Frontend ↔ Directory API

Для production frontend используется:

```text
VITE_WTINK_DIRECTORY_URL
```

Локально значение можно задать через `.env`/`.env.local`.

Для GitHub Pages workflow используется repository variable:

```text
WTINK_DIRECTORY_URL
```

Создайте её в:

**Settings → Secrets and variables → Actions → Variables**

Пример:

```text
Name:  WTINK_DIRECTORY_URL
Value: https://workertink-directory.<your-subdomain>.workers.dev
```

## GitHub Pages

Vite использует относительный `base`, поэтому приложение подходит для Pages-пути вида:

```text
https://username.github.io/WorkerTink/
```

Workflow фронтенда находится в:

```text
.github/workflows/deploy.yml
```

Workflow Directory API:

```text
.github/workflows/deploy-directory.yml
```

Перед первым deployment в GitHub Pages выберите:

**Settings → Pages → Source → GitHub Actions**

## Offline / PWA

Локальные рабочие функции не требуют Directory API. Service Worker кэширует production-ресурсы, а локальный профиль и расчётные данные сохраняются на устройстве.

Социальные функции, friends, presence, сообщения, P2P signaling и серверные уведомления требуют соединения с Directory API.

PWA использует автоматическое обновление Service Worker. После обновления приложения может потребоваться перезагрузка открытой вкладки/установленного PWA.

## Тесты и проверки

Команда:

```bash
npm test
```

проверяет:

- расчётное ядро;
- календарь и графики;
- даты выплат;
- дополнительные и ночные доплаты;
- storage migration;
- заметки и Markdown;
- smoke UI;
- motion markers;
- Directory API regression;
- social network regression.

Перед production рекомендуется дополнительно выполнить:

```bash
npm run build
```

и отдельно проверить production D1 migrations:

```powershell
cd directory-api
npx wrangler d1 migrations apply workertink-directory --remote
```

## Ограничения и модель безопасности

WorkerTink предназначен для рабочих данных и общения, но не является корпоративной системой документооборота.

Не публикуйте в ленте, сообщениях, заметках или backup:

- пароли;
- секретные токены;
- банковские реквизиты;
- коды восстановления;
- другие чувствительные данные, если они не нужны для работы.

Зарплата, отпускные и больничные являются расчётной моделью и могут отличаться от официального начисления работодателя.

Социальный backend хранит серверные сущности, необходимые для Community: профили, заявки, публикации, реакции, комментарии, уведомления и личные сообщения. Локальные рабочие расчёты и заметки не превращаются автоматически в публичные социальные данные.

## Лицензия

All Rights Reserved.

Copyright © 2026 Petrov Adel.

Подробнее — `LICENSE`.

## 2.14.0: защищённый чат и QR-вход

### Новый чат

- Личные сообщения находятся в разделе **Друзья и чат**.
- Ручной P2P/WebRTC-чат из пользовательского интерфейса удалён.
- Community оставляет только **Ленту / Уведомления / Люди**.
- Текст, фото, видео и голосовые сообщения шифруются на клиенте: **ECDH P-256 + AES-GCM**.
- Сервер хранит только зашифрованный envelope и метаданные вложения.
- Максимальный размер вложения в текущем клиенте — 7 МБ.

### QR-вход на ПК

1. На ПК откройте экран входа и нажмите **«Войти на ПК по QR-коду»**.
2. WorkerTink создаст одноразовую QR-сессию.
3. На уже авторизованном телефоне откройте **Профиль → «Вход на ПК по QR»**.
4. Отсканируйте QR и подтвердите вход.
5. ПК получает отдельную серверную сессию; мобильная сессия не закрывается.
6. E2E-ключ чата передаётся с телефона на ПК через дополнительный ECDH-зашифрованный пакет.

### Миграция D1

После обновления Directory API примените новую миграцию:

```bash
cd directory-api
npx wrangler d1 migrations apply workertink-directory --remote
```

Для локальной D1:

```bash
npx wrangler d1 migrations apply workertink-directory --local
```

### Проверка и сборка

```bash
npm install
npm run test
npm run build
```

Directory API:

```bash
npm --prefix directory-api install
npm --prefix directory-api run dev
```

Деплой:

```bash
npm --prefix directory-api run deploy
```
