# WTinker v6.0.0 — Complete Redesign Concept

## Status
This directory is the canonical v6 redesign concept. The standalone prototype is now a production-level visual/interaction prototype for validating the v6 shell and screen behavior before wiring the surfaces into the real application. It is intentionally isolated from the current application implementation: v6 is designed here first, then implemented incrementally without deleting or rewriting existing Work OS behavior.

## Product direction
WTinker becomes a **social network for work**. Social interaction becomes the primary interface while Work OS remains the operational foundation.

### Information architecture
Home → Social → People → Communities → Chats → Work → Notifications → Profile

## Non-negotiable preservation
The redesign MUST preserve:
- WTinkID and username identity/search
- profiles, publications, feed, comments, reactions, mentions
- friends, requests, communities, events, notifications
- personal E2E chats
- group E2E chats and group keys
- corporate channels, roles, permissions, invitations
- attachments, voice messages, replies, edits, read state, pins/reactions
- schedules, shifts, payroll, tax, advances, balances
- absences, vacations, sick leave
- work notes, documents, teams, events and shift swaps
- OnePass/WebAuthn/passkeys, sessions and security
- Directory API
- responsive web/PWA/push
- Electron Desktop and existing delivery/deployment pipeline

## Design principles
1. Human-designed, professional product UI. No generic AI-looking gradients, excessive glassmorphism, ornamental noise or decorative cards.
2. Information density is intentional: social content is expressive; work data is precise.
3. One coherent navigation model across desktop and mobile.
4. Every important screen has loading, empty, error, permission and offline states.
5. Accessibility is part of the component contract.
6. Light and dark themes are first-class.
7. Existing data and URLs remain compatible wherever possible.
8. New v6 UI should be implemented as replaceable surfaces around existing domain logic, not as a risky rewrite.

## Visual direction
- Base: neutral cool-white / charcoal surfaces.
- Accent: restrained blue.
- Typography: Inter/system fallback.
- Cards: 16–20px radius, subtle 1px borders, low elevation.
- Controls: 10–12px radius.
- No oversized marketing-style hero blocks inside operational screens.
- Strong hierarchy through type, spacing and alignment rather than decoration.
- Motion: 160ms feedback, 220ms standard, 280ms page transitions; respect reduced-motion.

## Screen set
01 Home
02 Social
03 People
04 Communities
05 Chats
06 Work
07 Notifications
08 Profile
09 Mobile system

See the companion files in this folder for exact screen contracts, tokens, components, responsive rules and implementation mapping.

## Prototype capabilities
The standalone `prototype.html` is intentionally dependency-free and demonstrates the intended product behavior, not just static screenshots:
- responsive desktop/tablet/mobile shell with persistent mobile navigation
- light/dark theme with persisted preference
- command/search palette with keyboard shortcut
- Home, Social, People, Communities, Chats, Work, Notifications and Profile surfaces
- Social feed tabs, reactions and composer flow
- People search by WTinkID or username plus authenticated-style “Отправить заявку” interaction
- Personal / Groups / Channels chat switcher, chat selection and local message composition
- Work schedule, payroll summary, dense data table and operational cards
- notifications read-state interaction
- create modal, profile menu, toasts, focus states and Escape handling
- reduced-motion support and 44px+ mobile interaction targets

The prototype remains isolated from production application code and uses mock data by design.
