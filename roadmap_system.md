# WTinker — roadmap_system.md

> Внутренняя техническая дорожная карта WTinker после перехода на v7.0.0.
>
> **Цель:** привести внутренние системы к состоянию, в котором социальный слой, Work OS, E2E-коммуникации и Directory API работают как единая надёжная платформа — без потери существующих данных, аккаунтов, идентичности, URL и рабочих расчётов.

## 0. Правила разработки

1. **Correctness first.** Сначала корректность данных и бизнес-логики, затем новые возможности.
2. **No big-bang rewrite.** Модули выделяются постепенно вокруг уже работающего поведения.
3. **Backward compatibility.** Старые данные, deep links, API-контракты и E2E identity не ломаются без отдельного migration plan.
4. **Server authority.** Авторизация, права, критичные расчёты и финальное состояние серверных сущностей не определяются клиентом.
5. **Idempotency.** Критичные mutation-операции можно безопасно повторить.
6. **Auditability.** Финансы, права, identity, security и административные действия должны оставлять проверяемый след.
7. **Observable by default.** Ошибка должна быть диагностируема без воспроизведения у пользователя.
8. **CI is a gate.** Production считается обновлённым только после успешного build, deploy и smoke verification.

---

# P0 — Core Integrity

## 1. Calculation Engine

**Цель:** сделать расчёты детерминированными, тестируемыми и независимыми от UI.

### Payroll

- [ ] Инвентаризация всех текущих формул и мест, где выполняются расчёты.
- [ ] Выделить pure calculation functions.
- [ ] Зафиксировать входные параметры и единицы измерения.
- [ ] Зафиксировать правила округления.
- [ ] Ставки, часы, ночные, выходные, праздники, переработки.
- [ ] Авансы, налоги, удержания, баланс.
- [ ] Snapshot входных данных для каждого итогового расчёта.
- [ ] Версия алгоритма расчёта.
- [ ] История результатов без silent recalculation.
- [ ] Явная процедура пересчёта исторических данных.
- [ ] Защита от NaN, Infinity, overflow и невозможных отрицательных значений.
- [ ] Regression fixtures для пограничных случаев.

### Shifts

- [ ] Единая модель смены.
- [ ] Timezone-aware timestamps.
- [ ] Overnight shifts.
- [ ] DST transitions.
- [ ] Overlap/duplicate detection.
- [ ] Проверка невозможных интервалов.
- [ ] State machine для swap/approval/rejection.
- [ ] Immutable history критичных изменений.

### Absence

- [ ] Единый engine отпусков/больничных.
- [ ] Рабочие и нерабочие дни.
- [ ] Пересечения.
- [ ] Лимиты и переносы.
- [ ] Approval state machine.
- [ ] Аудит изменения периода/статуса.

### Definition of Done

- одинаковый input всегда даёт одинаковый результат;
- UI не содержит собственной альтернативной формулы;
- критичные edge cases покрыты тестами;
- изменение алгоритма имеет версию;
- старые результаты не меняются молча.

---

# P0 — Identity, Auth & Security

## 2. Identity

- [ ] WTinkID — immutable identifier.
- [ ] Username normalization policy.
- [ ] Case-insensitive lookup.
- [ ] Username uniqueness на сервере.
- [ ] Reserved usernames.
- [ ] Защита от identity collision.
- [ ] Audit trail изменений username/profile identity.
- [ ] Разделить display name и machine identity.

## 3. Sessions

- [ ] Session rotation.
- [ ] Expiration.
- [ ] Revoke current session.
- [ ] Revoke all sessions.
- [ ] Device/session registry.
- [ ] Suspicious-session detection.
- [ ] Rate limiting.
- [ ] Security events.
- [ ] Регрессии для multi-device.

## 4. OnePass / WebAuthn

- [ ] Audit challenge lifecycle.
- [ ] Challenge expiry.
- [ ] Replay protection.
- [ ] Credential uniqueness.
- [ ] Credential revoke.
- [ ] Device management.
- [ ] Recovery flow.
- [ ] Multi-device regression tests.
- [ ] Проверка после deploy/migration.

> **Критическое правило:** deploy, migration, logout, device registration или обновление клиента не должны автоматически создавать новую E2E identity.

---

# P0 — Authorization

## 5. Unified Permission Engine

Постепенно убрать разрозненные permission checks и привести их к единой модели:

`actor → action → resource → scope → decision`

