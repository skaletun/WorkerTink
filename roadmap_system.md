# WTinker — Internal Systems Roadmap

> Roadmap по развитию внутренних систем WTinker после v6.0.0. Фокус — корректность данных, расчёты, безопасность, API, E2E, уведомления, поиск, синхронизация, observability и эксплуатационная надёжность.

## Принципы
- Не ломать существующие данные, URL, API и E2E identity.
- Сервер — источник истины для авторизации, прав и критичных расчётов.
- Любая миграция БД должна быть безопасной, проверяемой и совместимой с предыдущей схемой.
- Критичные операции должны быть идемпотентными и аудируемыми.
- Сначала корректность и надёжность, затем масштабирование и новые возможности.

## P0 — Core Integrity

### State / Storage
- [ ] Аудит `storage.ts` и текущей схемы State.
- [ ] Формализовать версии локальной схемы и migration pipeline.
- [ ] Добавить проверки целостности после миграций.
- [ ] Безопасно восстанавливать повреждённое локальное состояние.
- [ ] Обработать IndexedDB/localStorage quota и storage errors.
- [ ] Добавить regression tests для всех существующих schema versions.

### Date / Time
- [ ] Единая политика timezone.
- [ ] Разделить local date и абсолютные timestamps.
- [ ] Проверить DST.
- [ ] Проверить ночные смены, переходы месяца/года и невалидные даты.

### Server / Client consistency
- [ ] Определить authoritative source для каждого домена.
- [ ] Единый error model.
- [ ] Request IDs.
- [ ] Idempotency keys для mutation-запросов.
- [ ] Optimistic update rollback.
- [ ] Conflict/stale-data detection.

## P0 — Calculation Engine

Цель — вынести критичные расчёты из UI в детерминированные domain functions.

### Payroll
- [ ] Единый calculation engine.
- [ ] Snapshot входных параметров.
- [ ] Ставки, часы, ночные, выходные, праздники, переработки.
- [ ] Авансы, налоги, удержания и округления.
- [ ] История расчётов.
- [ ] Версия алгоритма расчёта.
- [ ] Запрет пересчёта исторических результатов новым алгоритмом без явной миграции.
- [ ] Regression fixtures для реальных пограничных случаев.
- [ ] Проверки на NaN, Infinity и невозможные отрицательные значения.

### Shifts
- [ ] Единая модель смены.
- [ ] Timezone-aware start/end.
- [ ] Overnight shift support.
- [ ] Overlap/duplicate detection.
- [ ] Swap state machine.
- [ ] Approval/rejection.
- [ ] Immutable history критичных изменений.

### Absence
- [ ] Единый engine отпусков и больничных.
- [ ] Проверка пересечений.
- [ ] Рабочие/нерабочие дни.
- [ ] Лимиты и переносы.
- [ ] Approval state machine.

## P0 — Identity / Auth / Security

### Identity
- [ ] WTinkID — immutable identifier.
- [ ] Username uniqueness и normalization policy.
- [ ] Reserved usernames.
- [ ] Audit trail изменений identity.

### Sessions
- [ ] Session rotation.
- [ ] Expiration.
- [ ] Revoke all sessions.
- [ ] Device/session registry.
- [ ] Rate limiting и lockout.
- [ ] Security events.

### OnePass / WebAuthn
- [ ] Аудит challenge lifecycle и expiry.
- [ ] Replay protection.
- [ ] Credential uniqueness.
- [ ] Device management.
- [ ] Credential revoke.
- [ ] Recovery flow.
- [ ] Multi-device regression tests.
- [ ] Проверка поведения после deploy/update/migration.

**Критично:** deploy или migration никогда не должны автоматически создавать новую E2E identity.

## P0 — Permissions

- [ ] Единый permission evaluator.
- [ ] Формальная RBAC/resource ownership модель.
- [ ] Company/community/channel scope.
- [ ] Membership checks.
- [ ] Admin scope.
- [ ] Negative authorization tests.
- [ ] Cross-company access tests.
- [ ] Blocked/deleted/expired-member access tests.

### Permission matrix
| Resource | Owner | Admin | Manager | Moderator | Member |
|---|---:|---:|---:|---:|---:|
| Profile | full | limited | — | — | own |
| Community | full | full | scoped | moderate | read |
| Channel | full | full | scoped | moderate | scoped |
| Work data | own | audit | scoped | — | own |
| Payroll | own | audit | scoped | — | own |

## P0 — People / Directory / Search

### People search
- [ ] Поиск по WTinkID.
- [ ] Поиск по username.
- [ ] Имя, компания, должность, подразделение.
- [ ] Exact-match priority.
- [ ] Case-insensitive username lookup.
- [ ] Pagination.
- [ ] Privacy/block filtering.
- [ ] Rate limiting.

### Global search
- [ ] People.
- [ ] Posts/comments.
- [ ] Communities/companies/channels.
- [ ] Events/documents.
- [ ] Local decrypted message search.
- [ ] Incremental indexing.
- [ ] Delete/update propagation.
- [ ] Rebuild и stale-index detection.

