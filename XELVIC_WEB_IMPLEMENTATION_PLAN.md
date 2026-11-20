# Xelvic Web Implementation Plan

Date: 2026-11-01
Scope: `xelvic-web/` only. Mobile (`xelvic/app`) and backend (`xelvic/backend`)
are read-only references and the shared source of truth.

## Constraints

1. All edits stay inside `xelvic-web/`.
2. Backend endpoints, models, migrations, settings and contracts are untouched.
3. Mobile source is untouched.
4. No fake data, no fabricated receipts, no dead buttons.
5. Working web code is improved, not rewritten wholesale.
6. Stack stays React 19 + TypeScript + Vite + Tailwind + TanStack Query.

## Baseline (measured 2026-11-01)

- `npm run typecheck` — pass.
- `npm test` — 24/24 pass at baseline; 29/29 pass after the Phase 4 work.
- Web: 25 page files in `src/pages`, 191 `.ts`/`.tsx` files, ~61k lines
  (recounted 2026-11-01; the earlier 20 / 83 / ~31k figures were a stale
  baseline from before that day's passes).
- Mobile reference: 151 screens, 283 files, ~256k lines.
- Shared backend: 24 Django apps.

## Phase 0 — Discovery and audit (COMPLETE)

Deliverables in this repository:

- `XELVIC_MOBILE_FEATURE_INVENTORY.md`
- `XELVIC_FEATURE_PARITY_MATRIX.md`
- `XELVIC_API_COMPATIBILITY_REPORT.md`
- `XELVIC_WEB_IMPLEMENTATION_PLAN.md` (this file)
- `XELVIC_PROGRESS_TRACKER.md`
- `XELVIC_TESTING_REPORT.md`
- `XELVIC_FINAL_GAP_REPORT.md`

## Phase 1 — Foundation

| Goal | Work | Status |
| --- | --- | --- |
| 1.1 | Confirm design tokens and shared primitives | DONE (existing, verified) |
| 1.2 | Route protection + lazy loading | DONE (existing) |
| 1.3 | Central API client + refresh + errors | DONE (existing) |
| 1.4 | Conversation cache helpers (insert/patch/remove) | DONE |
| 1.5 | Optimistic message model (`pending`/`failed`) | DONE (goal 4.2) |

## Phase 2 — Authentication and profile

Existing QR sign-in, dev login, refresh, profile, privacy, devices are wired.
Remaining work (not blocking conversation):

- Account deactivation (`/auth/deactivate/`).
- Account switching (needs a second credential store; deferred).
- Language preference surface.

## Phase 3 — Feature parity (social, media, notifications)

Priority order after the conversation phase:

1. ~~Notification preferences surface~~ — done as Phase 6, below.
2. Message search (web surface for `/chat/search/`).
3. Group admin surfaces (members, invites, rooms).
4. Media upload progress + video poster.
5. Mentions, mutuals, crew read surfaces.
6. Deals / circles / collabs (large, separate modules). *The marketplace was in
   this group and is done — see Phase 5.*
7. Editors and studio tools (large; browser constraints).

## Phase 5 — The marketplace and the theme (done 2026-11-01)

The one page the app calls a marketplace, ported aisle by aisle, and the
requirement that goes with it: a theme must reach every screen, not just the
shell's five.

| Goal | Work | Status |
| --- | --- | --- |
| 5.1 | One page, three aisles, one purse, one Settings row | DONE |
| 5.2 | Drip aisle (`drip.dart`) | DONE |
| 5.3 | Themes aisle (`theme_shop_view.dart`) | DONE |
| 5.4 | Logos aisle (`logo_shop_view.dart`) | DONE |
| 5.5 | The preview moves the whole web, both readings | DONE |
| 5.6 | One `Backdrop` component for every ground | DONE |
| 5.7 | Fix the shell's backdrop stack position | DONE |
| 5.8 | The marketplace's own ground, as a pushed screen | DONE |
| 5.9 | The theme's picture inside a chat | DONE |
| 5.10 | The chat accent on an uncoloured convo | OPEN — see the gap report |

## Phase 6 — Notifications, to the app's own rules (done 2026-11-01)

Two surfaces, ported rather than redrawn, and one honest boundary.

| Goal | Work | Status |
| --- | --- | --- |
| 6.1 | The alert row, to `screens/alerts.dart`'s geometry and layers | DONE |
| 6.2 | The in-app strip, to `notices.dart` + `notice_banner.dart` | DONE |
| 6.3 | A hidden tab's row: the browser's own notification, with a click that opens the row's destination | DONE |
| 6.4 | One routing table for every surface (`alertPath`) | DONE |
| 6.5 | The sounds and the switch, with copy that says where the sound stops | DONE |
| 6.6 | A notification after the site is **closed** | BLOCKED — the server pushes only to FCM device tokens; this build has no Firebase config, VAPID key or service worker, and the backend is read-only |

What the strip is, in one paragraph: a `thread.update` frame's `notice` is
offered to `deliver`, which refuses it when notifications are off, when the
conversation is muted, when it is a typing note, when its ordinal has been seen,
or when it is the conversation on screen. Everything left is either a strip
(the tab is visible) or a row on the browser's notification surface (it is
not). `alert.new` is never a strip, because the phone does not draw one either.

## Moments — the story walk, ported from `MomentViewScreen` (done 2026-11-01)

The ask for this pass, verbatim: *"moments ko app ke according kijiye jaise
moments aap me work kar raha hai waise hi isme bhi karna chahiye exact."* The
reference is `app/lib/screens/moment_view.dart`, read line by line, with
`app/lib/moments.dart`, `app/lib/strings/en.dart` and
`backend/apps/moments/{urls,views,services}.py` beside it.

The method matters as much as the result: `MomentViewer.tsx` was **rewritten as
a port**, not adjusted. Every rule the phone's viewer keeps is either kept here
with the line that decides it, or named as a gap below.

| Goal | Work | Status |
| --- | --- | --- |
| M.1 | The 60ms clock and `MomentItem.hold` (clip window, sound window capped at `kSoundLongest`, a carried picture's life, `HOLD_FLOOR`) | DONE |
| M.2 | The gesture: 32%/68% tap split, hold-to-pause at `kHoldToPause`, hold-to-leave at `kHoldToPause + kHoldToLeave`, and the clock that runs down in `_carriedTo`'s words while it is held | DONE |
| M.3 | Swallowing the browser's post-hold `click`, which Flutter's gesture arena would have swallowed for us | DONE |
| M.4 | `_carried` in order (item vibe → `made_from.vibe` → `made_from.drop` → sound → `source_id`) and `_carriedTo`'s four sentences | DONE |
| M.5 | Opening what is carried: the Vibes shelf at that clip, the drop, the Audio section, and a pushed walk over a `source_id` moment | DONE |
| M.6 | `_ownOrder`: my own walk opens on my last day, days reversed and items not | DONE |
| M.7 | Marking watched: per item as it comes up, and the day on its last item | DONE |
| M.8 | The heart (`kStoryLike`) and the faces (`kStoryFaces`), drawn from the server's answer | DONE |
| M.9 | The answers tally and the who sheet (viewers / reactors / voters, read when opened), drawn on my own day only | DONE |
| M.10 | Reply into a convo, holding the clock while the field is focused | DONE |
| M.11 | Share: the gate question, then the picker, one convo at a time, the true count reported | DONE |
| M.12 | Take down behind its confirm, and the three dots that hold only "Add to Memories" | DONE |
| M.13 | `/app/moments?memories=1` — a route parameter nothing read, so "New Memory" on my own profile was a dead button | DONE (fixed) |
| M.14 | `MomentStage`'s own metrics (`kNoteColumn`/`kNoteMargin`, `kSongCoverGap`/`kSongCoverMargin`, the `_overMedia` shadow) | DONE |
| M.15 | Carry: the app opens the picture in its Image editor first | DONE (NOT VERIFIED live) — a carry with a picture opens `PhotoEditor` seeded with the carried bytes and posts the composed file with `source`; a clip, a note or a Vibe carries straight through `carry/`. `links` and `tags` do not ride across |
| M.16 | The Memory walk (`isMemory`): a Memory's own header words, `memories/{id}/react\|reply\|share/`, Remove in place of Take down | DONE (NOT VERIFIED live) — `MomentViewer` branches on `isMemory`, and the shelf, the Alerts row and the Moments page all open it through one `memoryAsMoment` |
| M.16a | Managing a Memory from the shelf — `manageMemory`'s four rows | DONE (NOT VERIFIED live) — long press on my own card: Add more to it, Rename, Change the cover, Remove |
| M.16b | A Memory named in an alert | DONE (NOT VERIFIED live) — `alertPath` → `/app/moments?memory=<id>`, opened out of `moments/memories/` |
| M.17 | Together mode and stickers/drawings | **not a feature** — `moment_view.dart` has neither, and `grep -rn "together\|Together\|watch party" app/lib` finds nothing. The editor's own stickers/drawings are `PhotoEditor`'s and were already there |
| M.18 | The live ring on a face (`Moments._rings` / `hasRing`) | DONE (NOT VERIFIED live) — `useLiveRings()`; `DropCard` and search's `PersonRow` wear it |

Also removed in this pass, and recorded rather than hidden: the web had a
composite moment it called the **Morning Question**, built around a `prompt`
field that exists on neither `MomentSerializer` nor the app's model. It was
fabricated, so it is gone, and the field was struck from `src/types/api.ts` so a
build cannot type against it again. See `XELVIC_MOBILE_FEATURE_INVENTORY.md`.

Code status: M.1–M.18 pass typecheck, lint, unit tests and a production build.
Nothing in that list has been run against a live backend; see
`XELVIC_TESTING_REPORT.md` §11a.
Runtime behaviour against a live backend is **NOT VERIFIED**; M.15–M.17 are
named in `XELVIC_FINAL_GAP_REPORT.md`.

## Circles — the section, the picker and the circle page (done 2026-11-01)

The ask: the app's Moments page has a Circles section with "Pick your
interests"; the web had none. The reference is `app/lib/screens/circles.dart`
(`CircleSection`, `CircleScreen`, `CirclePickerScreen`) and `app/lib/circles.dart`,
with `backend/apps/circles/{urls,views,serializers,services}.py` and
`apps/drops/views.py:write_fields` beside them.

| Goal | Work | Status |
| --- | --- | --- |
| C.1 | The section under the rail on `/app/moments` | DONE (NOT VERIFIED live) — `features/circles/CirclesSection.tsx`; header, empty card that is the picker, cards, "N more interests this month" |
| C.2 | A circle card | DONE — field glyph, `field · COUNTRY`, seats, flame, chevron, task line, status, post button, top three takes, "See all N takes" |
| C.3 | The picker ("Your interests", "Choose up to {n}") | DONE (NOT VERIFIED live) — read fresh each open; a pick lands in the circle it made |
| C.4 | One circle's page | DONE (NOT VERIFIED live) — `/app/circles/:circleId`: faces, task card, "Today's board", numbered `DropCard(read: false)` |
| C.5 | Posting a take | DONE (NOT VERIFIED live) — the shared `DropComposer` with `circle` set; posting goes through `POST /circles/{id}/`, which runs the same `write_fields` as a drop |
| C.6 | The window, drawn honestly | DONE — a sealed day's `task` is null and the section draws the hour; `open` is read together with `opens_in` so "not yet" and "over" are not the same sentence |
| C.7 | Four routes, none invented | DONE — `circles.service.ts`: `fields/`, `pick/`, `mine/`, `<id>/` (GET + POST), tabulated in `XELVIC_API_COMPATIBILITY_REPORT.md` |

Note about the source, recorded so it is not mistaken for parity: the phone's
Moments page now mounts `LiveNow` where the section used to sit
(`app/lib/screens/moments.dart:629`, commit `f4f7ffb7`, 2026-10-31). The section
and both of its screens are still shipped, and this port follows that shipped
source. Since the Audio and Live pass below, the web mounts the app's `LiveNow`
strip under the rail and keeps this section beneath it.

Code status: passes typecheck, lint, unit tests and a production build. Nothing
here has been run against a live backend.

## Audio and Live — to the app's shape (done 2026-11-01)

Sources read, not modified: `app/lib/screens/audio.dart`, `audio_bits.dart`,
`audio_studio.dart`, `live_now.dart`, `room.dart`, `room_bits.dart`;
`backend/apps/audio/{urls,views,studio}.py` and `apps/spaces/` for the contract.

| Goal | Work | Status |
| --- | --- | --- |
| A.1 | The Audio tab's doors: category chips open their own page, the board strip opens the chart, "Audio drops" reads the reco feed | DONE (NOT VERIFIED live) — `audio/board`, `audio/c/:key`, `/audio/feed/` |
| A.2 | A category's page | DONE (NOT VERIFIED live) — `AudioCategoryPage`, `GET /audio/categories/<key>/` |
| A.3 | The weekly board | DONE (NOT VERIFIED live) — `AudioBoardPage`, `GET /audio/board/`, `weekSpan`, the server's order |
| A.4 | The studio | DONE (NOT VERIFIED live) — `AudioStudioPage`, `GET /audio/studio/`; one's own only; unmeasured numbers say so |
| A.5 | One studio item and its audience | DONE (NOT VERIFIED live) — `AudioStudioDetailPage`: lifetime sums, the trend read (no band/score when `score` is null), rates ("Not measured"), components, audience bars, used-by, this week, false rights |
| A.6 | Every row's heart, drops included | DONE — a drop is felt at `/drops/{id}/like/`, a catalogue track at `/audio/tracks/{id}/like/` |
| A.7 | The app's downloads door | NOT IMPLEMENTED — a browser has no kept-tracks store here; named on the page |
| A.8 | The full-screen swipe deck | NOT IMPLEMENTED — the reco strip plays; the deck was not ported |
| L.1 | The app's Live surface — the "Live now" strip under the Moments rail | DONE (NOT VERIFIED live) — `LiveNow`, `?shelf=kept`, socket-refreshed, always drawn |
| L.2 | One create sheet for both doors | DONE — `OpenRoomSheet` (kind, name, note, tags, start) |
| L.3 | The shelf card's words | DONE — `crowdLine(room)` replaces a bare listener count |
| L.4 | The room's head | DONE — cover, "{host} · {crowd}", "Over" / start time / LIVE |
| L.5 | The three dots | DONE (NOT VERIFIED live) — Start now / Share the room / Report the room / Close the room / Leave quietly, the app's conditions |
| L.6 | Share the room, inside and out | DONE — convos first, "Share outside" with the clipboard fallback and the app's own sentence |
| L.7 | Report a room | DONE (NOT VERIFIED live) — `ReportSheet kind="room"`, reasons from the server |
| L.8 | Scheduled and closed words | DONE — the app's announcement lines and "Close the room?" |
| L.9 | Room sound | NOT IMPLEMENTED — the app's stage audio is a WebRTC mesh over `call.signal`; the web has had a client for that relay since the calls (2026-11-06) but the room page is not wired to it, and the page says so |

Deliberate difference, recorded: the web keeps `CirclesSection` below the strip,
because the app reaches circles from their own shelf and the web has none.

## Phase 4 — Conversation system (highest priority)

Goals and statuses:

| Goal | Work | Status |
| --- | --- | --- |
| 4.1 | Conversation architecture audit | DONE |
| 4.2 | Optimistic send + reconciliation via `client_id` | DONE |
| 4.3 | Honest receipts from `thread.status` / member watermarks | DONE |
| 4.4 | Fix Spark view-once endpoint (`open-once/`) | DONE |
| 4.5 | Forward messages (`/forward/`) | DONE |
| 4.6 | Group message info (`/info/`) | DONE |
| 4.7 | Live thread-card patch from `thread.update` + reorder | DONE |
| 4.8 | Conversation list: the line under a name, the count and the row's marks, to the app's grammar | DONE (rebuilt 2026-11-03) |
| 4.9 | Composer polish (draft restore, emoji, attach menu) | DONE |
| 4.10 | Scroll/pagination verification | VERIFIED (static) |
| 4.11 | Message search surface | DONE (`/chat/search/` inside Convo search) |
| 4.12 | Offline outbox / durable sync replay | NOT STARTED (needs design) |
| 4.13 | The Spark sheet's "Add to Moments" — the card painter and the composer behind it | DONE 2026-11-04; sound row DONE 2026-11-05 (nothing posted live) |
| 4.14 | Calls — audio and video over the app's own relay | DONE 2026-11-06 (**NOT VERIFIED** — no live backend, no second device, no devices here) |

Phase 4 code status: goals 4.1–4.14 are implemented and pass typecheck, lint,
unit tests and a production build. Runtime behaviour against a live backend and
a second authenticated device is **NOT VERIFIED** in this environment (see
`XELVIC_TESTING_REPORT.md`).

### Second pass — Spark lifecycle and chat-screen fidelity

The first pass still treated a Spark as a message kind and remembered opened
state in the browser. The backend does neither, so that path is replaced:

- Detection reads `payload.view_once`; opened reads `payload.opened_at`.
- Send goes through the app's camera/editor (`ChatPage` attach menu → "Spark")
  and posts `kind: image|video` with `payload: {view_once: true}` — the
  invalid `kind: "spark"` is gone.
- The viewer loads the media bytes first, then spends the look with
  `POST .../open-once/`; it walks the run of unopened incoming Sparks in
  ordinal order, closes on the last tap, and can reply.
- The app's exact Spark strings and dimensions are used for the recipient
  tile, the sent/opened/gone pill, and the server-driven screenshot line.

Chat-screen fidelity was brought to the app's spec: no clock above text
bubbles, day pills, 4/10/2 run gaps, group sender at run head, receipt under
every own bubble, edited marker inside cards, app bubble and composer
dimensions, and a heading with only name/face/verified tick.

### Third pass — the list's own grammar, and the Spark a row opens (2026-11-03)

Goal 4.8 was marked done on the strength of a real preview and a numeric badge;
both were the web's own answers rather than the app's, and three defects were
reported against them. What changed:

- **The line under a name** is `listLine`, the phone's rule: `Say something`,
  my own receipt word, `N new`, `Nothing new` — and never the message.
- **The count** is `N new` under the name, plus a plate at the end of a group's
  name; the accent circle at the far right of every row is gone.
- **The spark's tap** opens a sheet about that run (`SparkSheet`, a port of
  `screens/spark.dart`) instead of navigating to the sparks wallet page.