- [ ] Resource ownership.
- [ ] Company scope.
- [ ] Community scope.
- [ ] Channel scope.
- [ ] Team scope.
- [ ] Membership state.
- [ ] Role state.
- [ ] Admin scope.
- [ ] Blocked/deleted/expired member checks.
- [ ] Negative authorization tests.
- [ ] Cross-company access tests.

### Базовая матрица

| Resource | Owner | Admin | Manager | Moderator | Member |
|---|---:|---:|---:|---:|---:|
| Profile | full | limited | — | — | own |
| Community | full | full | scoped | moderate | read |
| Channel | full | full | scoped | moderate | scoped |
| Work data | own | audit | scoped | — | own |
| Payroll | own | audit | scoped | — | own |

Матрица уточняется по каждому endpoint/resource, а не заменяет endpoint-level authorization.

---

# P0 — People / Directory / Social Graph

## 6. People Search

Поиск должен одинаково корректно работать по:

- [ ] WTinkID.
- [ ] username.
- [ ] имени.
- [ ] компании.
- [ ] должности.
- [ ] подразделению.
- [ ] доступным публичным атрибутам.

Технически:

- [ ] exact match priority;
- [ ] normalized username;
- [ ] pagination/cursors;
- [ ] privacy filtering;
- [ ] blocked-user filtering;
- [ ] rate limiting;
- [ ] deterministic ranking;
- [ ] regression tests для WTinkID + username.

## 7. Social Graph

- [ ] Friend-request state machine.
- [ ] Duplicate request prevention.
- [ ] Accept/reject/cancel.
- [ ] Block precedence.
- [ ] Friendship uniqueness.
- [ ] Follow/subscribe semantics.
- [ ] Mutual connections.
- [ ] Relationship cache.
- [ ] Relationship event log.
- [ ] Transactional notification creation.

### Public profile

- [ ] Privacy checks.
- [ ] Authenticated «Отправить заявку».
- [ ] Duplicate request handling.
- [ ] Blocked-user handling.
- [ ] Deep-link compatibility.

---

# P0 — Data & D1

## 8. Schema Integrity

- [ ] Полный inventory таблиц и связей.
- [ ] Foreign-key strategy.
- [ ] UNIQUE constraints.
- [ ] NOT NULL where required.
- [ ] CHECK constraints.
- [ ] Soft-delete policy.
- [ ] Retention policy.
- [ ] Index audit.
- [ ] Query profiling.
- [ ] Migration ordering.
- [ ] Migration verification.
- [ ] Backup procedure.
- [ ] Restore procedure.

## 9. Migration Safety

Каждая миграция должна иметь:

- [ ] forward path;
- [ ] compatibility window;
- [ ] validation query;
- [ ] rollback/recovery procedure, если rollback технически возможен;
- [ ] backup requirement для destructive changes;
- [ ] production verification.

**Нельзя** выполнять destructive migration только потому, что старое поле «больше не используется» клиентом.

---

# P0 — Local State / Storage

## 10. Client State Integrity

- [ ] Inventory localStorage/IndexedDB state.
- [ ] Versioned local schema.
- [ ] Migration pipeline.
- [ ] Recovery from corrupted state.
- [ ] Quota handling.
- [ ] Storage error handling.
- [ ] Clear separation между cache и source-of-truth data.
- [ ] Regression tests всех schema versions.
- [ ] Safe logout/device reset.

Особое внимание:

- E2E identity;
- session metadata;
- drafts;
- pending mutations;
- cached profiles;
- notification state;
- chat state.

---

# P0 — E2E Messaging Reliability

## 11. E2E Identity

- [ ] Formal identity lifecycle.
- [ ] Durable IndexedDB vault.
- [ ] Compatibility с существующим storage.
- [ ] Identity continuity tests.
- [ ] Backup/restore strategy.
- [ ] Multi-device model.
- [ ] Explicit device revocation.

## 12. Group Keys

- [ ] Key versioning.
- [ ] Rotation при изменении состава.
- [ ] Member removal.
- [ ] Recovery.
- [ ] Stale-key detection.
- [ ] Concurrent membership-change tests.
- [ ] Unknown-key recovery state.

## 13. Message Delivery

Состояния:

`draft → pending → sent → delivered → read`

и отдельное:

`failed → retrying → sent/failed`