## P0 — Social Graph

- [ ] Friend-request state machine.
- [ ] Duplicate request prevention.
- [ ] Accept/reject/cancel.
- [ ] Block precedence.
- [ ] Friendship uniqueness.
- [ ] Follow/subscribe model.
- [ ] Mutual connections.
- [ ] Relationship cache.
- [ ] Relationship event log.
- [ ] Transactional notification creation.

### Public profile flow
- [ ] Privacy checks.
- [ ] Authenticated `Отправить заявку`.
- [ ] Duplicate request handling.
- [ ] Blocked-user handling.
- [ ] Deep-link compatibility.

## P1 — Notifications / Event Bus

Перейти от разрозненных вызовов уведомлений к единой domain-event модели.

### Events
- [ ] friend.request.created
- [ ] friend.request.accepted
- [ ] post.created
- [ ] reaction.created
- [ ] comment.created
- [ ] mention.created
- [ ] message.created
- [ ] shift.changed
- [ ] payroll.updated
- [ ] absence.created
- [ ] security.event

Для каждого события определить ID, actor, target, timestamp, schema version и idempotency.

### Notification pipeline
- [ ] Event → policy → inbox → push/desktop.
- [ ] Deduplication.
- [ ] Batching.
- [ ] Priority.
- [ ] Mute settings.
- [ ] Read state.
- [ ] Deep links.
- [ ] Retry и failure tracking.

## P1 — Messaging / E2E Reliability

### E2E identity
- [ ] Formalize identity lifecycle.
- [ ] Durable IndexedDB vault.
- [ ] localStorage migration compatibility.
- [ ] Identity continuity tests.
- [ ] Backup/restore.
- [ ] Multi-device model.

### Group keys
- [ ] Key versioning.
- [ ] Rotation при изменении состава.
- [ ] Member removal.
- [ ] Recovery.
- [ ] Stale-key detection.
- [ ] Concurrent membership change tests.

### Message reliability
- [ ] Pending state.
- [ ] Delivery state.
- [ ] Retry with backoff.
- [ ] Deduplication.
- [ ] Ordering.
- [ ] Offline queue.
- [ ] Attachment retry.
- [ ] Failed-message recovery.

## P1 — Offline / Synchronization

- [ ] Sync cursor.
- [ ] Server/client revision.
- [ ] Conflict detection.
- [ ] Mutation queue.
- [ ] Retry backoff.
- [ ] Idempotency.
- [ ] Partial sync.
- [ ] Full resync.

Для каждого домена определить стратегию конфликта: server-wins, client-wins, merge или manual resolution. Не использовать одну стратегию для всех данных.

Offline scope:
- [ ] Calendar.
- [ ] Work notes.
- [ ] Drafts.
- [ ] Pending chat messages.
- [ ] Cached profiles.
- [ ] Read states.
- [ ] Social drafts.

## P1 — API / D1

### API contracts
- [ ] Versioned contracts.
- [ ] Typed request/response schemas.
- [ ] Consistent error codes.
- [ ] Pagination/cursor contract.
- [ ] Auth middleware.
- [ ] Authorization middleware.
- [ ] Rate limits.

### D1
- [ ] Audit schema.
- [ ] Foreign-key strategy.
- [ ] Index audit.
- [ ] Query profiling.
- [ ] Migration ordering.
- [ ] Migration verification.
- [ ] Backup procedure.
- [ ] Restore procedure.

### Data integrity
- [ ] Uniqueness constraints.
- [ ] NOT NULL where required.
- [ ] CHECK constraints.
- [ ] Referential integrity.
- [ ] Soft-delete policy.
- [ ] Retention policy.

## P1 — Attachments / Media

- [ ] Upload sessions.
- [ ] Size/MIME/content validation.
- [ ] Filename sanitization.
- [ ] Resumable uploads.
- [ ] Retry.
- [ ] Orphan cleanup.
- [ ] Access-controlled downloads.
- [ ] Thumbnail pipeline.
- [ ] Storage quotas.

## P1 — Observability

### Logs
- [ ] Structured logs.
- [ ] Request ID.
- [ ] Domain event ID.
- [ ] Error category.
- [ ] No secrets in logs.

### Metrics
- [ ] API latency.
- [ ] Error rate.
- [ ] Auth failures.
- [ ] Notification delivery.
- [ ] Message delivery.
- [ ] Sync failures.
- [ ] Calculation failures.
- [ ] Migration status.
- [ ] Storage failures.

### Health
- [ ] Health endpoint.
- [ ] DB health.
- [ ] Dependency health.
- [ ] Event/queue health.
- [ ] Deployment health.

## P1 — Testing

### Unit
- [ ] Payroll/tax.
- [ ] Shifts/absence.
- [ ] Dates.
- [ ] Permissions.
- [ ] Notifications.
- [ ] Search normalization.
- [ ] Identity migration.
- [ ] E2E key lifecycle.

