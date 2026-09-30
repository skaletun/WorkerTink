# v6 Implementation Map

The v6 concept is isolated from production code until each surface is validated.

## Existing code mapping
- App shell/navigation → src/App.tsx + existing shell styles
- Global visual layer → src/design.css
- Social/feed → existing network/social components
- People/profiles → existing people/profile components
- Chats → ChatView.tsx, ChatsHub.tsx and group/channel components
- Work OS → existing schedule/payroll/absence/note/document/team modules
- Notifications → existing notification system
- Auth/security → existing OnePass/WebAuthn/session/E2E modules

## Migration rule
Do not replace domain logic merely to change presentation.

Preferred sequence:
1. Introduce v6 tokens/components behind isolated classes.
2. Build the new shell.
3. Migrate Home.
4. Migrate Social.
5. Migrate People.
6. Migrate Communities.
7. Migrate Chats.
8. Migrate Work surfaces.
9. Migrate Notifications.
10. Migrate Profile/settings.
11. Remove only dead styling after parity is verified.

## Verification gate per surface
- Existing behavior tests pass.
- Typecheck passes.
- Production build passes.
- Mobile layout reviewed.
- Dark mode reviewed.
- Permission states reviewed.
- Existing URLs/deep links preserved.
- No data migration unless explicitly required.
- No duplicate polling/state update loops.