- [ ] Client message ID.
- [ ] Server message ID.
- [ ] Deduplication.
- [ ] Retry with backoff.
- [ ] Ordering.
- [ ] Offline queue.
- [ ] Attachment retry.
- [ ] Failed-message recovery.
- [ ] Read-state synchronization.

---

# P1 — API Reliability

## 14. API Contracts

- [ ] Typed request/response schemas.
- [ ] Versioned contracts where needed.
- [ ] Consistent error envelope.
- [ ] Stable machine-readable error codes.
- [ ] Cursor pagination.
- [ ] Auth middleware.
- [ ] Authorization middleware.
- [ ] Rate limits.
- [ ] Request ID.
- [ ] Idempotency key for critical mutations.

Рекомендуемая форма:

`request_id + error_code + message + details?`

Не использовать текст ошибки как единственный контракт клиента.

---

# P1 — Event & Notification System

## 15. Domain Events

Перейти от прямых разрозненных вызовов уведомлений к domain-event модели.

Минимальный envelope:

- `event_id`
- `event_type`
- `schema_version`
- `actor_id`
- `target_id`
- `timestamp`
- `request_id`
- `idempotency_key`

Базовые события:

- [ ] `friend.request.created`
- [ ] `friend.request.accepted`
- [ ] `post.created`
- [ ] `reaction.created`
- [ ] `comment.created`
- [ ] `mention.created`
- [ ] `message.created`
- [ ] `shift.changed`
- [ ] `payroll.updated`
- [ ] `absence.created`
- [ ] `security.event`

## 16. Notification Pipeline

`domain event → policy → inbox → push/desktop`

- [ ] Deduplication.
- [ ] Batching.
- [ ] Priority.
- [ ] Mute settings.
- [ ] Read/unread.
- [ ] Deep links.
- [ ] Retry.
- [ ] Failure tracking.
- [ ] Notification grouping.
- [ ] Preference inheritance.

---

# P1 — Offline & Synchronization

## 17. Sync Engine

- [ ] Sync cursor.
- [ ] Server revision.
- [ ] Client revision.
- [ ] Mutation queue.
- [ ] Idempotency.
- [ ] Retry backoff.
- [ ] Partial sync.
- [ ] Full resync.
- [ ] Conflict detection.
- [ ] Corruption/recovery state.

Для каждого домена отдельно определить:

- server-wins;
- client-wins;
- merge;
- manual resolution.

**Одна глобальная conflict strategy недопустима.**

### Offline scope

- [ ] Drafts.
- [ ] Pending chat messages.
- [ ] Work notes.
- [ ] Calendar cache.
- [ ] Cached profiles.
- [ ] Read states.
- [ ] Social drafts.

---

# P1 — Attachments / Media

## 18. Upload Pipeline

- [ ] Upload session.
- [ ] Size validation.
- [ ] MIME validation.
- [ ] Content validation.
- [ ] Filename sanitization.
- [ ] Access control.
- [ ] Resumable uploads.
- [ ] Retry.
- [ ] Orphan cleanup.
- [ ] Thumbnail pipeline.
- [ ] Storage quotas.
- [ ] Download authorization.

---

# P1 — Search

## 19. Global Search

Индексируемые домены:

- [ ] People.
- [ ] Posts.
- [ ] Comments.
- [ ] Communities.
- [ ] Companies.
- [ ] Channels.
- [ ] Events.
- [ ] Documents.
- [ ] Public metadata.

E2E message search остаётся локальным по расшифрованным данным, если сервер не получает plaintext.

Технически:

- [ ] Incremental indexing.
- [ ] Delete propagation.
- [ ] Update propagation.
- [ ] Rebuild.
- [ ] Stale-index detection.
- [ ] Cursor pagination.
- [ ] Privacy-aware filtering.

---

# P1 — Observability

## 20. Structured Logging

Каждый серверный request по возможности связывать через:

`request_id → domain event → mutation → error`

- [ ] Structured logs.
- [ ] Request ID.
- [ ] Event ID.
- [ ] User/account identifier в безопасной форме.
- [ ] Error category.
- [ ] No passwords/tokens/private keys/plaintext E2E messages in logs.

## 21. Metrics

Минимальный набор:

- [ ] API latency.
- [ ] Error rate.
- [ ] Auth failures.
- [ ] Rate-limit hits.
- [ ] Notification delivery.
- [ ] Message delivery.
- [ ] Sync failures.
- [ ] Calculation failures.
- [ ] Migration status.
- [ ] Storage failures.
- [ ] Deployment status.