- **The Unread lane** reads `unread_other_count`, so a convo whose only waiting
  line is a Spark stays off it.
- **The marks row** gained the pin and the birthday cake, and the phone's gaps.

Still outside: the row's play button (see `XELVIC_FINAL_GAP_REPORT.md`) and a
live run of any of it. The sheet's "Add to Moments" pill was outside then too,
and was closed in the fourth pass below.

### Fourth pass — the Spark card, and "Add to Moments" (2026-11-04)

The sheet's last pill was the one part of `screens/spark.dart` deliberately left
undrawn, because there was no composer behind it. There is now:

- **`SparkSheet`** draws the phone's `_comingUp()` row — the next rung's sentence
  and the stadium "Add to Moments" pill beside it — on every run the sheet can
  draw, including a broken one, as the phone does.
- **`features/sparks/card.ts`** is the port of `spark_moment.dart`'s painter: a
  1080×1920 picture of one run, the card 840×1520 inside the band a phone's crop
  leaves, paper from the award, fixed ink, the flame, the two curves with their
  chat and call marks, both faces, the ring, the award's name, the days, the rule
  and the closing line. The glyphs are `lucide-react`'s path data, so the picture
  keeps the client's own icon language; a face is drawn only from the media cache
  or a local blob, else initials, because a tainted canvas loses the whole card.
- **`features/sparks/SparkMoment.tsx`** is the phone's page: the card at post
  size (what is drawn *is* the file that uploads — painted once per opening, as
  the phone paints in `initState`), the audience pill, the mention switch, and
  one button — `uploadAsset` → `POST /moments/`, with the success line said only
  after the server takes it. It is a lazy chunk.
- **Fixed in the same pass, after the first opening of the page:** the painter
  was ported without the bound the phone puts on it — `spark_moment.dart` reads
  both faces through `Faces.keep`, whose `patience` is fifteen seconds, and the
  port awaited them for ever, so a media read that went quiet without closing
  left the modal on a spinner and the Share button dead. `FACE_PATIENCE_MS`,
  `FONT_PATIENCE_MS` and `within()` in `features/sparks/card.ts` are that bound,
  in the phone's own numbers, measured in a browser on 2026-11-04.
- **Fixed in the pass after that, when the page said it could not draw the
  card:** the taint the bullet above only warns about is what a public avatar
  does. `mediaCache.loadMedia` returns a non-API address untouched, so a CDN
  avatar arrives as an `https://…` URL and drawing it plainly poisons the canvas;
  `toBlob` then throws `SecurityError`. `faceImage` asks with
  `crossOrigin="anonymous"`, a name that is not a string and a `drawImage` that
  throws both fall back to the initials plate, and a whole failed paint is
  retried once with no pictures before the page is told. The page also prints
  the reason under the sentence on a dev build.
- **Not done:** a live posting run, with or without a sound. Named on the parity
  matrix.
