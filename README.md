# Xelvic Web

A standalone React web client for the Xelvic account system. It shares the Django API with the Android app and uses the APK's brand and theme assets.

Installed clients for **macOS, Windows, Linux and visionOS** wrap this same
build. What each one is, how it is packaged, what was verified and what still
needs signing or an app record is recorded in
[`PLATFORMS.md`](PLATFORMS.md).

Public profiles (`/u/:username`), drops (`/d/:dropId`) and vibes
(`/v/:vibeId`), their SEO/Open Graph/geo metadata, and the sign-in return path
are described in [`docs/PUBLIC_CONTENT_AND_SEO.md`](docs/PUBLIC_CONTENT_AND_SEO.md).
That document also lists the anonymous API reads and the server-side HTML
injection that the backend and deployment still have to ship — social crawlers
do not run JavaScript. The Search Console, sitemap and indexing checklist is
[`docs/GOOGLE_INDEXING.md`](docs/GOOGLE_INDEXING.md).

This is a parity build, not a redesign. The current status is recorded honestly in [`docs/FINAL_VERIFICATION_REPORT.md`](docs/FINAL_VERIFICATION_REPORT.md); the client is not yet full Android parity.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS
- TanStack Query
- React Router
- Native WebSocket
- `qrcode.react`
- Manrope variable font, shipped locally

No UI kit is used. Components are built from the mobile design language.

## Requirements

- Node.js 22.12.x or 24.x and newer (required by the current Vite/Vitest toolchain)
- npm
- A reachable Xelvic API for real data
- For local API work: the backend's documented Python/Postgres/Redis stack

The web client can build and run without a backend; data screens will show their real connection errors.

## Setup

```bash
cd xelvic-web
npm install
copy .env.example .env
npm run dev
```

The dev server prints its local URL (normally `http://localhost:5173`).

### Environment

```env
VITE_API_URL=http://127.0.0.1:8000
VITE_ENABLE_DEV_LOGIN=0
```

- `VITE_API_URL` is the API origin. The client appends `/api/v1/`.
- `VITE_ENABLE_DEV_LOGIN=1` shows the password door. It is intended for local development; the documented product signs in with a QR from the phone.

Do not commit `.env` or real credentials.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run typecheck` | Strict TypeScript build check |
| `npm run lint` | ESLint |
| `npm test` | Regression tests (theme eligibility, persisted query cache, media disk cache, sticker shelf, sound shelf, part-length menu, the feed's query options, the page's scroll lock, the editor's plate ink, the spark card's painter and its five looks, the bound on what a card waits for, the person a spark moment names, and the Vibe feed weave's own mix) |
| `npm run build` | Typecheck and production build into `dist/` |
| `npm run preview` | Serve the production build locally |

## Routes

### Public

- `/` - direct QR sign-in and optional dev login
- `/signin` - compatibility route for direct sign-in
- `/s/:token` - shared playlist landing
- `*` - not found

### Signed in

- `/app/drops` - feed
- `/app/drops/:dropId` - drop detail
- `/app/moments` - moments
- `/app/convo` - conversations
- `/app/convo/:threadId` - chat
- `/app/audio` - audio home
- `/app/audio/:playlistId` - playlist
- `/app/live` - live rooms
- `/app/live/:roomId` - room
- `/app/u/:username` - profile
- `/app/search` - people/audio search
- `/app/alerts` - requests
- `/app/saved` - saved drops
- `/app/sparks` - theme shop, wallet, sparks, medals
- `/app/settings` - account and appearance

## Architecture

```text
src/
  components/        presentational building blocks, grouped by responsibility
    ui/              primitives: Avatar, Button/Spinner, EmptyState/ErrorState, Blank
    common/          app-wide pieces: ErrorBoundary, Splash
    layout/          page furniture: PageHeader/Tabs/Divider, Backdrop, PlayerBar
    media/           authenticated image and video elements
    overlays/        Modal, ConfirmDialog, PrivacyConfirm
    icons/           brand marks and verified tick
  config/            env addresses, axios client
  constants/         storage keys and other invariant values
  context/           React context objects (created once, read by hooks)
  features/          domain code: drops, moments, convo, audio, live, deals, …
  hooks/             every custom hook (useAuth, useAlerts, useDeals, …)
  layouts/           route layouts (AppShell)
  pages/             route screens
  providers/         implementations behind the contexts (auth, theme, socket, …)
  routes/            route table, guards, lazy page registry and prefetching
  services/          one module per backend area; the only place URLs are called
  store/             client state, persistence and cache actions (no requests)
  styles/            global stylesheet and Tailwind layers
  theme/             palettes, catalogue, assets mapping
  types/             API contracts
  utils/             pure helpers, caches and formatters
public/              brand, favicon, theme covers and paintings
docs/                audit, parity, remediation and verification records
```

Folders exist where there is code to hold. There is no `workers/` folder
because nothing in the app currently does work heavy enough to move off the
main thread; an empty directory is a promise the code does not keep.

- TanStack Query owns server state. The cache keeps a page for 30 minutes and
  treats it as fresh for 60 seconds, so returning to a tab draws what was there
  and revalidates behind it.
- The last answers survive a reload: every query answer (except search results,
  mention pickers and QR sessions) is written to `sessionStorage` per account
  and hydrated into the query client before the first render, so a reload paints
  data instead of skeletons while the network revalidates
  (`src/store/queryCache.ts`).
- A tap opens on the row it tapped: a drop, a room and a convo header are read
  out of the list that cached them and passed as `placeholderData`, so the page
  draws immediately while its own request replaces the seed
  (`src/store/seed.ts`).
- Routes are code-split and prefetched: hovering, focusing or touching a tab
  starts both that page's chunk *and* its first API read, and the five shell
  tabs' chunks are warmed while the browser is idle
  (`src/routes/lazyPages.tsx`, `src/routes/prefetchData.ts`,
  `src/hooks/useRoutePrefetch.ts`). A prefetch reads the page's own query
  options rather than restating them (`src/features/drops/feedQueries.ts`),
  because a query's options are *replaced*, not merged, by the next fetch that
  carries any — a prefetch one option short is not a wasted request, it is a
  query that is wrong from then on.
- One counted scroll lock holds the page still behind an overlay
  (`src/utils/scrollLock.ts`). The document is what scrolls here, so a lock
  written back in the wrong order is a page that never moves again; four
  save/restore pairs became one lock with a release each.
- The camera's editor draws every tool panel and the sticker sheet on one named
  surface — the theme's card and ink, the pair the Audio sheet already used
  (`src/features/camera/PhotoEditor.tsx`). Its controls that sit *on* the
  photograph keep their dark scrim: words over a picture need contrast the theme
  cannot supply.
- The API client is the only place that knows about tokens, refresh and URL joining.
- One socket provider owns connect/reconnect/heartbeat; feature screens subscribe.
  The handshake is opened on idle so it never competes with the first page read.
- Auth has loading, signed-out and signed-in states. The last account is kept
  in `sessionStorage` for the tab so a reload paints the shell instead of
  waiting on `/auth/me/`.
- Themes are CSS custom properties on `<html>`.
- One audio element is owned by the player provider. No autoplay.
- Authenticated media is fetched as a blob because `<img>`/`<audio>` cannot send Bearer headers.
- Those blob reads are invisible to the browser's HTTP cache (an `Authorization`
  header disqualifies a response), so a reload used to re-download every picture
  in the feed. The bytes are now written to `Cache Storage` in a cache named
  after the account (`xelvic-media-<id>`, 400 files, 20 MB per file) and read from
  there before any network request; a disk hit does not queue for a network slot.
  Sign-out, 401 and expiry delete every `xelvic-media-*` cache
  (`src/utils/mediaCache.ts`, `src/providers/AuthProvider.tsx`).
- Long feeds mark each card with `content-visibility: auto`, so cards below the
  fold are neither laid out nor painted until the scroll nears them. Their
  infinite-scroll sentinels sit 1400–2000 px out, so the next page is asked for
  well before the reader reaches the foot rather than when they do.
- Authenticated media reads are capped at six in flight, so a rail of thumbnails
  cannot queue in front of the JSON the page actually needs, while a screenful
  still drains in one pass (`src/utils/mediaCache.ts`).
- A picture is asked for up to 1600 px before it can be scrolled into view
  (about three phone screens), rather than when it is reached, because the first
  byte here takes a few hundred milliseconds
  (`src/components/media/Media.tsx`).

## Verification

Last recorded results:

```text
npm test           PASS (321 cases, 27 files)
npm run typecheck  PASS
npm run lint       PASS
npm run build      PASS
```

Production build output: the entry chunk is 514.54 kB (159.90 kB gzip) and the
stylesheet is 134.52 kB; every page is a separate lazy chunk, so
opening one screen does not download the rest (the largest are Settings 120.64 kB
and a convo 99.67 kB, and the moment viewer is split off from the convo at
42.89 kB because only a thread that carries a story card needs it). The spark
card's page is its own chunk too, 29.43 kB (10.89 kB gzip), because only a sheet
whose "Add to Moments" is tapped needs it — 15.71 kB before the four card looks
landed and 20.26 kB before the sound row joined it. The sound sheets are a chunk
of their own (`SoundPicker`, 24.06 kB / 8.08 kB gzip) and the editor that opens
the same two sheets imports them back: `PhotoEditor` is 59.72 kB, down from
82.48 kB, because "which sound, and which part of it" now lives once in
`src/features/audio/` instead of twice. A face is asked for with
`crossOrigin="anonymous"` — a public avatar address is drawn straight from its
host, and a cross-origin picture drawn plainly taints the canvas and makes it
unexportable — and a paint that fails anyway is retried once without pictures
before the page says it could not draw one. The card itself has five looks —
`classic` (the phone's own card) and `midnight`/`sunset`/`aurora`/`noir`, drawn
from a four-card design sheet and picked at random per card; the four exist only
here, and `classic` is untouched (`card.test.ts` pins its list of fills, and that
test caught a regression during the 2026-11-05 rewrite). The four were rebuilt
on 2026-11-05 against measurements of the sheet: a near-white field of `#F8F5FE`
with the award's tone collecting along the left and right edges, an opaque
motif at the card's centre inside a soft halo of flat steps, the two faces at the
top, the award's name at y 985, the days on a pill, and a foot of tone that
climbs the two edges and dips through the middle. Their soft edges are stacks of
flat shapes a step of alpha apart and never a gradient, per the house rule — so
the sheet's glow is *approximated*, not reproduced. Each look was rasterised
through the real painter in headless Chrome and measured against the sheet (the
motif region of all four now sits within about 4 % of its sheet counterpart) —
but they have never been seen, only measured, and the sheet's cards are 4:5
where the real box is 840×1520, so this is an adaptation of the composition and
not a pixel-exact copy.
The camera's
two chunks (60.20 kB and the picture editor's 59.72 kB, plus the 20.15 kB they
share) are fetched while a convo is being read rather than on the tap that opens
the camera — see `src/features/camera/warm.ts`. No chunk-size advisory is
emitted. Production preview verified that `/` and `/signin` render the sign-in
flow. No authenticated end-to-end pass was possible because the backend was not
available, so the boot-speed, camera, sound-shelf, part-length, prefetch,
drops-feed, scroll-lock, editor-surface, convo-row and Spark-card sound-row
changes below are **NOT VERIFIED** against a live session.

The API itself was measured from this machine on 2026-11-02 (Cloudflare edge in
Singapore, so these numbers are dominated by distance, not by Django):

```text
GET /health/  cold connection   TTFB 0.40–0.61 s (TCP ~0.10 s, TLS ~0.31 s)
GET /health/  keep-alive        TTFB 0.16–0.27 s per request
OPTIONS preflight               TTFB 0.42 s, Access-Control-Max-Age 86400
```

That floor is why the frontend now hides the first round trip (persisted cache,
data prefetch, earlier scroll triggers) and stops paying it twice for media
(blob bytes kept in `Cache Storage`) rather than trying to shorten it. The
improvement a reader sees is **NOT MEASURED in a browser** against a signed-in
session, and the disk-store logic is covered only by the unit tests in
`src/utils/mediaCache.test.ts` (6 cases: round trip, miss, per-account
separation, size limit, session-end wipe, no Cache Storage).

See [`docs/TEST_AND_REGRESSION_MATRIX.md`](docs/TEST_AND_REGRESSION_MATRIX.md) for the full matrix and [`docs/FINAL_VERIFICATION_REPORT.md`](docs/FINAL_VERIFICATION_REPORT.md) for the release verdict.

## Known limitations

- Stickers come off **our own sticker service** first
  (`https://sticker.gaongram.in/api`, a public token-free catalogue that answers
  `access-control-allow-origin: *`; 381 stickers measured 2026-11-02), falling
  back to this API's `/api/v1/stickers/` when that service refuses — which is
  what the phone does, and the reason a picker reading only our own server showed
  a different and much shorter list. A respond's and a note's sticker picker
  reads our own server alone on purpose: those send an id back, and the server
  can only check the ids it has rows for. The camera's code is fetched while a
  convo is being read rather than on the tap, but `getUserMedia` still runs only
  inside the mounted camera, and the first ask is still video *and* audio in one
  call — splitting it would either prompt twice or quietly record clips with no
  sound.
- A convo's audio sheet draws the **uploads shelf** — `/audio/tracks/?source=drop`
  — and not the shipped catalogue, because that is the list the phone's picker
  draws on all three of its chips (`app/lib/screens/audio_picker.dart`). The sheet
  used to ask the route with no `source` at all, which answers the catalogue
  instead — a handful of seeded songs and episodes, which is exactly what a short
  list on that path looks like — and then fell back to the Audio tab's own rows
  when that came back empty. Neither list is the one the phone draws. It asks
  once for 60 rows, the phone's own `kPickerRows`, instead of paging a cursor the
  route does not have, so neither platform can see past the server's cap on the
  drop branch (100). Search narrows the same shelf on every chip, as the phone's
  box does.
