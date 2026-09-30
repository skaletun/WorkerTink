# WTinker 7.0.0 — Product Redesign

v7 is the production completion of the WTinker product surface.

## Goals
- One coherent visual system across social, work, identity and communication.
- Real structural application shell instead of a CSS overlay.
- Preserve existing domain logic, data, URLs, E2E identity and calculations.
- Make mobile a first-class surface.
- Keep dense work data precise while giving social surfaces more breathing room.
- Remove ornamental AI-looking visual patterns: no gradients as decoration, no glassmorphism, no excessive pills.

## Product areas
1. Home — personal work cockpit.
2. Social — work feed and publishing.
3. People — WTinkID / username discovery and relationships.
4. Communities — groups, events and membership.
5. Chats — personal E2E, groups and corporate channels.
6. Work — schedule, payroll, absence, notes and teams.
7. Notifications — unified activity center.
8. Profile — identity, public profile and security.
9. Settings/Admin — account, sessions, OnePass/WebAuthn and administrative controls.

## Design language
- Cool neutral background.
- White/charcoal surfaces.
- Restrained blue action color.
- 8–16px control radii, 14–16px surfaces.
- Thin borders and low elevation.
- Compact typography with strong hierarchy.
- Accessible focus states.
- Reduced-motion support.
- Desktop sidebar + compact topbar.
- Mobile bottom navigation + full-screen task surfaces.

## Architecture
v7 uses V7Shell as the application composition layer. Existing domain components remain the source of business behavior; presentation is progressively normalized through v7.css.
The migration deliberately avoids rewriting payroll, authentication, E2E cryptography, Directory API or storage as part of a visual release.

## Release gate
The release is not considered complete until tests, typecheck, production build, Directory API health, Pages deployment and production smoke checks all succeed.