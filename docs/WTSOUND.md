# WTSound

WTSound is integrated into the authenticated WTinker app at `?tab=sound`, the bottom navigation and the application launcher. It uses WTinker authentication and themes. The player is mounted outside the route stage, so navigating to chats, work, profile or the calendar does not destroy the audio element.

## Implemented

- Personal music library; batch audio uploads; SHA-256 duplicate detection; embedded artist, title, album, genre, year, duration and cover extraction.
- Home, collection, favorites, playlists, albums, artists and downloads views; search; sorting; recent listening and a shuffled stream of the user's own available recordings.
- Playlist creation, naming, description, ordering, membership, deletion and JSON export. Imported playlists preserve the original sequence, including unavailable recordings.
- Persistent queue, seeking, previous/next, shuffle, repeat all/one/off and volume. A compact player and an expanded now-playing dialog share the same audio element.
- Ten-band Web Audio equalizer (32 Hz–16 kHz), eight presets, manual gains, preamp, automatic headroom and a peak compressor. Settings persist per account.
- Uploaded audio and extracted covers stored in IndexedDB (Blobs, with a byte-preserving ArrayBuffer fallback when WebKit refuses Blob serialization), separate from the application cache and E2E storage. Files play without a network connection and survive PWA shell updates. For offline WebKit media loads, the original audio bytes are exposed through an inline data URL because WebKit can reject newly opened blob media URLs while offline. The browser is asked for persistent storage; refusal does not falsely report persistence as granted. Clearing site data or OS storage eviction can still remove local files.
- Media Session title, artist, album and cover; lock-screen/headset actions for playback, seeking and track switching. Audio Session `playback` is used when available. No pause-on-hidden handler is installed.
- Transactional library mutations prevent two tabs from overwriting each other's additions; BroadcastChannel refreshes library changes and pauses a second active player in the same account.
- Account-scoped cloud audio endpoints backed by optional R2, with authenticated access, bounded uploads, MIME validation and no publicly exposed audio URLs. Uploads are idempotent by track ID and file hash. Limits: 100 MB for local files; 50 MB per cloud file, 10,000 cloud tracks and 5 GB per account.

## Playlist transfer — В разработке

Playlist transfer is disabled by product decision. Both entry points display «В разработке» and are native disabled buttons. Link and file import forms are removed. Authenticated `POST /sound/import` always returns HTTP 503 with «Перенос музыки — В разработке» before reading the request body, querying rate limits or contacting providers. Capabilities report `vk: false` and `yandex: false`, even if a VK token is configured.

Previously saved playlists and missing-audio entries are preserved. Users can still upload their own audio, attach it to existing entries, create and edit playlists, play offline and use the equalizer. Dormant metadata parsers and matching helpers remain for future development; they are not an available transfer feature.

WTSound does not contain a licensed streaming catalog or claim complete functional parity with Yandex Music.

## Optional cloud audio deployment

The existing Directory API works without R2; local uploads and offline playback remain available. The capabilities endpoint truthfully reports whether cloud storage is configured; provider transfer stays disabled.

To enable cloud audio on the existing Cloudflare account:

1. In `directory-api`, run `npx wrangler r2 bucket create wtinker-sound` using the account's approved credentials.
2. Set the repository Actions variable `WTSOUND_R2_BUCKET` to `wtinker-sound`. The Directory deployment workflow adds the `SOUND_BUCKET` binding only when this variable is set. The bucket must already exist; the workflow does not purchase or provision storage automatically.
3. The next approved main-branch deployment applies migration `0031_wtsound.sql` and deploys the Worker with the binding. In WTSound, use a track's “Сохранить в облаке” action. Other authenticated devices load the cloud track list and can download recordings for offline playback.

Playlists, likes, EQ and listening state currently persist on the current device; cloud audio is available across devices after explicitly saving a track to R2. This is not a general cross-device collection synchronization feature.

## Mobile background behavior

The implementation uses a persistent native HTML audio element, user-gesture activation, Blob audio sources, Media Session actions and Audio Session playback type. Playback survives WTinker route changes and ordinary visibility changes. EQ uses a Web Audio graph only after it is requested.

A browser/PWA cannot promise the same uninterrupted background lifetime as native iOS/Android applications. Headless Chromium and desktop WebKit do not establish physical iPhone lock-screen, Bluetooth, incoming-call or long background survival. Those cases require device testing before release claims. Guaranteed native background operation would additionally require native iOS/Android media-session integration; this repository currently contains a web/PWA client and Electron desktop wrapper.

## Verification

`npm run test:sound` covers export parsing, matching, playlist order, incomplete provider responses, pagination, URL security boundaries, cloud ownership and upload bounds.

`npx playwright test tests/visual/wtsound.visual.spec.cjs` exercises actual WAV uploads/playback, persistent route-independent audio, EQ controls, disabled transfer entry points, previously saved missing-audio handling, favorites, offline playback, and an offline PWA restart. It captures desktop/mobile screenshots in both themes. The suite is configured in pull-request CI for Chromium and WebKit. Playwright is pinned to 1.64.0, which includes the upstream offline service-worker navigation fix (microsoft/playwright#42894). Offline navigation is exercised in both engines; no WTSound scenarios are skipped. Physical iPhone lock-screen and long background survival still require device testing.

Run `npm test` before `npm run build`, matching the existing repository workflows: the pre-existing integrity suite rejects a generated root `tsconfig.tsbuildinfo` file left by TypeScript build mode.
