# WTinker v6 Design Decision Log

## D-001 — Social-first, Work-preserving
WTinker is presented as a work-focused social network, but Work OS remains the system of record for operational workflows.

## D-002 — One navigation model
The product is organized as Home → Social → People → Communities → Chats → Work → Notifications → Profile.

## D-003 — Professional product UI
Avoid AI-slop visual patterns: excessive gradients, giant decorative hero blocks, random glass cards, noisy shadows and ornamental effects.

## D-004 — Dense work UI stays dense
Payroll, schedules and data tables prioritize precision, scanning and correctness over visual spectacle.

## D-005 — Chat modes must remain obvious
Personal, Groups and Corporate Channels are peers in the Chats information architecture and must stay visible on mobile.

## D-006 — Identity continuity
WTinkID, username, OnePass/WebAuthn, sessions and E2E identity/key continuity are preserved.

## D-007 — Incremental implementation
The concept lives in this isolated directory first. Production implementation should be incremental and reversible.

## D-008 — v6 is not a data migration
The redesign changes presentation and information architecture; it must not silently discard or transform existing user/work data.
