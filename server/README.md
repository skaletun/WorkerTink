# WorkerTink Directory API — legacy Node.js

Небольшой legacy-сервер-каталог для локальной разработки. Для production используйте `directory-api/` на Cloudflare Workers + D1.
Он **не хранит чаты и заметки**: они остаются в local signaling/localStorage.

## Запуск

```bash
node server/index.mjs
```

По умолчанию API слушает `http://localhost:8787`.

Для GitHub Pages задайте:

```text
VITE_WTINK_DIRECTORY_URL=https://ВАШ-API-ДОМЕН
```

### Переменные сервера

- `PORT` — порт, по умолчанию `8787`.
- `WTINK_DATA_FILE` — путь к JSON-файлу базы, по умолчанию `server/data.json`.
- `CORS_ORIGIN` — разрешённый origin, по умолчанию `*`.

В production рекомендуется заменить JSON-хранилище на постоянную БД и ограничить CORS доменом WorkerTink.
