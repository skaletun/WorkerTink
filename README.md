# WorkerTink 3.0.0

**WorkerTink — рабочая социальная сеть и Work OS: люди, команды, коммуникации, смены, документы и личные рабочие расчёты в одном продукте.**

## Социальная сеть

- рабочая лента, публикации, вопросы и объявления;
- профессиональные сообщества и события;
- люди, поиск по имени, должности, WTinkID и username;
- публичные профили `/user/<username>`;
- уникальные username с автоматической генерацией и безопасной сменой;
- центр уведомлений с прочтением, фильтрами и push-категориями.

## Коммуникации

- личные E2E-чаты;
- групповые E2E-чаты;
- корпоративные каналы по приглашениям;
- роли корпоративных каналов и гибкие права;
- передача владельца;
- собственные ленты корпоративных каналов;
- очистка чата только на своём устройстве;
- редактирование, ответы, удаление, read state;
- голосовые сообщения с реальной waveform и прогрессом;
- пакетная отправка фото/видео/файлов с общей подписью.

## Work OS

- графики 5/2, 4/1, 3/2, 3/1, 6/1, 2/2 и вахта;
- зарплата, НДФЛ, аванс и остаток;
- отпуск и больничные;
- рабочие заметки;
- события и обмен сменами;
- команды/отделы;
- рабочие документы и ссылки внутри команд.

## PWA и Desktop

- PWA для iOS/Android с автоматическим предложением установки;
- offline shell и push;
- Electron Desktop подключается сразу к production GitHub Pages;
- Windows NSIS installer с выбором каталога, ярлыками и деинсталлятором;
- Windows portable;
- macOS DMG/ZIP;
- Linux AppImage/DEB.

## Production

Frontend: `https://skaletun.github.io/WorkerTink/`
Directory API: `https://workertink-directory.workertink-directory.workers.dev`

## Web

```powershell
npm install
npm test
npm run build
npm run dev
```

## Wrangler

```powershell
cd directory-api
npm install
npx wrangler d1 migrations list workertink-directory --remote
npx wrangler d1 migrations apply workertink-directory --remote
npm run deploy
```

Миграция 0019 добавляет рабочие команды и общий каталог документов/ссылок.

## Desktop

Electron использует production Pages URL по умолчанию. Для тестового URL можно задать `WORKERTINK_WEB_URL`.

```powershell
npm install
npm run desktop:dev
npm run desktop:win
```

Windows installer: `release/WorkerTink-3.0.0-win-x64.exe`

Portable: `release/WorkerTink-3.0.0-win-x64.exe` с соответствующим portable artifact name, если выбран target portable отдельно.

## Проверки

```powershell
npm test
npm run build
```