## 22. Health

- [ ] Health endpoint.
- [ ] DB health.
- [ ] Directory API health.
- [ ] Storage health.
- [ ] Deployment health.
- [ ] Dependency health.

---

# P1 — Testing Strategy

## 23. Unit Tests

Обязательно покрыть:

- [ ] Payroll/tax.
- [ ] Shift calculations.
- [ ] Absence.
- [ ] Date/time/DST.
- [ ] Permissions.
- [ ] Identity normalization.
- [ ] Search.
- [ ] Friend-request state machine.
- [ ] Notifications.
- [ ] E2E key lifecycle.
- [ ] Sync/conflict resolution.

## 24. Integration Tests

- [ ] Auth.
- [ ] OnePass/WebAuthn.
- [ ] Directory API.
- [ ] D1 migrations.
- [ ] Social graph.
- [ ] Notifications.
- [ ] Personal chat.
- [ ] Group chat.
- [ ] Corporate channels.
- [ ] Attachments.
- [ ] Work/payroll.

## 25. Invariants

Автоматически проверять:

- [ ] Payroll никогда не возвращает NaN/Infinity.
- [ ] Невозможный баланс отклоняется.
- [ ] Duplicate friendship невозможен.
- [ ] Duplicate username невозможен.
- [ ] Unauthorized resource access невозможен.
- [ ] Expired auth challenge отклоняется.
- [ ] E2E identity сохраняется после обновления.
- [ ] Critical mutations безопасно повторяются.
- [ ] Migration validation проходит.
- [ ] Deep links не ломаются.

---

# P1 — CI/CD & Release Safety

## 26. Required Pipeline

Каждый production change должен проходить:

1. [ ] dependency install;
2. [ ] tests;
3. [ ] typecheck;
4. [ ] build;
5. [ ] migration validation, если затронута schema;
6. [ ] deploy;
7. [ ] production smoke test;
8. [ ] deployment status verification.

### Release rules

- [ ] Версия изменяется явно.
- [ ] Production releases имеют immutable tag.
- [ ] Рискованные миграции требуют backup.
- [ ] Есть rollback/recovery plan.
- [ ] Сохраняются build/deploy logs.
- [ ] Failed deploy не считается успешным релизом.

---

# P1 — Performance

## 27. Client

- [ ] Background polling audit.
- [ ] Visibility-aware refresh.
- [ ] Abort stale requests.
- [ ] Code splitting.
- [ ] Lazy media.
- [ ] Client cache.
- [ ] Memory leak audit.
- [ ] Render cost audit.
- [ ] Bundle budget.

## 28. Server / D1

- [ ] Query profiling.
- [ ] N+1 audit.
- [ ] Index audit.
- [ ] Feed cursor pagination.
- [ ] Chat pagination.
- [ ] Notification pagination.
- [ ] Bounded result sets.

Правило: большие коллекции никогда не должны безусловно загружаться целиком.

---

# P2 — Admin / Audit

## 29. Immutable Audit Log

Для критичных действий фиксировать:

- actor;
- target;
- action;
- timestamp;
- reason;
- request ID;
- before/after metadata;
- result.

Обязательно для:

- [ ] удаления;
- [ ] изменения ролей;
- [ ] revoke sessions;
- [ ] revoke credentials;
- [ ] финансовых корректировок;
- [ ] массовых операций;
- [ ] security actions.

Критичная mutation должна иметь:

`permission check + confirmation + audit event + idempotency`

---

# P2 — Privacy & Data Lifecycle

## 30. Data Lifecycle

- [ ] Data classification.
- [ ] Sensitive-field inventory.
- [ ] Retention policy.
- [ ] Deletion policy.
- [ ] Account deletion.
- [ ] Media cleanup.
- [ ] Session cleanup.
- [ ] Orphan cleanup.
- [ ] Export policy.
- [ ] Privacy enforcement tests.

Особое правило: удаление пользователя не должно оставлять бесконтрольные orphan records или раскрывать приватные данные через старые deep links/cache/search indexes.

---

# P2 — Internal Architecture

## 31. Target Boundary

Постепенно двигаться к:

`UI → application services → domain logic → data/API`

Основные домены:

