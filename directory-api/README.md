# WorkerTink Directory API — Cloudflare Workers + D1

Это production-вариант каталога WorkerTink для поиска `WTinkID`, профилей и заявок в друзья.

## Что хранится в D1

- `profiles`: WTinkID, имя, должность, аватар и хеш токена устройства;
- `friend_requests`: входящие/исходящие заявки и их статус.

**Чаты, заметки и P2P-содержимое здесь не хранятся.** Они остаются в localStorage и передаются через WebRTC.

## Требования

- Node.js 16.17+;
- аккаунт Cloudflare;
- Wrangler 4.x.

## 1. Установка

Из каталога `directory-api`:

```powershell
npm install
npx wrangler login
```

Откроется браузер. Войди в Cloudflare и разреши Wrangler доступ к аккаунту.

## 2. Создание D1

Из `directory-api`:

```powershell
npx wrangler d1 create workertink-directory --location weur
```

`weur` — подсказка для региона Западной Европы. Команда вернёт `database_id`.

Открой `wrangler.jsonc` и замени:

```json
"database_id": "REPLACE_WITH_D1_DATABASE_ID"
```

на выданный Cloudflare UUID.

## 3. Миграция

Локально:

```powershell
npx wrangler d1 migrations apply workertink-directory --local
```

Для production:

```powershell
npx wrangler d1 migrations apply workertink-directory --remote
```

Для первого запуска нужна именно `--remote`, потому что Worker будет читать production D1.

## 4. CORS

По умолчанию `ALLOWED_ORIGIN` равен `*`, чтобы первый запуск был простым.

После публикации GitHub Pages рекомендуется заменить его в `wrangler.jsonc` на точный адрес Pages, например:

```json
"vars": {
  "ALLOWED_ORIGIN": "https://your-name.github.io"
}
```

После изменения снова выполнить `npx wrangler deploy`.

## 5. Локальный запуск

```powershell
npx wrangler dev
```

Worker будет доступен по локальному адресу Wrangler. Для локального тестирования можно использовать локальную D1:

```powershell
npx wrangler d1 migrations apply workertink-directory --local
```

## 6. Production deploy

```powershell
npx wrangler deploy
```

Cloudflare выдаст адрес вида:

```text
https://workertink-directory.<your-subdomain>.workers.dev
```

Проверка:

```text
GET https://...workers.dev/health
```

Ожидаемый ответ:

```json
{"ok":true,"profiles":0}
```

## 7. Подключение к WorkerTink

В GitHub Pages workflow WorkerTink уже используется переменная:

```text
WTINK_DIRECTORY_URL
```

В GitHub:

`Settings → Secrets and variables → Actions → Variables → New repository variable`

Создай:

```text
Name:  WTINK_DIRECTORY_URL
Value: https://workertink-directory.<your-subdomain>.workers.dev
```

После следующего push GitHub Pages соберёт WorkerTink с этим URL.

## 8. API

```text
GET  /health
POST /profiles
GET  /profiles/:wtinkId
PUT  /profiles
POST /friend-requests
GET  /friend-requests/incoming
GET  /friend-requests/outgoing
POST /friend-requests/:id/accept
POST /friend-requests/:id/decline
GET  /friends
```

Авторизация приватных методов:

```text
Authorization: Bearer <directory-token>
```

Токен создаётся один раз при регистрации профиля и сохраняется только локально в WorkerTink. В D1 хранится только SHA-256 хеш токена.

## 9. Безопасность

- токен не хранится в открытом виде в D1;
- профиль можно менять только владельцу токена;
- заявку нельзя принять/отклонить пользователю, которому она не адресована;
- нельзя отправить заявку самому себе;
- нельзя создать две одновременные заявки между одной парой пользователей;
- аватар ограничен по размеру;
- SQL-запросы используют параметры, а не конкатенацию пользовательского ввода;
- CORS можно ограничить адресом GitHub Pages.

## 10. Что важно знать про бесплатный тариф

Cloudflare Workers Free сейчас ограничен 100 000 запросами в сутки. D1 на Workers Free имеет дневные лимиты 5 млн прочитанных строк и 100 000 записанных строк. С 1 сентября 2026 года превышение D1 free-tier дневных лимитов останавливает соответствующие запросы до сброса лимита. Для WorkerTink это означает, что нужно избегать бессмысленных частых запросов и полных сканирований таблиц.

## 11. Автоматический деплой из GitHub Actions

Если хочешь, чтобы Directory API обновлялся вместе с GitHub, workflow уже находится в:

```text
.github/workflows/deploy-directory.yml
```

В GitHub открой:

`Settings → Secrets and variables → Actions`

Добавь **Secrets**:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

### Как создать `CLOUDFLARE_API_TOKEN`

В Cloudflare:

`Manage Account → Account API Tokens → Create Token`

Для CI/CD нужен API token, а не Global API Key. Для уже существующего Worker Cloudflare рекомендует роль `Editor` для Worker; для запуска D1-миграций из CI нужен также доступ к D1 с правом записи/редактирования. Поэтому для этого проекта в Custom Token укажи минимально необходимые права:

- **Workers → Edit** — для деплоя существующего Worker;
- **D1 → Edit** — для применения миграций.

Если Worker ещё не создан, первый `wrangler deploy` удобнее выполнить локально через `npx wrangler login`, потому что создание нового Worker требует более широких прав, чем последующие обновления.

После первого успешного локального деплоя CI сможет обновлять уже существующий Worker с более узким токеном.

### Где взять `CLOUDFLARE_ACCOUNT_ID`

Его можно увидеть в Cloudflare Dashboard на странице аккаунта. Это строка идентификатора аккаунта, а не ID базы D1.

### Что делает workflow

При изменениях в `directory-api/` GitHub Actions:

1. устанавливает Wrangler;
2. подключается к Cloudflare через секреты;
3. применяет неприменённые миграции D1 с `--remote`;
4. выполняет `wrangler deploy`;
5. публикует новую версию Worker.

## 12. Настройка CORS после публикации Pages

После первого деплоя WorkerTink Pages будет иметь origin вида:

```text
https://USERNAME.github.io
```

Если приложение находится по адресу:

```text
https://USERNAME.github.io/WorkerTink/
```

в `ALLOWED_ORIGIN` всё равно нужно указывать **только origin без `/WorkerTink/`**:

```json
"vars": {
  "ALLOWED_ORIGIN": "https://USERNAME.github.io"
}
```

После изменения выполни:

```powershell
npx wrangler deploy
```

На первом запуске можно оставить `*`, проверить систему, а затем ограничить origin.

## 13. Почему D1, а не `data.json`

Старый `server/index.mjs` оставлен для локального fallback. В production JSON-файл использовать не следует: у serverless Workers нет обычного постоянного локального диска, который можно безопасно использовать как базу.

D1 предоставляет постоянную SQL-базу, а Worker получает к ней binding `DB`. Запросы к D1 параметризованы, а нужные поля имеют индексы.

## 14. Что именно отправляется в Directory API

При регистрации/обновлении:

```text
WTinkID
Имя
Должность
Сжатый аватар
```

Также сервер хранит технический хеш токена устройства.

При работе с друзьями:

```text
поиск WTinkID
заявка
принятие / отклонение
статус заявки
```

**Сообщения чата, содержимое заметок и история P2P не отправляются в Directory API.**
