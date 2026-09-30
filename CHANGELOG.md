# Changelog

## 7.2.0 — 2026-10-01

Release build consolidating the WTinker 7.x product and UI work already merged to `main`, including the post-review correctness and authorization hardening.

### Included

- Refined calendar, profiles, spaces and rich/flexible posts.
- Profile and community cover/banner customization, including corporate-channel customization APIs.
- Shift notes and related date validation/API regression coverage.
- Sidebar profile identity now shows avatar, name and username without the job title.
- Mobile shift/note editor is layered above the fixed bottom navigation so editor actions remain reachable.
- Expanded system/social regression and integrity checks for the new surfaces.
- Hardened chat SQL, private-resource authorization, social post visibility, verification state transitions, username uniqueness and push preferences.
- Removed tracked Wrangler/TypeScript build artifacts and aligned local API development with the production Directory API.

### Release metadata

- Application/package version: `7.2.0`
- Git branch: `main`
- Verified application baseline commit: `75cad85526e97acea296559f75336e557b562f98` (subsequent release-metadata commit contains no runtime changes).
