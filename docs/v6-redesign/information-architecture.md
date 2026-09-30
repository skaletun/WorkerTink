# v6 Information Architecture

## Primary navigation
| Area | Purpose | Existing capability retained |
|---|---|---|
| Home | Personal work/social overview | dashboard, presence, upcoming work |
| Social | Public work-social feed | publications, reactions, comments, mentions |
| People | Discover and connect | WTinkID + username search, profiles, friends |
| Communities | Interest/work communities | communities, events, members |
| Chats | Private/team/corporate communication | E2E personal/group chats, channels |
| Work | Operational Work OS | schedules, shifts, payroll, leave, docs, teams |
| Notifications | Unified activity inbox | internal notifications + system activity |
| Profile | Identity and personal workspace | profile, security, sessions, settings |

## Desktop shell
- Left navigation rail: 248–264px.
- Main content: max 1440px, fluid.
- Optional contextual right rail only on Social/Communities/Home.
- Persistent top utility row: search, create, notifications, profile.
- No duplicate navigation trees.

## Mobile shell
- Top bar: page title + contextual action.
- Bottom navigation: Home, Social, Chats, Work, Profile.
- Secondary destinations open from contextual sheets/drawers.
- Chat mode switcher exposes Personal / Groups / Channels explicitly.
- Touch targets >= 44px.

## Cross-area rules
- Search must find both WTinkID and username.
- Public profile links expose an authenticated “Отправить заявку” action where applicable.
- Notifications deep-link to the exact originating object.
- Social and Work entities can cross-link without duplicating records.
- Permissions are inherited from the existing domain model.