- **Added 2026-11-05 — the phone's sound row.** `features/audio/` now holds the
  one implementation of "which sound, and which part of it": `SoundPicker` (the
  three shelves and search — the sheet the composer's audio tool already opened),
  `PartChooser` (the drag surface), `audioWindow.ts` (how long a part a post
  needs), `soundBits`, `preview.ts` and the moved `audioShelf`/`partLength`.
  `PhotoEditor` imports them back, and `SparkMoment` now draws `_soundRow()`:
  "Add audio", then the sound's name, its window as `soundWindowLabel`, "Choose a
  part" and an ✕. A card is one picture, so the part offered is the one-picture
  thirty seconds. What goes up is `sound`/`sound_start_ms`/`sound_end_ms` on the
  moment item, all three of which `PostItemSerializer` has accepted since before
  the page existed. **Not looked at in a browser, and not posted live.**
- **Added 2026-11-05 — four further card looks.** `SPARK_CARD_STYLES` is
  `["classic", "midnight", "sunset", "aurora", "noir"]`, chosen uniformly at
  random per card. The four after `classic` are the composition of a four-card
  design sheet: the classic skeleton underneath (both faces, the glyph, the
  award's name, the days, the closing line, all at the same coordinates), a
  violet pill behind the days and behind the closing line, and one motif per
  look drawn flat under the card's clip. The first ornaments were invented rather
  than read and did not match the sheet; they were **rebuilt on 2026-11-05**
  against measurements of it — a near-white field of `#F8F5FE` with the award's
  tone collecting at the two edges, an opaque motif in a stepped halo (a planet
  on an orbit with a rocket for `sunset`, a moon with a climbing rocket, stars
  and cloud for `midnight`, a segmented ring with four icon buttons for
  `aurora`, a stack of three tilted slabs over a contour bed for `noir`), and a
  foot of tone that climbs the two edges and dips through the middle. No
  gradients anywhere, per the house rule: stacks of flat shapes a step of alpha
  apart, never `createRadialGradient` — so the sheet's glow is approximated, not
  reproduced. `classic` is untouched and its fill list is pinned by a test, which
  caught the one regression that reached it. This is **beyond parity** — the
  phone has one card and these four exist only here — and `NOT VERIFIED`: they
  have been rasterised in headless Chrome and measured, never seen. Full detail
  in `XELVIC_PROGRESS_TRACKER.md` and `XELVIC_TESTING_REPORT.md` (**The four card
  looks, rebuilt**).

## Calls — audio and video over the app's own relay (done 2026-11-06)

Asked for as "jaise app me audio aur video call chal rha hai waise hi isme bhi".
The app's contract was followed rather than reinvented, because a call is the one
feature where being nearly the same as the phone means two handsets that never
connect.

Sources read, not modified: `app/lib/calls.dart` (the state machine),
`app/lib/screens/call.dart` and its neighbours, `app/lib/call_platform.dart`;
`backend/apps/calls/{urls,views,services}.py`, `apps/chat/consumers.py` (the
`call.*` branches), `apps/chat/events.py` (`CALL_*`).

| Goal | Work | Status |
| --- | --- | --- |
| C.1 | The signalling client — ring, accept, decline, leave, video, signal, pending, on the app's one authenticated socket | DONE (NOT VERIFIED live) — `src/features/calls/engine.ts` |
| C.2 | Peer connections — `GET /calls/ice/` into `RTCPeerConnection`, who offers, the collision rule, the candidate queue, the re-offer after a camera | DONE (NOT VERIFIED — no connection has ever been made) |
| C.3 | The screen — full-window overlay, the video grid with a mirrored self-view, the audio stage, the clock, mute / camera / hang up | DONE (NOT VERIFIED — never rendered) |
| C.4 | The two doors — the convo row's phone and video buttons, and a call-back from a history row | DONE (NOT VERIFIED live) |
| C.5 | Accepting a ring is the one thing that cannot wait for a page | DONE — `CallProvider` sits above the router, so a ring draws wherever the person is |
| C.6 | Media a browser refuses | DONE — the refusal is the app's own sentence, drawn in amber, and the call is carried rather than dropped |
| C.7 | Ringtone, vibration, wake lock, earpiece/speaker routing, camera flip | NOT IMPLEMENTED — the browser has no equivalent of `call_platform.dart`'s half, and none of it is faked |
| C.8 | `call.add` — starting or growing a group call from the web | NOT IMPLEMENTED — a group call can be drawn as its frames arrive, but nothing here starts one or adds a third person |
| C.9 | Removing a call from the history | NOT IMPLEMENTED — `DELETE /calls/<id>/` is unused; the row has no remove |

Deliberate differences, recorded: the phone's ring is answered from a banner and
a notification, and the web has neither — a ring draws as the overlay itself. The
phone routes audio to an earpiece and locks the screen awake; a browser does
neither, and nothing here claims it does.

**Nothing about a call is verified.** No connection was ever made, no microphone
or camera was ever opened, no live backend answered, and there was no second
device. The state machine and its arithmetic are covered by 42 unit tests (see
`XELVIC_TESTING_REPORT.md`, **The calls — 2026-11-06**); the connections are
covered by nothing. The parity matrix carries this as `PARTIALLY COMPLETE (NOT
VERIFIED)`.

## Phase 5 — Cross-device synchronization

Mechanism (verified against backend):

- Both clients share `api.xelvic.com` and the same JWT identities.
- Realtime is `wss://<api>/ws/?token=`; per-thread `subscribe` joins the group.
- `message.new` arrives for mobile-originated sends and is inserted once by id.
- `thread.update` carries unread + preview and is patched into the list.
- Receipts arrive as `thread.read`; presence as `presence`.
- Where no socket event exists, TanStack Query invalidation is the fallback.

Status: **implemented at the code level; live cross-device run unverified**
(no second authenticated device/backend in this environment).

## Phase 6 — Web-native UX

- Two-pane conversation layout already exists (desktop sidebar + pane).
- Responsive behaviour: sidebar collapses under `:threadId` on small screens.
- Remaining: keyboard shortcuts, composer focus retention, touch target audit.

## Phase 7 — API/state audit

Performed in `XELVIC_API_COMPATIBILITY_REPORT.md`. Mismatches fixed:
view-once path, preview rendering, receipt honesty, live card patching, direct
chat creation documentation.

## Phase 8 — Performance and security

- Deduplicate messages by id; sort by `ordinal`.
- Avoid list refetch on each `thread.update` (patch instead).
- No tokens logged; media fetched with auth helper; no `dangerouslySetInnerHTML`.
- Upload progress now comes from axios `onUploadProgress` in
  `src/services/upload.service.ts` and is painted on the optimistic bubble
  (`Uploading n%`).
- Remaining: virtualisation for very long histories.

## Phase 9 — Testing

Static: typecheck, lint, unit tests, production build.
Runtime: blocked by missing live backend/device credentials; documented in
`XELVIC_TESTING_REPORT.md`.

## Phase 10 — Transport (done 2026-11-01)

The whole app was moved onto one HTTP client, in the shape the reference web
project uses: a config layer plus one service module per domain.

```
src/config/env.ts      addresses, timeouts, app name
src/config/urls.ts     absolute/relative media and API URL helpers
src/config/axios.ts    the single instance: bearer, refresh-once, ApiError
src/services/*.ts      21 domains, 202 methods, index.ts barrel
```

Rules this phase fixes in place:

- A screen never imports `axios`. It calls `someService.method()`.
- A service method is `async`, takes the arguments the screen already had, and
  returns `response.data` unreshaped. It never invents a value.
- A third-party host (geocoding, a public avatar) is dialled with bare `axios`,
  never the shared instance, so the account's bearer token cannot leave for
  another origin.
- Failures still reach the call site as `ApiError`; there is no global error
  toast, so no screen can show a fake success.

`src/lib/api.ts` and `src/lib/env.ts` are deleted. The completeness proof and
the two wire-level differences this introduces are in §12 of
`XELVIC_TESTING_REPORT.md`.

## Execution order from here

1. ~~Land the Phase 4 fixes (4.2–4.11) with typecheck/lint/test/build.~~ DONE.
2. ~~Message search + upload progress.~~ DONE.
3. ~~The marketplace and the theme (Phase 5, the second one).~~ DONE.
4. ~~Notifications to the app's own rules (Phase 6, the second one).~~ DONE.
5. ~~Moments: the story walk, ported from `MomentViewScreen`.~~ DONE, with M.15–M.17 named as gaps rather than claimed.
6. ~~Transport: every request on axios, through `src/services/`.~~ DONE (Phase 10).
7. ~~The Moments follow-through: the Memory walk, managing a Memory, a Memory out of Alerts, carry-with-edit, the live ring.~~ DONE (M.15–M.18), all NOT VERIFIED live.
8. Group admin surfaces.
9. Remaining parity modules in the order above.
10. Keep the tracker and gap report current after every goal.

## Round 18 — the ring, the notice, the camera, the layout, and a room's sound (2026-11-06)

The round that finished the six things the calls pass left out or left blunt. It
touches no backend and, like the calls, is `PARTIALLY COMPLETE (NOT VERIFIED)`
throughout — nothing here was exercised against a live backend, a second device, a
microphone, a camera or a real notification surface.

| Goal | Work | Status |
| --- | --- | --- |
| R.1 | A ringtone for incoming and outgoing calls — the app's own recording with a written tone behind it — plus vibration | DONE (NOT VERIFIED) — `src/features/calls/ring.ts`, 22 cases |
| R.2 | A call notice on the browser's notification surface, with Decline and Accept, fed back into the engine | DONE (NOT VERIFIED) — `src/features/calls/notice.ts`, `public/call-sw.js`, 8 cases |
| R.3 | Camera quality — 1080p at 30 fps with a floor, `maintain-resolution`, a bitrate from the picture, `contentHint`, a device list, and a `getStats` pill | DONE (NOT VERIFIED) — `src/features/calls/quality.ts`, 30 cases |
| R.4 | The call layout for a phone and a laptop — fit/fill, spotlight and grid, a draggable clamped self-view, fullscreen | DONE (NOT VERIFIED — never rendered) — `src/features/calls/CallOverlay.tsx` |
| R.5 | A room's sound, over the same relay an ordinary call uses | DONE (NOT VERIFIED — no connection has ever been made) — `src/features/rooms/`, `src/features/media/surfaces.tsx`, `CallEngine.ignoreCall` |
| R.6 | A listener past the relay's limit is named plainly rather than silently dropped | DONE — `RoomSoundView.tsx` says so, against `MEDIA_LISTENERS` |
| R.7 | The picture lifted into the browser's own corner window, and a room that the browser refuses to play saying so instead of claiming to be heard | DONE (NOT VERIFIED) — `requestPictureInPicture` in `CallOverlay.tsx`; the blocked-playback press in `RoomSoundView.tsx` and `features/media/surfaces.tsx` |

Two of the calls section's named gaps move. **C.7** is now partly done: ringtone,
vibration and camera flip are here; earpiece/speaker routing and the screen-awake
lock stay not implemented, because a browser offers neither. And **room sound**,
which the calls pass left out, is now wired over the same relay — no new endpoint,
the stage being a `calls.Call` on the server.

**Nothing about it is verified.** No connection was ever made, no microphone or
camera was ever opened, no notification was ever shown, and there was no second
device. The new arithmetic — the ring's tones, the notice's one-post-per-call rule,
the quality helper's bitrate and constraint building, the mesh's `whoOffers` and
`readSignal` — is covered by unit tests; everything that needs a browser is covered
by nothing. See `XELVIC_TESTING_REPORT.md`, **Round 18**.

## Round 19 — the mirror, the cards that fit, and Vibes in the feed (2026-11-06)

The round that answers three of the owner's own reports: the picture that was
mirrored when the phone would not mirror it, the card that asked for a box taller
than the screen, and a feed with no Vibe in it. The first two are complete as code
and `NOT VERIFIED`; the weave is complete as code and `NOT VERIFIED live`; and the
round's own limits — a Vibe still plays only its first clip, there is no Vibe
editor here, play counts never move and there is no own-posts shelf — are named
`NOT IMPLEMENTED` rather than left implicit.

| Goal | Work | Status |
| --- | --- | --- |
| R.8 | A mirror control for the picture, on a call and on a room's stage, following the phone's rule that only the front lens is mirrored | DONE (NOT VERIFIED) — `features/calls/engine.ts` (`Facing`, `mirrored`, `readFacing`), `CallOverlay.tsx`, `features/rooms/{stage,useRoomStage,RoomSoundView}`, `RoomPage.tsx`. **Turned round in Round 20**: see R.16 |
| R.9 | A card's picture kept inside the screen — a clip capped at `62dvh`, a still or a gallery narrowed to answer the same ceiling, from the phone's own `tallClipShare` / `0.78` | DONE (NOT VERIFIED) — `features/drops/DropCard.tsx`'s `frameBox`, `SensitiveVeil.tsx`'s `max-h-[78dvh]` |
| R.10 | A walk that no longer puts its caption and its player panel under a phone's bottom bar | DONE (NOT VERIFIED — reasoned, medium confidence) — `VibeViewer.tsx` became `fixed inset-x-0 top-0 h-[100dvh]`; `styles/index.css` moved `body` to `100dvh` and added `overflow-x: clip`; `PollBlock.tsx` gained `break-words` |
| R.11 | Vibes woven into the feed the way the phone's `mixedFeed` weaves them, from the server's `vibe_share` | DONE (NOT VERIFIED live) — `features/drops/mix.ts`, `mix.test.ts` (13 cases), `pages/DropsPage.tsx`, `types/api.ts`'s `Page<T>` |
| R.12 | The rail of Vibes above the feed, in `shelfOrder` less the clips the feed below already draws, capped at ten | DONE (NOT VERIFIED live) — `DropsPage.tsx`, `RAIL_CLIPS = 10` |
| R.13 | A clip in the feed drawn as a card whose single press opens the walk — a Vibe or a plain video, as the app opens both — without breaking the double-press that feels the post | DONE (NOT VERIFIED) — `DropCard.tsx`'s optional `onOpen`, waiting out the 220 ms window; `model.ts`'s `dropIsClip` and `mix.ts`'s `walkOf` decide it and where the walk starts |
| R.14 | A `?edit=<id>` deep link reading the drop route first and the Vibe route second, because a URL carries an id and not the table it lives in | DONE (NOT VERIFIED) — `EditDrop.tsx` |
| R.15 | A play signal, a Vibe editor, `category` / `interests`, and an own-posts shelf | NOT IMPLEMENTED — `POST /drops/<id>/play/` is uncalled, the composer never sends `recipe` / `category` / `interests` / `track_id`, and `GET /drops/mine/` and `GET /drops/interests/` are unused |

R.8–R.14 answer the owner's three reports and the omission the phone's `mixedFeed`
had exposed; none of them moves a gap the calls left open. R.15 is deliberately one
line of `NOT IMPLEMENTED` rather than several claims: the round wove the Vibes into
the feed but did not build the editor behind them, and a Vibe still plays as its
first clip alone because its `recipe` and `clip_urls` are read by nothing here.

**Nothing about it is verified.** No device and no browser run was made and no live
server was reached, so the mirror rule, the heights, the strip and the walk's door
are all unexercised where it counts. The mix's arithmetic is covered by the phone's
own cases carried over into `mix.test.ts`, the clip rule by `model.test.ts` and the
card's box by `frame.test.ts`, and the whole suite is
307 tests across 26 files with `npm run typecheck`, `npm run lint` and
`npm run build` all passing when the round closed (310 after Round 20). See
`XELVIC_TESTING_REPORT.md`, **Round 19**.

## Round 20 — the Mirror button, turned round (2026-11-06)

The round that answers the owner's next report, and reverses half of R.8: *"jo video
call me mirror par click karne par jo flip ho raha hai wo mere video card me raha
hai jabki reciever user video card me hona chahiye"*. Round 19's button overruled the
self-view's lens rule, so the one picture that was already right turned over. Asked
which picture it should turn, the owner chose the picture **arriving** — the other
person's — with the self-view left on the phone's own rule.

| Goal | Work | Status |
| --- | --- | --- |
| R.16 | The Mirror button turning the pictures **arriving** rather than this tab's own, with the self-view following the lens and nothing else | DONE (NOT VERIFIED) — `features/calls/engine.ts` (`remoteMirrored`, `toggleRemoteMirror()`, `mirrored()` reduced to `facing !== "environment"`), `CallOverlay.tsx` (`RemoteTile`'s `mirror?` at the grid, the spotlight and the rail; the pill on `call.remoteMirrored`), `features/rooms/{stage,useRoomStage,RoomSoundView}`, `RoomPage.tsx`, three cases in `engine.test.ts` |
| R.17 | A per-stream word for camera-versus-screen, so a remotely shared screen is not turned over with the cameras | NOT IMPLEMENTED — a call frame carries no such word, so `toggleRemoteMirror()` flips whatever is arriving and this is named rather than guessed |

R.16 is complete as code and `NOT VERIFIED`: a mirror is a display and not a
transmission (`VideoSurface`'s `-scale-x-100`, no track transformed), so it takes two
ends on a real call to be *seen*, and none was available. It is also a deliberate
divergence from the phone, which has no Mirror button at all. Two consequences are
named rather than left to be found: a webcam reporting no `facingMode` is now drawn
mirrored with no way to change it, and a remotely shared screen is flipped too.
See `XELVIC_TESTING_REPORT.md`, **Round 20**.

## Round 21 — a shared screen shown whole, and a call that can be put aside (2026-11-06)

Two more of the owner's own reports, and both faults lived in the same file for
different reasons: *"main screen laptop me share kar raha hu aur koi apne mobile me
dekh raha hai to pura screen nahi dikh raha hai use kewal beech ka dikh raha hai,
aur video call karne par main video hata kar chat par aa raha hu aur call chal hi
rahi hai to phir main video call par nahi aa raha pa raha hu"*. The crop was a
viewer's own **Fill** surviving into every later call; the missing way back was a
`fixed inset-0` overlay with nothing above it to press.

| Goal | Work | Status |
| --- | --- | --- |
| R.18 | The view choices — Fit/Fill, the layout and the focused seat — reset when a call ends instead of outliving it in a tab | DONE (NOT VERIFIED) — `CallOverlay.tsx`'s effect on `call.phase` returning to `idle` / `over` sets `fit`, `layout` and `focus` back to their opening values |
| R.19 | A far end whose picture changes shape mid-call — a camera replaced by a shared screen — drawn whole again, measured from the video element rather than from the signalling | DONE (NOT VERIFIED) — `features/calls/model.ts`'s `sourceChanged(before, after)` and `SHAPE_SHIFT = 0.12` with three cases in `model.test.ts`; `media/surfaces.tsx`'s `resize` listener (kept off the attach effect by a ref) beside `loadedmetadata`; `CallOverlay.tsx`'s `remoteShapeChanged` returning to **Fit** |
| R.20 | A **Minimize** pill and a bar that carries a running call over another page — picture or glyph, name, clock, microphone, camera, red button — with its own sound and a press to return | DONE (NOT VERIFIED) — `CallOverlay.tsx`'s `minimized` state, the bar above the router at `z-[95]`, `MiniButton`, `AudioSurface` per remote seat; reset with the next call |
| R.21 | A word in the call frame that says a stream is a screen and not a camera, so mirror and fit could both respect it | NOT IMPLEMENTED — the relay accepts only offers, answers and candidates (`SIGNAL_TYPES` in `backend/apps/calls/services.py`) and the backend is read-only, so the client infers from **shape** alone |
| R.22 | Rejoining a call that is still running after a page reload | NOT IMPLEMENTED — the engine holds no `callId`, `calls.pending` answers only for rings, and no read-only route lists the calls an account is on |

R.18 and R.19 are complete as code and `NOT VERIFIED`: both need two ends, a
laptop sharing a screen and a phone looking at it, and neither was available. R.19
has one named hole — a camera and a shared screen that are both 16:9 produce no
shape change, so a **Fill** pressed during that same call still crops until the
call ends. R.20 is complete as code and `NOT VERIFIED`, and it is deliberately not
the phone's window: `call_window.dart` can be dragged and docked and can shrink to
a mark, while this bar is fixed to the bottom and has one size.

The suite stands at 313 tests across 26 files, with `npm run typecheck`,
`npm run lint` and `npm run build` all passing when the round closed
(entry 510.67 kB / 158.99 kB gzip, CSS 134.30 kB). See
`XELVIC_TESTING_REPORT.md`, **Round 21**.


## Round 22 — the small call window is moved by hand (2026-11-06)

The follow-up of the same day, about Round 21's own bar: *"abhi video call minimize
karne par use drag aur drop nahi kar pa raha hoon chat screen me"*. Round 21's R.20
gave a running call somewhere to go; it left that place fixed to the bottom of the
screen, which the owner reported as half a feature.

| Goal | Work | Status |
| --- | --- | --- |
| R.23 | The small call window dragged anywhere on the page and docked against an edge, following the phone's own rules | DONE (NOT VERIFIED) — `src/features/calls/minibar.ts` (`homeSpot`, `clampSpot`, `dockEdge`, `WINDOW_GUTTER`), `minibar.test.ts` (8 cases), `CallOverlay.tsx` (pointer drag with capture and `DRAG_SLOP = 6`, the capture-phase click guard, placement by `left`/`top` once moved, the docked tab, `ResizeObserver` on the bar and a `resize` listener on the page, the `<audio>` elements moved out of the window) |
| R.24 | The phone's third size — a call hidden down to a single mark (`CallView.hidden`) | NOT IMPLEMENTED — the web has two sizes where the phone has three |
| R.22 | Rejoining a live call after a page reload | NOT IMPLEMENTED — unchanged; the round moved nothing on the wire |

R.23 is complete as code and `NOT VERIFIED`: no browser run and no device run, so
the drag, the click it swallows and the tab it folds into are reasoned and
unexercised. One cost is named in `minibar.ts`'s own tests rather than left to be
found — on a phone the bar fills almost the whole width, so it rests one gutter from
both edges and folds away from the smallest push, where the phone's 116-point window
on the same screen does not.

The suite stands at 321 tests across 27 files, with `npm run typecheck`,
`npm run lint` and `npm run build` all passing when the round closed
(entry 514.54 kB / 159.90 kB gzip, CSS 134.52 kB). See
`XELVIC_TESTING_REPORT.md`, **Round 22**.

## Round 23 — the emoji a message wears, and the mic that records (2026-11-11)

Two of the owner's own reports about when an emoji moves — *"abhi emoji chatscreen me send
karne par send ke baad aur hover par animate nahi kar raha hai, please ise fix kijiye"*, then
*"ye jo continue animate ho raha hai jabki send karne par aur hover karne par animate hona
chahiye"* — then four about what it is drawn with, the last of them settling it: *"please
dynamic emoji hata dijiye pahle jaise tha waise hi kijiye jo google ka"*, and then the panel
itself, where the same fault was worse because the whole grid moved at once: *"abhi input me jo
plus hai usme emoji par click karne par jo emoji panal open hota hai, usme emoji animate
continue hote hi rahte please ise aisa kijiye ki kewal hover karne par hi emoji animate kare"*.
Then one more, sent with a crop of two pink bubbles, which is where the round ended: **"kisi kisi
emoji me do do emoji aa raha hai ek hover karne par animate hota hai aur ek nahi hota hai please
ise fix kijiye jisse ek hi emoji aaye"**, and at once *"aur ye problem sabse jyada people & body
wale me jyada hai"*. The composer's round mic had never recorded anything at all.

| Goal | Work | Status |
| --- | --- | --- |
| R.25 | The composer's mic recording a real voice note — the phone's hold-to-record, the bars drawn from what was actually recorded, and the note sent as an asset | DONE (NOT VERIFIED) — `src/features/convo/voicehold.ts` (`holdSlide`, `amplitudeBar`, `CANCEL_SLOP = 70`, `LOCK_SLOP = 60`, `MIN_VOICE_MS`, `MAX_VOICE_MS`, `MAX_VOICE_BYTES`, the 120-sample shelf), `useVoiceNote.ts` (`MediaRecorder` + `AnalyserNode`, the container chosen from what the browser will record), `VoiceStrip.tsx`, `voicehold.test.ts` (13 cases), and `uploadAsset` with `kind: "voice"` → `chatService.send`. Measured in Chrome with a fake microphone; never run against a live server |
| R.26 | An emoji — in the picker or in a message — moving only while a pointer rests on it and once on send or arrival, rather than for being on screen, and Google's artwork as the only resting set | DONE (NOT VERIFIED) — `src/features/emoji/motion.ts` (`wanted(inView, hovered)` with no mode, `spare`, `giveBack`, `MOST_MOVING = 24`), `motion.test.ts` (11 cases), `EmojiArt.tsx`'s `burst` and its `bursting` guard, `src/features/convo/arrivals.ts` (7 cases), `text.ts`/`flags.ts` for reading a message without the picker's index; and the alternative resting sets removed (`looks.ts`, `fluent.ts`, `threed.ts`, `moji3d.ts`, `emojitwo.ts`, the `xelvic.emoji.look` key, the picker's Look chip). Measured in a real browser with real mouse moves: the panel idle `{"running":0,"drawn":169}`, one tile held `{"running":1}`, pointer away `{"running":0}`; `EmojiText` idle `0` → hovered `1` → left `0` → burst `2` → settled `0`. Named rather than discovered: on a touch screen, where nothing can rest on an emoji, the panel is still |
| R.28 | One emoji drawn once — the machine's own glyph no longer showing under Google's drawing | DONE (NOT VERIFIED) — `EmojiArt.tsx` derives `covered = drawn || animated` and fades the character layer out with `opacity-0` over the still's own 100 ms, keeping it in the DOM so a message's emoji stays selectable and copyable and so the fourteen emoji Google draws nothing of still show it. Measured in Chrome through the real `EmojiText`: every character layer `opacity: "0"` at rest and hovered, and forcing it back on changes 1,234 px at rest / 1,301 hovered — per emoji 😀 0, 👏 13, 👍 37, ✌️ 102, 🙏 132, 🙌 189 at 42px, and 761 for a 120px 🙏, which is the owner's *"sabse jyada people & body"* measured. `hover-tiles.mjs` and `emoji-text.mjs` re-run unchanged. No unit test is possible: `vitest.config.ts` is `environment: "node"`, so the browser probe is the evidence |
| R.27 | WhatsApp's own emoji artwork | NOT IMPLEMENTED — and not shippable from this origin: WhatsApp's emoji on an iPhone are Apple Color Emoji, which Apple does not license to other people's websites. The device's own font is the closest honest answer and it is not this origin's to serve either |
| R.24 | The phone's third size — a call hidden down to a single mark (`CallView.hidden`) | NOT IMPLEMENTED — the web still has two sizes where the phone has three; this round did not go near a call |
| R.22 | Rejoining a live call after a page reload | NOT IMPLEMENTED — unchanged; the round moved nothing on the wire |

R.25, R.26 and R.28 are complete as code and `NOT VERIFIED` where it counts. The mic's own half was
measured in a real browser with Chrome's fake microphone — a three-second hold made a real
36,220-byte `audio/mp4;codecs=mp4a.40.2` note of 2,195 ms with 19 loudness readings, a 120 ms
tap made nothing and said *"Hold the mic to record — a tap is too short to send."*, and a hold
slid up parked the recorder for the strip's Send to finish. **No live server was reached and
nothing was done in the signed-in app**, so the upload of the recording, the message that
carries it and the bubble that plays it back are written and unexercised, and no emoji was ever
seen moving inside a real thread.

The suite stands at 395 tests across 33 files, with `npm run typecheck`, `npm run lint` and
`npm run build` all passing when the round closed (entry 514.84 kB / 159.96 kB gzip, chat page
139.50 / 37.08, EmojiPicker 97.46 / 24.78, `lottie_light` 169.07 / 47.41). The suite itself was
run as `npx vitest run --pool=vmForks`: plain `npm test` uses vitest's default pool, which on
this machine does not finish its worker bootstrap and stops all 33 suites at their first
`describe` — with files that have nothing to do with emoji among them, and identically with
`EmojiArt.tsx` restored to its committed state, so it is an environment fault and not this
round's. It was passing earlier the same day and stopped after the previous round's build;
nothing in `package.json` or `vitest.config.ts` was changed to hide it. The chat page figure
is measured over a working copy of `src/pages/ChatPage.tsx` that differs from the last commit by
1,588 lines added and 523 removed, more than this round's own composer and arrival wiring, and
is not covered by this section as this round's work. See `XELVIC_TESTING_REPORT.md`,
**Round 23**.

## Round 24 — the plus menu's six rows, and a place that can be sent (2026-11-12)

The request named the rows and their order: *"please ab convo ke chatscreen ke input me jo plus
par click karne par open hota hai, please usme photos and videos, file, Location, Spark, sticker
aur emoji ka option add kijiye"*. The menu held four — Photo or file, Sticker, Spark, Emoji — and
holds six. Emoji was the only one of the six the phone cannot have (its keyboard supplies them,
Round 23); the phone's own words for the other two file rows are the ones used here.

| Goal | Work | Status |
| --- | --- | --- |
| R.29 | The composer's plus menu offering Photos and videos, File, Location, Spark, Sticker and Emoji, each opening something that works | DONE (NOT VERIFIED) — `src/pages/ChatPage.tsx`: one `AttachRow` written once for the six rows, the two hidden inputs, the panel rebuilt. Measured in a real browser against the real app: `["Photos and videos","File","Location","Spark","Sticker","Emoji"]`, none disabled, and the accept lists `["image/*,video/*","audio/*,application/pdf,.doc,.docx,.txt"]` — the single old list cut in two, with `chooseFile` untouched so the kind that travels is still the file's own |
| R.30 | Sending a place from the chat composer | DONE (NOT VERIFIED) — `src/features/convo/LocationSheet.tsx` → `sendLocation` → `chatService.send` with `kind: "location"` and `{lat, lng, accuracy_m?}` in `payload`; no asset, because `Message.Kind.LOCATION` is in the backend's `EMBED_KINDS` and not in `MEDIA_KINDS`. Measured: the fix reverse-geocoded (*Shahid Major Kaustubh Rane flyover, Mumbai*), the accuracy drawn as its own line at 35 m and at 2,400 m, the footer enabling on a choice, and a LOCATION bubble left in the thread. Never delivered to a real backend: the request and its optimistic bubble are what was watched |
| R.31 | The phone's place sheet, both halves — the browser's own fix with how sure it is, and a search by name | DONE (NOT VERIFIED) — a port of `app/lib/screens/place_sheet.dart`, *"the one door onto a place"*, and of its reason: *"location select karte time manually bhi search kar sake, jaise kisi hotel ka naam"*. Measured with real key events: `Bandra` drew six real OpenStreetMap rows under a refusal line for the position, and a searched place travels with **no `accuracy_m`**. The refusal vocabulary is pinned without a browser by `src/utils/place.test.ts` (7 cases) |
| R.32 | One home for naming a position, shared by the camera and the composer | DONE — `src/utils/place.ts` is `getJson`, `reversePlace`, `searchPlaces` and `PlaceChoice` **moved unchanged** out of `src/features/camera/CameraCapture.tsx`, with `myPlace` new beside them; that file now imports from it and its own `findCurrentPlace` and fallback are untouched. Splits into a 2.61 kB chunk of its own |
| R.33 | A poll created from the chat composer | NOT IMPLEMENTED — and not this round's removal: the last commit has the row (**Ask the crowd**) and its `PollComposer`, the working copy has neither, and no edit to `ChatPage.tsx` in any transcript on this machine removed it. Answering a poll still works. A gap against the last commit, **not** against the phone, whose chat creates no polls either. Left as found |
| R.34 | Trimming the attach list by the room's own rule, as the phone's sheet does | NOT IMPLEMENTED — pre-existing: `channel_allows` exists in `services.py` and the phone shortens its sheet before it draws, but the web's `Channel` type carries `{id, name, position}` and no rule, so a photos-only room here still offers *File*. Named again, not closed |
| R.35 | Song as an attach row, and *Camera photo*/*Camera video* as two roads | NOT IMPLEMENTED — the phone's sheet has seven rows; the web's six cover four of them and add two of their own. Not asked for this round and not built |

R.29 to R.32 are complete as code and `NOT VERIFIED` where it counts. The menu and the sheet were
driven in a real browser against the real app — the real providers, route, guard and `ChatPage`,
with only the server stubbed on `127.0.0.1:5599` and the live API never contacted — so the six
labels, the two accept lists, the reverse-geocoded fix, the accuracy lines, the six real search
rows, the refusal line, the footer and the wire bodies are measured rather than read. **No server
was reached**, so the send is verified as this client's request and its optimistic bubble only,
with the backend's acceptance of `kind: "location"` taken from its own code and tests.

The suite stands at **402 tests across 34 files, all passing on plain `npm test`**, with
`npm run typecheck`, `npm run lint` and `npm run build` clean at the close (entry 514.83 kB /
159.97 kB gzip, chat page 141.86 / 37.84, EmojiPicker 97.70 / 24.86, `lottie_light` 169.07 /
47.41, `place` 2.61 / 1.18). Round 23's note about the default pool does **not** carry forward:
`vitest run` that failed all 33 suites at their first `describe` on 2026-11-11 bootstrapped its
workers again on this run with nothing changed in `package.json`, `vitest.config.ts` or the tests.
See `XELVIC_TESTING_REPORT.md`, **Round 24**.

## Round 25 — one clip component for the walk and the convo panel (2026-11-12)

**The plan, and why it was this.** The owner asked for four things about the convo header's
Vibes — its design, like/comment/share/save on it, a shelf that reaches everybody, and every
feature the Drops walk has. Three of the four are answered by one decision: **stop having two
drawings of a Vibe.** The panel's own little player could only ever be a subset of the walk, and
adding four rail actions to it by hand would have left two rails to keep in step, two caption
rules, two comment sheets and two opinions about what a double tap does. So the drawing was moved
out of the walk into `src/features/drops/VibeSlide.tsx`, and both screens render it.

**Order of work.**

1. `VibeSlide.tsx` — lift `VibeSlide` out of `VibeViewer.tsx` unchanged (the clip, its rail, its
   caption, its strip, its prompts, its pad, its player panel, its sheets), exporting `FLOAT` so a
   caller can put the same shadow on its own chrome.
2. `VibeViewer.tsx` — render `<VibeSlide>` and keep only what a full screen owns: the portal, the
   scrim-free bar (*More*, *Your studio*, *New Vibe*), the snap scroller, the document-level
   Escape/arrow keys, `lockScroll()`, and the hoisted `DropMenu`/`StatsSheet`/`EditDrop`.
3. `VibesPanel.tsx` — render `<VibeSlide>` in a snap reel over `dropsVibesQuery`, and keep only
   what a panel owns: the shadowed bar with a close button, a title, an `n / total` counter and
   the ⋮; the loading, error and empty states; the once-per-opening `reportVibesShown`; the
   prefetch at `at + 2`; the 90 ms `turned` debounce; and **no** *Your studio* or *New Vibe*,
   because both navigate and a convo is being read behind this panel.
4. `ChatPage.tsx` — replace the five-pixel accent strip in the convo header with a real 40×40
   icon button before the ⋮, which sets `vibesOpen` and carries `aria-label`/`aria-expanded`.
5. Verify in the real app: a stub shelf of three strangers, a real browser, real mouse and key
   events, every write read back from the stub.

**What the plan refused to do.** It did not add an author filter to the shelf request to "fix" the
followers complaint, because there is no filter to remove — `dropsVibesQuery` sends nothing but
the limit, and the read-only backend's `visible_vibes` has no followers-only clause. The honest
answer to that part of the request is measurement, not a code change: the shelf asks for
everybody, and a narrow-looking live shelf is the corpus the server deals.

**What it found on the way, and fixed.** A 500 ms hold opened the player and the release's
`click` shut it again — the tap handler read the release as a tap. Pre-existing in the committed
`VibeViewer.tsx`, inherited by the shared component, fixed once in `VibeSlide.tsx` so both screens
get it.

**Follow-ups this round did not take.** The panel draws Vibes beside the thread rather than
inline in the message list, which is where the phone draws them; the stub's clip was a stand-in,
so nothing was watched playing; and no live request was made, so live media and live moderation
are unverified. The shelf's `limit=8` hand, its cursor paging and the reco lanes are as they
were.

## Round 26 — one file for the box, one measurement for the size (2026-11-12)

**The plan, and why it was this.** The owner asked for two things about the composer's sticker
sheet: that its box be **exactly the emoji picker's**, and that **every sticker be one size**. The
box could have been fixed by typing the picker's four numbers into the sheet — and would have drifted
the next time either panel changed. So the numbers were moved into **one file both panels import**:
`src/components/ui/shelf.ts`, holding `SHELF` (the box), `SHELF_SEARCH` (41), `SHELF_TITLE` (29),
`SHELF_GRID` (`min(258px, 42vh)`), `SHELF_FOOTER` (33) and `SHELF_TITLE_TEXT`, every height written
down as the number it measures.

**Order of work.**

1. Measure both panels in the running app, row by row, before changing anything — 340 × 363 (41 · 29
   · 258 · 33) against 340 × 339 (41 · 264 · 32).
2. `src/components/ui/shelf.ts` — the four rows, extracted from the emoji picker.
3. `EmojiPicker.tsx` — import the rows instead of holding them.
4. `StickerSheet.tsx` — import the same rows, **gain the missing title row** (the pack's name in
   front, the shown count beside it — the row the picker spends on "Smileys & People"), and draw the
   pack bar **always**, so a one-pack shelf cannot lose 32 pixels and move the box.
5. `ChatPage.tsx` — rebuild the lazy picker's Suspense fallback (`h-[320px] w-[350px]`) out of the
   same rows, so the placeholder is the size of the panel it holds.
6. Measure the stickers off the real catalogue before touching the grid, to find out **where** the
   uneven sizes come from. Answer: the files, not the cells — 49 of 90 carry a transparent margin,
   and their ink spans 775–3843 px².
7. `src/components/media/StickerArt.tsx` — measure the ink by alpha scan on the `<img>` the grid has
   already loaded, and fit the **longest visible edge** to the 63-pixel box, positioned by
   percentages with the transparent margin hanging outside.
8. Verify in the real app: both boxes re-measured, four stickers re-measured.

**What the plan refused to do.** It refused to equalise **area**. Same-area would mean drawing a wide
sticker wider than its cell, which crops its wings or overlaps its neighbour; the longest edge is the
only crop-free rule. It also refused to fetch anything twice: the ink is read from the element the
grid already downloaded, which is why Round 26's change did not turn a lazy shelf into six hundred
downloads — Round 27 later confirmed exactly 602 requests for 602 cells.

**Follow-ups this round did not take.** The editor's own sticker shelf
(`src/features/camera/PhotoEditor.tsx`) still draws `size-full object-contain`; it was left as it was
and is named as such. Touch was not measured, and no live request was made.

## Round 27 — ask for the whole shelf, and count the pictures as they arrive (2026-11-12)

**The plan, and why it was this.** Two asks: bring **all** the stickers, and add a **GIF section if
there are GIFs**. The second decides the shape of the first, so it was answered first and from the
data: the catalogue was paged at `limit=100` and counted — **602 rows, 7 pages, 602 unique ids,
`animated: true` 0 of 602**. The owner's instruction covered that case in the same sentence (*"agar
nahi hai to leave it kewal sabhi sticker ko laiye"*), so no GIF section was built and the count was
written down as the reason.

That left the first ask, and the plan was to find out **which half** was missing before changing
anything: the stickers, or their pictures. Counting the cells said the stickers were all there
(602 built, 0 broken); counting the drawn pictures said the pictures were not (76 drawn, 526 blank,
and still 216 blank at the very end of a shelf 11,941 pixels tall).

**Order of work.**

1. Page the catalogue and count `animated` — the GIF question, answered by evidence.
2. `sticker-count.mjs` — count cells, drawn, blank and broken in the running app.
3. `scroll-count.mjs` — drive twenty patient screens and a jump to the bottom, to be sure the blanks
   were not an artefact of jumping.
4. `StickerArt.tsx` — add one prop, `eager`, deciding the `loading` attribute.
5. `StickerSheet.tsx` — turn `eager` on **350 ms after the shelf opens** and off when it closes. A
   timer rather than a plain `true`, so the first screenful takes the connections first.
6. `settle.mjs` — time the fill and count the bytes as they arrive, with a fresh browser profile so
   the numbers are a cold open and not a cached one.
7. Correct the doc comment's byte figure, which had been a `content-length` sample's estimate (94 KB
   each, 54 MB) rather than a measurement. The wire count says 26 MB.

**What the plan refused to do.** It refused to shrink the pictures to make the shelf cheaper: the
Cloudinary URL's `w_512` is part of the URL that is **sent to the backend** when a sticker is picked,
so asking for a smaller file would change the message, not just the download. It refused to change
the box or the grid density that Round 26 had just been asked to set, and it refused to touch the
editor's shelf or the phone to make the numbers look better.

**Follow-ups this round did not take.** The editor's own shelf
(`src/features/camera/PhotoEditor.tsx`) still loads lazily over the same 602 stickers, so it still
behaves as the composer's shelf did before this round. A slow connection was not measured — the
~7.5 s and 26 MB figures are this machine on this connection. Touch was not measured, and no live
request was made.

## Round 28 — the character over the composer, and the two files it needed (2026-11-12)

**The ask.** *"abhi jaise typing par charector typing indicator aa hai waise isme nahi aa raha hai,
please ise fix kijiye"* — the character the phone puts up while the other person writes.

**Why this is a small round.** The live half was already built and was left alone: the composer
already sends `{action:"typing", thread, typing}` while the field has text and `typing:false` 2400 ms
after the last keystroke, and already reads `thread.typing` into `typers`, clearing a typer after the
frame's own `ttl`. What was missing was the **drawing**, so the whole of this round is one new
component and the two things it reads.

**What was built.**

| file | what it is |
| --- | --- |
| `src/features/convo/TypingPeek.tsx` **(new)** | `_peek` from `app/lib/screens/chat.dart`: the other person's character, drawn behind the composer at the phone's own three numbers — `PEEK_SIZE` 84, `PEEK_RISE` 0.86, `PEEK_CLEAR` 82 — with the phone's 260 ms slide. `pointer-events-none`, and an `sr-only` `role="status"` sentence in place of the words the phone removed |
| `src/features/marketplace/model.ts` | `figureOnChat(placement)` — the rule that decides whether a figure may stand over a composer at all. The phone has the identical four lines twice (`CharacterRow.onChat`, `ThemeRow.figureOnChat` in `app/lib/catalogue.dart`); this gives the pair one name and one test |
| `src/features/marketplace/model.test.ts` **(new)** | Five cases: the four `placement` values and a figure with no row of its own |
| `src/types/api.ts` | `character?: string \| null` declared on `UserCard`. `UserCardSerializer` has carried it on every card all along — the web's type simply had not said so |
| `src/pages/ChatPage.tsx` | The composer wrapper became `relative isolate`; `<TypingPeek>` is its first child; the visible `Ravi is typing...` paragraph came out; the message list's bottom spacer is `PEEK_CLEAR` |

**The decision that shaped it: whose figure comes up.** Theirs, not mine. The character that rises
while somebody writes to me is the figure **their** account is wearing, read off their card and
resolved against the same catalogue the shop sells from — because it is them, and my theme decides
what they see and not what I see. That is the phone's rule unchanged, and it is why the component
reads `UserCard.character` rather than anything in the reader's own profile.

**The decision this round refused to make quietly.** The phone's chain has three rungs — their worn
figure, the figure their **theme** ships, the app's own. The web's catalogue carries a figure's
pictures but not a theme's, so the middle rung cannot be reached from here and an account wearing no
shop figure falls back to the bundled one. Rather than pretend otherwise, the component's doc comment
records the gap and `XELVIC_FEATURE_PARITY_MATRIX.md` carries it as `NOT IMPLEMENTED`. The alternative
— inventing a lookup the API cannot answer — would have drawn a figure that is not theirs.

**What the round measured, in the running app.** A headless Chrome holding a real WebSocket to a stub
that speaks the backend's own `thread.typing` frame, so the note arrives over the socket: the
character **down** at rest, **up** at `translateY(-72.24px)` while they write, **down** again when
they stop, **down** throughout for a figure staff set to `placement: "profile"`, and **up** in the
bundled figure for a key the catalogue has no row for. Across the first pass the stub was asked for
one picture, its own figure's `/pose/typing`, which is what proves the drawn figure is theirs.

**A probe fault worth recording.** The first `profile` pass looked like a broken rule and was a stale
cache: the app keeps its answers in `sessionStorage` for thirty minutes keyed by account
(`src/store/queryCache.ts`), so the second pass replayed the first pass's thread. Clearing
`sessionStorage` between passes turned it into a real negative result — and the negative result is
only believable because that pass was then seen asking the server for `/catalogue/` and the thread
afresh.

**Follow-ups this round did not take.** The theme-figure rung of the phone's chain (above). A theme's
`figure_peek` size, which is on the theme's row and not read here. Typing between two live accounts,
which was not tested — the frames came from a stub. Touch, and a phone-sized viewport. The phone's own
`app/lib/screens/chat.dart` was read and not changed, and `xelvic/` remains read-only.

## Round 29 — the second character, and the feature that had to exist first (2026-11-12)

**The ask.** *"abhi app jaisa nahi aa raha hai aap me jo jo hai exact waisa hi hona chahiye aur usme
typing aur wait 2 charector hai aur dono jaise work kar raha hai app me waise isme bhi karna chahiye"*
— that the web carry **both** of the phone's characters, working the way they work there.

**Why Round 28 could not have satisfied it, and why that mattered more than the drawing.** Round 28
drew the character the typing frame feeds. The phone has **two**, and the second one — `wait`, for
somebody who is on one of my places and not writing — has no sender in the typing mechanism at all. It
is fed by the **gaze**: where the other person is looking, which arrives as a `focus` frame. The web
had no gaze code — a search for it found only `window.addEventListener("focus")` in an unrelated view
— so before anything could be drawn there was a feature to build. This is the round's real work and
the plan records it as such rather than as a new pose in an existing component.

**The rule, taken from the phone as one expression.** `app/lib/screens/chat.dart:1415-1423`:

```dart
pose: typing ? poses.typing : (peekPose(gaze, poses: poses) ?? last),
up:   typing || gaze != null,
```

Written out in the web as `peekOn({typing, gaze, last, poses})`. Two things in it are easy to lose.
The first is precedence: **writing wins over merely being there**. The second is that the two facts
**end differently** — writing ends and the figure stays up, back in `wait`, because being on my convo
is a fact that does not come and go; the gaze ends and the figure goes down. A one-character
implementation cannot express that asymmetry, and a probe that only watched somebody start and stop
typing could not tell a rule from a fallback chain. Both are measured.

**What was built.**

| file | what it is |
| --- | --- |
| `src/features/presence/looking.ts` **(new)** | `app/lib/looking.dart` in TypeScript, rules only: `lookOf`, `gazeFrom`, `sameLook`, `staleGazes`, and the three frames this side says — `focusSayFrame`, `focusAskFrame`, `focusLeaveFrame` |
| `src/features/presence/looking.test.ts` **(new)** | 11 cases. The unknown-`kind` case is the one that matters most: a newer server naming a third place must leave the screen quiet rather than have the web invent a character |
| `src/features/convo/peek.ts` **(new)** | `peekOn` — the phone's expression, kept out of the widget so it can be tested at all (`vitest.config.ts` is `environment: "node"`) — and `peekWords`, the three `sr-only` sentences |
| `src/features/convo/peek.test.ts` **(new)** | 9 cases: the `wait` pose on **both** a `chat` and a `profile` gaze, writing winning when both are true, the last pose kept with `up: false`, a first frame with nobody there, the nullable-picture fallback, and the three sentences |
| `src/context/looking.ts`, `src/providers/LookingProvider.tsx`, `src/hooks/useLooking.ts` **(new)** | The clocks and the socket, in the house's own three-file shape: a counted watch set, one ask interval, one re-say interval, a sweep before each ask, and a **named** goodbye. `useSocketEvent(["focus","ready"], …)`, where `ready` re-asks and re-says because a socket opened on an idle callback can open after the page's first words |
| `src/features/convo/TypingPeek.tsx` | Now takes `{character, typing, gaze, name}` instead of a boolean, and carries `data-peek` and `data-pose` so a probe can read which character is standing without a screenshot |
| `src/pages/ChatPage.tsx` | `watch(chatterId)` + `say(chatterId, "chat")` on the convo, `unwatch` + `leave` on the way out, and `gazeOf(chatterId)` passed down |
| `src/features/profile/PersonProfile.tsx` | `say(personId, "profile")` on somebody else's profile — the other half of the same feature, and the only place the `profile` gaze can come from |
| `src/main.tsx` | `LookingProvider` inside `SocketProvider`, outside every page |

**The decision that shaped it: the gaze needed the same three clocks presence does.** The server
forgets what somebody is looking at thirty seconds after they stop saying it, and a person whose app is
killed mid-scroll says nothing on the way out. So both directions repeat — ask every 15 s, re-say every
15 s — and believe a fact for 30 s. The 15/30 ratio is not decoration and it is pinned in a test: a
genuine gaze is renewed by every poll, so it takes **two** missed polls to lose somebody. A constant
set at the server's own TTL would drop a character between two polls that were both on time.

**The one deliberate deviation, and why the plan states it as one.** The phone remembers "the last
pose" as one of three files in its own bundle, which cannot go away while it runs. The web's poses are
shelf URLs that change the moment somebody changes their figure, so the memory in `TypingPeek.tsx` is
**keyed to the set of pictures it came from**. Unkeyed, a figure change mid-convo would leave the
character standing in the previous figure's pose. It is not what the phone does; it is what the web has
to do to mean the same thing.

**What the round measured, in the running app.** A headless Chrome holding a real WebSocket to a stub
that now speaks `focus` **both ways round** and unmasks the frames the page *sends*. Six moments, and
the two that carry the round: the `wait` character stands for somebody quiet who has my convo open, and
its picture is asked for **while nobody is typing** — which is the evidence that the second character
is gaze-driven and not an absence of the first. The gaze was set **before** the convo opened, so the
page cannot have learned it from a push. Then writing takes the pose, stopping writing returns it to
`wait` **still standing**, and withdrawing the gaze takes it down keeping the pose it was drawn in. The
`profile`-placed figure and the off-the-shelf key were measured as well.

**A probe fault worth recording, in the same spirit as Round 28's.** The first attempt to measure that
the ask and my own word are *repeated* printed "8 asks and 9 words about me" — because the stub's frame
log had been accumulating since a previous run, so a leftover was being counted as a repeat. The stub
grew `POST /__clear`, the driver calls it at the start, and the check now measures a delta. The
corrected reading is **2 frames 8 seconds after the page settled**. The wrong number existed and would
otherwise have been believed.

**Follow-ups this round did not take.** Presence — is the other person *online* — which is a different
fact from where they are looking and is still `NOT IMPLEMENTED`. The theme-figure rung and a theme's
`figure_peek`, unchanged from Round 28. Two live accounts looking at each other, which was not tested —
the frames came from a stub. The server's 30-second lapse of a peer who vanishes without a goodbye,
exercised in unit tests and never against a real vanished peer. Touch, and a phone-sized viewport.
`app/lib/looking.dart`, `app/lib/screens/chat.dart`, `apps/chat/consumers.py` and
`config/settings.py` were read and not changed, and `xelvic/` remains read-only.

## Round 30 — the chips a convo forms, and the payload shape behind the call one (2026-11-12)

**The ask.** *"ab chatscreen me jo chip banta hai jaise call ka, data ka etc ka wo sab jaise aap me hai
exact waisa kijiye"* — every chip a convo forms exactly as the app has it.

**The plan's first move was to measure before editing, and it changed the round.** Four of the five
chips were already the phone's object: the top strip, a system note, the picture stamp, and the day
pill's geometry. Only the day pill's **radius** was wrong (`rounded-full`, which a browser clamps to
11.5px on a 28.5px pill, against the phone's `DayMark` of **20**). The other two were not styling
problems at all.

**The call chip had never been drawn, and the reason is a payload shape.** `_write_log`
(`apps/calls/services.py`) calls `chat.system_note(thread, call.caller, body, {"call": str(call.pk),
"media": call.kind, "outcome": outcome, "seconds": seconds})` — **one flat dictionary**, `call` a
*string*, with `media`, `outcome` and `seconds` as its **siblings**. The web's `callNote()` read
`payload.call` as an object and looked for `media` inside it, so the guard never passed and every call
fell through to the ordinary-bubble branch. This is worth writing down as a plan item, not just a fix:
the web had a shape that **no server has ever sent**, and nothing caught it because nothing had ever
rendered a real call note against a real backend. The fix reads the payload flat, exactly as
`callNoteOf` (`app/lib/calls.dart:3758`) does — a Map check, `payload['call'] != null`, and
`payload['media']` in `{audio, video}`.

**The chip was also not pressable**, and carried a comment asserting this client could not place a
call. That stopped being true in Round 18. It is now a `<button>` under the phone's own `_canCall` —
`_hasCallee && _callOpen`, i.e. `thread.other.username` non-empty **and** `gate.can_call === true`.
This is also why `ThreadDetail.gate` was retyped from `Record<string, unknown>` to `ChatGate`, which
already carried `can_call?: boolean`.

**The file chip was a different object, and was rebuilt rather than adjusted.** The phone's `_FileRow`
lives in a `_MediaFrame`: `X.card` fill, radius 14, a 1px border that goes `X.card → X.line`, bounded
to 220–290, padding 12, a 32px `X.accent` icon, a 10px gap, a name at `X.text` w700 over a `_fileDetails`
line at 11px `X.dim` — and **no download glyph**, because the whole row is the `InkWell`. The web's was
`bg-paper`, `px-3 py-2.5`, an 11.5px/600 name, a rounded-10 `accent-soft` square around a 16px glyph, a
trailing `Download` arrow and no width bound.

| file | what changed |
| --- | --- |
| `src/utils/format.ts` | **new** `mediaSize` — `formatMediaSize`'s units, its rounding (one decimal below ten of a unit, none at or above) and its `Unknown size` for `<= 0` |
| `src/utils/format.test.ts` | **new** — four cases. The house convention is that the pure rule is what a `node`-environment suite can reach, so the arithmetic is here and the plate is measured in a browser instead |
| `src/pages/ChatPage.tsx` | the flat `callNote`, the pressable call plate, `fileDetails`, the rebuilt `ChatDocument`, the day pill's `rounded-[20px]`, `sparkShotLine`'s `pb-[2px]` |
| `src/types/api.ts` | `ThreadDetail.gate: ChatGate` |

**What the round measured, in the running app.** A stub carrying every chip — a system note, a missed
call, a call of mine that ended, a picture, a PDF — driven by headless Chrome over CDP, with a real
WebSocket so the chip's press is read as a **frame the page said**. The chip press produced
`{"ring":"2222…2222","kind":"audio"}`; with `gate.can_call` shut the same chip is a `<div>`. Every
plate was read from the element that paints: the call chip radius 16 / `9px 13px` / icon 16 / gap 8 /
13px w600 / 10px dim; the file chip 220 × 62.73 / radius 14 / padding 12 / 32px accent glyph / gap 10 /
14px w700 name / 11px dim details.

**Probe faults worth recording, in the same spirit as Rounds 28 and 29.** Two were mine and would each
have made the page look wrong when it was not: the stub wrote call notes as `kind: "text"` where the
backend writes them through `chat.system_note` as `system`, and its document asset used `mime_type`
where the serializer's field is `mime`. A third was a measurement fault — the day pill's radius was
first read off a `rounded-full` span, where a browser clamps `full` to half the height; it was re-read
from the plate.

**Follow-ups this round did not take.** Any file kind other than a PDF, so `_fallbackType`'s
`Image`/`Video`/`Audio` words are read from source and not exercised. The chip's download saving
against a real backend. A video call actually placed. Two live accounts, which were not used — every
reading is a loopback stub. The phone's file-name **size** is an inference: `_FileRow` gives the name
w700 and no `fontSize`, so it inherits Material's default 14, and that inheritance was not measured on
a device. `apps/calls/services.py`, `apps/chat/services.py`, `apps/chat/serializers.py` and
`app/lib/screens/chat_media.dart` were read and not changed, and `xelvic/` remains read-only.

## Round 31 — where a message's time is read (2026-11-12)

**The ask.** *"abhi isme message ka time nahi dikhta jaise app me dikhta hai, please ise bhi fix
kijiye"*.

**The plan's job here was to stop the obvious fix.** The phone does not put a clock on an ordinary
bubble, and says so in two comments: `messageStateRow` (`chat.dart:579`) — *"The time is not here
either: it is read from the long-press menu now"* — and `_actions` (`chat.dart:5073`) — *"the bubble no
longer carries it under the words, so pressing a message is how anybody learns when it was sent. It
sits at the top left, above the emoji, where a heading would."* Adding a clock to a bubble would have
made this client differ from the phone **in the name of matching it**. The plan records the answer as
the phone's own surface, not as a new one.

**What changed.** The options sheet opens with the phone's line as its **first child**, above the emoji
row: `Padding(fromLTRB(16,0,16,6))` → `Align(centerStart)` → `Text(at, X.dim, 11)`. A **duplicate 9px
clock inside the quote card** was removed — the phone has one time in that sheet and it is the 11px
headline.

**Why no `_menuClock` was written.** The phone's `clock()` answers `10:42` and appends `AM`/`PM`
itself, so midnight does not read as morning. The web's `clock()` (`src/utils/format.ts:105`) is
`Intl.DateTimeFormat(undefined, {hour: "numeric", minute: "2-digit"})`, which already answers
`11:05 AM` and is locale-aware. One function serves the sheet and the picture stamp, and the two cannot
disagree — which is the property the phone's own comment is protecting.

**What the round measured.** In the open sheet: `Message options` 18px, `11:05 AM` 11px / 400 /
`rgb(107,107,123)`, `top: 70`, ink **17px** from the panel's left edge. The inset was read with a
`Range` over the text node rather than off the element's box, because an inset is internal padding and
a box's own left edge says nothing about it.

**Follow-ups this round did not take.** An unsent outbox row in the sheet, where the phone's
`_menuClock` is empty by design. A 24-hour locale, where the web reads `23:05` and the phone would
append `PM` to a `10:42`-style string — recorded as a divergence rather than fixed, because matching
the phone there would mean ignoring the viewer's own locale. Everything was measured on a **received**
message against a loopback stub. `app/lib/screens/chat.dart` was read and not changed, and `xelvic/`
remains read-only.

## Round 32 — the sound bubble is a port, and the plan was to port it rather than draw it (2026-11-12)

**The ask.** *"Alright, please audio message bubble ka design exact app ke jaisa kijiye"*.

**Why this one could be a port and not a design.** `ChatAudioBubble`
(`app/lib/screens/chat_audio.dart:1109`) is built out of numbers that were all chosen on purpose: a
column pinned to `SizedBox(width: 150)` (*"the size a bubble in a conversation has room for"*), an
`AudioWaveform` whose defaults are `height: 30` and `mostBars: 56`, and a bar laid out off the **cell**
it is given — `thick = (cell * 0.42).clamp(0.8, height >= 44 ? 5 : 4)`, `gap = ((cell - thick) /
2).clamp(0, 2)`, radius 2, height `(4 + sample / 100 * 24) * unit`, 24 bars at rest, a 900 ms dance
while a waveform-less sound plays, and a 1 → 1.5 → 2 ring. Nothing here needed an opinion, so nothing
here got one: [voiceclip.ts](src/features/convo/voiceclip.ts) is that maths and
[VoiceBubble.tsx](src/features/convo/VoiceBubble.tsx) is that row, and the constants carry the phone's
own names (`WAVE_TRACK_WIDTH`, `WAVE_LIMIT`, `WAVE_IDLE_BARS`, `WAVE_PULSE_MS`, `SPEED_RING`).

**The one thing the plan had to decide.** The phone's bubble takes an `accent` prop — the convo's own
tint, never the app's — and the web had no such prop to pass. It does not need one: `--accent` is
already rebound to `var(--convo-accent)` inside the convo page, so the bars, the glyph and the chip
take the thread's colour with no plumbing. Measured as `rgb(43, 87, 198)`.

**What the round measured.** The player **190 × 58** (the phone's own 150 + 40), the control 40 × 40,
the track **150 × 30** with **56** bars 1.11 wide at `marginInline 0.776786`, the readout `0:00 / 0:02`
at 10px `--dim`, the speed chip **38 × 28** at 14px/500.

**Follow-ups this round did not take, named rather than left to be discovered.**

- The speed chip cannot be set before the first press. The phone's own comment says the chip is
  *"Always a control: before the first press it chooses the speed that press will play at"* and keeps
  `_speedChoice`/`speedOf` per sound; the web's is `disabled={!held}`. **NOT MATCHED.**
- `InFront` — the phone stops a note when the page it is drawn on stops being looked at. The web has
  the one-ear rule and no page gate. **NOT IMPLEMENTED.**
- `_transferControls` (Pending, Uploading, Retry, Discard). **NOT IMPLEMENTED.**
- The sender a group voice note wears above its player (`sender: mine ? null : sender`). **NOT
  IMPLEMENTED.**
- The phone's control is a Material `IconButton`; the web's is an explicit 40 × 40 box.

**What the round did not do at all.** Nothing was heard: the harness plays a silent WAV built in the
page against a loopback stub. No seek and no speed change was performed with a finger or a mouse.
`xelvic/` was read and not changed, and `xelvic-web/docs/` was not touched.

## Round 33 — three sounds, three designs, and the one that is not a bubble (2026-11-12)

**The ask.** *"song message bubble aur audio message bubble do alag alag message bubble hai aur dono ka
design alag alag hai app me, please aise hi isme bhi kijiye"*.

**The plan's job was to count the objects before drawing any.** The phone draws **three** things here,
and only two of them are bubbles: `kind: 'voice'` → `ChatAudioBubble`; `kind: 'audio'` →
`_mediaBubble`'s `'audio'` arm → `ChatAudioFileRow` → `_FileRow(icon: Icons.audio_file_outlined)`; and a
song share, which is an ordinary **text** line whose payload carries the track and which never reaches
`_mediaBubble` at all — `chat.dart:8325` draws `ChatTrackCard` last in the content chain. Four designs
would have been wrong; two would have been wrong in the other direction.

**The card is not a bubble, and that is a rule rather than a preference.** `bare`: *"a picture is
already a rectangle with edges of its own, and a card brings its own. A panel behind either puts a
margin down the sides of something somebody framed themselves."* The web already followed it for every
other card, and the song card now does too. Above it sits `messageStamp` — 10px `X.dim` and 4 points of
air, which is `if (bare) ...[stamp, const SizedBox(height: 4)]` — on the row's side, which is
`crossAxisAlignment: bare && mine ? end : start`. The words are never repeated, because the phone keeps
them in the final `else` of that chain and the web keeps its `!hasCard`.

**The one thing that could not be copied by geometry: the accent.** `ChatTrackCard` takes no `accent`
and fills its play button with `X.accent` — the app-wide one — while everything else in the thread
takes `convoAccent()` = `X.theme.chatTint ?? X.accent`, which the chat screen hands over by name. The
web had a single accent for both. The plan's answer is the smallest one that works:
`ThemeProvider` publishes `--palette-accent`, and `ChatTrackCard` rebinds `--accent` to it **at its own
root**, so the card's children read the palette and the rest of the thread is untouched. Measured on
the dark "Alone" theme — the one shipped case where the two differ: the card's play button at
`rgb(143, 180, 255)` (`#8FB4FF`) against the voice note's glyph and the file card's glyph at
`rgb(43, 87, 198)` (`#2B57C6`). **On every light theme the two coincide and the rebind is invisible**,
which is why the probe pins `xelvic.theme = alone` and `xelvic.mode = dark`.

**What the round measured, in one thread holding all three.** The song card **272 × 152.89** with no
background, no border and no radius, padding 10, 26 bars of 2.5px at `marginInline 0.8` with the
unplayed ink at 16 %, a 10.5/600 tabular clock row under a 252 × 22 wave; the voice note a 220 × 84
bubble at `rgb(18, 26, 44)` with `18px 18px 18px 6px`; the sound file a 250 × 88.73 bubble at
`rgb(15, 28, 60)` with `18px 18px 6px`, holding a 220 × 62.73 row.

**Follow-ups this round did not take.**

- The card is a flat `w-[272px]` where the phone is content-sized inside `ConstrainedBox(minWidth: 220,
  maxWidth: 290)`. **PARTIALLY MATCHED** — recorded, not fixed.
- The failure line is hardcoded to "Could not play that." where the phone prints `store.stuck!`. **NOT
  MATCHED.**
- The file row: two lines allowed on the phone and one here, `source.fileName` on the phone and "An
  audio file" here, and a `_MediaFrame` with Pending / Uploading / Retry / Discard and a press that
  opens a local file, against an `<a download>`. **NOT MATCHED / NOT IMPLEMENTED.**
- `ShareWho`'s name reads the reader's own alias on the phone and `name || username` here. **NOT
  MATCHED, and unchanged this round.**
- Three messages in one thread against a **loopback stub**; two live accounts were not used, no sound
  was heard, and no failure was provoked. The heart's own box was not measured — the probe's selector
  matched the play button twice. `xelvic/` was read and not changed, and `xelvic-web/docs/` was not
  touched.

## Round 34 — the group settings panel (2026-11-13)

**Files.** New [GroupPanel.tsx](src/features/convo/GroupPanel.tsx). [chat.service.ts](src/services/chat.service.ts)
gained the group's own furniture — `renameGroup`, `setGroupAvatar`, `clearGroupAvatar`, `room`,
`channels`, `createChannel`, `updateChannel`, `removeChannel`, `invites`, `makeInvite`, `revokeInvite`,
`members`, `addMembers`, `setMemberRole`, `removeMember`, `deleteGroup`. [api.ts](src/types/api.ts)
gained `Channel.post/media`, `Roster`, `GroupRoom`, a reshaped `Invite`, and `UserCard.can_open`;
`Modal.tsx` gained `ConfirmDialog.cancelLabel`. [ChatPage.tsx](src/pages/ChatPage.tsx) routes a group's
aside to the new panel and leaves `ThreadInfoPanel` to direct convos.

**Why a new component rather than editing the old one.** `ThreadInfoPanel` is web-invented — it shows
counts and a roster and nothing you can change. The phone's `GroupScreen` is a different shape: a head
with a photo and a name, two switches that describe the room, a channel list where each row states its
rule in words, a list of links with a use count, and a roster with roles. Rewriting it in place would
have left two half-adapted layouts in one file.

**Order of work.** Read `views_groups.py`, `views_threads.py`, the channel and roster services and the
serializers first, to confirm every control had an endpoint — it did. Then the panel, then the phone's
copy for the six channel rules and the five confirmations, then the probe.

**What was deliberately not done.** No endpoint was added, no migration written, no serializer touched,
no setting changed. `xelvic/` was read and not changed, and `xelvic-web/docs/` was not touched.

## Round 35 — the direct convo's options sheet (2026-11-13)

**Files.** New [names.ts](src/features/convo/names.ts). `model.ts` (`threadTitle`), `ConvoSheet.tsx`
(the alias row, the block row's side, three notes, the self-convo guards), `Modal.tsx`
(`PromptDialog.onReset`), `constants/storage.ts` (one key), and two title sites in `ChatPage.tsx`.

**Why the alias is local.** It is local on the phone too — `Aliases` writes one JSON object to
shared_preferences and says in its own doc that the handle is never rewritten. Porting it as a server
field would have invented a contract the backend does not have.

**Why `useSyncExternalStore` and not a query.** Renaming one person changes a title that several
screens read through `threadTitle`. A refetch happens to redraw most of them, but TanStack's structural
sharing can hand back the identical thread object, and a rename that does not visibly take is worse than
one that takes a beat. A tiny subscription removes the guess.

**Why the block row changed.** The gate has carried `blocked_by_me` since the phone needed it
(`backend/apps/social/services.py`). The web read only `mode`, so it drew an Unblock on the side that had
nothing to undo. Reading one more field removed a control that could not work.

## Round 36 — one React, and a screen that repairs itself (2026-11-14)

**Goal.** Stop the intermittent `Cannot read properties of null (reading 'useContext')` screen the user
was clearing by hand.

**Order of work.** (1) Find what the message can mean, from React's own source in `node_modules` rather
than from folklore. (2) Rule the app out with scans and the bundle. (3) Reproduce it in a browser with
the smallest possible cause. (4) Make the dev server stop producing that cause, and make the screen
recover when it happens anyway. (5) Verify, delete the probe, re-run every check, record the gaps.

**Delivered.** `optimizeDeps.include` + `resolve.dedupe` in [vite.config.ts](vite.config.ts); a one-time
self-reload for React's unrecoverable tree failures in
[ErrorBoundary.tsx](src/components/common/ErrorBoundary.tsx) backed by
[recover.ts](src/components/common/recover.ts) and a new session-storage key; 12 new tests.

**Still open.** The trigger was not captured in the user's tab (**NOT VERIFIED**). `date-fns` and
`lottie-web` are declared dependencies that nothing imports — left alone rather than removed in a round
that is not about them.

**Checks.** `tsc -b` clean · `eslint .` clean · 41 files / 466 tests · build clean in 4.73 s · probe
deleted · `docs/` untouched · `xelvic/` untouched.

## Round 37 — the component layer, inlined as Tailwind (2026-11-14)

**Goal.** Delete the hand-written component classes in `src/styles/index.css` and write Tailwind at each
place they were used, without changing how anything looks or behaves.

**Order of work.** (1) Find every use site with the TypeScript compiler rather than a text search.
(2) Name the exact utility for every declaration in the block, with a theme token where the value was a
`color-mix()`. (3) Prove the substitution in a browser against the app's own stylesheet before touching a
single source file. (4) Apply, delete the block, take the dead classes out of the call sites. (5) Run the
four checks, read the shipped stylesheet from a real page, record the deviations.

**Delivered.** `src/styles/index.css` loses its `@layer components` block (188 lines, 15 classes);
`tailwind.config.ts` gains 11 colour tokens, `backgroundImage.skeleton` and `boxShadow.field-focus`; 299
class strings across 78 files and four entries in `Button.tsx`'s `variants` map become utilities. The
parity harness and the shipped-value read are in [XELVIC_TESTING_REPORT.md](XELVIC_TESTING_REPORT.md).

**Still open.** Five deviations are named rather than hidden — the real one is that a button's colour
transitions now use the app's soft easing where they used `ease`, because one Tailwind `transition-*`
carries one timing function. Nobody has looked at the app this round (**NOT VERIFIED** by eye), and the
harness is a statement about computed styles, not about taste. `.prose-copy` turned out to have no user
and is simply gone. 32 classes elsewhere in the app are dead in the built stylesheet for pre-existing
reasons (`shadow-xs`, `text-md`, `animate-float-up`, and opacity steps outside Tailwind's scale); they
were reported, not fixed, as they are outside this round's request.

**Checks.** `tsc -b` clean · `eslint .` clean · 41 files / 466 tests · build clean in 4.33 s ·
`docs/` untouched · `xelvic/` untouched · no `.env.local` written.

## Round 38 — a convo's own wallpaper and theme, applied at the tap (2026-11-14)

**Goal.** Make the photo somebody picks as a convo's wallpaper appear, in that convo, and keep appearing
after a reload; make a picked convo theme actually paint the chat; and have both land on the tap rather
than after a request and a refetch.

**Order of work.** (1) Read the phone's own path — `OwnWalls`, `_chooseOwn`, `wall_frame.dart`,
`skin.dart` — before touching the web, so the storage medium, the default strength and the wash were known
facts rather than guesses. (2) Name the missing reader: the store in `look.ts`, over
`useSyncExternalStore`, with data-URL rows and a debounced slider write. (3) Change the write order in the
sheet: save locally first, tell the server `'default'` second, tolerate its failure. (4) Make the theme a
read as well as a write: `chosenTint`, `convoPalette` published, `ChatPage` rebuilding the palette and
writing the accent and bubble variables. (5) Add the optimistic overlay and the rollback. (6) Prove the
shipped values in a browser, run the checks, record what was not verified.

**Delivered.** `src/features/convo/look.ts` and its 7 tests; `skin.test.ts`'s 5; `chosenTint` and the
corrected `FALLBACK_WALLS`; `ConvoSheet`'s `onSkin`, on-DOM file input, local-first save and rollback;
`ChatPage`'s own-wall read, `useSkinOverlay` and tint palette; `ThemeProvider`'s `convoPalette` and
`rgbChannels` exports. The phone's `0.78` wash is now the web's too, and a photo starts at full strength
because the phone's does.

**Still open.** The chat accent on an **un-coloured** convo still follows the account accent where the
phone answers its fixed pink; that row stays PARTIALLY COMPLETE and is not claimed here. The web has no
cropping step — the phone frames a photo to the phone's shape, the web downscales it to 1600 px and lets
`cover` do the rest. A photo lives in `localStorage` as a data URL rather than in a file, so it shares the
origin's quota; when the quota refuses, the picture is shown for the session and the toast says exactly
that, never "saved". `localStorage` rows written by the old build with a `blob:` address are dropped
rather than migrated, because their bytes are already gone.

**Not verified.** No authenticated chat, no live backend, no pick made through the UI, and no eye review.
The evidence is 12 unit tests, a computed-style probe against the built stylesheet, and a boot of the built
app with no error screen.

**Checks.** `tsc -b` clean · `eslint .` clean · 43 files / 478 tests · build clean in 4.54 s · `docs/`
untouched · `xelvic/` untouched · no `.env.local` written.

## Round 39 — the gap between two emoji (2026-11-14)

**Goal.** Two emoji typed next to each other should not be drawn overlapping, and the space between them
should be the emoji's own width rather than an arbitrary padding.

**Order of work.** (1) Read the phone first — `chat.dart`'s `emojiCount`, `messageFontSize`,
`_isEmojiCluster` and the `Text` that draws a body — and establish that it adds no spacing at all.
(2) Work out why the web cannot be the same: `EmojiText` replaces the glyph with a box. (3) Measure what
that box really is — declared `1.15em`, but sized to the machine glyph's **1.373em** advance by the
character layer inside it, which is why adjacent drawings overlapped by 6.70 px rather than touching.
(4) Put the difference back as a right margin, applied where two drawings would otherwise overlap — the
first draft put 0.1em on every emoji, which the owner's screenshot showed still overlapped by 3.70 px.
(5) Choose the value by measuring a sheet of margins in the real chain and looking at it, not by taste.
(6) Verify against the built stylesheet at every size the bubble uses. (7) Write the size divergence down as
its own row rather than letting "the gap is fixed" stand in for parity.

**Delivered.** `EmojiText`'s adjacency rule (`mr-[0.35em]` when the next run is another drawable emoji);
3 tests in `text.test.ts`; a new **PARTIALLY COMPLETE** row for the emoji sizes in the parity matrix. A pitch
of 1.500em with clearances of 3.80 / 4.55 / 5.31 / 1.89 px at 30 / 36 / 42 / 15 px, where no margin left
−6.70 px of overlap.

**Still open.** The sizes: 42 / 36 / 30 / 24 / 15 px against the phone's 38 / 26 / 15. The vertical
overhang: the drawing is 1.373em tall in a 1.05em line box, so it hangs below its own line — a
pre-existing property this round neither caused nor changed, and one that a line-height or size rule would
be the place to fix. Nothing about wrapping or the bubble's own width changed. Bringing the sizes to
38 / 26 / 15 is the obvious next step and is deliberately not folded into a round about spacing.

**Not verified.** No authenticated chat, no live backend, no bubble seen by eye. The evidence is 3 unit tests
and a computed measurement against the built stylesheet in the exact class chain the component emits.

**Checks.** `tsc -b` clean · `eslint .` clean · 43 files / 481 tests · build clean in 4.30 s
· `docs/` untouched · `xelvic/` untouched · no `.env.local` written.