- Not full Android parity. Missing: vault, crew list, codepad, artist pages, own QR, account deactivation and several rich chat sheets.
- **Audio and video calls are real, and never verified.** Added 2026-11-06: the two buttons in a convo's header and the call-back button on a call-log row now place a call on the server and ring it, and the tab draws the phone's own phases — dialling, ringing, live and the goodbye — with the same buttons. The media is peer to peer and never touches the server: `RTCPeerConnection` under `features/calls/engine.ts`, the relay's address from `GET /calls/ice/`, the mesh built on the rules `app/lib/calls.dart` already settled (people already in the call offer to the newcomer and the newcomer only answers; two crossed offers are thrown away and the higher id offers again; candidates wait until there is a remote description to add them to), and the signalling is the app's own `call.ring` / `call.accept` / `call.decline` / `call.leave` / `call.video` / `call.signal` / `call.pending` over the one authenticated socket. A request that could not be sent is said again when the socket comes up, a ring that runs out is given up on the server's own `ring_seconds`, and a goodbye that failed is held rather than pretended. **What is not here:** no earpiece/speaker switch (the browser has no such route control — nothing is drawn for it either), and no way to *add* somebody to a call (`call.add` is not sent by this client, so a group call can be received and drawn but not started here). The ringtone, the vibration, the answer from a system notification and the camera flip named here were added on 2026-11-06 (Round 18), and the **Mirror** pill turns the pictures *arriving* rather than this tab's own (Round 20) — a display, never a transmission. **Not verified:** the backend was never reachable from here and there is no second device, so not one frame of this has been seen against a live server — the state machine is covered by tests, the connections are not.
- A convo draws every card kind the phone does — a post, a mention line, a waiting share, an uploaded sound with its player, a song, a playlist, a person, a story, a live room, a sticker, and the header over a reply to a moment — but three of them differ on purpose: a story card does not play the story inside itself and offers no heart or "Remention" (all three are in the viewer it opens), a shared song's heart starts unfelt because a share carries no liked state, and the site can *receive* a song share and a profile share but has no flow that sends one. "Put it on your Moments" is not on the share sheet for the same kind of reason: the site's composer takes files off the roll and a post that is already up has no road to it.
- Passing a post on is the phone's sheet — search, a tick strip, a pinned send button, one card per convo with a tally — and the count on the card moves by what actually landed. None of it has been seen against a live session.
- The chat list is the phone's row: the line under a name never shows the message, the count is `N new` under the name plus a plate on a group's name, and the spark's tap opens the sheet about that run. The sheet's "Add to Moments" pill is drawn on every run and opens the phone's card page — the card painted at the size it will be posted, the two questions before the share, one button — whose composer posts an image moment with a mention, an audience and — added 2026-11-05 — the phone's own **sound row**: "Add audio" opens the same picker the convo's audio sheet uses, "Choose a part" the same window chooser, and the part that is kept is sent as `sound` / `sound_start_ms` / `sound_end_ms` on the moment item, which is the three fields the backend already accepted. The card is painted from the app's font and the two faces **under a bound** (`FACE_PATIENCE_MS`, the phone's `Faces.patience` of fifteen seconds; `FONT_PATIENCE_MS`, two) and never waits for a picture that is not coming: a face that does not arrive in time is drawn as the initials plate the list itself uses, because a card with initials on it posts and a card that was never painted posts nothing. A face is also asked for CORS-clean, and a name that is not a string or a picture the browser will not draw falls back to that same plate — the card is lost only if two whole paints fail. What is still not drawn: the row's play button (the Spark run viewer lives inside a convo, so a row cannot open one). The card's own words are English only — Android reads them from its string table, so a Hindi phone draws a Hindi card and this one does not. Muted rows are drawn like any other.
- Theme purchase now follows Android tier/slot rules in both the web UI and local API; paid theme wearing is ownership-checked. Backend tests were added but could not run because local PostgreSQL rejected the configured test credentials.
- The web Sparks page adds a Themes tab and mobile shortcut, while retaining streaks, ladder and medals tabs beyond Android's Themes/Wallet Reward shape.
- The browser cannot read the device address book, show native push or provide OS background audio controls. Settings can show matches and deny contact uploads; allowing uploads stays in Android.
- Media elements cannot send Bearer headers; the client uses blob URLs.
- Room games are wired against assumed subroutes and need a live check.
- No automated accessibility or visual-regression pass has been run.
- There is no `workers/` folder: no current work is heavy enough to justify
  moving it off the main thread.

## Documentation

- [`docs/MASTER_GOALS.md`](docs/MASTER_GOALS.md)
- [`docs/APK_PARITY_MATRIX.md`](docs/APK_PARITY_MATRIX.md)
- [`docs/SCREEN_BY_SCREEN_AUDIT.md`](docs/SCREEN_BY_SCREEN_AUDIT.md)
- [`docs/SECTION_AND_INTERACTION_AUDIT.md`](docs/SECTION_AND_INTERACTION_AUDIT.md)
- [`docs/BACKEND_API_PARITY_MATRIX.md`](docs/BACKEND_API_PARITY_MATRIX.md)
- [`docs/DESIGN_PARITY_AUDIT.md`](docs/DESIGN_PARITY_AUDIT.md)
- [`docs/TEST_AND_REGRESSION_MATRIX.md`](docs/TEST_AND_REGRESSION_MATRIX.md)
- [`docs/REMEDIATION_LOG.md`](docs/REMEDIATION_LOG.md)
- [`docs/FINAL_VERIFICATION_REPORT.md`](docs/FINAL_VERIFICATION_REPORT.md)

Earlier inventory documents are also kept in `docs/`.

## Round 18 — the ring, the notice, the camera, the layout, and room sound (2026-11-06)

The calls added on 2026-11-06 now ring, reach the browser's own notification
surface, ask the camera for a better picture and lay themselves out for a phone
and a laptop, and a live room's sound is carried over the same relay an ordinary
call uses — with no new endpoint, because a room's stage is a `calls.Call` on the
server.

New: `src/features/calls/ring.ts` (the app's own `public/ringtone/call.wav` with a
written Web Audio tone behind it, and vibration), `src/features/calls/notice.ts`
and `public/call-sw.js` (one notice per ringing call, with Decline and Accept fed
back into the engine), `src/features/calls/quality.ts` (1080p at 30 fps with a
floor, `maintain-resolution`, a bitrate from the picture, device pickers and a
`getStats` pill), a rebuilt `src/features/calls/CallOverlay.tsx` (fit/fill,
spotlight and grid, a draggable clamped self-view, fullscreen), and
`src/features/rooms/` with `src/features/media/surfaces.tsx` for the room's sound.

This closes what the calls bullet in Known limitations had listed as missing —
the ringtone and the vibration, the answer from a system notification, and the
camera flip; earpiece/speaker
routing and `call.add` still stand as not implemented, and nothing is drawn for
either. **None of it is verified.** No connection was ever made, no microphone,
camera, vibrator or notification surface was ever opened, and there was no second
device, so every one of these is `PARTIALLY COMPLETE (NOT VERIFIED)`.

## Round 19 — the flipped picture, the cards that fit, and Vibes woven into the feed (2026-11-06)

The round that answers three of the owner's own reports and one omission.

**The picture is no longer mirrored when it should not be.** The phone mirrors
only its front lens (`app/lib/calls.dart`, `_selfMirrored`); the web mirrored
unconditionally, which is what the owner saw as *"video me jo video ban raha hai
wo ulta ban raha hai aur phone me sahi hai"*. `src/features/calls/engine.ts` now
carries a `Facing` (`"user" | "environment" | null`) and a `mirrored` flag on the
snapshot: `mirrored()` returns a person's own choice when they have made one and
otherwise answers `facing !== "environment"`, so a camera reporting a back lens
is not flipped. The facing is read off the track itself —
`track.getSettings().facingMode`, called from `openCamera()` and from
`openDevice()` — and both fields reset in `closeMedia()`.
`src/features/calls/CallOverlay.tsx` draws the self picture with
`mirror={!call.sharing && call.mirrored}` and adds a **Mirror** pill (active when
mirrored) after the existing **Flip camera** pill. The same rule and the same
button sit on a room's own tile, through `src/features/rooms/stage.ts` (which
exposes `toggleMirror`), `useRoomStage.ts`, `RoomSoundView.tsx` and
`RoomPage.tsx`. This is complete as code and **not verified**: no device or
browser run was made, and a webcam that reports no `facingMode` at all falls back
to mirrored, which is the honest default rather than a known-good one. *(The
self-view half of this was reversed the same day, on the owner's own report: the
Mirror button is about the pictures arriving rather than this one, and `mirrored()`
is the lens alone. See Round 20.)*

**A card's picture can no longer ask for a box taller than the screen, and the
card is a column rather than the whole window.** The owner's report was *"jo card
video aur post ka ban raha hai wo pure screen ke andar hi aaye screen se bahar na
jaye jaise instagram me hai"*. The cause was that the media box took the card's
whole width and derived its height from the server's `ratio` (height ÷ width)
with no ceiling, so a portrait post wanted a box taller than the screen at every
width, a 1440-pixel desktop window included. Both numbers are the phone's own
(`tallClipShare = 0.62`, the photograph's `0.78`, in
`xelvic/app/lib/screens/drops.dart`, whose comment is the owner's earlier report
of 2026-10-27).

**The second pass, on the owner's screenshot of 2026-11-06.** They reported
*"design sahi nahi hai aur card bhi ganda lag raha hai aur width bahut jyada hai,
aur for you ke upar jo vibes ka section tha wo bhi hat gya hai, please use
rakhiye"* beside a photograph of a card 1000 points wide holding a picture 318
points wide. Three faults, three changes, all in `xelvic-web`:

- **The column.** `DropsPage.tsx`'s grid was `max-w-[1240px]`, one column below
  the `xl` breakpoint, so a card was drawn the whole width of the window — 1240
  points on a desktop. The feed column is now capped at the 660 points the `xl`
  breakpoint already gave it and centred at every size, which is the closest
  thing to the phone's 390-point card a desktop has.
- **The box.** `frameBox` was written so that a still answered the height
  ceiling by *narrowing*, which is the phone's rule and is invisible there — at
  390 points wide and 800 tall, the ceiling costs a portrait photograph about a
  tenth of its width. On a wide, short browser window the same rule costs two
  thirds of it, and the card is left with a strip of picture in the middle and
  empty card either side. A box with an automatic width is narrowed by the
  browser to satisfy `max-height`; `src/features/drops/frame.ts` now writes
  `width: 100%` outright, so **the box keeps the card's width and the ceiling
  takes the height**, with `object-cover` cropping. A still is drawn at the
  poster's shape up to four-to-five — the tallest a card stands anywhere — and
  the whole picture is on the post's own page (`DropPage`). A clip keeps the
  app's own `62dvh`. `SensitiveVeil.tsx` takes the exact box as a `frame` prop
  so the cover and the picture are the same box, before and after lifting.
- **The strip.** The rail dropped every clip the feed was drawing *anywhere*,
  so a shelf of eight clips against two scrolled pages of ten left it empty and
  took the whole section off the page. `mix.ts`'s `railClips` now bounds the
  exclusion to the feed's **first block** — the cards the strip is on the screen
  with — never draws an empty strip over a shelf that has clips, and is the
  app's rule unchanged on a filled page.
- **The door.** A clip in the feed is a card a thumb opens, and in the app that
  is true of a plain video as much as of a Vibe: `DropVideo.onOpen` is
  `isVibe ? openVibe : _openFrame`, and `_openFrame` is `openClip`, which is
  `openVibe` (`app/lib/screens/drops.dart`). Here only a woven Vibe had a door,
  so a video somebody posted played where it sat and a press on it did nothing —
  the owner's report of 2026-11-06: *"app me drops ke for you post me video post
  par click karne par ek dusare page me wo video open hota hai waise isme nahi ho
  raha hai"*. `model.ts`'s `dropIsClip` is the app's own test
  (`(kind == 'video' || isVibe) && asset.content_url`) and now has both readers:
  the card asks it whether to draw the clip, the page asks it whether to hand
  the card a door. A clip the shelf does not hold is carried **in front of** it —
  `mix.ts`'s `walkOf` — so the walk opens on the clip under the thumb and the
  shelf is a swipe away, which is the phone's `Drops.it.carry`. A still is left
  alone, as the app leaves it. `reco.ts` now sends each row's own `kind` (`drop`
  or `vibe`, as `Reco.served` does): the server resolves an id against the table
  its `kind` names (`_KINDS` in `apps/reco/services.py`), so a plain video
  reported as a `vibe` was a row `_existing` could not find — dropped in silence.

`VibeViewer.tsx`'s walk stopped pinning all four edges of a `fixed` box — it is
`fixed inset-x-0 top-0 h-[100dvh]` now, because a box pinned on every edge
resolves against the *layout* viewport, taller than the visible area when a phone
browser shows its bottom bar, which had put the caption, the comment rail and the
clip's player panel underneath it while the page scroll was locked.
`src/styles/index.css` moved `body` from `min-height: 100vh` to
`min-height: 100dvh` (it was the app's only `100vh`; every page root already used
`dvh`) and added `overflow-x: clip` as a guard against a sideways spill, and
`PollBlock.tsx` gained `break-words` on an answer's text in three places, so a
long unbroken word is not cut off by the row it is in. This is complete as code
and **not verified** on a device; the `VibeViewer` height change is a reasoned
fix with medium confidence and is not claimed as watched.

**Vibes are woven into the feed.** The server states a policy and the client does
the weaving: `GET /drops/` answers `vibe_share` (0.20 for a reader it knows, 0.40
for a cold start, `apps/drops/services.py:feed_vibe_share`), and the phone's
`Drops.mixedFeed` lays the clips out. The web ignored the field and had no weave,
so its feed never carried a Vibe. `src/features/drops/mix.ts` is now a whole port
of `mixedFeed` / `_mixSlots` / `shelfOrder` / `shelfKey` from
`xelvic/app/lib/drops.dart` — `shelfKey` (FNV-1a, salted), `shelfOrder`, `mixSlots` (a partial Fisher–Yates
over ten slots), `mixPerBlock`, `mixedFeed`, `filledWithVibes` and
`RAIL_CLIPS = 10`. One thing in the port could have gone quietly wrong and is
named: the hash multiply is done with `Math.imul`, because the phone's `int`
holds the whole product before masking and a JavaScript number does not.
`src/pages/DropsPage.tsx` reads `vibe_share` off the feed's first page (falling
back to the app's 0.20 until a page carries one), draws a salt once per opening of
the page, keeps a rail of the shelf in `shelfOrder` **less the clips the feed's
first block is drawing** — capped at ten, and never emptied while the shelf has a
clip on it: a clip met twice on one screen is two counters a like would have to
move together (the owner's *"dono rahe"* was about the two shapes, not about one
clip in both places), but a strip that vanishes takes its heading with it, which
is what the owner reported on 2026-11-06 — weaves the feed through
`mixedFeed`, draws a clip (a Vibe or a plain video) as a card whose picture opens
the walk, and — for
a `caught_up` feed with nothing left — fills from the shelf's own tail *past the
rail's ten*, with the foot asking for the next hand of clips instead of a page of
drops. Hiding or taking a card down now sweeps **both** the feed and the Vibes
queries. `src/types/api.ts`'s `Page<T>` gained `vibe_share?: number`.
`DropCard.tsx` gained an optional `onOpen`: a single press on the picture waits
out the 220 ms double-press window and then opens, so a double press still only
feels the post, and a card given no `onOpen` behaves exactly as before (the mute
button stops propagation, so muting does not also open). `EditDrop.tsx` reads the
drop route first and the Vibe route when that says there is nothing there,
because a URL carries an id and not the table it lives in. `MomentDropCard.tsx`'s
exported `previewPath`, which named `/app/drops/vibes/<id>` — a route that does
not exist — is deleted; it had no callers. This is complete as code for the weave
and the rail and **not verified** against a live server.

**What this round does not do, said plainly.** A Vibe still plays only its own
`asset`: the recipe (`recipe`) and the addresses of the uploads it names
(`clip_urls`) are sent by the server and read by **nothing** here, so a Vibe
edited on the phone plays on the web as its first clip alone — no voiceover, no
music lanes, no per-clip trim or speed, no overlays, no filter and no chosen
frame shape — `NOT IMPLEMENTED`. There is no Vibe editor on the web: the composer
posts `{asset, caption, music, mentions, sensitive}` to `POST /drops/vibes/` and
never sends `recipe`, `category`, `interests` or `track_id`, though the server
accepts all four — `NOT IMPLEMENTED`. Play counts never move from the web:
nothing under `src/` calls `POST /drops/<id>/play/`, which the phone calls at
`xelvic/app/lib/audio.dart:1975`, so a sound played in the browser does not
advance `plays` and the poster's own numbers do not include it —
`NOT IMPLEMENTED`, and a silent omission rather than a claim on screen. And
`GET /drops/mine/` and `GET /drops/interests/` are still unused, so there is no
"my own posts" shelf and a post made here carries no interests and cannot be
filed — `NOT IMPLEMENTED`.

**Nothing in the round is verified.** `npm run typecheck`, `npm run lint` and
`npm run build` pass, and the suite was 307 tests over 26 files when the round
closed (310 now, after Round 20), with
`mix.test.ts` (24 cases) carrying the phone's own weave over plain values and
`model.test.ts` holding the clip rule both readers ask and `frame.test.ts` the
box a card draws in. But
no device and no browser run was made at all, so the mirror rule, the cards that
now fit the screen, the restored strip and the clip that opens the walk are all
unexercised in a real browser or against a live server.
`git -C ../xelvic status --short` is unchanged: nothing under
`backend/` or `app/` was touched.

## Round 20 — the Mirror button now turns the other person's picture, not mine (2026-11-06)

The owner's report: *"jo video call me mirror par click karne par jo flip ho raha
hai wo mere video card me raha hai jabki reciever user video card me hona
chahiye"*. Round 19's button did the opposite of what was wanted: it overruled
the self-view's own lens rule, so the one picture on the screen that was already
right was the one that turned over.

Asked which picture the button should turn, the owner chose **the other person's**
— the picture arriving here — with the self-view left on the phone's own rule.

**The phone's own answer, for the self-view.** `app/lib/screens/call.dart` has no
Mirror button at all: `_mine` draws this tab's own tile through
`mirror: calls.selfMirrored` (front lens mirrored, back lens not) and every remote
tile through `_feed(person, mirror = false)`, and `app/lib/screens/room.dart` does
the same with `mirror: person.id == mine && Stage.it.selfMirrored`. So
`CallEngine.mirrored()` is now `facing !== "environment"` and nothing else, the
hand-overrule is gone with `toggleMirror()`, and a browser webcam that reports no
`facingMode` is drawn mirrored — which is the honest reading of a camera somebody
is sitting in front of, and is named as a gap below.

**The button, turned round.** `src/features/calls/engine.ts` carries a
`remoteMirrored` flag on the snapshot (`private remoteMirror`, false until
pressed, cleared in `closeMedia()` so the next call starts unflipped), set by
`toggleRemoteMirror()`. `CallOverlay.tsx`'s `RemoteTile` gained a `mirror?` prop
handed straight to `VideoSurface`, and all three of its sites pass
`call.remoteMirrored` — the grid, the spotlight and the rail thumbnails — so the
button means one thing on every tile. `SelfView` is unchanged at
`mirror={!call.sharing && call.mirrored}`. The pill is active on
`call.remoteMirrored`, and it waits for a picture to arrive
(`others.some((seat) => streamFor(seat.user)?.getVideoTracks().length)`) rather
than for this tab's own camera to be on: the button is about what is on the screen
and not about what this tab is sending, and a pill over a seat whose camera is off
would be offering something the screen cannot answer. A room's tile carries the
same meaning through `features/rooms/stage.ts`'s `toggleRemoteMirror()`,
`useRoomStage.ts`, `RoomSoundView.tsx` (the self tile draws `mirrored`, every other
tile `remoteMirrored`) and `RoomPage.tsx`, with the same wait-for-a-picture guard.

**What this is, and what it is not.** It is a **display and not a transmission**:
nothing in the outgoing track is transformed, so nobody else's screen changes when
it is pressed — there is no way for it to change anyone else's screen, since a
mirror is applied by `VideoSurface`'s `-scale-x-100` to a `<video>` element and
never to a track. A picture the far end is *sharing* rather than filming is turned
over too, because a call frame carries no word for which of the two a stream is,
so there is nothing on this side to tell them apart. This is a deliberate
divergence from the phone, which has no such button at all, and it was added
because the owner asked for it.

**Not verified, and the two honest gaps.** `npm run typecheck`, `npm run lint`,
`npm test` (310 cases, 26 files) and `npm run build` all pass, and
`engine.test.ts` gained three cases over the new flag — the default, the press
that leaves this tab's own `mirrored` alone, and the reset that a next call opens
unflipped. But no device and no browser run was made, so the flip was never
watched: two ends on a real call is the only thing that can say the receiver's
picture turns and the sender's does not. And because the self-view can no longer
be overruled by hand, a webcam reporting no `facingMode` — most laptops — is drawn
mirrored with no way to change it.

## Round 21 — a shared screen shown whole, and a call that can be put aside (2026-11-06)

Two reports in one message: *"screen share wale me problem aa raha hai jaise ki,
main screen laptop me share kar raha hu aur koi apne mobile me dekh raha hai to
pura screen nahi dikh raha hai use kewal beech ka dikh raha hai"* and *"video call
karne par main video hata kar chat par aa raha hu aur call chal hi rahi hai to phir
main video call par nahi aa raha pa raha hu"*.