- [ ] identity;
- [ ] auth;
- [ ] permissions;
- [ ] social graph;
- [ ] feed;
- [ ] communities;
- [ ] messaging;
- [ ] notifications;
- [ ] work;
- [ ] payroll;
- [ ] absence;
- [ ] search;
- [ ] files;
- [ ] sync.

### Правило рефакторинга

Не создавать новую абстракцию только ради архитектурной красоты. Выделять модуль тогда, когда он:

- имеет собственные инварианты;
- имеет повторяемую бизнес-логику;
- имеет собственные тесты;
- имеет чёткую границу ответственности.

---

# 32. Приоритетный execution plan

## Phase 1 — Correctness

**Цель:** убрать риски потери/искажения данных.

1. [ ] Audit calculation engine.
2. [ ] Зафиксировать payroll formulas/rounding.
3. [ ] Выделить pure calculation functions.
4. [ ] Audit shift/absence edge cases.
5. [ ] Audit permissions.
6. [ ] Укрепить WTinkID/username uniqueness + normalization.
7. [ ] Audit friend-request state machine.
8. [ ] Проверить notification consistency.
9. [ ] E2E identity continuity tests.
10. [ ] D1 integrity/migration validation.

**Exit criteria:** критичные domain invariants покрыты regression tests; production data не требует ручной коррекции для штатных сценариев.

## Phase 2 — Reliability

1. [ ] Unified API errors.
2. [ ] Request IDs.
3. [ ] Idempotency keys.
4. [ ] Message retry/deduplication.
5. [ ] Notification event pipeline.
6. [ ] Offline mutation queue.
7. [ ] Sync cursor.
8. [ ] Attachment retry/cleanup.
9. [ ] Structured logging.
10. [ ] Health checks.

**Exit criteria:** основные transient failures восстанавливаются автоматически, а постоянные ошибки диагностируются по request/event ID.

## Phase 3 — Security

1. [ ] Unified permission evaluator.
2. [ ] Negative authorization suite.
3. [ ] Session/device audit.
4. [ ] OnePass/WebAuthn hardening.
5. [ ] Credential/session revoke.
6. [ ] Admin audit log.
7. [ ] Privacy/data lifecycle enforcement.

**Exit criteria:** каждый критичный resource/action имеет формализованное authorization rule и negative test.

## Phase 4 — Scale

1. [ ] Global search.
2. [ ] Feed cursor pagination.
3. [ ] Chat history pagination.
4. [ ] Notification pagination.
5. [ ] D1 index/query audit.
6. [ ] Background cleanup.
7. [ ] Metrics.
8. [ ] Client bundle/memory audit.

**Exit criteria:** рост объёма данных не приводит к линейному росту размера одного request/render.

## Phase 5 — Architecture

1. [ ] Domain boundaries.
2. [ ] Application services.
3. [ ] Shared API contracts.
4. [ ] Event contracts.
5. [ ] Shared validation primitives.
6. [ ] Remove duplicated business logic.
7. [ ] Reduce App.tsx orchestration responsibility.

**Exit criteria:** новые функции можно добавлять в конкретный domain module без изменения несвязанных систем.

---

# 33. Definition of Done

Внутренняя система считается завершённой, если:

- [ ] есть формальная модель данных;
- [ ] определён source of truth;
- [ ] определены authorization rules;
- [ ] определены invariants;
- [ ] есть error/retry strategy;
- [ ] есть idempotency strategy для критичных mutations;
- [ ] есть migration/backward compatibility strategy;
- [ ] есть unit tests;
- [ ] есть integration/regression tests;
- [ ] есть observability;
- [ ] есть документация;
- [ ] CI проходит;
- [ ] production deploy проходит;
- [ ] smoke test проходит;
- [ ] существующие данные сохраняются;
- [ ] E2E identity сохраняется;
- [ ] существующие deep links продолжают работать.

---

# 34. Красные флаги

Следующие изменения нельзя вливать в production без отдельной проверки:

- изменение payroll formulas;
- изменение identity model;
- изменение E2E key storage;
- изменение session/auth lifecycle;
- destructive D1 migration;
- изменение permission semantics;
- массовое удаление;
- изменение notification event schema;
- изменение message ID/order semantics;
- изменение sync conflict strategy.

Для каждого такого изменения обязательны:

**backup → tests → migration/compatibility check → CI → deploy → smoke verification.**

---

# 35. Главный порядок работы

> **Корректность → безопасность → надёжность → наблюдаемость → производительность → масштабирование → новые возможности.**

