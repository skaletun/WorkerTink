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

## iPhone / iPad local file picker

In iOS WebKit, `<input type="file" accept="audio/*">` can mistakenly filter for video and grey out MP3/WAV/M4A files (WebKit issue [242110](https://bugs.webkit.org/show_bug.cgi?id=242110)). Both the bulk upload picker and the per-track missing-file attachment intentionally **omit `accept`**. The system Files picker can then choose audio files without iOS MIME filtering. The app still validates allowed extensions/MIME types, the 100 MB local size limit, reads tags and deduplicates using the existing `inspectAudio` pipeline; removing the picker filter does **not** disable content validation.

On iPhone, use WTSound → «Загрузить треки» → «Обзор» / «Выбрать файл» → «Файлы», then select an actual `.mp3`, `.wav`, or `.m4a` file from «На iPhone» or iCloud Drive. Files locked inside an external streaming service (including protected Apple Music tracks) cannot be accessed as ordinary local files. The automated Playwright test uses an iPhone-like mobile viewport in Chromium and WebKit to validate the file inputs, chooser triggers, two uploads and missing-track attachment. Real iOS native picker behavior still requires confirmation on a physical iPhone.

## Player v3: iPhone usability, playlists and background audio

- The **mini-player** lives at the **top** of WTinker under its primary header (not above the bottom navigation). It provides a transport, seek bar and an explicit hide button. Hiding leaves a compact restore pill, and the preference is saved locally.
- Tapping the current track opens a **full-viewport, safe-area-aware player**. It has large art, timeline scrubbing, shuffle/repeat, previous/pause/next, favourites, queue navigation and EQ settings. It never relies on a narrow dialog for playback controls; Escape/close collapses the overlay.
- Each local track row, including **Моя коллекция**, has a dedicated **Добавить в плейлист** control. Pick an existing list or create a new one **with the chosen track already included**. The old selector that required pre-created playlists is removed.
- The **Альбомы** navigation section, album group pages and album labels were removed; album tags remain in saved metadata for backwards compatibility with existing files and playlist imports, rather than destructively rewriting IndexedDB.
- Discovery previews gain previous/next controls, a scrub bar where the server provides a seekable duration, and retain their original links.

### iOS/background reliability and limits

Long playback is less susceptible to app-induced interruptions: the player keeps a single persistent HTMLAudioElement/MediaSession and does not clear its source while reading the next track; it preserves playback position on page hide and when the app is backgrounded; database time checkpoints are throttled from every 5 seconds to 60 seconds in the foreground, reducing IndexedDB activity. Resume uses the saved position directly instead of briefly starting at 0 and seeking later. Small next-track files are opportunistically prefetched from IndexedDB. Hardware previous/next, position and repeat are routed through the same controller.

**WebKit limitation:** iOS standalone PWAs have documented [background auto-next/playback restrictions](https://bugs.webkit.org/show_bug.cgi?id=261858), [AudioContext interruptions](https://bugs.webkit.org/show_bug.cgi?id=291892), and [resume limitations](https://bugs.webkit.org/show_bug.cgi?id=243258). No script, wakelock, or service worker can guarantee uninterrupted music after iOS kills/suspends a web app. To avoid a known failure mode, WTSound does not construct an AudioContext/equalizer chain on iPhone; equalizer is labelled unavailable on iOS, while it remains available elsewhere. For multi-hour offline playback, install the latest iOS update, download tracks locally, keep WTSound open in standalone mode, and verify actual long-duration behavior on a physical device (screen locked, 30+ min, track changes, headphones). Use a native audio app for guaranteed OS-level background scheduling.

Validation: full unit tests + production build, Playwright Chrome/WebKit regression covering top mini-player, fullscreen seek/skip, new playlist actions, no Albums tab, iPhone file selection and music discovery. Browsers cannot simulate OS suspension or promise uninterrupted lock-screen playback on a physical iPhone.

## Music discovery — music-first search

WTSound's discovery screen uses a **music-first** search inspired by open-source player designs:

- [Nuclear](https://github.com/nukeop/nuclear): provider metadata adapters, separate search categories (artists/tracks/albums), independent source capabilities, and queue-oriented search.
- [MusicFree](https://github.com/maotoumao/MusicFree): a standardized provider-plugin interface with searching/streaming independent from the presentation layer and pagination owned by the UI.
- [Feishin](https://github.com/jeffvli/feishin) and Navidrome: private/self-hosted library search; useful as UI references, but not public global discovery sources.

The default **Музыка** mode searches **Audius** and optional **Jamendo**. This prioritizes actual songs with artists and cover art rather than archival field recordings. The secondary **Свободные записи** mode searches **Openverse**, **Wikimedia Commons** and **Internet Archive** (useful for audio samples, recordings and Creative Commons / public-domain resources). **Везде** searches all configured sources. Source selection and paging remain available.

### Audius (no key required for read-only search)

The official `https://api.audius.co/v1/tracks/search` endpoint supports query, pagination and relevance sorting. Results map track title, user name, cover art, duration, genre, stream and artist permalink to WTSound's normalized discovery result. Streaming-only records stay visible for online preview. Download is enabled **only** if the Audius response explicitly has `is_downloadable === true` and no download access gate. The app uses the official `/tracks/{id}/download` endpoint only for that case; it never treats stream URLs as downloadable content or bypasses purchase/follow gates. The official source page is provided with each result. Individual track rights remain with creators; Audius is **not** automatically a Creative Commons library.

Official API documentation: https://docs.audius.co/api/ and https://docs.audius.co/sdk/tracks/.

### Other sources and attribution

Jamendo is optional and requires a build-time `VITE_JAMENDO_CLIENT_ID` created at https://developer.jamendo.com/. Only tracks with `audiodownload_allowed === true` are included. Jamendo album artwork, public preview audio, album and duration are displayed.

Wikimedia Commons uses MediaWiki file pages and their license/artist metadata. Openverse is an aggregator that returns audio metadata, thumbnails, and license URLs. Internet Archive requires an explicit, original item-level CC/CC0 license and a downloadable audio file below 100 MB. Archive recordings can be non-musical and are **not** included in the default song search.

Search results now have cover art or a music-note fallback, clear hierarchy for title/artist, source/genre/license cues, track duration, touch-sized controls and responsive mobile/desktop layouts. A single inline preview player is shown for the selected result. Downloads stream with a hard 100 MB limit, abort control and explicit errors for CORS-restricted origins. WTSound imports through its existing SHA-256 deduplicated IndexedDB storage pipeline, retaining title, artist, album, license, attribution and original source page.

These integrations use documented/public API endpoints and do not install arbitrary remote plugins, scrape streaming pages, extract protected content, or download unlicensed commercial streams. Generic YouTube/SoundCloud/Bandcamp scrapers from community players were reviewed but not embedded into the PWA. Some remote preview/download hosts restrict CORS and some sources have regional service restrictions or rate limits. Actual third-party APIs and iOS playback must be verified on a real device after deployment.

Validation: `npm run test:sound` covers provider normalization, artwork, Audius download gates, partial source failures, audio response/type/size validation and pagination; Playwright WTSound coverage includes mocked Audius search and mobile track cards, alongside the existing imports and offline playback.

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