**A shared screen is shown whole.** The crop was the *viewer's* own Fit/Fill choice,
kept for as long as the tab lived: `fit` was one piece of state in `CallOverlay`,
so once somebody pressed **Fill** — which Round 18 put there because the owner asked
for a resize control — every later call was cropped, and a wide desktop cropped to
fill a phone held upright is only its middle. Two rules now hold:

- **The choice belongs to the call.** `fit`, `layout` and the focused seat are put
  back to their defaults when a call ends (`idle` or `over`), so the next call opens
  the way the screen's own comment describes: the whole picture, letterboxed.
- **A picture that changes shape is a different source.** A camera does not change
  its own frame mid-call, so a far end that does is switching what it sends — a
  camera for a screen, or back. `model.ts`'s `sourceChanged(before, after)` answers
  that with a 12 % threshold, and `CallOverlay` returns the picture to **Fit** the
  moment it answers true. The measurement comes from
  `src/features/media/surfaces.tsx`, which now listens to the video element's
  `resize` event as well as `loadedmetadata`: a track replaced under a picture that
  is already playing (`sender.replaceTrack`, which is how a share starts) changes
  the frame without changing the stream, and `loadedmetadata` never fires twice.

The measurement is honest about what it is: a *shape* change, not a word from the
server saying "this is a screen". A call frame carries no such word, and the signal
relay accepts only offers, answers and candidates (`SIGNAL_TYPES` in
`backend/apps/calls/services.py`), so there is nowhere to put one without changing
the backend — which this project does not.

**A call can be put aside and come back to.** There was no way to leave the call
screen while a call was running: `CallOverlay` is `fixed inset-0` above the router,
so it covered every page, and nothing drew a way back once it was out of the way.
The phone has three sizes — a page, a window and a small mark
(`app/lib/screens/call_window.dart`) — and the web now has two: the screen, and a
**Minimize** pill in the toolbar that swaps it for a small bar over whatever page
the person went back to. The bar carries the picture (or a phone glyph when there
is none), the name and the clock, the microphone, the camera on a video call, and
the red button; tapping it returns to the call. It carries the sound through
`<audio>` elements of its own, because the full screen's `<video>` elements are
gone while it is up and a call that went quiet when its screen was out of the way
would be a call somebody thinks has dropped. It is reset when the call ends, so the
goodbye is never hidden behind it.

**Not verified.** `npm run typecheck`, `npm run lint`, `npm test` (313 cases, 26
files) and `npm run build` all pass, and `model.test.ts` gained three cases for
`sourceChanged` — a camera that keeps its frame, the 4:3-to-desktop switch in both
directions, and a shape that has never been measured. But no device and no browser
run was made: a shared screen seen on a phone, and a call minimized and picked up
again, were never watched. The shape rule is a reasoned fix with high confidence,
not a watched one.

## Round 22 — the small call window can be dragged, and it docks (2026-11-06)

The owner's own report of the same day, about Round 21's own work: *"abhi video call
minimize karne par use drag aur drop nahi kar pa raha hoon chat screen me"*. Round 21
gave a call somewhere to go; it did not let that place be chosen. The bar was pinned
to the bottom of the screen by five classes of CSS, and a phone glyph in its corner
was the only hint that moving it was ever meant to be possible.

**It moves now, and it can be put against an edge.** The rules are the phone's, taken
from `app/lib/screens/call_window.dart` (read, never written to) and kept in a file
of their own — `src/features/calls/minibar.ts` — because they own no DOM: they take
rectangles and return them, so they can be tested without a browser.

- It is dragged by pointer events on the bar itself, and the drag is **captured**, so
  the window keeps following the finger or the cursor after it leaves the bar's own
  rectangle — which is almost immediately. Only after six pixels of travel does a
  press become a drag (`DRAG_SLOP`), so a slightly unsteady tap on the microphone or
  the red button is still a tap; a drag that a browser still turns into a click is
  stopped by the bar's capture-phase handler rather than being allowed to mute
  somebody by accident.
- It is **clamped on every draw**, not only while it is being moved: a rotation, a
  narrowed window or a phone keyboard all move the edge it was keeping clear of, and
  a window nobody can reach is a call nobody can answer.
- Letting go **into** an edge folds it to a 28-pixel tab at that edge, at the height
  it was let go at; a press brings the window back and it stays where it was left.
  "Into" and not "near", for the phone's reason: while it floats it is held a
  12-pixel gutter clear of every side, so its own edge can only be inside that gutter
  if somebody pushed it there. Tapping rather than dragging the tab, also for the
  phone's reason — the strip along a screen edge belongs to the browser's and the
  device's own back gestures.
- The sound is drawn **beside** the window rather than inside it, so folding the
  window into a tab does not take the call's voice with it.

**Not verified, and one cost named honestly.** `npm run typecheck`, `npm run lint`,
`npm test` (321 cases, 27 files) and `npm run build` all pass — `minibar.test.ts` is
new and carries eight cases over the corner, the clamp and the two edges. But no
browser run and no device run was made: nothing was dragged, docked or pulled back on
a real screen. And on a phone the bar fills almost the whole width, so it rests
already exactly one gutter from both edges and comes back docked from the smallest
push — the phone's own window has the same rule and not this problem, because it is
116 points wide on the same screen. That cost is pinned by a test rather than left to
be discovered.

**Still missing, and named rather than implied.** The phone's third size — a call
hidden down to a single small mark and nothing else (`CallView.hidden`) — has no
counterpart here, and a page reload still loses a live call outright.

## Round 23 — the emoji a message wears, and the mic that records (2026-11-11)

The owner's own reports, in the order they came. Twice about **when** an emoji moves:
*"abhi emoji chatscreen me send karne par send ke baad aur hover par animate nahi kar raha
hai, please ise fix kijiye"*, and then, once the rule was clear, *"ye jo continue animate ho
raha hai jabki send karne par aur hover karne par animate hona chahiye"*. Then four about
**what** it is drawn with: *"abhi emoji 3d me nahi dikh raha hai ... jab hover ya send karne
par emoji jab animate karta hai tab matlab emoji animation ke liye abhi jo emoji use ho raha
hai google ka wo use kijiye aur jab animate na kare to koi aur 3d emoji use kijiye"*;
*"jo dynamic 3d emoji abhi jo use kar raha hai wo mat use kijiye koi aur use kijiye, iske
liye option dijiye"*; *"abhi jo emoji use kar rahe hai wo bhi sahi nahi hai jaise whatsaap ka
hai waise chahiye"*, sent with a screenshot of WhatsApp's own picker; and last, settling it:
**"please dynamic emoji hata dijiye pahle jaise tha waise hi kijiye jo google ka"** — take the
other sets out, put it back the way it was, Google's. Then, once the sets were settled, the
panel itself, and the same fault as the thread in a grid where every tile moved at once:
*"abhi input me jo plus hai usme emoji par click karne par jo emoji panal open hota hai, usme
emoji animate continue hote hi rahte please ise aisa kijiye ki kewal hover karne par hi emoji
animate kare"*. The composer's mic, which had never actually recorded anything, was the
round's other job.

**When an emoji may move is decided in `src/features/emoji/motion.ts`**, out of the
component because it owns no DOM — it takes counts and flags and answers yes or no, which
is what makes it testable without a browser.

- **Nothing moves for being on screen — not a tile in the picker and not an emoji in a
  sentence.** What moves a drawing is a pointer resting on it, and that is the whole rule.
  It arrived in two steps from the owner: the thread first (*"ye jo continue animate ho raha
  hai jabki send karne par aur hover karne par animate hona chahiye"* — a message is read,
  not browsed), and then the panel, where the same fault was worse because the whole grid
  moved at once. Being on screen stopped being a reason to move and became only a condition:
  `wanted` still asks, because nothing should play for something scrolled clean out of the
  page, but it is the pointer that answers.