WTinker должен развиваться как единая социально-рабочая платформа, но внутренние системы должны оставаться консервативными там, где цена ошибки — потеря аккаунта, рабочего расчёта, сообщения, E2E identity или доступа к данным.

> **Не переписываем то, что уже работает. Усиливаем границы, инварианты и надёжность — и только затем расширяем систему.**


---

# v7.0.0 — Product Completion Program

v7 — это не новый набор CSS поверх v6. Это завершение перехода на единую продуктовую систему при сохранении существующей доменной логики.

## 19. Product Surface Contract

Каждый production-экран обязан использовать один визуальный язык:

- [ ] единая типографическая шкала;
- [ ] единая сетка отступов;
- [ ] единые controls и focus states;
- [ ] единые card/table/list primitives;
- [ ] единая цветовая семантика success/warning/danger/info;
- [ ] единые loading/empty/error/offline states;
- [ ] 44px touch targets на мобильных сценариях;
- [ ] keyboard navigation;
- [ ] reduced-motion;
- [ ] light/dark parity;
- [ ] отсутствие декоративных градиентов, glassmorphism и случайных визуальных паттернов.

## 20. v7 Screen Completion

### Home
- [ ] Один главный контекст: сегодня, следующая смена, деньги, отсутствие.
- [ ] Вторичные действия не конкурируют с главным контентом.
- [ ] Рабочие метрики остаются точными и компактными.
- [ ] Social activity является частью рабочего контекста.

### Social
- [ ] Composer, feed и filters используют общий surface system.
- [ ] Post card имеет стабильную иерархию автора → контент → actions.
- [ ] Comments, mentions, attachments и states не ломают layout.
- [ ] Empty/loading/error/retry оформлены одинаково.

### People
- [ ] Search by WTinkID and username is first-class.
- [ ] Exact match is visually obvious.
- [ ] Relationship state and actions are explicit.
- [ ] Public profile keeps authenticated «Отправить заявку».

### Communities
- [ ] Directory and detail share one card grammar.
- [ ] Membership state is visible before action.
- [ ] Feed, members and events have clear hierarchy.
- [ ] Admin controls are permission-aware.

### Chats
- [ ] Personal, group and corporate modes feel like one product.
- [ ] E2E state is visible but quiet.
- [ ] Composer, attachments, replies and reactions share one interaction model.
- [ ] Mobile chat is full-screen and keyboard-safe.

### Work
- [ ] Calendar, payroll and absence use the same information hierarchy.
- [ ] Dense data remains dense where precision matters.
- [ ] Financial numbers use stable formatting.
- [ ] No visual treatment obscures calculations.

### Notifications
- [ ] One activity center.
- [ ] Read/unread state is unmistakable.
- [ ] Deep-link action is predictable.
- [ ] Internal, social, chat and work events share one event presentation.

### Profile / Settings / Security
- [ ] Identity, work profile and security are clearly separated.
- [ ] Sessions, OnePass/WebAuthn and E2E identity continuity remain accessible.
- [ ] Destructive actions require explicit confirmation.
- [ ] Account state and privacy controls are understandable.

## 21. v7 Reliability Gate

Production release is valid only when all of the following pass:

- [ ] unit/regression tests;
- [ ] TypeScript build;
- [ ] Vite production build;
- [ ] Directory API deploy;
- [ ] Directory API /health smoke test;
- [ ] GitHub Pages deploy;
- [ ] deployed application smoke test;
- [ ] auth/login smoke test;
- [ ] WTinkID + username search regression;
- [ ] friend request regression;
- [ ] E2E identity continuity regression;
- [ ] payroll/calculation regression;
- [ ] deep-link regression;
- [ ] mobile layout regression;
- [ ] version metadata reports 7.0.0.

## 22. v7 Release Rules

1. Never call v7 released while CI is red.
2. Never change calculation semantics as part of a visual-only refactor.
3. Never replace E2E identity storage during UI migration.
4. Never remove a legacy URL without an explicit compatibility path.
5. Every destructive data change requires backup and migration validation.
6. Release tag v7.0.0 is created only from the verified production commit.
7. Backup branch backup/pre-v7-2026-09-30 remains immutable.

## 23. v7 Definition of Done

v7 is complete when the application feels like one product from login through profile, social, people, communities, chats, work and settings — while existing data, calculations, identity, E2E, permissions, APIs and deep links continue to work unchanged.
