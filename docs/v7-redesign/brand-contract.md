# WTinker v7 — Brand & Product Contract

## Positioning

**WTinker — социальная сеть для работы.**

Не «Work OS с социальной лентой», а social product, в котором рабочие действия являются частью контекста человека, команды и сообщества.

### Core loop

**People → Feed → Community → Conversation → Work action**

Пользователь приходит в WTinker, чтобы видеть людей и события вокруг себя, общаться, делиться опытом и сразу выполнять связанные рабочие действия.

## Information architecture

1. Главная
2. Лента
3. Люди
4. Сообщества
5. Чаты
6. Работа
7. Уведомления
8. Профиль

### Social layer

- posts
- comments
- reactions
- mentions
- people
- profiles
- communities
- events
- personal chats
- group chats
- corporate channels

### Work layer

- shifts
- calendar
- payroll
- advances
- taxes
- absences
- vacation
- sick leave
- notes
- documents
- teams
- shift swaps

Work features must be reachable from social context without duplicating business logic.

## Brand language

Use **WTinker** in all user-facing product copy.

Preferred terminology:

- «Лента», not «Социальная сеть»
- «Люди», not «Каталог сотрудников»
- «Сообщества», not «Рабочие группы» when the entity is social
- «Чаты», not «Сообщения»
- «Работа», not «Work OS»
- «Профиль», not «Личная карточка»
- «Рабочий контур» only where a distinction from the social layer is useful

Technical identifiers may remain `workertink` for compatibility.

## Visual identity

### Colors

- Ink: `#151922`
- Background: `#f6f7f9`
- Surface: `#ffffff`
- Line: `#e3e6eb`
- Accent: `#2563eb`
- Accent soft: `#eaf1ff`

Dark mode remains first-class.

### Typography

Inter/system sans-serif.

Hierarchy should be created through weight, size and spacing — not decorative containers.

### UI character

- editorial social feed
- compact professional navigation
- restrained borders
- low elevation
- clear avatars and identity
- 44px minimum touch targets
- strong keyboard focus
- reduced-motion support

### Avoid

- decorative gradients
- glassmorphism
- excessive pills
- giant hero illustrations
- meaningless dashboard cards
- generic AI-generated visual language

## Rebrand compatibility

Do not rename without migration:

- GitHub Pages path `/WorkerTink/`
- Directory API host
- localStorage keys
- E2E vault/key prefixes
- existing public URLs
- existing database identifiers
- existing package/repository technical names

The visible product brand and technical infrastructure are intentionally separated.