### Integration
- [ ] Auth.
- [ ] OnePass.
- [ ] Directory API.
- [ ] D1 migrations.
- [ ] Social graph.
- [ ] Notifications.
- [ ] Chat.
- [ ] Attachments.

### Invariants
- [ ] Payroll never returns NaN/Infinity.
- [ ] Impossible balances rejected.
- [ ] Duplicate friendships impossible.
- [ ] Duplicate usernames impossible.
- [ ] Unauthorized resource access impossible.
- [ ] Expired challenges rejected.
- [ ] Existing E2E identity remains recoverable.
- [ ] Migrations are idempotent.

## P1 — CI/CD & Release Safety

- [ ] lint.
- [ ] typecheck.
- [ ] unit tests.
- [ ] integration tests.
- [ ] build.
- [ ] migration validation.
- [ ] deployment.
- [ ] production smoke tests.
- [ ] immutable release tags.
- [ ] backup before risky migrations.
- [ ] rollback procedure.
- [ ] Artifact/error-log retention.

Каждый production deploy считается успешным только после фактического успешного build + deploy + smoke verification.

## P2 — Admin / Audit

- [ ] Immutable audit log.
- [ ] Actor/target/action/timestamp.
- [ ] Reason.
- [ ] Before/after metadata.
- [ ] Admin session controls.
- [ ] Bulk operation safeguards.

Для удаления, изменения ролей, revoke sessions/credentials, финансовых корректировок и массовых операций обязательны permission check, confirmation, audit event и idempotency.

## P2 — Performance

- [ ] API query profiling.
- [ ] D1 index audit.
- [ ] N+1 audit.
- [ ] Feed cursor pagination.
- [ ] Chat history pagination.
- [ ] Notification pagination.
- [ ] Lazy media.
- [ ] Client caching.
- [ ] Code splitting.
- [ ] Bundle budget.
- [ ] Memory leak audit.
- [ ] Background polling audit.
- [ ] Visibility-aware refresh.

Правила: inactive tab не должен постоянно опрашивать API; большие коллекции нельзя загружать целиком; тяжёлые расчёты не должны выполняться во время render.

## P2 — Privacy / Data Lifecycle

- [ ] Data classification.
- [ ] Sensitive-fields inventory.
- [ ] Retention policy.
- [ ] Deletion policy.
- [ ] Account deletion.
- [ ] Media cleanup.
- [ ] Session cleanup.
- [ ] Orphan cleanup.
- [ ] Export policy.
- [ ] Privacy enforcement tests.

## P2 — Internal Architecture

Постепенно двигаться к границе:

`UI → application services → domain logic → data/API`

Domain modules:
- [ ] identity
- [ ] auth
- [ ] permissions
- [ ] social graph
- [ ] feed
- [ ] communities
- [ ] messaging
- [ ] notifications
- [ ] work
- [ ] payroll
- [ ] absence
- [ ] search
- [ ] files
- [ ] sync

Не делать big-bang rewrite. Каждый модуль выделять вокруг уже работающего поведения.

## Приоритет внедрения

### Sprint 1 — Correctness
1. [ ] Аудит payroll/calculation logic.
2. [ ] Зафиксировать формулы, округления и пограничные случаи.
3. [ ] Вынести критичные расчёты в pure functions.
4. [ ] Permission matrix audit.
5. [ ] WTinkID/username uniqueness + search normalization.
6. [ ] Friend-request state machine audit.
7. [ ] Notification consistency audit.
8. [ ] E2E identity continuity tests.
9. [ ] D1 migration integrity check.
10. [ ] Critical negative authorization tests.

### Sprint 2 — Reliability
1. [ ] Unified API errors.
2. [ ] Request/idempotency IDs.
3. [ ] Offline mutation queue.
4. [ ] Sync cursor.
5. [ ] Message retry/deduplication.
6. [ ] Notification event pipeline.
7. [ ] Attachment retry/cleanup.
8. [ ] Structured logging.

### Sprint 3 — Scale
1. [ ] Global search.
2. [ ] Feed indexing/pagination.
3. [ ] Chat history pagination.
4. [ ] Notification pagination.
5. [ ] DB index audit.
6. [ ] Background cleanup jobs.
7. [ ] Metrics dashboard.

## Definition of Done

Внутренняя система считается готовой, если:
- [ ] есть формальная модель данных;
- [ ] определён source of truth;
- [ ] определены authorization rules;
- [ ] есть error/retry strategy;
- [ ] есть idempotency strategy для критичных mutations;
- [ ] есть migration/backward compatibility strategy;
- [ ] есть unit + integration/regression tests;
- [ ] есть logging/telemetry;
- [ ] есть документация;
- [ ] CI проходит;
- [ ] production smoke test проходит;
- [ ] существующие данные, E2E identity и deep links продолжают работать.

## Главный принцип

> **Корректность → надёжность → безопасность → масштабирование → новые возможности.**

WTinker должен развиваться без потери существующих аккаунтов, рабочих данных, расчётов, чатов, E2E identity и API.