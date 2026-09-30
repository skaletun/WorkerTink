# Legacy JSON API

Этот Node.js сервер сохранён только как исторический fallback. Production WTinker использует Cloudflare Workers + D1 Directory API.

Для локальной разработки используйте из корня репозитория:

```bash
npm run directory:dev
```

Скрипт `npm run api` также запускает Directory API, чтобы локальная проверка совпадала с production-кодом.