- An **emoji in a sentence** also gets **once** through when the message it belongs to is
  sent or arrives (`EmojiArt`'s `burst`), which is not asked of the pointer at all.
- The budget is real — `MOST_MOVING = 24` players for the whole app — and a pointer is the
  one thing allowed past it: the emoji somebody has walked up to is the one that most
  deserves a place. It gives that place back when the pointer leaves, and only when the
  budget is actually overdrawn (`giveBack`), because otherwise walking a pointer along a row
  would leave every tile it crossed running for good.
- A burst is not subject to any of the above while it runs: it was asked for by a message
  being sent or arriving, and it ends when its own animation ends, so a scroll or a pointer
  crossing it cannot cut it short. Without that guard the observer's very first callback —
  "you are on screen" — stopped a burst that had only just started, which is exactly the
  fault the owner reported.
- `prefers-reduced-motion: reduce` plays nothing at all, and a hover does not override it:
  the still drawing is already there, so nothing has to be replaced, only withheld. The
  player is `lottie-web`'s **light** build, fetched with `import()` the first time something
  needs it, so a chat that is only read never downloads it.
- A consequence of that rule, named rather than discovered: on a device with no pointer that
  can rest — a phone, a tablet — the panel is **still**, because a touch arrives and leaves
  in the same instant. That is the rule as the owner asked for it, and it is the same
  stillness a message's emoji keep there.

**"Just arrived" is a fact about the message, not about the screen.** A row that came into
view must not set a whole thread moving every time somebody scrolls it, so
`src/features/convo/arrivals.ts` (7 cases) keeps the moment each message arrived — by either
of the two names a message can be known by, because a bubble is drawn twice, once
optimistically under its `client_id` and once as the server's copy, and the first moment
wins — and forgets it after three seconds, which is what bounds the map on a busy thread.

**Every drawing is Google's — the still and the animation both.** Google's animated-emoji
CDN, the set Gmail and Android draw, keys an emoji by its own code points in lower-case hex
joined by underscores (`2764_fe0f` for ❤️, `1f44b_1f3fd` for 👋🏽), which is `cdn.ts`, and the
same key addresses the still (`/emoji.svg`) and the animation (`/lottie.json`). Every one of
the 1,906 emoji in the table was asked for by name before the table was generated, so a
drawing is never requested that is not there: 1,892 stills and 605 animations among the
plain forms. A tinted emoji is a **different** emoji to that CDN rather than a variation of
the plain one — only 250 of the 1,615 toned forms move, against 605 of the 1,906 plain ones
— so the five tinted drawings and five tinted animations of each of the 323 tone-able emoji
were measured the same way instead of being derived. The fourteen emoji Google draws nothing
of — ©️, ®️ and the ten keycaps, with `#️⃣` and `*️⃣` among them — fall back to the character
itself in the machine's font, which is the first layer `EmojiArt` writes and, for those
fourteen, the only drawing there is.

**One emoji is one drawing, and the round had to be told so.** Last of the owner's reports,
sent with a picture of two pink bubbles each holding folded hands — *"kisi kisi emoji me do do
emoji aa raha hai ek hover karne par animate hota hai aur ek nahi hota hai please ise fix
kijiye jisse ek hi emoji aaye"* — and then, narrowing it himself: *"aur ye problem sabse jyada
people & body wale me jyada hai"*. He was right about both, and the second was the clue. The
character layer was **never** hidden: Google's still was laid over it, so the still's own
outline mostly covered the machine's glyph, and on hover the still stepped aside for the
animation — whose figure is thinner than the still it replaced — and the glyph underneath was
what he could see moving in place. Which emoji look doubled is decided by how far the two
figures part company, which is exactly why faces were innocent (a grin is the same shape twice
over) and hands were not. `EmojiArt` now derives **`covered = drawn || animated`** and paints
the character only while it is the only drawing there is; it steps out with `opacity-0` over
the same hundred milliseconds the still comes up in, so the two drawings trade places instead
of one blinking out under the other. `opacity` and not `visibility`, because the character is
still the sentence it was said in: in a message it stays in the DOM to be selected, copied and
read out, and only a tile — a button and nothing else — is `select-none`. The fourteen emoji
Google draws nothing of are untouched by this: their still never loads, `drawn` stays false,
and the character is the drawing.

**Three generated files rather than one.** `data.ts` (100 kB) is the picker's table: the
character, the name, the group, whether it takes a tone, whether Google draws it, whether
Google animates it, the words its name does not already contain, and the ten tone digits.
`flags.ts` (40 kB) is the same measurements with the names, groups and search words left
out, and it is what `text.ts` reads: a message is on the first screen of every chat and
should not fetch a search index — about 55 kB of it — to find out whether one emoji moves.
`flags.test.ts` holds the two files to each other row by row so they cannot drift.

**The other sets were built, measured, and then taken out again — none of them left dark.**
Between the second and the fifth of the owner's messages this round carried five resting
looks: the device's own font, 3moji (`jeremytoys/3moji`, CC BY-SA 4.0), Microsoft's Fluent
3D and Fluent flat (`microsoft/fluentui-emoji`, MIT), and Google; a fourth candidate,
EmojiTwo (`EmojiTwo/emojitwo`, CC BY 4.0 — a free redraw of Apple's own shapes, which is why
it was worth measuring against *"jaise whatsaap ka hai waise chahiye"*), was measured and
dropped before it was wired to the panel. The owner's last message closed the question, so
`looks.ts`, `fluent.ts`, `threed.ts`, `moji3d.ts`, `emojitwo.ts` and their test files are
**deleted**, the `xelvic.emoji.look` storage key is gone from `src/constants/storage.ts`, and
the picker's Look chip — and the five-drawing preview row behind it — is gone with them.
`EmojiArt` takes no look: Google's still, Google's animation over it, the character
underneath. There is no dead switch and no preference that no longer does anything.

**A browser has no emoji key, so the composer has a panel.** The phone has no picker of its
own — its keyboard supplies emoji, and the app's own shelves are small and for one job each
(`kReactions` six, `kStoryFaces` five, `roomThrows` five, and `drop_post.dart` sixty-tile
caption board). `EmojiPicker.tsx` draws the whole of Unicode instead: 1,906 emoji in 9
groups, a search across names and search words that requires all the words typed rather than
any of them (`SEARCH_LIMIT` 120), a shelf of the last 24 reached for, kept in `localStorage`,
and the five skin tones offered only where the page on screen holds something a tone can
change. **What travels is plain text**: a pick lands on `onPick` as an ordinary emoji
character, so a message keeps its emoji on a device that has never heard of Lottie and no
CDN is asked to serve a drawing to a reader. The panel is fetched with `React.lazy`, so a
chat that never opens it never downloads the table.

**The mic records now.** The composer's round button is the phone's own hold-to-record,
ported number for number: `voicehold.ts` carries `CANCEL_SLOP = 70` and `LOCK_SLOP = 60`
from `chat_audio.dart`'s `voiceHoldCancelSlop`/`voiceHoldLockSlop`, `MIN_VOICE_MS = 1000`
from `chat.dart`'s `_minVoiceDuration`, thirty minutes and 25 MB from
`VoiceRecordingController`'s own defaults, and 120 loudness samples at one every 100 ms from
its `maxWaveformSamples`. Nothing is decided until the finger comes up, so sliding back to
the button undoes either choice; a slide up parks the recorder with nobody touching it and
the strip's Send ends it; a tap says "hold the mic" rather than sending a note, and a note
under a second is thrown away with *"Hold the mic to record — a tap is too short to send."*

What the strip draws is what the recorder actually read: `useVoiceNote.ts` runs a
`MediaRecorder` and an `AnalyserNode` over the same stream, takes one reading every 100 ms,
and turns a root-mean-square into the 0–100 bar the phone sends (`amplitudeBar` — in
decibels, because speech sits at 0.02–0.1 rms and would draw three pixels of bar whatever
anybody said). The container is chosen by what the browser will actually record, from
`audio/mp4;codecs=mp4a.40.2` down to `audio/ogg;codecs=opus`.

The finished note becomes a message through the same door a picture takes: `uploadAsset`
with `kind: "voice"` and `voice: true` — `POST /chat/assets/`, an endpoint that has carried
the phone's own voice notes all along — and then `chatService.send` with the asset's id. The
length travels as the recording's own clock rather than the container's, which is not
pedantry: asked of Chrome 156, an `<audio>` element answers 2.56 s for a two-second MP4/AAC
and `Infinity` for the WebM/Opus that a browser without MP4 falls back to, because that
container writes its length at the end where an element reading only the header never looks.
A note sent with no length is a bubble that cannot say how long it is.

**What the browser was actually asked.** The real components were mounted in Chrome and
looked at, because every rule above is about what appears on a screen:

- `google-only.mjs` is the closing measurement, taken after the other sets were removed.
  Mounted exactly as the chat mounts it, the panel's Smileys page drew **169 images, all 169
  from `fonts.gstatic.com`, none from `cdn.jsdelivr.net`, none from anywhere else**; People &
  Body drew **386, all Google again**. The sample addresses were `/1f600/emoji.svg`,
  `/1f603/emoji.svg`, `/1f604/emoji.svg` — the still, keyed by the character. There was no
  Look chip in the panel, and `localStorage` held no `xelvic.emoji.look` after a fresh mount,
  which is what "the choice is gone rather than hidden" has to mean.
- `hover-tiles.mjs` is the measurement of the second report. `EmojiPicker` mounted exactly as
  the chat mounts it, with real `Input.dispatchMouseEvent` mouse moves, counting only Lottie's
  own `<svg>` inside a tile's stage span — the still is an `<img>`, so a player and a still
  cannot be confused, and the panel's own header icons are excluded by construction. With the
  pointer in a corner: **`{"running":0,"drawn":169}`** — 169 tiles drawn, none moving. Held on
  the grinning face: `{"running":1,"labels":["grinning face"]}`. Pointer away: `{"running":0}`.
  Held on heart eyes: `{"running":1}`; away: `{"running":0}`. Held on the smiling-open-mouth
  face: `{"running":1,"labels":["grinning face with big eyes"]}`; away: `{"running":0}`. One
  tile moves, and it is the one under the pointer.
- `emoji-text.mjs` asks the same of the other half, mounting the real `EmojiText` and driving
  `burst` through the same prop `ChatPage` uses: idle `{"emoji":2,"running":0}` → hovered
  `{"running":1}` → pointer left `{"running":0}` → burst `{"running":2}` (no pointer anywhere)
  → settled `{"running":0}`. A sentence's emoji are still until pointed at, and a send or an
  arrival plays without one and stops by itself. Both probes were run again after the
  one-drawing change and read the same numbers, which is what "nothing else moved" has to mean.
- `bubble-layers.mjs` and `bubble-ink.mjs` are how the doubled emoji was found: they mounted
  the real 42px `EmojiText` bodies and asked each of the three layers what it computes to, then
  forced the character layer transparent and counted the ink; what the count lost was the
  machine's own glyph showing on the page. It was never zero.
- `one-drawing.mjs` is the closing measurement. Seven real bubble-sized bodies — folded hands,
  grinning face, thumbs up, raising hands, victory hand and clapping hands at the 42px
  `bubbleType` gives a one-emoji message, plus one 120px folded hands — mounted through the
  same `EmojiText` the chat uses. At rest **every character layer computed to `opacity: "0"`
  with its still at `opacity: "1", loaded: true`**; on the large folded hands with the pointer
  resting on it the still was `visibility: hidden` with a Lottie player injected, so the only
  drawing on that tile was the animation. Forcing the character back on — the way it was drawn
  before this change — changed **1,234 pixels across the probe at rest and 1,301 with the
  pointer resting**, and per emoji at 42px it was 😀 **0**, 👏 13, 👍 37, ✌️ 102, 🙏 132, 🙌
  **189**, with the 120px 🙏 at 761. That list is the owner's own observation measured: the
  face is zero and the hands are not, and the worst of them are People & Body.
- `tile-drawing.mjs` asks it of the panel, which is where the owner first saw it. It mounts the
  real `EmojiPicker` full-screen the way the composer mounts it and reads all three layers of
  every tile under the Smileys page: **169 tiles, 169 stills landed, `characterPainted: 0`,
  `bothPainted: 0`, `offenders: []`** — at rest with the pointer in a corner and again with one
  tile held. No tile draws the machine's glyph under Google's still, so the rule holds in both
  places `EmojiArt` is used and not only in the message bodies.
- The look-era probes (`three.mjs`, `picker3d.mjs`, `looks.mjs`) did their job while the five
  sets existed and are recorded above in this file's own history: five chips, five different
  pictures, jsDelivr drawings on the tile, and a reload that came back in the chosen look.
  They describe a system that is no longer in the tree and are kept only as the measurement
  that was made, not as a description of this build.
- `voice.mjs` mounted `useVoiceNote` on a button in Chrome 156 with Chrome's own fake
  microphone. A three-second hold and release produced a real `voice-*.m4a`,
  `audio/mp4;codecs=mp4a.40.2`, 36,220 bytes, `durationMs` 2195, 19 loudness readings and a
  loudest of 41. The same hold slid left produced nothing and said nothing. A 120 ms tap
  produced nothing and said *"Hold the mic to record — a tap is too short to send."* A hold
  slid up parked it (`phase=locked`, no note yet), and the strip's Send then produced 35,113
  bytes, 2,146 ms, 20 bars and a loudest of 88.

**Not verified, and not claimed.** `npm run typecheck`, `npm run lint`, `npm test` (**395
cases, 33 files**, `motion.test.ts`'s `wanted` describe now four cases and the file eleven)
and `npm run build` all pass; `motion.test.ts`, `text.test.ts`,
`model.test.ts`, `flags.test.ts`, `voicehold.test.ts` and `arrivals.test.ts` are new this
round. The look-era suites (`looks.test.ts`, `fluent.test.ts`, `emojitwo.test.ts`) went out
with their modules, which is why the closing case count is lower than the peak during the
round.

But **no live server was reached and nothing was done in the signed-in app**, so the
half of the voice note that faces the server — the upload of the recording, the message that
carries it, and the bubble that plays it back — is written and unexercised, and the emoji
work has never been seen inside a real thread with real messages in it. The recording is
timed from the moment the recorder arms rather than from the moment the finger went down,
which is the phone's own behaviour and was measured: a three-second hold produced a 2,195 ms
note with the fake device. A browser without MP4 records WebM/Opus, whose length no element
can report, which is why the recording's own clock is sent — and Safari's own recording
support is not something this round watched. Every emoji drawn at rest now costs one Google
still, and the fourteen Google draws nothing of cost nothing and show the character. At the
close of the round the chat page chunk is **139.50 kB / 37.08 kB gzip** (222.92 / 65.52
before the other sets and their tables were removed), the picker **97.46 / 24.78** (99.07 /
25.08), `lottie_light` **169.07 / 47.41**, and the entry **514.84 / 159.96** (514.84 /
159.97). The chat page itself is not a settled number: at the close of the round the working
copy of `src/pages/ChatPage.tsx` differs from the last commit by 1,588 lines added and 523
removed — 1,408 and 343 of them once whitespace is ignored — which is more than this round's
own composer and arrival wiring, so that chunk is measured over work this section does not
describe.

**Two pink bubbles in the owner's picture, and what is honest about them.** He sent a 94×194
crop of two rounded bubbles stacked, each holding folded hands with *Sent* under it. Read
against the code, those are two message rows and not one — a bubble calls `EmojiText` once, and
the four call sites in `ChatPage` (the reply quote, the collaboration and vanish line, and the
two caption sites) are separate elements — so the picture may be showing a thread where the
same emoji was said twice, over the doubling he described. What this round fixed is the
doubling **inside one drawing**, which is what his sentence names and what the ink measurement
found; the two-row reading is not something a screenshot can settle, and it is not claimed
here either way.

**The suite's default worker pool is broken on this machine, and it is not this change.**
`npm test` is `vitest run`, whose default pool fails before any test body runs: all 33 suites
stop at their first `describe` with vitest's own *"failed to find the current runner"* /
`Cannot read properties of undefined (reading 'config')`, on files that have nothing to do with
emoji (`cameraMath.test.ts`, `engine.test.ts`, `moment.test.ts` among them), which is vitest
never finishing its worker bootstrap rather than a test failing. The same suite, the same tree,
passes **33 files / 395 cases** four times out of four under `--pool=vmForks`, and the emoji
picker chunk builds with `.transition-opacity`, `.duration-100` and `.opacity-0` present in the
shipped stylesheet. The failure is **not** this change: with `src/features/emoji/EmojiArt.tsx`
put back to its committed state, the default pool fails the same 33 of 33, and it did so on the
full suite as well as on one file. It was passing earlier the same day and stopped after the
previous round's `npm run build`, so it is written down as an environment fault with a
workaround rather than papered over: nothing in `package.json` was changed to hide it, and the
honest statement is that this round's suite was verified on `--pool=vmForks`.

**Apple's artwork is the one thing this round cannot give.** The owner asked for WhatsApp's
emoji and will not get WhatsApp's emoji from this origin, because WhatsApp's emoji on an
iPhone *are* Apple's, and Apple licenses Apple Color Emoji for Apple's own software rather
than for other people's websites: this origin may not serve it, and no free redraw of it is
the same pictures. The device's own font can be used, because the font never leaves the
device, which is why the alternative-look work started there and why the one set that would
have satisfied the request is the one that cannot ship. What is here is Google's, chosen by
the owner in as many words. The emoji work is the **chat screen's**, and only the chat
screen's: a drop's caption, a comment, a Moment and a room still draw their emoji as text in
the machine's font, which is what the phone does everywhere. The phone's emoji come from its
keyboard, so this round is a **divergence from the phone rather than parity with it** — the
same character has motion here that it does not have there, and nothing in this round claims
otherwise.

## Round 24 — the plus menu's six rows, and a place that can be sent (2026-11-12)

The request, in the owner's words: *"please ab convo ke chatscreen ke input me jo plus par click
karne par open hota hai, please usme photos and videos, file, Location, Spark, sticker aur emoji
ka option add kijiye"* — six rows in the menu the composer's plus opens, named.

The menu held four: **Photo or file** (one file input with the whole list on it), **Sticker**,
**Spark**, **Emoji**. It holds six now, in the owner's order: **Photos and videos**, **File**,
**Location**, **Spark**, **Sticker**, **Emoji**. Every one of them opens something that works —
a picker, a sheet, the camera, the shelf, the panel — which is the one thing this list is not
allowed to contain.

**Two pickers rather than one.** The single input's `accept` was
`image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt`; there are now two inputs carrying
exactly that list, split where the row names split it: `image/*,video/*` for *Photos and
videos*, and `audio/*,application/pdf,.doc,.docx,.txt` for *File*. Nothing new is allowed in and
nothing that used to be picked has stopped being pickable — one list, cut in two, because one
input with the whole list on it answers "a picture" with a document picker. `chooseFile` is
untouched: the kind that travels is still the file's own (`image/` → image, `video/` → video,
`audio/` → audio, everything else → doc), so a clip that a phone's library hands back from the
picture picker is still taken.

**The Location row, and where its sheet comes from.** `src/features/convo/LocationSheet.tsx` is
a port of the phone's own place sheet — `app/lib/screens/place_sheet.dart`, whose header calls
itself *"the one door onto a place"* and whose two halves are the phone's own answer at the top,
drawn with how sure it is, and a search box under it for everything the phone cannot know. That
sheet exists on the phone because of what the owner said on 2026-10-15 — *"jaha jaha location
dalne wala option hai drops moments vibe har jagh location select karte time manually bhi search
kar sake, jaise kisi hotel ka naam"* — and, of a phone placed by its connection rather than by a
satellite, *"mumbai se lucknow aa jau, abhi bhi mumbai aa raha"*. The web's copy keeps both
halves and the same two lookup functions: `myPlace()` for the browser's own position, and
`searchPlaces(query)` for the name somebody types, with the sheet's own line drawn from the
accuracy the browser reported (`Accurate to about N m` under 150 m, `Within about N m` under a
kilometre, `Approximate — could be N km off` past it) and one sentence per way a position can be
refused, only one of which a person can act on: `denied` is their own browser's setting, so the
sheet may say "allow it" for that one and must not say it for a browser that simply had no idea
where it was.

`src/utils/place.ts` is that half of the work: `getJson`, `reversePlace`, `searchPlaces` and
`PlaceChoice` were **moved out of `src/features/camera/CameraCapture.tsx` unchanged** rather than
written a second time, so the camera and the composer name a position the same way, and
`myPlace` — the browser's position folded into one of four refusals, or a fix — is new beside
them. The camera's own `findCurrentPlace` and its fallback are untouched. Naming a position asks
OpenStreetMap (Nominatim, with a BigDataCloud fallback): that is the camera's pre-existing
behaviour, not a decision this round made, and it is why a place row is the one row in this menu
that talks to anybody but Xelvic.

**The message is a kind the backend already had.** A location needs no upload: `Message.Kind.
LOCATION` is in `EMBED_KINDS` in `backend/apps/chat/services.py` (line 67), not in `MEDIA_KINDS`
(line 65), so `send_message` asks for no asset and the coordinates travel in `payload` exactly as
the phone sends them. `sendLocation` therefore posts through the same door every other send uses:
`chatService.send(threadId, {kind: "location", body: place.label, payload: {lat, lng, accuracy_m?}, client_id})`.
`accuracy_m` is sent only when the browser promised an accuracy — a searched place has none, and
the key is left out rather than invented. The receiving half already existed and was not touched:
`locationOf()` reads the payload, the bubble draws it, and the tap opens
`https://www.google.com/maps?q=<lat>,<lng>`.

**What the browser was actually asked.** Two probes drove the real app at `/app/convo/<threadId>`
in headless Chrome against a local stub of the API — the real providers, the real route, the real
guard, the real `ChatPage`, because the menu is inline JSX inside a 5,400-line page and cannot be
mounted on its own. `plus-menu.mjs` read the panel back as
`["Photos and videos","File","Location","Spark","Sticker","Emoji"]` with every row enabled, and
the two inputs as `["image/*,video/*","audio/*,application/pdf,.doc,.docx,.txt"]`; opened the
Location row (the third button) and read the sheet — *Share a location* / *Where you are, or a
place you look up.* / *Search a hotel, a street, a city...*, the browser's fix reported as
**Shahid Major Kaustubh Rane flyover, Mumbai** with *Accurate to about 35 m* under it and the
footer at *Pick a place to send*; ran it again with the emulated accuracy at 2,400 m, where the
line became *Approximate — could be 2 km off*; chose the place, which turned the footer into
**Send this location** and enabled it; and sent, after which the sheet was gone and the thread
held a **LOCATION** bubble. `plus-search.mjs` asked the other half in the same real app, with
geolocation deliberately not granted so the sheet had to draw a refusal: it typed `Bandra` with
real per-character key events and drew **six real rows** from OpenStreetMap (Gurunanak Marg
(Turner Road), Mumbai; Bihar; Gornji Ramići, Bosnia; Brijesnica Velika, Bosnia; and two Madhya
Pradesh hamlets), with the refusal line above them — *This browser is not allowed to see where
you are. A place can still be searched for above.* Choosing the last row enabled the same footer,
and sending put *Madhya Pradesh* in the thread as a **LOCATION** bubble.

**The wire, exactly.** What the composer put on `POST /api/v1/chat/threads/<id>/messages/send/`,
captured verbatim by the stub:

```json
{"kind":"location","body":"Shahid Major Kaustubh Rane flyover, Mumbai",
 "payload":{"lat":19.076,"lng":72.8777,"accuracy_m":35}}
{"kind":"location","body":"Shahid Major Kaustubh Rane flyover, Mumbai",
 "payload":{"lat":19.076,"lng":72.8777,"accuracy_m":2400}}
```

and, for a searched place, with no `accuracy_m` at all because the browser never gave one:

```json
{"kind":"location","body":"Madhya Pradesh","payload":{"lat":22.2962668,"lng":79.6823517}}
```

Each carried a `client_id`, which is the same idempotency key every other send carries. Nothing
else left the page but the app's own calls to the stub on `127.0.0.1:5599` and the geocoder calls
the shipped sheet itself makes.

**One row had already left this menu, and this round did not take it.** The last commit's
`ChatPage.tsx` has a fifth row — **Ask the crowd** — opening a `PollComposer` (one question and up
to six answers, sent as `kind: "poll"`). The working copy this round edited did **not**: the panel
it replaced held four rows, and `PollComposer`, `pollOpen` and `sendPoll` are in no file in the
tree. Recorded rather than quietly worked around: no edit to `ChatPage.tsx` in this session — or
in any transcript on this machine — removed that row, the round's own edit to the panel took a
four-row panel as its starting text, and the receiving half (the poll bubble and the vote) is
intact and still calls `chatService.vote`. So a chat poll can be **answered** here and not
**asked**, which is a gap against the last commit and **not** against the phone: the phone's own
chat has no such row either (see `XELVIC_MOBILE_FEATURE_INVENTORY.md`, Round 24) — polls are
created as drops and Moments on both sides. It is left exactly as it was found, because restoring
code somebody else removed is not what this round was asked for, and the owner should decide
whether that row comes back as a seventh.

**Checks.** `npm run typecheck`, `npm run lint` and `npm run build` are clean, and the suite is
**402 cases across 34 files, PASS** — on plain `npm test`, whose default pool failed on this
machine throughout Round 23. That fault has healed on its own: nothing in `package.json`,
`vitest.config.ts` or the tests was changed, and Round 23's `--pool=vmForks` caveat no longer
applies. This round's one new test is `src/utils/place.test.ts` (7 cases, described above).
Chunks at the close: entry **514.83 kB / 159.97 kB gzip**, chat page **141.86 / 37.84** (139.50 /
37.08 before — the sheet, the six rows and the two inputs are in the chat page's own chunk),
EmojiPicker 97.70 / 24.86, `lottie_light` 169.07 / 47.41, ConvoLayout 90.07 / 23.50,
`place` 2.61 / 1.18 as its own shared chunk now that the camera and the composer both import it,
and the stylesheet 137.30 / 24.52.

**Not verified, and not claimed.** The message was **never delivered to a real backend**: no
server was reached, the live API was deliberately not contacted, and the stub answers what the
backend's own tests and serializers say it answers. So the send is verified as *this client's
request* and its optimistic bubble, with server acceptance taken from
`backend/apps/chat/tests` and from `services.py`'s own handling of `LOCATION` — it was not watched
landing. The probes measured the menu and the sheet with a mouse, not a finger. The room rule the
phone's own attach sheet honours (`_showAttachmentSheet`'s `only`, and `channel_allows` in
`services.py`) is **not** honoured here and cannot be: the web's `Channel` type carries `id`,
`name` and `position` and no media rule, so a photos-only room still offers *File* — a
pre-existing gap that this round neither caused nor closed. A searched place carries no accuracy
because there is none to carry. If OpenStreetMap is unreachable the sheet says nothing by that
name rather than inventing a row. And the six rows are the chat composer's only: a drop, a Moment,
a comment and a room are unchanged.

## Round 25 — the convo's Vibes is the Vibes screen, and the shelf asks for everybody (2026-11-12)

The request, in the owner's words: *"chatheader me jo vibes section hai please uska design fix
kijiye aur usme like, comment share aur save ka bhi option rakhiye aur abhi usme kewal followers
ka hi videos aa raha hai jabki sabhi ka aana chahiye aur jo jo drops ke vibe me wo sab kuch
chatheader ke vibes me bhi hona chahiye wo sab features"* — four things: the design, the four
rail actions, the shelf's reach, and parity with the Drops walk.

**What the panel was.** `src/features/convo/VibesPanel.tsx` was a player of its own, written
separately from the Drops screen: a play/pause button under the clip, a previous/next pair, an
"n / total" counter, and nothing else. No felt, no responds, no share, no save, no caption, no
scrubber, no ⋮. A clip watched beside a thread could not be answered at all, and nothing said
who had made it. Its door was not a button either — a five-pixel strip of accent colour down the
header's edge, which is a thing you find by accident.

**What it is.** One component draws one Vibe, and both screens use it.
`src/features/drops/VibeSlide.tsx` is that component: it was lifted out of the Drops walk this
round so the walk and the panel cannot drift — a rail, a caption, a scrubber and a comment sheet
with two implementations would eventually mean two different things. `VibeViewer.tsx` (the
full-screen walk) now renders `<VibeSlide>` and keeps only its own bar, its scroller and its
document-level Escape/arrow keys; `VibesPanel.tsx` renders the same `<VibeSlide>` in a reel
beside the thread and keeps only the two things a panel has that a full screen does not — a close
button with a title drawn on a shadow rather than on a scrim, and no studio or camera (those
navigate, and a control inside a convo that takes the app away from the thread is a different
thing from a control on the Vibes screen). The ⋮ is in the panel because everything on it is
about the clip in front.

The rail that both screens now draw, in the order it is drawn: **Felt** (the heart, with the
boom), **Comments**, **Share**, **Save**, **Mute**. Tap a clip to pause, tap again to play, tap
the open player to put it away, double tap to feel, hold 500 ms for the player panel (scrubber,
four speeds, "When it ends: the next Vibe plays / replay"). The caption is there with *Read
more* past 120 characters, mentions link, music and a collab credit are drawn, the comment strip
and the two `vibePrompts` sit under it, and the 96-pixel empty room above Felt is the 2× pad.

**The door.** `src/pages/ChatPage.tsx` now puts a real 40×40 icon button in the convo header,
before the ⋮ — carrying the clapperboard, `aria-label="Open Vibes"` / `"Close Vibes"`,
`aria-expanded`, and an accent tint while the panel is open. The strip is gone. Opening it sets
`vibesOpen`; opening the info sheet closes it, and vice versa; `rightOpen` is either.

**The shelf asks for everybody, and the client narrows nothing.** The panel reads the same query
the Drops walk reads — `dropsVibesQuery` → `dropsService.vibesFeed` → `GET /drops/vibes/?limit=8`
— and `src/features/drops/feedQueries.ts` sends no author, no following flag and no filter. The
server's `visible_vibes` (read, not modified — `backend/apps/drops/…`) is
`Q(author=me) | Q(author__is_private=False) | Q(author_id__in=following_ids(me))` plus block,
mute, hidden, age, country and language filters: **there is no followers-only clause on either
side.** If the live shelf looks like only followed people, that is a deal of the corpus (who
posted, what the reader can see), not a filter this client applies.

**The probe, and what it proves.** `stub-vibes.mjs` answers the shelf with **three clips from
three authors the reader does not follow** — Meera, Dev, Noor, none of them the reader — and
records every body the app posts before it answers. `convo-vibes.mjs` drives the real app at
`/app/convo/<threadId>` in headless Chrome: the real providers, the real route, the real
`ChatPage` (the panel's door and its aside are inline in a 5,400-line page and cannot be mounted
apart). It read back:

- the door as `BUTTON` titled `Vibes`, 40×40, `aria-expanded="false"` before the click;
- the panel's bar as `Close Vibes` / `Vibes` / `1 / 3` / `More`;
- all three strangers drawn — `Meera's Vibe`, `Dev's Vibe`, `Noor's Vibe` — while the only
  shelf request on the wire was `GET /api/v1/drops/vibes/?limit=8` (plus its `seen` report);
- the rail on every slide as `Felt 46x52`, `Comments 46x50`, `Share 46x49`, `Save 46x27`,
  `Unmute 46x27`, and the pad present;
- Felt → `POST /api/v1/drops/vibes/<id>/like/ {"on": true}`;
- Save → `POST /api/v1/saved/ {"kind": "vibe", "id": "<id>", "on": true}`, after which the glyph
  read `Saved`, `aria-pressed="true"`;
- Comments → the sheet, a typed line sent as `POST /api/v1/drops/vibes/<id>/comments/
  {"body": "from the vibes panel"}`, with the panel still mounted afterwards;
- Share → the sheet with *Send to Jaya*, *Another app*, *Copy a link*;
- a 500 ms hold → the player panel: scrubber, `0.5× / 1× / 1.5× / 2× speed`, `Next` / `Replay`,
  *When it ends — The next Vibe plays*, `Done`;
- and `POST /api/v1/reco/signals/` carrying `surface: "vibes"` with all three clips and their
  positions, once per opening.

**A bug the probe found, in both screens.** Sampling while the finger was still down showed the
player opening; after release it shut. The browser sends a `click` when a press is released
however long it was held, and `onTap` read that click as "put the player away" — the hold worked
and nobody could see it. It was pre-existing in the committed `VibeViewer.tsx` (`onTap`, line
688; `longFired` was only checked in `onDouble`) and the shared component had inherited it.
`VibeSlide.onTap` now returns at once when `longFired.current` is set, and that mark is cleared
by the next press and nothing else. After the fix the hold timeline read `shut ×4, open ×6` —
open before release and still open after it.

**What this round did not verify.** The clips in the probe were a four-byte stand-in, so what the
panel's *picture* looks like playing a real Vibe is **NOT VERIFIED** — the chrome, the rail, the
bar and the player are measured; the video frames are not. Share is verified as far as its sheet:
the rows were drawn and nothing was picked inside it, so **no share write was sent** and the
route's acceptance is read from `drops.service.ts`, not measured. Everything above was measured
against a local stub, not the live API; no real account was used, and no live request was made.
The backend was read only: `backend/apps/drops/` and `backend/apps/chat/services.py` were read to
confirm the shelf's filter and the comment route, and **no backend file was created, edited or
deleted** — nothing outside `xelvic-web/` changed this round.

**Checks.** `npx tsc -b` clean; `npx eslint .` clean; `npm test` 34 files / 402 tests passed;
`npm run build` succeeded — `ChatPage` 148.38 kB (39.73 kB gzip), `VibeSlide` 23.36 kB (7.62 kB
gzip), entry 514.78 kB (159.95 kB gzip), the pre-existing >500 kB warning unchanged.

## Round 26 — the sticker shelf is the emoji shelf's size, and every sticker is drawn at one size (2026-11-12)

The request, in the owner's words: *"chatiput me plus par click karne par sticker me jo sticker
panel open ho raha hai please us panel ka hight aur width exact emoji panel ke jitna kijiye aur
sticker panel jo stckers hai un sab ka size ek jaisa nahi hai, please sabhi ka size ek jaisa
kijiye, chota bada na dikhe"* — two asks: the panel's box, and the stickers inside it.

Both were real, and both were measured in the running app before anything was written.

**The box.** Opened from the composer's plus, the two panels were **the same width and a
different height**, and the difference was a whole row:

| | width × height | rows top to bottom |
| --- | --- | --- |
| emoji picker | **340 × 363** | 41 · 29 · 258 · 33 |
| sticker sheet | **340 × 339** | 41 · 264 · 32 |

The sticker sheet had no title row at all — the emoji picker's second row is where "Smileys &
People" is written, and there was nothing on the sticker side to write there. Its grid took the
row's height instead (264 against 258), and its pack bar was 32 where the emoji's group bar was
33. Worse, the pack bar was drawn **only when the shelf held more than one pack**, so on a shelf
that came back with a single pack the box lost another 32 pixels and moved a second time. A panel
that changes height with what came back from the network is the complaint underneath the
complaint.

`src/components/ui/shelf.ts` is new: one file holding the four rows, each with its measured
height written down — `SHELF` (the box), `SHELF_SEARCH` (41), `SHELF_TITLE` (29), `SHELF_GRID`
(`min(258px, 42vh)`), `SHELF_FOOTER` (33), `SHELF_TITLE_TEXT`. The emoji picker and the sticker
sheet both import them, so the two panels are the same size **by construction** rather than by two
sets of numbers kept in step by hand. Three edits followed:

- `StickerSheet.tsx` gained the missing title row, naming the pack in front (`All stickers`, or
  the pack's own name) with the count of what is shown beside it — the same row the emoji picker
  spends on "Smileys & People";
- `StickerSheet.tsx`'s pack bar is now **always drawn**, even for a one-pack shelf, so the box
  cannot move with the network;
- `ChatPage.tsx`'s Suspense fallback for the lazy emoji picker was `h-[320px] w-[350px]` — a
  placeholder a different size from the panel it was holding, which is a jump you can see. It is
  now built from the same four rows.

**The stickers.** The grid was never the problem: every cell already measured 75 × 75 with a
63 × 63 drawing box inside it, and every file was already drawn with `object-contain`. The
difference was **inside the files**, and measuring it needed the real catalogue — the shelf is
read from `https://sticker.gaongram.in/api/stickers?limit=1000`, which is public and needs no
token. Ninety stickers sampled off it:

- **49 of the 90 carry a transparent margin on at least one axis** — the ink box is under 92% of
  the file on one side or both;
- drawn as they were, their visible ink covered anywhere between **775 and 3843 square pixels**,
  and stood between **22 and 63 pixels** tall — a five-fold spread in area, and the smallest of
  them a third the height of its neighbour;
- the worst case, `image-removebg-preview (3)` — a **512 × 279** file whose ink occupies only
  **48% × 73%** of it — was being drawn at **31 × 25** inside a 63-pixel box, next to a sticker
  that filled its box. Side by side they did not look like the same kind of thing.

`object-contain` cannot fix that: it fits the **file**, and the file is mostly empty.

`src/components/media/StickerArt.tsx` is new and measures the ink rather than assuming it. It
draws the `<img>` the grid has **already loaded** into a 128-pixel-wide canvas, scans the alpha
channel, and finds the bounding box of the visible pixels as fractions of the file; the picture is
then sized so that its **longest visible edge is exactly the box's edge** and slid so the middle of
the ink sits in the middle of the box — the transparent margin hangs outside, where it costs
nothing. Three properties it had to keep, and does:

- **Nothing is fetched twice.** The measurement reads the element the grid already downloaded, so
  `loading="lazy"` still decided which stickers were read at all, and the measuring itself cost no
  request. (Round 27 later changed what `lazy` means on this shelf — the whole shelf is now asked
  for, so an open does pull six hundred pictures — but it still costs **one** request per sticker,
  never two.)
- **A host that forbids reading is not a broken sticker.** Reading a canvas needs the picture's own
  CORS header. The picture is requested with `crossorigin="anonymous"` so it *can* be measured; if
  the host refuses that request outright the element is retried **without** it and the sticker is
  drawn the plain, old way rather than not drawn at all. The Cloudinary hosts behind this
  catalogue answer `Access-Control-Allow-Origin: *`, so in practice the measurement succeeds.
- **Nothing waits to be seen and nothing flickers.** Until the ink is known the sticker is drawn
  exactly as it was before, so a cell is never empty.

Nothing is cropped — a wide sticker keeps its wings — and nothing is stretched, because only the
transparent margin is taken up.

**What the probe read back.** `panels.mjs` drove the real app at `/app/convo/<threadId>` in
headless Chrome against a loopback stub, opening the plus and both rows. After the change both
panels measure **340 × 363 with identical rows 41 · 29 · 258 · 33**, and every sampled sticker
reports a longest ink edge of **63**:

| sticker | file | ink box | drawn before | drawn now |
| --- | --- | --- | --- | --- |
| `image-removebg-preview (3)` | 512 × 279 | 48% × 73% | 31 × 25 | **63 × 52** |
| `winged heart with golden halo` | 512 × 341 | 98% × 87% | 62 × 37 | **63 × 37** |
| `winged heart with arrow` | 512 × 341 | 98% × 98% | 62 × 41 | **63 × 42** |
| `yellow heart` | 512 × 512 | 88% × 78% | 55 × 49 | **63 × 56** |

What is left is the art's own aspect and nothing else: a genuine 1.86 : 1 sticker is drawn 63 × 34,
which is what a 1.86 : 1 sticker *is*. Equal **area** was considered and rejected — it would mean
drawing a wide sticker wider than its cell, which crops its wings or overlaps its neighbour.

**What this round did not do.** The editor's own sticker shelf
(`src/features/camera/PhotoEditor.tsx`) still draws with `size-full object-contain` and therefore
still shows the same uneven sizes; it was **not** changed, and it is not claimed to be. The
**phone** carries the same behaviour — `app/lib/screens/chat_sticker.dart` uses a uniform square
cell with `BoxFit.contain`, which fits the file for the same reason — and it was read, not changed:
`xelvic/` is read-only. And this is not a claim of parity: the two web panels now share one box and
the shelf one sticker size, which is what was asked; nothing else about the panels was unified.

**Checks.** `npx tsc -b` clean; `npx eslint .` clean; `npm test` 34 files / 402 tests passed;
`npm run build` succeeded in 5.87 s — `ChatPage` 150.50 kB, `EmojiPicker` 97.30 kB, entry 514.78 kB
(159.95 kB gzip), the pre-existing >500 kB warning unchanged.

## Round 27 — every sticker is on the shelf, and there are no GIFs to give a section (2026-11-12)

The request, in the owner's words: *"Abhi sabhi stickers nahi aa raha hai, please ise fix kijiye
jisse sabhi stickers aaye aur agar isme koi gif ka bhi hai to isi me ek gif ka section add kijiye
jisme sabhi gif dikhega aur agar nahi hai to leave it kewal sabhi sticker ko laiye"* — two asks:
bring all the stickers, and add a GIF section **if** there are GIFs.

**The second ask is answered first, because it changes what gets built: there are none.** The
shelf's catalogue is `https://sticker.gaongram.in/api` — `GET /api/stickers?limit=&offset=`, public,
no token. Paged through at `limit=100` it answers **602 rows across seven pages**, with **602
unique ids**, and every row carries the same seven keys (`id, packId, url, tags, animated, pack,
match`). Counting the one that decides it: **`animated: true` is 0 of 602.** There is no GIF on the
shelf to show, so per the owner's own instruction — *"agar nahi hai to leave it kewal sabhi sticker
ko laiye"* — **no GIF section was added**, and that is a finding rather than a skipped task.

**The first ask was real, and it was not the data.** The shelf already fetched all seven pages and
the grid already built **602 cells, not one of them broken**. What was missing was the pictures.
`StickerArt` drew each sticker with `loading="lazy"`, and lazy means a cell stays blank until it
comes near the window it is scrolling in — a window **258 pixels tall**, over a grid **159 rows and
11,941 pixels** long, of which **16 cells** are visible at once. Measured in the running app before
anything was changed:

| where the shelf was | cells | drawn | blank | broken |
| --- | --- | --- | --- | --- |
| as it opens | 602 | **76** | 526 | 0 |
| after 5 screens | 602 | 136 | 466 | 0 |
| after 10 screens | 602 | 196 | 406 | 0 |
| after 15 screens | 602 | 252 | 350 | 0 |
| after 20 screens | 602 | 312 | 290 | 0 |
| jumped to the very end | 602 | **386** | **216** | 0 |

Twenty screens of patient scrolling left **216 stickers blank**, and jumping straight to the bottom
— which is what a person does when looking for something specific — left the same 216. On a shelf
that tall, that reads exactly as the owner described it: stickers that never came.

**The fix.** `StickerArt` gained one prop, `eager`, which decides the `loading` attribute
(`loading={eager ? "eager" : "lazy"}`); `StickerSheet` turns it on **350 ms after the shelf opens**
and off again when it closes. The beat is why it is a timer rather than a plain `true`: the first
screenful gets the connections to itself, and then the rest of the shelf is asked for, so that a
scroll never arrives before the drawing does. After the change, the same probes read
**602 cells / 602 drawn / 0 blank / 0 broken** at rest, after each of the twenty screens, and at the
very end.

**What it costs, measured rather than guessed.** With a cold cache — a fresh browser profile, so
nothing is served from disk — the shelf pulls **602 pictures, one request each, 26 MB in total**,
and the last of them is drawn **about 7.5 s** after the panel appears:

| when | asked for eagerly | drawn | blank | files on the wire | MB |
| --- | --- | --- | --- | --- | --- |
| 2.1 s | 0 | 0 | 602 | 0 | 0.0 |
| 4.2 s | 602 | 165 | 437 | 165 | 8.9 |
| 7.5 s | 602 | **602** | **0** | **602** | **26** |

Every one of those pictures answers `cache-control: private, no-transform, immutable,
max-age=2592000` — **thirty days** — so a second open costs almost nothing (a warm re-open was
measured at ~0 bytes). An earlier estimate of 54 MB came from `content-length` headers on a sample
of twenty-five; the wire count says 26 MB, and the wire count is the one that is written down.

**Checks.** `npx tsc -b` clean; `npx eslint .` clean; `npm test` 34 files / 402 tests passed;
`npm run build` succeeded in 5.49 s — `ChatPage` 150.69 kB, `EmojiPicker` 97.30 kB, entry 514.78 kB
(159.96 kB gzip), the pre-existing >500 kB warning unchanged.

**What this round did not do.** No GIF section, because there are no GIFs (above). The pictures were
**not** asked for at a smaller size: the Cloudinary transform in the URL (`f_auto,q_auto,w_512,
c_limit`) is part of the URL that is sent to the backend when a sticker is picked, so shrinking the
download would change the message. The grid's density was not touched — Round 26's 340 × 363 box
with four columns is what the owner asked for and it stands. The editor's own sticker shelf
(`src/features/camera/PhotoEditor.tsx`) still uses `loading="lazy"` over the same 602 stickers and
was **not** changed, so it still behaves as the composer's shelf did before this round. The **phone**
is the same — `app/lib/screens/chat_sticker.dart` was read and not changed (`xelvic/` is read-only) —
and this is not a parity claim.

## Round 28 — the character comes up over the composer while they write (2026-11-12)

The request, in the owner's words: *"Alright, abhi jaise typing par charector typing indicator aa hai
waise isme nahi aa raha hai, please ise fix kijiye"*. On the phone, somebody writing to you is not a
line of words — it is **their character**, standing up out of the seam between the thread and the
composer, and sliding back down when they stop. The web had the words and not the figure.

**What the web already had, so that this round is not mistaken for one that built the real-time
part.** The live path was there and unchanged: the socket sends `{action:"typing", thread, typing}`
while the field has text and sends `typing:false` **2400 ms after the last keystroke**
([ChatPage.tsx:4106-4116](src/pages/ChatPage.tsx#L4106-L4116)); a received `thread.typing` frame puts
that account in `typers` and clears it again after the frame's own `ttl`
([ChatPage.tsx:4171-4195](src/pages/ChatPage.tsx#L4171-L4195)). What was drawn for all of that was
`Ravi is typing...`. **This round added no new real-time mechanism** — it draws the figure on the
frame that was already arriving.

**The port, and the three numbers it turns on.** The new
[TypingPeek.tsx](src/features/convo/TypingPeek.tsx) is `_peek` from `app/lib/screens/chat.dart`, and
it takes the phone's numbers rather than inventing them: `PEEK_SIZE` = `kPeekSize` = **84**;
`PEEK_RISE` = `kPeekAt` = **0.86**, so the character is drawn 72.24 px up out of its own height;
`PEEK_CLEAR` = `kPeekClear` = `84 × 0.86 + 10` = **82** px, the room the newest message keeps clear
of a character **whether it is up or not** — a fixed inset, because a list that jumped its last
message up every time somebody started typing would be worse than the overlap it avoids. The slide and
the fade are the phone's 260 ms.

**Whose character it is, which is the whole rule.** The figure that comes up while somebody writes to
me is the one **their** account is wearing, because it is them; my own theme decides what they see,
not what I see. So the key is read off their card — `character`, which `UserCardSerializer` has
carried all along and which the web's `UserCard` type now declares — and resolved against the same
shelf the shop sells from. The phone's chain has three rungs (their worn figure, the figure their
*theme* ships, the app's own); the web can reach the first and the third, which is the limit
[`TypingPeek.tsx`](src/features/convo/TypingPeek.tsx) records in its own doc comment and which
`PosedBio` records for the profile. Whether a figure may stand over a composer at all is staff's
`placement`, and that rule now has one name —
[`figureOnChat`](src/features/marketplace/model.ts) — because the phone has the identical four lines
twice (`CharacterRow.onChat` and `ThemeRow.figureOnChat`, both in `app/lib/catalogue.dart`).

**What was measured, in the real app, against a server that really speaks.** A headless Chrome holds
an actual WebSocket to a stub that speaks the same `thread.typing` frame the backend sends, so the
other participant's note arrives over the socket and not from the page's own state. Five moments:

| the other participant | the character | opacity | drawn | above the seam | the picture drawn |
| --- | --- | --- | --- | --- | --- |
| nobody writing | **down** | 0 | 84 × 84 | −1 px | their `typing` pose, not re-asked for |
| writing | **up** | 1 | 84 × 84 | **71 px** | **their** `typing` pose |
| stopped | **down** | 0 | 84 × 84 | −1 px | — |
| writing, wearing a figure staff set to `profile` | **down** | 0 | 84 × 84 | −1 px | — |
| writing, wearing a key the catalogue has no row for | **up** | 1 | 84 × 84 | 71 px | **the bundled** `/char/typing.png` |

The transform read `matrix(1, 0, 0, 1, 0, -72.24)` while up and `matrix(1, 0, 0, 1, 0, 0)` while down,
which is `0.86 × 84` exactly; the 71 is that against the composer's own fractional top edge. Across
the whole first pass the stub was asked for **one** picture, `/pose/typing` — its own figure's typing
pose — and never the bundled robot, which is what proves the drawn figure is *theirs*. No visible
words about typing existed at any of the five moments; the sentence survives only where a reader who
cannot see the figure needs it, as a `role="status"` line that reads `Jaya is typing...` while it is
up and is empty while it is down.

**A negative result that had to be proved rather than assumed.** The first `placement: "profile"`
pass showed the character rising, and the temptation was to call the rule broken. It was the probe
that was wrong: the app keeps its answers in `sessionStorage` for thirty minutes, keyed by account
(`src/store/queryCache.ts`), so the second pass was replaying the first pass's thread, still wearing
the first pass's figure. With the cache cleared between passes the same pass asks the server for
`/catalogue/` and `/chat/threads/<id>/` afresh and the character stays down.

**Checks.** `npx tsc -b` clean; `npx eslint .` clean; `npm test` **35 files / 407 tests** passed (five
new, for the four `placement` values and the no-row case); `npm run build` succeeded in 5.28 s —
`ChatPage` **149.76 kB** (was 150.69 kB in Round 27 — the words came out and the shared `marks` chunk
went in, so this is a smaller number for a change that added a feature, and no improvement is being
claimed from it), `ConvoLayout` 90.04 kB, `marks` 15.61 kB, entry 514.87 kB (159.98 kB gzip), the
pre-existing >500 kB warning unchanged.

**What this round did not do.** The figure a *theme* ships is not reachable: the web's catalogue
carries a figure's pictures but not a theme's, so an account wearing no shop figure gets the bundled
one. A *theme's* `figure_peek` is on the theme's row and is not read here; a *shop figure's*
`peek_size` is. **Typing between two live accounts was not tested** — the frames came from a stub,
and the one frame shape it sends was read off `consumers.py` and `services.py`. The web's dead-man
timer is the frame's `ttl` (the backend's `TYPING_TTL_SECONDS` is **6**, and the phone's own
`kTypingNet` is also 6 seconds, so both nets are the same length by two different routes). Touch and
a real phone were not used, and the phone's `app/lib/screens/chat.dart` was read and not changed.
This is not a parity claim.

## Round 29 — there are two characters, and the second one needed a feature the web did not have (2026-11-12)

The request, in the owner's words: *"Alright, abhi app jaisa nahi aa raha hai aap me jo jo hai exact
waisa hi hona chahiye aur usme typing aur wait 2 charector hai aur dono jaise work kar raha hai app me
waise isme bhi karna chahiye"*. Round 28 drew **one** character on a `typing ?? wait ?? bio` chain,
which is a fallback — three pictures for one state. The phone does not have a chain. It has **two
states** with a precedence rule, and the second state is fed by a feature the web had never ported.

**Why this was structural and not a fallback that needed reordering.** The `wait` character is not
"the figure you show when nobody types". It is the figure you show when somebody is **on one of your
places** — sitting in your convo, looking at your profile — without saying a word. That fact arrives
over the socket as a `focus` event, and the phone's whole half of it lives in `app/lib/looking.dart`
(272 lines) plus `_watchOther`/`_sayLook` in `chat.dart`. `grep` for it in `xelvic-web` found only
`window.addEventListener("focus")` in an unrelated view. So Round 29 was a port of a feature, not an
edit to a picture.

**The precedence rule, which is the whole of the two characters.** The phone's rule is
`chat.dart:1415-1423`, and it is one expression with one notable asymmetry:

| | phone | web |
| --- | --- | --- |
| the picture | `pose: typing ? poses.typing : (peekPose(gaze, poses) ?? last)` | [peek.ts](src/features/convo/peek.ts) |
| whether it stands | `up: typing \|\| gaze != null` | same file |
| what the pose means | `peekPose` returns `poses.wait` whenever a gaze exists, else `null` | same file |

The asymmetry is the point: **writing wins over merely being somewhere of mine.** Somebody typing to
me is being *shown* to me as `typing` even if they are also sitting in my convo, because writing is
the more specific fact and it is the one that comes and goes. But being written to *ends* and being
somewhere of mine *does not* — so when the typing frame stops, the figure does not go down, it goes
back to `wait` and stays up. That is one line in [peek.ts](src/features/convo/peek.ts) and the round's
probe measures all five moments of it.

**What was ported, and where each piece went.** The rules are pure and live outside the widget, which
is this repo's house convention for anything a `node`-environment test can reach:

| file | what it is |
| --- | --- |
| [features/presence/looking.ts](src/features/presence/looking.ts) | `lib/looking.dart`'s rules: what a `kind` means, what goes stale and when, and the three frames this side says |
| [context/looking.ts](src/context/looking.ts) · [providers/LookingProvider.tsx](src/providers/LookingProvider.tsx) | who is looking at whom, the watch/ask/keep timers, and the `focus`/`ready` socket handling |
| [hooks/useLooking.ts](src/hooks/useLooking.ts) | the reader |
| [features/convo/peek.ts](src/features/convo/peek.ts) | the two-character rule, kept out of the widget so it can be tested without a DOM |
| [features/convo/TypingPeek.tsx](src/features/convo/TypingPeek.tsx) | draws whichever of the two the rule chose |

`LookingProvider` is mounted **inside** `SocketProvider` and **outside** every page in
[main.tsx](src/main.tsx), because the fact it holds belongs to the socket rather than to a screen.
[ChatPage.tsx](src/pages/ChatPage.tsx) watches the other participant and says `chat` on the way in,
and takes both back on the way out — unwatch first, then a **named** goodbye, so a goodbye for a
person cannot be mistaken for somebody else's. [PersonProfile.tsx](src/features/profile/PersonProfile.tsx)
does the same with `profile`.

**The numbers, taken from the phone rather than invented.** `GAZE_STALE_MS` is 30 s, which is the
server's own `FOCUS_TTL_SECONDS` — a gaze is believed for exactly as long as the server would believe
it. `GAZE_RECHECK_MS` is 15 s, twice under that, so a person genuinely sitting somewhere of mine is
renewed by two polls before the first one could lapse. `GAZE_REFRESH_MS` is the same 15 s for my own
word, because half of the server's window is one dropped frame away from being too long. The phone
says the same three numbers (`Looking.recheck`, `Looking.refresh`, and `focus_ttl` in `settings.py`).

**One deliberate deviation, recorded rather than hidden.** The phone remembers "the last pose" as one
of three files in its own bundle, which cannot go away. The web's poses are shelf URLs that change the
moment somebody changes their figure, so the memory is **keyed to the set of pictures it came from** —
`memory.current?.art === art`. Without that key a figure change mid-convo would leave the character
standing in the previous figure's pose.

**What was measured, in the real app, over a real socket.** A headless Chrome holds an actual
WebSocket to a stub that speaks `focus` both ways round — the broadcast the way `_focus_said` sends it
and the answer to `{action:"focus", users:[...]}` the way `_focus_asked` sends it — so every gaze is
measured arriving as a frame, not as page state. The gaze was set **before** the convo opened, so the
page can only know it by having asked:

| the other participant | state | character | opacity | the picture drawn | a screen reader hears |
| --- | --- | --- | --- | --- | --- |
| quiet, sitting on my convo | **up** | `wait` | 1 | `/pose/wait`, 84 × 84, **71 px** above the seam | `Jaya has this convo open` |
| writing on top of that | **up** | `typing` | 1 | `/pose/typing` | `Jaya is typing...` |
| stopped writing, still there | **up** | `wait` | 1 | `/pose/wait` | `Jaya has this convo open` |
| gone | **down** | — | 0 | the pose it was drawn in is kept | *(nothing)* |
| their figure is `profile`-placed, writing *and* watched | **down** | — | 0 | *nothing drawn at all* | *(nothing)* |
| their figure is off the shelf | **up** | `wait` | 1 | the bundled `/char/wait.png` | `Jaya has this convo open` |

The transform read `matrix(1, 0, 0, 1, 0, -72.24)` while up and the identity while down, which is
`0.86 × 84` exactly — the same number Round 28 measured, from a different route. Across the first
pass the stub was asked for **two** pictures, `/pose/wait` and `/pose/typing`, and it was asked for
the `wait` one **without anybody typing**, which is the evidence that the second character is being
driven by the gaze and not by the absence of the first.

**The half that is easy to leave out: an expiring fact has to be re-said.** A screen that asked once
would lose the gaze the moment the server's thirty seconds ran out, and a screen that said its own
word once would go quiet while it was still true. Both are repeated every fifteen seconds, and that
was **measured rather than assumed**: with the stub's frame log cleared at the start of the run and
the count taken again after the page settled, the page said **2 more frames 8 seconds later** — one
`ask` and one word about where it was. The log cannot be left to accumulate across runs, which is
exactly how a leftover gets counted as a repeat; the stub grew a `POST /__clear` for it.

**The other direction, which is a different page.** Navigating to `/app/u/jaya` and reading the frames
the *profile* said gives `{"kind":"profile","user":"2222…","phase":"idle"}`, so the profile half is
not just code that exists — it says the right place about the right person. The convo's own log for
one clean open reads `ask, say chat` — with one `left` in the middle under React's StrictMode, which
double-invokes effects in dev only; a production mount runs the effect once. That is recorded here as
a dev-mode artefact and not claimed as correct behaviour.

**Checks.** `npx tsc -b` clean; `npx eslint .` clean; `npm test` **37 files / 428 tests** passed
(twenty new: eleven for the `looking` rules, nine for the two-character rule and the three sentences);
`npm run build` succeeded in 4.92 s — `ChatPage` **150.53 kB** (was 149.76 kB in Round 28; the rise is
the watch/say wiring, and no improvement is being claimed in either direction), `ConvoLayout`
90.04 kB, entry 517.35 kB (160.77 kB gzip), the pre-existing >500 kB warning unchanged.

**What this round did not do.** The `focus` path was verified **against a stub, not against a live
account** — the frame shapes were read off `consumers.py` and `looking.dart`, and two live accounts
looking at each other were not tested. The 30-second sweep runs only in unit tests; no probe waited
out a real lapse. The server's own `stale` sweep (`looking.dart`'s `ask` path cleaning up after a
person who vanished without saying goodbye) is exercised through `staleGazes` in tests and not through
an actual vanished peer. **Presence-watching was not ported** — the phone also watches whether a
partner is online, and that is a separate feature from where they are looking. Touch and a real phone
were not used. `xelvic/` was read and not changed. This is not a parity claim.

## Round 30 — the chips in the thread, and the one that had never been drawn at all (2026-11-12)

The request, in the owner's words: *"Alright, please ab chatscreen me jo chip banta hai jaise call ka,
data ka etc ka wo sab jaise aap me hai exact waisa kijiye"*. "Chip" in a convo means the five things a
thread draws that are **not** messages: the strip at the top, the day pill, a finished call, a system
note, and a file. Four of the five turned out to be exact already. One of them had never been drawn as
a chip at all — not since the day it was written — and that is what this round's ask actually was.

**What was already right, measured before anything was touched.** The reading below is the browser's,
taken from the element that paints, not a restatement of the source:

| chip | measured | phone | |
| --- | --- | --- | --- |
| the top strip | 159.77 × 29.75, radius 20, `6px 12px 6px 11px`, icon 12, gap 5 | same | ✅ |
| a system note | radius 16, `9px 13px`, 12.5px/600 `--dim` | same | ✅ |
| the stamp over a picture | 10px/400 `--dim`, 4px above the picture, left-aligned to it | `messageStamp` | ✅ |
| the day pill | 20px radius, `5px 11px`, 11px/600, `0.2px` tracking, air 10 above / 12 below | same | ✅ |

The day pill's radius is a one-word fix this round did make: it was `rounded-full`, which on a 28.5px
pill the browser clamps to 11.5px. The phone's `DayMark` is radius **20**, and 20 is what it is now.

**The bug: the call chip was invisible, and had been the whole time.** `_write_log` in
`apps/calls/services.py` writes a finished call as an ordinary system note whose payload is **one flat
dictionary** — `{"call": "<uuid string>", "media": "audio", "outcome": "ended", "seconds": 751}`, with
`media`, `outcome` and `seconds` as *siblings* of `call`, and `call` itself a plain string. The web's
`callNote()` read `message.payload.call` as an **object** and looked for `media` inside it:

```ts
const raw = message.payload?.call;          // ← a string, never an object
if (!raw || typeof raw !== "object") return null;
```

No server has ever sent that shape, so the guard never passed and **every call in every thread fell
through to the ordinary-bubble branch** — a washed-out 18px-radius card in a `justify-start` or
`justify-end` row, instead of the phone's centred call plate. It was proven rather than reasoned: a CDP
dump of the message list printed `Missed audio call` and `Video call · 12:31` with the bubble's own
classes on them. The fix is to read the payload flat, exactly as the phone's `callNoteOf`
(`app/lib/calls.dart:3758`) does: a Map check, `payload['call'] != null`, and `payload['media']` in
`{audio, video}` — all siblings.

**The call chip, now, against the phone's `_callRow`:**

| | phone | web, measured |
| --- | --- | --- |
| plate | radius 16, `X.card`, 1px `X.line`, `fromLTRB(13,9,13,9)` | radius 16, `rgb(255,255,255)`, 1px `rgb(227,227,236)`, `9px 13px` |
| row | `Icon(16)`, 8, body 13 w600, 8, clock 10 `X.dim` | icon 16, gap 8, 13px/600, 10px/400 |
| colour | `alarm = missed && !mine` → `X.bad`, else `X.dim` | `rgb(217,43,43)` and `rgb(107,107,123)` |
| glyph | video → `videocam_off`/`videocam`; else `call_missed`/`call` | `VideoOff`/`Video`/`PhoneMissed`/`Phone` |
| press | `InkWell(onTap: _canCall ? … : null)` | a real `<button>` |
| measured | — | missed **201.19 × 39.5**, mine **195.67 × 39.5** |

The chip was also **not tappable**, and carried a comment saying this client could not place a call.
That stopped being true in Round 18, when calling landed. It now renders a `<button>` under the
phone's own `_canCall` — `_hasCallee && _callOpen`, i.e. `thread.other.username` non-empty **and**
`gate.can_call === true` — and pressing it rings back. Verified by pressing it and reading the frames
the page said: `[{"ring":"2222…2222","kind":"audio"}]`. When the gate is shut the same chip draws as a
plain `<div>`, which is the phone's `onTap: null`.

`ThreadDetail.gate` was typed `Record<string, unknown>` and is now `ChatGate`, which already carried
`can_call?: boolean`. That is a type, not a behaviour change.

**The file chip — the one that is genuinely a different object on this client.** The phone's `_FileRow`
(`chat_media.dart:500`) wraps it in `_MediaFrame`: a `X.card` plate with a 14px radius and a 1px border
that goes `X.card → X.line`, bounded to 220–290 wide, padded 12, holding a 32px `X.accent` icon, a
10px gap, a name at `X.text` w700 over an 11px `X.dim` details line — and **no download glyph**, because
the whole row is the `InkWell`. The web's version was a `bg-paper` box with `px-3 py-2.5`, an 11.5px/600
name, a 32px rounded-10 `accent-soft` square around a 16px glyph, a trailing `Download` arrow, and no
width bound. Rebuilt to the phone's geometry and measured: **220 × 62.73**, card fill, radius 14,
padding 12, a 32px `rgb(227,27,102)` glyph, gap 10, name **14px/700 `rgb(19,19,26)`**, details
**11px/400 `rgb(107,107,123)`**. The `Download` import went with it.

The details line is `_fileDetails`: `'$type · ${formatMediaSize(size)}$duration'`. `formatMediaSize`
came across as [mediaSize](src/utils/format.ts) with the phone's own rounding — one decimal below ten
of a unit, none at or above it — which is why `1183744` bytes reads **`1.1 MB`** and not `1184 KB`, and
why `null` reads **`Unknown size`** rather than nothing. `0` reading `Unknown size` is the phone's
behaviour, not a web choice. Four test cases pin it in
[format.test.ts](src/utils/format.test.ts).

**One smaller correction, and two things recorded rather than changed.** `sparkShotLine` was missing
the phone's `bottom: 2`, which is a 2px difference nobody would name but everybody would feel as a
thread that sits slightly tight; it now carries `pb-[2px]`. The phone's file-name size is an
**inference, not a measurement**: `_FileRow` gives the name w700 and no `fontSize`, so it inherits
Material's default 14 — the web draws 14 to match the inheritance, and if the phone's theme moves that
default this is the number that will be wrong. And a doc/serialised asset field is `mime` on the wire,
not `mime_type`; the web reads `asset.mime`.

**Checks.** `npx tsc -b` clean; `npx eslint .` clean; `npm test` **38 files / 432 tests** passed (the
+4 being `mediaSize`); `npm run build` succeeded in 4.93 s — `ChatPage` **151.10 kB** (was 150.53 kB in
Round 29; the rise is the file-chip rebuild, and no improvement is claimed in either direction),
`ConvoLayout` 90.04 kB, entry 517.58 kB (160.88 kB gzip).

**What this round did not do.** The whole of it was measured **against a stub, not against two live
accounts**. Two defects in that stub were mine and were found by the dump rather than by the page — it
had written the call notes as `kind: "text"` where the backend writes `system`, and had used
`mime_type` where the backend sends `mime` — which is worth recording because both would have made the
page look wrong when it was not. Video call notes were drawn and measured but a video call was **not
placed**. A file chip was measured for a PDF; no other kind was exercised, so `Image`/`Video`/`Audio`
labels and the `_fallbackType` path are read from the phone's source and not measured here. The file
chip's `<a download>` was not confirmed to actually save a file on a real backend. `xelvic/` was read
and not changed. This is not a parity claim.

## Round 31 — the time a message carries, which the phone keeps in the long press (2026-11-12)

The request, in the owner's words: *"Aur abhi isme message ka time nahi dikhta jaise app me dikhta
hai, please ise bhi fix kijiye"*. This one needed the phone read carefully before anything was drawn,
because the phone **does not put a clock on an ordinary bubble** — and the honest answer is not to add
one.

The phone says so in two places. `messageStateRow` (`chat.dart:579`): *"The time is not here either:
it is read from the long-press menu now."* And `_actions` (`chat.dart:5073`): *"the bubble no longer
carries it under the words, so pressing a message is how anybody learns when it was sent. It sits at
the top left, above the emoji, where a heading would, and it says the half of the day."* The one
message that carries a clock **on** the page is a picture, and it is above the picture rather than
under it — `messageStamp`, 10px `X.dim` — because a strip below a photograph is a band of the thread's
own background between it and the next message.

So the web had the picture stamp right and the sheet wrong. The sheet now opens with the phone's own
line as its first child: `<p className="px-4 pb-1.5 pt-3 text-[11px] text-dim">`, left-aligned, above
the emoji row. Measured in the open sheet: **11px / 400 / `rgb(107,107,123)`**, `top: 70`, and the
words' own ink **17px** from the panel's left edge — the phone's 16 plus the panel's 1px border. A
duplicate 9px clock that had been sitting **inside** the quote card, next to the sender's name, was
removed: the phone has one time in that sheet and it is the 11px headline, not a 9px line in a card.

The phone adds `AM`/`PM` itself (`_menuClock`) because its `clock()` answers `10:42` and `10:42` at
midnight reads as the morning. The web's `clock()` is `Intl.DateTimeFormat` with `hour: "numeric"`, so
it already answers **`11:05 AM`** and needs nothing added — the same value serves the bubble and the
sheet, and the two can never disagree. The measured sheet headings, in order, are `Message options`
18px, `11:05 AM` 11px, `You` 9px, `ringing you now` 12px — with no 9px time left in the card.

**Checks.** Same run as Round 30: `tsc -b` clean, `eslint .` clean, **38 files / 432 tests**, build
clean. The lone `You` at 9px is the phone's own quote-card label, kept deliberately: this web client
still draws a sender label on a quoted message, and 9px/uppercase/`0.12em` is what it was and still is.

**What this round did not do.** The sheet was measured by long-pressing a **received** message, and the
phone's clock is empty for an unsent outbox row — a state the web renders but which was not opened in
the sheet. A 12-hour locale was the one exercised; a 24-hour locale would render `23:05` where the
phone's `_menuClock` would append `PM` regardless, and that divergence is recorded here rather than
fixed, because matching the phone exactly there would mean ignoring the viewer's own locale. `xelvic/`
was read and not changed. This is not a parity claim.

## Round 32 — the sound bubble is the phone's own player, to the bar (2026-11-12)

The request, in the owner's words: *"Alright, please audio message bubble ka design exact app ke jaisa
kijiye"*. The phone draws a voice note with `ChatAudioBubble` (`screens/chat_audio.dart:1109`), and
almost everything that bubble is made of is a number somebody chose on purpose — so this round was a
port, and every number came off the phone rather than out of a guess.

**One track width decides the whole shape.** `_ChatAudioBubbleState` draws a `Row` of exactly two
things: a play control, and a column pinned to **150 points** — `_track`, `SizedBox(width: 150)`, and
the comment above it says why: *"the size a bubble in a conversation has room for."* Inside that
column, `AudioWaveform` defaults to `height: 30` and `mostBars: 56`, and its bars are laid out off the
cell they are given rather than off a fixed width:

| the phone | the web — [voiceclip.ts](src/features/convo/voiceclip.ts) |
| --- | --- |
| `boundedWaveform(samples, limit: 56)` | `boundedWaveform(asset.waveform, WAVE_LIMIT)` = 56 |
| `cell = box.maxWidth / count` | `waveCell(WAVE_TRACK_WIDTH, count)` = 150 / count |
| `thick = (cell * 0.42).clamp(0.8, height >= 44 ? 5 : 4)` | same |
| `gap = ((cell - thick) / 2).clamp(0, 2)` | same |
| `(4 + sample / 100 * 24) * unit` | `sampleHeight` |
| no waveform: 24 bars of `(4 + (index % 6) * 2) * unit` | `WAVE_IDLE_BARS`, `idleHeights` |
| playing with no waveform: a 900 ms pulse, `(5 + (wave + 1) / 2 * 21) * unit` | `WAVE_PULSE_MS`, `danceHeights` |
| radius 2, inactive `X.dim`, played `tone` | radius 2, `var(--dim)`, `var(--accent)` |
| the ring is 1 → 1.5 → 2 | `SPEED_RING` |

`tone` is the row that matters. The phone's bubble takes an `accent` prop and the chat screen always
names it — `convoAccent()`, the convo's own tint — because *"a convo wears its own tint, and the app's
theme is not supposed to reach inside one."* The web arrives at the same place by another road:
`--accent` is already rebound to `var(--convo-accent)` inside the convo page, so the bars, the glyph
and the speed chip take the thread's colour with no prop passed at all.

**What the browser measured** — the dark "Alone" theme, a loopback stub, one received voice note
carrying a 90-sample waveform and a silent WAV built inside the page:

| | measured | the phone |
| --- | --- | --- |
| the player | **190 × 58** | 150 of track + a 40-wide control — the same 190 |
| the control | 40 × 40, `rgb(43, 87, 198)` | a Material `IconButton`, 24 icon, `color: tone` |
| the track | **150 × 30**; 56 bars, **1.11** wide, `marginInline 0.776786`, radius 2 | `height` 30, `mostBars` 56 |
| the readout | `0:00 / 0:02`, 10px `--dim` | `formatAudioTime(position) / formatAudioTime(duration)`, 10 `X.dim` |
| the speed chip | **38 × 28**, 14px/500, `color-mix(in srgb, var(--ink) 38%, transparent)` while no ear is held | `minimumSize: Size(38, 28)`, foreground `tone` when it is active |
| the bars | unplayed `rgb(168, 182, 214)` = `--dim`; played `--accent` = `rgb(43, 87, 198)` | `X.dim` / `tone` |

**What this round did not do — and it is a list worth reading.**

- **The speed chip cannot be set before the first press.** The phone says the opposite in so many
  words — *"Always a control: before the first press it chooses the speed that press will play at"* —
  and keeps `_speedChoice`/`speedOf` against the sound's own id so the choice survives until it is
  opened. The web's chip is `disabled={!held}`, so a speed can only be cycled while this bubble
  already holds the ear. **NOT MATCHED.**
- **`InFront` is not ported.** The phone stops a note when the page it is drawn on stops being the one
  being looked at — a sheet over the thread, a call, a pushed person — and it is a *stop* rather than
  a pause, because a row left showing itself as playing is a claim about a sound nobody can hear. The
  web has the one-ear rule ([playback.ts](src/utils/playback.ts) — `claimEar`, `holdsEar`,
  `releaseEar`) but no page gate. **NOT IMPLEMENTED.**
- **The transfer controls are absent.** The phone's `_transferControls` draws Pending, Uploading, a
  Retry and a red Discard under the player while a file is still moving, and its expired state is
  drawn inside the row it replaces. The web draws an "Expired" line and nothing else.
- **The control is a different object.** The phone's is a Material `IconButton` — 24 icon, 8 of
  padding, Material 3's 48-point minimum tap target; the web's is an explicit 40 × 40 box with a 24
  glyph, so the visual box matches and the tap target may not.
- **A sender is not drawn on somebody else's voice note.** The phone passes `sender: mine ? null :
  sender` and puts a face and a name above the player in a group, where there is no side to read. The
  web draws the player alone.
- Every reading is from a **loopback stub in a headless browser with a silent WAV**; a real recording
  was never played, and two live accounts were not used. `xelvic/` was read and not changed. **This is
  not a parity claim.**

**Checks.** `npx tsc -b` clean, `npx eslint .` clean, `npm test` **40 files / 454 tests**, `npm run
build` clean in 5.14 s — `ChatPage` **156.50 kB**, `ConvoLayout` 90.04 kB, entry 517.76 kB (160.96 kB
gzip).

## Round 33 — three sounds, three designs, and the one that is not a bubble at all (2026-11-12)

The request, in the owner's words: *"Alright, song message bubble aur audio message bubble do alag alag
message bubble hai aur dono ka design alag alag hai app me, please aise hi isme bhi kijiye"*. The phone
does not draw two things here. It draws **three**, and only two of them are bubbles:

| what arrived | the phone | a bubble? |
| --- | --- | --- |
| a voice note — `kind: 'voice'` | `ChatAudioBubble`, the Round 32 player | yes |
| a sound file — `kind: 'audio'` | `_mediaBubble` → `ChatAudioFileRow` → `_FileRow(icon: Icons.audio_file_outlined)` | yes — a file row inside one |
| a shared song — an ordinary **text** line whose payload carries the track | `ChatTrackCard` | **no** |

The switch is `_mediaBubble` (`chat.dart:7138`), whose `'audio'` arm is the file row and whose `'doc'`
arm is `ChatDocumentRow` — and a song share never reaches it, because a song share is a text message
and `ChatTrackCard` is drawn at `chat.dart:8325`, last in the content chain.

**The card is not a bubble, and the phone says why.** `bare` (`chat.dart`, above the chain): *"None of
these is a bubble, and for the same reason. The panel a word is written on exists so the word has
something to sit on; a picture is already a rectangle with edges of its own, and a card brings its own.
A panel behind either puts a margin down the sides of something somebody framed themselves."* The web
already had that rule for every other card ([ChatPage.tsx:2672](src/pages/ChatPage.tsx#L2672)); the
song card now obeys it too. Above it sits the phone's `messageStamp` — 10px `--dim`, then 4 points of
air, which is the phone's `if (bare) ...[stamp, const SizedBox(height: 4)]` — and it follows the side
the row sits on, which is the phone's `crossAxisAlignment: bare && mine ? end : start`. The body line
is never repeated: the phone keeps its words in the final `else` of that chain, the web keeps its
`!hasCard`.

**Three designs, measured side by side in one thread:**

| | measured | drawn by |
| --- | --- | --- |
| the shared song | **272 × 152.89** — no background, no border, **no radius**, padding 10; 26 bars of 2.5px at `marginInline 0.8`, radius 2, ink at **16 %**, heights **5.58 → 21.25**; a 252 × 22 wave, then 4 points, then a 10.5px/600 tabular `--dim` clock row | `ChatTrackCard` |
| the voice note | bubble **220 × 84**, ground `rgb(18, 26, 44)`, radius `18px 18px 18px 6px`, padding `10px 14px 8px`, holding the **190 × 58** player | `VoiceBubble` |
| the sound file | bubble **250 × 88.73**, ground `rgb(15, 28, 60)`, radius `18px 18px 6px`, padding `10px 14px 8px`, holding a **220 × 62.73** row: padding 12, gap 10, radius 14, a 32px `rgb(43, 87, 198)` glyph, name 14px/700, details 11px/400 `--dim` three points under it | `ChatDocument kind="audio"` |

`soundKind` ([sound.ts](src/features/convo/sound.ts)) is what keeps the first two apart: the message's
own `kind` answers first and the asset's kind is the fallback, so a `voice` line carrying an `audio`
asset is still a voice note. Four cases pin it in [sound.test.ts](src/features/convo/sound.test.ts).
The file card's type word and its size come from the same `fileDetails` Round 30 built.

**The accent split — the part that is invisible on every light theme.** The phone's `ChatTrackCard`
takes no `accent`: it fills its play button with `X.accent`, the app-wide one. Every other thing in the
thread takes `convoAccent()` — `X.theme.chatTint ?? X.accent` — which the chat screen hands to
`ChatAudioBubble` by name. So on a theme whose `chatTint` differs from its accent, **the song card and
the sound bubbles are meant to be different colours.** The web had one accent for both. `ThemeProvider`
now publishes `--palette-accent` ([ThemeProvider.tsx:436](src/providers/ThemeProvider.tsx#L436)) and
`ChatTrackCard` rebinds `--accent` to it at its own root
([ChatPage.tsx:1790](src/pages/ChatPage.tsx#L1790)), so the card's children read the palette while the
rest of the thread keeps the convo tint. Measured on the dark "Alone" theme — the one shipped case
where the two differ: `--convo-accent` **`#2B57C6`** against `--palette-accent` **`#8FB4FF`** — the
card's play button painted `rgb(143, 180, 255)`, while the voice note's play glyph and the file card's
glyph painted `rgb(43, 87, 198)`. **On every light theme the two are the same colour and the rebind
changes nothing**, which is why the probe pinned `xelvic.theme = alone` and `xelvic.mode = dark`.

The card itself was rebuilt to `chat_track.dart`: `ShareWho`, then 9 points, then `CoverArt 44`, the
title at 14/700 over an 11.5 `--dim` byline, `LikeButton size="md"` (a 34 box around a 22 glyph — the
phone's `LikeHeart` is an `IconButton` constrained to exactly `34 × 34` around a 22 icon), a 34px
filled round play button, the track's own 26-bar wave — `waveShape(track.seed, 26)`, 2.5 wide,
`3 + shape * 19` tall, unplayed at `X.fade(X.text, 0.16)`, which is the web's `color-mix(in srgb,
var(--ink) 16%, transparent)` — then 4 points and the `_timeStyle` row at 10.5/600 tabular `--dim`.

**What this round did not do.**

- **The card is a fixed 272; the phone's is 220–290 and content-sized.** `ConstrainedBox(minWidth: 220,
  maxWidth: 290)` means a long title widens the card and a short one narrows it; here it is always 272.
  **PARTIALLY MATCHED** — recorded, not fixed.
- **The failure line is hardcoded.** The phone prints `store.stuck!`, the store's own sentence about
  what went wrong; the web prints "Could not play that." **NOT MATCHED.**
- **The file row is thinner than the phone's.** The phone's name allows **two** lines and ellipsises at
  the second; the web truncates to one. A file with no `original_name` reads "An audio file" here,
  where the phone uses its own `source.fileName`. And the phone's row is a `_MediaFrame` with the
  transfer controls (Pending, Uploading, Retry, Discard) and a press that opens a local file, while the
  web's is an `<a download>` — **no transfer states, and the press downloads rather than opens.**
- **`ShareWho` names a person the reader's own way on the phone** (`Aliases.it.name(id, name,
  username)`); the web draws `name || username`. Unchanged this round, and recorded here rather than
  passed over.
- The three designs were measured **in one thread against a loopback stub**, with a WAV sound file and
  a silent voice note built inside the page; two live accounts were not used and a real recording was
  never played. **The heart's own box was not measured** — the probe's selector matched the play
  button a second time, so no reading for it is claimed. `xelvic/` was read and not changed. **This is
  not a parity claim.**

## Round 34 — the group behind the ⋮, and every control the phone keeps there (2026-11-13)

The convo sheet's "Group settings" row used to open a small web-invented panel. It now opens
[GroupPanel.tsx](src/features/convo/GroupPanel.tsx), a port of the phone's `GroupScreen`: the group
photo and name (a rename and a camera, for admins), the two switches that say how the group runs
(Locked, Invites are on), the channels with each one's rule — everyone or admins, anything / photos
only / words only — the invite links with how many people each one let in and whether it is still on,
and the roster with its roles, its search, its three different counts and its own "…" menu.

The rules are the phone's, not new ones: `member < admin < owner` decides what is drawn at all; a
member sees the channels and their rules but nothing to tap; a rule write sends **both** `post` and
`media` and the tick moves only after the server answers; a revoked link stays listed and marked off;
a member row opens a profile only when the server says `can_open`, and never for my own row.

Everything it talks to already existed — **the backend gained no endpoint, migration, setting or
contract change.** Watched in a browser against a loopback stub as an owner and as a member, with the
lock and one channel rule confirmed on the wire. Avatar upload, invites, role changes, leaving,
deleting, and the add-people picker are built but were **not exercised at runtime**.

## Round 35 — the direct convo's own ⋮, and the one row it had never had (2026-11-13)

The phone's menu for a convo you are in has eight rows: rename on this device, pin, mute, vault,
disappearing, block/unblock, clear, trash. The web had seven.

The missing one is the name only you see. [names.ts](src/features/convo/names.ts) keeps it in
`localStorage` under the same key the phone uses (`xelvic.names.mine`), scoped to the account, with the
handle as a second key so a rename survives the person changing their name. `threadTitle` answers with
it before the server's title, so the chat header, the empty-state line and every row that names a
person follow at once. The row says "Rename on this device" until there is one and "Change the name on
this device" after, and the dialog can hand the person their own name back.

The block row was wrong rather than missing: it offered "Unblock" whenever the gate said `blocked`,
including when the **other** person was the one who blocked me. The phone draws neither Block nor
Unblock on that side, because there is nothing of mine to undo. The gate already carried
`blocked_by_me`; it is read now.

Two smaller alignments with the phone: the self convo no longer offers Mute or Trash, and the clear,
trash and block questions carry the phone's notes.

**Three rows remain that the phone keeps elsewhere** — Media and files, Wallpaper and Convo theme live
on the person's profile on the phone; here they are still in this sheet. **Not a parity claim**, and
nothing was exercised against a live backend.

## Round 36 — the crash a refresh was fixing (2026-11-14)

*Kabhi kabhi* the app arrived at "Something broke on this screen" with `Cannot read properties of null
(reading 'useContext')`, and reloading cleared it. This round established what that message can and
cannot mean, removed the app's part in it, and taught the screen to repair the one state React cannot.

**What the message is.** In React 19.3.1 the only place `.useContext` is read off anything
([react.development.js:1258](node_modules/react/cjs/react.development.js)) is `dispatcher.useContext`,
where `dispatcher` is `ReactSharedInternals.H`. React 19's `resolveDispatcher` no longer throws: it
`console.error`s and returns `null`, so a null dispatcher surfaces as this `TypeError` instead of the
familiar "Invalid hook call". `H` is null in exactly three situations: before the first render, while
React probes a component for a stack frame, and in a React copy that has never rendered.

**Three of those were tested in a browser, not argued about.** A ordinary render error still surfaces as
itself. A hook called outside render *in the same React copy* says "Invalid hook call" — not this
message. Loading the pre-bundled React chunk a second time and calling its `useContext` while the first
copy rendered produced the user's message, character for character, and the error boundary caught it.
So the crash is not a hook written in the wrong place: it is **two React copies in one page**, and the
hook call resolved to the copy that was not rendering the tree.

**Why a long-lived dev tab grows a second copy.** The dev server pre-bundles dependencies into files
whose names carry a content hash. When the optimizer re-runs — a newly discovered import, a config
edit, an install — the React chunk comes back under a new name. A tab that loaded the old chunk keeps
it for the modules it already holds, and any module it loads afterwards imports the new one. Two
`ReactSharedInternals`, one of them never rendered: this error, once, until a refresh.

**What changed.** [vite.config.ts](vite.config.ts) now pins the whole dependency set with
`optimizeDeps.include` so the optimizer has nothing left to discover mid-session, and asks for one React
on the resolution side with `resolve.dedupe`. [ErrorBoundary.tsx](src/components/common/ErrorBoundary.tsx)
recognises this class of failure through [recover.ts](src/components/common/recover.ts), draws "Putting
this screen back together" while it reloads the page **once**, and writes the claim so a repeat failure
within twenty seconds shows the honest error screen instead. A real bug is still visible; it is not
hidden behind a reload loop.

**Not a parity claim.** The phone has no equivalent — a Flutter build cannot hold two copies of React —
so nothing in the mobile inventory changes. **Not verified:** the exact trigger in the user's own tab
was never captured, and the mixed-instance state cannot be prevented from inside the application once
it exists; the reload is the repair. Every check was re-run: `tsc -b` clean, `eslint .` clean, 41 files
/ 466 tests, build clean.

## Round 37 — the component layer, inlined as Tailwind (2026-11-14)

The request was to delete the hand-written component classes from [styles/index.css](src/styles/index.css)
and write Tailwind at every place they were used. The block is gone; each of its 15 classes now exists
only as utilities on the elements that wear them.

**What was there.** One `@layer components` block, 188 lines: `.btn` and its four variants, `.icon-btn`,
`.field`, `.field-label`, `.card`, `.chip` (with `[data-active="true"]`), `.glass-nav`, `.story-ring`,
`.skeleton` (with its `::after`), `.prose-copy`, `.scroll-area` (with two webkit rules). Everything else
in the file — `:root`, the base layer, the two utilities layers, the keyframes, the reduced-motion and
dark blocks, `.feed-item` — is untouched. `.prose-copy` had no user anywhere in `src/`; it is the one
class that was simply dropped.

**What replaced it.** 299 class strings across 78 files, each rewritten in place, plus the `variants` map
in [Button.tsx](src/components/ui/Button.tsx). 47 distinct utility strings came out of the 299 sites,
because every site keeps its own overrides: `btn btn-primary min-h-[46px] w-full rounded-[14px]` still
asks for 46 px and 14 px, and `field pl-8` gains `pr-4` — the old `padding: 0.75rem 1rem` split into the
one edge the site had not already set. [tailwind.config.ts](tailwind.config.ts) gained the colours the
`color-mix()` fills need (`accent-5`, `accent-30`, `ink-5`, `ink-6`, `dim-80`, `dim-26`, `line-58`,
`bad-10`, `bad-24`, `nav-glass`, `nav-edge-38`), the shimmer gradient as `backgroundImage.skeleton` and
the focus ring as `boxShadow.field-focus`. They read the `-rgb` channel variables that
[ThemeProvider.tsx](src/providers/ThemeProvider.tsx) writes beside the hex ones, so
`rgb(var(--accent-rgb))` is `var(--accent)` at every moment the theme can change.

**The 299 sites were found with the TypeScript compiler, not a text search.** The scan walks `className`
attributes, `className` properties and the arguments of `clsx`/`cn`/`cx`/`cva`/`twMerge`/`twJoin`/
`classNames` through conditionals, `&&` chains, arrays, object values and same-file constants. The text
search was tried first and thrown away: it counted the word "card" 748 times, nearly all of it prose.

**The class names are also vocabulary in these documents.** Where an earlier round below says `icon-btn`
or `.story-ring` it is describing the sheet as it stood before this round. Two claims read as current and
were corrected with the code: the Vibes section's header button and the plan's note about it.

**Verified, and where it is not.** A parity harness rendered 144 distinct class lists twice in headless
Chrome — the original tokens against a stylesheet compiled from the app's own `index.css`, then the
injected utilities — and compared ~60 computed properties per element plus `::after` and `::placeholder`,
in four states and for disabled buttons: 622 pairs, in agreement everywhere except five named deviations.
The built stylesheet was then read from a real page over HTTP for the field, the active chip, a button, an
icon button, a card and a skeleton, and the built app boots with no error screen. The deviations, the two
defects the harness caught before anything was applied, and the dead classes it turned up are in
[XELVIC_TESTING_REPORT.md](XELVIC_TESTING_REPORT.md) and
[XELVIC_FINAL_GAP_REPORT.md](XELVIC_FINAL_GAP_REPORT.md). **Not verified:** nobody has looked at this
app with their own eyes this round, and no screen behind the sign-in was walked.

**Checks.** `tsc -b` clean · `eslint .` clean · 41 files / 466 tests · build clean in 4.33 s · the built
stylesheet holds none of the 15 removed class names · `docs/` untouched · nothing under `xelvic/` read or
written.

## Round 38 — a convo's own wallpaper and its own theme, applied at the tap (2026-11-14)

The report was that a photo picked as a convo's wallpaper never appeared, that picking a convo theme
changed nothing, and that both had to land the moment they were picked. All three were true, and they had
five separate causes.

**The photo was saved and read by nobody.** [ConvoSheet.tsx](src/features/convo/ConvoSheet.tsx) held the
picture in its own state and wrote it to `localStorage` under `convo_wallpaper_<threadId>`, but the chat
root painted only `thread.wallpaper` — nothing outside the sheet ever read that key. Closing the sheet or
reloading left no picture at all. It was stored as a `blob:` object URL, which dies with the document that
made it, so even a reader would have found a dead address after a reload. And it was written only after
`PATCH /skin/` answered, so a refused request dropped the photo entirely.

**The theme was written and read by nobody.** The picker sent `tint` to the server and moved its own tick,
but [ChatPage.tsx](src/pages/ChatPage.tsx) never looked at `thread.tint`; it mapped `--accent` to the
account's `--convo-accent` and stopped there.

**Neither was instant.** Both paths waited on a request, and then on the thread query's next refetch.

**What was built.** [look.ts](src/features/convo/look.ts) is the missing reader: a store per thread over
`useSyncExternalStore`, the picture as a data URL in memory and in `localStorage` (`readWallImage` keeps a
small PNG for its alpha, otherwise frames it to 1600 px on the long edge and encodes JPEG at 0.82, so a
camera file becomes a row that fits), `null` for anything a reload cannot draw — a legacy `blob:` row is
dropped — opacity clamped to 0–1, and the slider's write debounced by 150 ms while the picture follows the
thumb on every step.

**The photo is saved first, the server is told second.** Choosing a photo stores it, returns to the
sheet's front page and repaints the chat immediately; the `PATCH` that tells the server `wallpaper:
'default'` — it has no key for somebody's own picture — runs afterwards and its failure is tolerated,
which is the phone's own order in `_chooseOwn` (`app/lib/screens/convo.dart`). The local save never waits
on the network. Picking a built-in wall clears the photo, keeps a copy, and puts it back if the request
fails.

**The theme now paints the chat.** [skin.ts](src/features/convo/skin.ts) gained `chosenTint`, which
answers `null` for `default` and the phone's own light-scheme reading otherwise; ChatPage rebuilds the
convo palette from that colour and writes `--convo-accent` plus the six bubble variables on the chat root.
An optimistic overlay moves the tick, the accent and the bubbles on the tap; a failed request rolls the
thread back and says so with an error toast. A convo nobody coloured still follows the account's
`chatTint ?? accent`, which is the gap the parity matrix already records against the phone's fixed pink.

**The photo starts at full strength, as the phone's does.** The phone's own wall opens at `1.0` and the
slider is how it is backed off (`app/lib/screens/wall_frame.dart`); the web now does the same, where the
first draft of this round had it start at 78 %. A built-in wall is different: the phone lays a flat 78 %
wash of the page's own ground over it (`kWallScrim`; `X.ink` is the page in `XScheme`), and the web's veil
now uses `var(--page)` at 0.78 instead of the black at 22 % it used before.

**The fallback catalogue had a key the server does not have.** `FALLBACK_WALLS` offered `xellom` where the
server's list says `xelvic`, so the first non-default swatch would have been refused on any thread whose
catalogue had not arrived. The keys and labels now match the phone's `kWallNames`: Xelvic, City, Journey,
Studio, Night, Gathering.

**Verified, and where it is not.** Unit tests cover the store and the tint rule; a headless-Chrome probe
against the built stylesheet read a photo as a `data:` background at `cover` with a zero-opacity veil at
full strength, the same picture at 40 % behind a 60 % page veil, a built-in wall under a 78 % page wash,
and `#0E7C8C` on `bg-accent`, `text-accent`, `border-accent` and `rgb(var(--accent-rgb) / 0.5)`. The
built app boots with no error screen. **Not verified:** no authenticated chat was opened — no backend runs
here, no credentials were used, `.env.local` was not written — and nobody has looked at these screens with
their own eyes.

**Checks.** `tsc -b` clean · `eslint .` clean · 43 files / 478 tests · build clean in 4.54 s · `docs/`
untouched · `xelvic/` read, not written.

## Round 39 — the space between two emoji in one bubble (2026-11-14)

The report was that a message made of more than one emoji drew them touching, and the picture that followed
said they still did. Both were true: two emoji typed next to each other were drawn **overlapping by 6.70 px**
at 30 px, and the first attempt at a margin left 3.70 px of that overlap in place.

**What actually overlapped.** [EmojiText.tsx](src/features/emoji/EmojiText.tsx) does not print an emoji as
text: it replaces each one with an `EmojiArt` span declared `size-[1.15em]`, because Google's artwork has to
be given a box to be drawn in. But the character layer that keeps the emoji readable while the artwork loads
is inside that box, and **it sizes the box's only grid column**: the machine's emoji glyph carries an advance
of **1.3730em** (41.19 px at 30 px, measured), so the column becomes 41.19 px wide and the artwork, which
fills its column, is drawn **41.19 px** wide inside a **34.50 px** box — spilling 3.35 px on each side.
Two emoji typed together therefore met at a pitch of 1.15em with drawings 1.373em wide: an **overlap of
6.70 px**, which is what the owner saw, not a pair of drawings that merely touched.

**What the phone does, and why it never had this.** `app/lib/screens/chat.dart` draws the body as one plain
`Text` at `messageFontSize` (38 px for one emoji, 26 for two, 15 for three or more) with `height: 1.35`, no
letter spacing and no widget per emoji. Its emoji are the system's own glyphs, so the font's advance is the
spacing and the question never arises. The web replaces the glyph with a drawing, so it has to give the
spacing back.

**The first attempt was too small, and the picture said so.** The margin was put on every emoji at 0.1em
— 3.00 px of box gap at 30 px — which left the drawings still overlapping by 3.70 px. The owner
answered with a screenshot of three emoji in a bubble still stuck, and that screenshot was right.

**What shipped.** `EmojiText` now gives an emoji a right margin of `mr-[0.35em]` **when the run after it is
another drawable emoji**, and nothing otherwise. That is 10.5 px at 30 px, a pitch of **1.500em** against
drawings 1.373em wide, so two emoji clear each other by **3.80 px** (4.55 px at 36 px, 5.31 px at 42 px,
1.89 px at 15 px). The last emoji of a row is followed by no emoji and carries no margin (measured margins
10.5 / 10.5 / **0** px), so no bubble is wider on its right for nothing — the `last:` variant the first
draft needed is gone with it.

**Where the margin is not, and why that is the point.** A single emoji is the whole body, drawn `bare` at
42 px (`bubbleType`), and a margin there is invisible. An emoji with words or a space around it already has
the text's spacing, and a margin there would push the words away or widen a space the person typed. The rule
is adjacency: the gap is added exactly where two drawings would otherwise overlap — which is also why it
applies wherever `EmojiText` is used, the bubble and the line a reply quotes alike.

**The fallback is covered too.** The character layer is what you see when Google's artwork has not arrived,
and it is 1.373em wide in the same box, so it overlapped by the same 6.70 px and now clears by the same
3.80 px. Measured with the artwork blocked and with it loaded: identical numbers.

**Measured, and where it is not.** In headless Chrome against the built stylesheet, with the exact class
chain the component emits and Google's real artwork: box 34.50 px, drawing 41.19 px, pitch 45.00 px =
1.500em, clearance **+3.80 px** at 30 px (was **−6.70 px**); the same pitch of 1.500em at 36, 42 and
15 px; and with no margin at all, a pitch of 1.150em and a clearance of −6.70 px. A 3× screenshot
of the shipped chain shows the three emoji of the owner's picture clearly separated where the un-margined
row is visibly overlapping. **Not verified:** no authenticated chat was opened — no backend runs here,
no credentials were used, `.env.local` was not written — so nobody has looked at these emoji in a real
bubble with their own eyes.

**A pre-existing overhang, found and not touched.** The drawing is 1.373em tall inside a line box of 1.05em,
so it hangs **6.70 px** below its own line at 30 px (8.05 px at 36 px, 9.38 px at 42 px, 3.36 px at 15 px) —
measured as the artwork's bottom against the paragraph's own box. In a body of several lines that overhang
reaches into the line below. It predates this round, this round's change does not affect it, and it is
recorded in the gap report rather than fixed here.

**One divergence is now written down.** The sizes are still the web's own: 42 / 36 / 30 / 24 px against the
phone's 38 / 26 / 15, so a row of three emoji is drawn twice the phone's size and a row of seven at 24 px
where the phone keeps 15. That is a new **PARTIALLY COMPLETE** row in the parity matrix, not something this
round claims to have closed.

**Checks.** `tsc -b` clean · `eslint .` clean · 43 files / 481 tests · build clean in 4.30 s
· `docs/` untouched · `xelvic/` read, not written.
