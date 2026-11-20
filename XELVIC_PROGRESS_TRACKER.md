# Xelvic Web — Progress Tracker

Date: 2026-11-01
Scope: `xelvic-web/` only. `xelvic/app` (mobile) and `xelvic/backend` were read
and were **not modified**.

Evidence, re-checked at the end of every pass in this file:
`git -C xelvic status --short -- app backend` reports only the same pre-existing
`app/` Flutter/Gradle edits (`analysis_options.yaml`, `android/*`, `pubspec.*`,
all stamped 2026-10-31, before any of this work) and **nothing at all under
`backend/`**. No file outside `xelvic-web/` was created, edited or deleted.

Status words in this file mean exactly what they say:

- **DONE** — the code path exists, calls the real endpoint, and the static
  checks (typecheck, lint, tests, build) pass.
- **NOT VERIFIED** — the code path exists but was not exercised against a live
  backend or a second device in this environment.
- **NOT STARTED** — no code path.

## Phase 0 — Discovery and audit

| Item | Status | Evidence |
| --- | --- | --- |
| Mobile feature inventory | DONE | `XELVIC_MOBILE_FEATURE_INVENTORY.md` |
| Web/mobile parity matrix | DONE | `XELVIC_FEATURE_PARITY_MATRIX.md` |
| API compatibility report | DONE | `XELVIC_API_COMPATIBILITY_REPORT.md` |
| Implementation plan | DONE | `XELVIC_WEB_IMPLEMENTATION_PLAN.md` |
| Baseline checks | DONE | typecheck pass, 24/24 tests pass |

## Phase 1 — Foundation

| Goal | Status | Where |
| --- | --- | --- |
| 1.1 Design tokens and primitives | DONE (pre-existing, verified) | `src/index.css`, `src/components` |
| 1.2 Route protection + lazy routes | DONE (pre-existing) | `src/App.tsx` |
| 1.3 API client, refresh, errors | DONE (rewritten on axios in the transport pass) | `src/config/axios.ts`, `src/services/`, `src/lib/errors.ts` |
| 1.4 Conversation cache helpers | DONE | `useMessageCache` in `src/pages/ChatPage.tsx` |
| 1.5 Optimistic message model | DONE | `Message.pending/failed`, `client_id` |

## Phase 4 — Conversations (the priority)

| Goal | Status | What was actually changed |
| --- | --- | --- |
| 4.1 Architecture audit | DONE | audit written into the API report and plan |
| 4.2 Optimistic send + reconciliation | DONE (NOT VERIFIED live) | `deliver()` in `ChatPage` inserts a `pending` row with a `client_id`, uploads, sends, and replaces the row with the server message (socket echo and HTTP response are deduped by id/`client_id`). Failures mark the row `failed` and offer retry with the same `client_id`. |
| 4.3 Honest receipts | DONE | `receiptWord()` reads `thread.status` and seat watermarks only. The literal `"Delivered"` default is gone. `thread.read` frames merge into local state and the thread cache. |
| 4.4 Spark view-once path | DONE (NOT VERIFIED live) | Detection is the server's `payload.view_once` (a Spark is an ordinary photo/clip, not a kind); send goes through the app's camera/editor as `kind: image|video` + `payload: {view_once: true}`; open reads `payload.opened_at` only, and the viewer fetches the bytes before `POST .../open-once/`. The old browser-local opened state and invented kinds are gone. |
| 4.5 Forward | DONE | `ForwardSheet` → `POST .../messages/{id}/forward/` `{threads}`; result count comes from the server response. |
| 4.6 Group message info | DONE | `MessageInfoSheet` → `GET .../messages/{id}/info/`, rendered for groups only. |
| 4.7 Live thread-card patch | DONE | `thread.update` patches `["threads"]` in place (preview, unread delta, timestamp, pinned-first re-sort); unknown threads fall back to a refetch. |
| 4.8 Preview + unread badge correctness | DONE | `ConvoRow` renders the real preview from `thread.preview`; numeric unread badge replaced the play glyph; `threadLine` no longer hides an incoming preview behind an outgoing status. |
| 4.9 Composer polish | DONE | per-thread draft restore via `localStorage` (guarded), emoji panel, attach menu, auto-grow, Enter/Shift+Enter. |
| 4.10 Scroll/pagination | VERIFIED (static) | newest-first pages rendered ascending; older pages prepend with a scroll anchor; optimistic rows sort last. |
| 4.11 Message search | DONE | `/chat/search/?q=` rendered under the Convo search field; opening a result navigates to its thread. |
| 4.12 Offline outbox / durable sync | NOT STARTED | needs a design decision; `/chat/sync/` is unused |
| 4.13 Calls | DONE (NOT VERIFIED) | Real WebRTC since 2026-11-06: `features/calls/engine.ts` + `CallProvider` + `CallOverlay`, the phone's own socket protocol over the app's one connection. Ringtone, notification answering, the speaker/earpiece switch, camera flip and `call.add` are not here |

Additional work in the same pass:

| Item | Status | Where |
| --- | --- | --- |
| Upload progress | DONE | `upload.ts` XHR progress callback; bubble shows `Uploading n%` + bar |
| Retry without re-upload | DONE | the uploaded asset id is kept on the send intent |
| Location messages | DONE | renders a maps link from `payload.location/place` |
| Collab / vanish-ask cards | DONE | payload-driven card with honest answer state |
| Edited marker | DONE | `Edited ·` prefix on the receipt line |

## Spark and chat-screen fidelity pass (2026-11-01, second pass)

| Item | Status | Where |
| --- | --- | --- |
| Spark send contract | DONE (NOT VERIFIED live) | `CameraCapture` posts an ordinary `image`/`video` message with `payload: {view_once: true}`. `kind: "spark"` was rejected by the backend and is removed. |
| Spark entry in chat | DONE | attach menu → "Spark" opens the same `CameraCapture` editor used by the app (`fromChat`). |
| Spark bubble — recipient | DONE | "A Spark for you" tile (38px accent circle, sparkles, 15 w700 + 12.5 dim "Tap to open · once only"), accent-42% border, accent-10% card wash, radius 18. |
| Spark bubble — sent/opened/gone | DONE | pill with `auto_awesome`/`visibility_off_outlined` and the exact app words "Spark · sent", "Spark · opened", "Spark · gone"; state from `payload.opened_at` only. |
| Spark viewer | DONE (NOT VERIFIED live) | full-screen black; "Spark" + "{n} of {m}"; close; loading sparkles/spinner; gone copy; tap advances through the unopened run, last tap closes; reply bar posts a real `reply_to` message. |
| Screenshot line | DONE | rendered only when the server sets `payload.shot_at`; browser screenshot detection is impossible, so none is fabricated or POSTed. |
| Spark sound band | DONE (NOT VERIFIED live) | reads `payload.sound` as an asset id (like `SparkLook.of`), fetches `/chat/assets/{id}/content/` with auth, plays/pauses with the payload's start/end window, and shows `sound_title` or "Sound attached". |
| Chat design fidelity | DONE | heading carries only name/face/verified tick (no `online` / `typing…` subtitle); no clock above text bubbles (clock only on bare media/cards); day pills; 4/10/2 run gaps; group sender at run head only; receipt under every own bubble; `Edited` marker inside non-bare cards; bubble padding 14/10/14/8, radius 18/6, 76% max; composer 12/8/8/8, 22px field, 46px send. |
| Emoji and separator glyphs | DONE | `ChatPage`, `ConvoPage` and `ConvoRow` carried double-encoded UTF-8 (`â¤ï¸`, `Â·`, `typingâ€¦`); they now hold the real ❤️ 😂 🔥 👍 😮 😢 set, `·`, `—`, `…` and ✨. |

## Marketplace and theme pass (2026-11-01, third pass)

The ask: Settings → Marketplace must be the app's, exactly — one page, the three
aisles, the same structure and flow — and a theme must reach *every* screen the
way it does on the phone.

| Item | Status | Where |
| --- | --- | --- |
| One marketplace, three aisles | DONE | `features/marketplace/MarketplaceView.tsx` — the strip (Drip / Themes / Logos, accent underline the width of the label, as the app's `TabBar`) and one aisle mounted under it. Ported from `screens/marketplace.dart`. |
| One purse, one reading | DONE | `MarketPurse` sits in the Settings header, as the app's `_header()` does with `SparkPurse(compact: true)`; all three aisles read the same `/sparks/wallet/` query, so the header and the tiles cannot disagree. |
| One Settings row, not two | DONE | The web-only "App logo" row and its `view === "logos"` sub-page were deleted. `screens/settings.dart` carries the owner's note that the app has exactly one Marketplace row; `?tab=logos` survives as `initialTab`, which is the deep link the app's own links use. |
| Themes aisle | DONE | `ThemeShopView.tsx`: the Mode button (Light → Dark → System), the shelf three to a row, "Mix your own" and its one-colour / mix-three picker, ported from `theme_shop_view.dart`. |
| The preview moves the whole web | DONE (NOT VERIFIED) | `previewDesign` puts the design on before the page is drawn and `clearPreview` takes it back off, and `setPreviewDark` moves the Light/Dark segments — the same pair of calls as `ThemeProvider.apply` on the phone. Applying records the reading that was looked at. |
| Logos aisle | DONE (NOT VERIFIED) | `LogoShopView.tsx`: twelve plates three to a row at the app's `side = ((maxWidth - 32 - 24) / 3).clamp(64, 132)`, the tile is the preview, a tap on a locked plate opens a price sheet, and buying wears it in the same breath. |
| Drip aisle | DONE (NOT VERIFIED) | `DripView.tsx`: the on-now figure with its time left, the shelf, the profile switch, and the full figure page. |
| Theme picture behind the shell | DONE (bug fixed) | The shell's backdrop layer was drawn at `z-index: auto`, which paints *after* every plain card and line of text in the same stacking context — so on a picture theme (Unicorn, Cat Girl) the picture covered the page instead of standing behind it. It is now `-z-10` inside an `isolate` shell, which is the stack position Flutter's `ThemeBackdrop` gives its first child. |
| Theme picture behind the marketplace | DONE | The app's Marketplace is a pushed screen with `Scaffold(backgroundColor: X.pageGround, body: ThemeBackdrop(...))`, and a `ThemeBackdrop` with no page named is the **Convo** page. `SettingsShell` takes that backdrop, so the page where a colour is chosen repaints itself under the thumb that chose it. Every other settings view keeps the app's own flat `Scaffold(backgroundColor: X.ink)`. |
| Theme picture behind the preview | DONE | `ThemePreviewPage` draws the design's own ground; `theme_preview.dart` is a `ThemeBackdrop` for the same reason. |
| Theme picture inside a chat | DONE (NOT VERIFIED) | `ChatPage` draws `theme.chatWall` under the thread when nobody picked a wallpaper, at `chatVeil ?? WALL_SCRIM` of the page's own ink — the app's ordering and the app's wash. The chat's bar and composer become glass while the theme stands on a picture, which is what `X.pageGround` being `clear` means. |
| One copy of the ground | DONE | `src/components/Backdrop.tsx`, ported from `screens/backdrop.dart`: the picture, the crop, and one tone of wash, for all four callers. |
| `markSizeFor` gate | DONE | Now gated on the row setting a mark at all (`row.mark.isNotEmpty`), not on it being a shape this build draws — a row's number is honoured even when its shape falls back. |

Not claimed: the chat's accent on a convo with no colour of its own. The phone
uses `theme.chatTint ?? #E31B66`; the web computes that value into
`--convo-accent` but the chat still falls back to `--accent`. See the gap report.

## Settings pass (2026-11-01, fourth pass)

The ask: Settings must be the app's, every page and sub-page of it. What stands
now, all of it inside `src/pages/SettingsPage.tsx` and `src/features/settings/`:
the one list with the app's rows and the app's order, and the sub-pages behind
them — profile, privacy, professional, verification, marketplace, language,
notifications (switch, message sound, ringtone, calls), devices and their
revocation, kept people, chat lock, permissions, and account deletion behind its
password. The Marketplace keeps its single row and its three aisles (see the
marketplace pass above).

## Profile pass (2026-11-01, fifth pass)

The ask: the profile must be the app's on both pages — mine and somebody else's
— and every part of it must work the way the phone's does.

| Item | Status | Where |
| --- | --- | --- |
| One handle, two pages | DONE | `ProfilePage` branches on the handle, so my own page is my own page from the first frame rather than a stranger's copy that turns into mine |
| Somebody else's page | DONE (NOT VERIFIED live) | `features/profile/PersonProfile.tsx`, a port of `person.dart`: cover band and theme art, the face, the trade, the name and tick, `@handle · private/public`, the birthday line, the professional pills, the counts the payload actually allows, the mutual strip, the posed bio, their Memories and their shelf, the gate card, and the floating discs in the app's order (⋮, convo / keep / let go / ask, their QR) |
| The day behind the face | DONE (NOT VERIFIED live) | `FaceButton` in `features/profile/parts.tsx` draws the app's `Ring` — a flat 2.5px accent hairline while their day is unwatched, the text colour at 16% once it is — from the `["moments-tray"]` row for that person; the tap opens `MomentViewer` over the page (`_openLive`), the hold opens the face |
| The face, as large as it goes | DONE | `FaceDialog` — `showFace` / `_showPhoto`: a 240 square, rounded 22, their name under it, tap anywhere to close |
| Birthday fall | DONE | `features/profile/BirthdayFall.tsx`, a port of `birthday.dart`: 13 balloons rolled once from the fixed seed, six eleven-second crossings then rest, flat tones and hairline strokes with no gradient, `pointer-events-none`, and nothing drawn at all under `prefers-reduced-motion` |
| Mutuals | DONE (NOT VERIFIED live) | `MutualStrip` → `MutualsModal` → `/social/users/{id}/mutuals/` (`mutuals.dart`); the count and the three faces come off the profile payload, the list is read only when opened |
| Their QR | DONE | `xelvic://u/@<handle>`, the exact string `qr.dart` writes and its scanner reads |
| The viewer, shared | DONE | `MomentViewer` moved out of `MomentsPage` into `features/moments/MomentViewer.tsx`, so the profile's ring and the moments page open the same walk; the build emits it as one 10 kB chunk both pages import |
| The ring's colour | DONE | `.story-ring` was a conic gradient of four colours; the app's `Ring` is one flat accent, and the convo row and the profile now both wear that |

Not claimed in this pass:

- The theme-bundled **figure** behind a bio. The catalogue carries the figure's
  name but not its pictures, so `PosedBio` draws the pose without it. See the
  gap report.
- The app's ⋮ sheet on somebody else's page also carries that convo's own
  settings; the web has no convo-settings sheet there, so the web's ⋮ holds
  mute and report only.
- Nothing on this page is a live-backend claim: no profile, ring, day or
  birthday was exercised against a running server here.

## Notifications pass (2026-11-01, sixth pass)

The ask: notifications must be the app's — every kind, live, and arriving the
way a phone's does, including when nobody is looking at the page.

| Item | Status | Where |
| --- | --- | --- |
| The alert row | DONE | `pages/AlertsPage.tsx`, rebuilt to `screens/alerts.dart`: a 16pt card with 10pt padding and an accent-10% ground when unseen; a 48pt face square holding a 44pt avatar, or the kind's own 22pt glyph on accent-14% for a self-spoken row; the person's door under everything else; a 20pt badge in `accentAt(alertTone)` ringed 2pt in the card's ground with an 11pt glyph in `inkOn`; the 28pt mark door offset 4pt past the badge's corner; a 58×76 tile whose word sits *under* the picture; keep answers side by side as 44pt doors around 34pt washes; and a 9pt dot in a 48pt-high column at the far end |
| More rows | DONE | scroll-for-more at the app's 400pt threshold (an `IntersectionObserver` sentinel) instead of a "Load older" button |
| Where a row goes | DONE | `alertPath` in `features/alerts/model.ts` — the phone's `_open` as one table, including `route` for studio news (`/theme/<key>`, `/c/<key>`, `/o/<id>`, `/l/<key>`) |
| The kinds the row did not know | DONE | `friend_moment` and `studio` join the model: a sentence each, a tone each, a mark label each, and a glyph each |
| The in-app strip | DONE | `features/notices/` — `NoticeProvider` (the decision) and `NoticeBanner` (the drawing), ports of `notices.dart` and `notice_banner.dart` |
| A hidden tab's row | DONE | `Notification` API, permission-gated; a strip that is up when the tab goes away is handed to it; a click focuses the tab and opens the row's destination |
| Live alerts | DONE | `alert.new` / `alert.read` are applied to the `["alerts"]` cache by `useAlerts`, and a hidden tab gets a system row composed by `alertSummary` rather than the alert's often-empty `body` |
| One owner for the sound | DONE | `SocketProvider` now owns only the connection; the chime and every system row come from `NoticeProvider`, which is the only place that knows whether the conversation is on screen, muted, or already announced |

Not claimed in this pass:

- **A notification after the site is closed is BLOCKED.** The server pushes only
  through Firebase, to the `Device.push_token` the phone app registers. This
  build has no Firebase project config, no VAPID key and no service worker, and
  the backend is read-only, so there is no honest web-only version of it. The
  Notifications page says exactly that instead of implying a sound it cannot
  produce.
- **No live run.** No two clients exchanged a line here; the strip, the dedupe,
  the mute rule and the hidden-tab row are implemented against the server's
  documented frame shapes and are **NOT VERIFIED** at runtime.

## Moments pass (2026-11-01, seventh pass)

The ask: Moments must work the way they work on the phone — exactly, and nothing
dropped. The reference is `app/lib/screens/moment_view.dart`, read line by line,
with `app/lib/moments.dart`, `app/lib/strings/en.dart` and
`backend/apps/moments/{urls,views,services}.py` alongside it.

`MomentViewer.tsx` was rewritten as a **port** of `MomentViewScreen` rather than
a redrawing of it. What that means, item by item:

| Item | Status | Where |
| --- | --- | --- |
| The clock and the per-item hold | DONE (NOT VERIFIED live) | a 60ms ticker (`kBarTick`). `holdMs(item)` is `MomentItem.hold` ported exactly: a clip holds for its own `clip_start_ms`…`clip_end_ms` window; a sound holds for its window capped at `kSoundLongest` (60s) but never shorter than the picture's own life; a picture carried in from a post keeps the life written on it; the floor is 5s. A video's bar is read off the element's own `currentTime`, so a paused clip is a paused bar. |
| The gesture | DONE (NOT VERIFIED, and needs a touch device) | tap steps: the left 32% of the width goes back, everything else forward. Hold pauses at 480ms (`kHoldToPause`); holding past 1230ms (`kHoldToPause + kHoldToLeave`) arms "let go and I'll take you there", and letting go calls `openCarried()`. The hold is drawn as a clock running *down* under the header, in `_carriedTo`'s own words: "Hold to open the drop" / "Let go to open the drop". |
| The browser's extra click | DONE (a real fix) | Flutter has a gesture arena; the web does not, so a `pointerup` that ended a long press is still followed by a `click`. Left alone, a hold would pause *and* step forward. A `consumed` ref is set the moment the hold fires and the click handler spends it, and a `facesPressed` ref does the same job for the react button's long press. |
| What a moment carries | DONE | `carried` reads in `_carried`'s order — a Vibe on the item, then `made_from.vibe`, then `made_from.drop`, then a sound, then `source_id` — and `where` speaks `_carriedTo`'s words ("Vibes", "the drop", "Audio", "what it came from"). |
| Opening a carried thing | DONE | a Vibe closes the walk and goes to `/app/drops?vibe={id}`, which is the Vibes *shelf* walk at that clip (`_openReels(vibeId:)`, and the web has no per-vibe route to push); a drop goes to `/app/drops/{id}`; a sound goes to `/app/audio`; a `source_id` fetches `GET /moments/{id}/` and **pushes a second walk over the one original moment** (`_openSource`). |
| My own day opens last | DONE | `_ownOrder` reverses the **days** on my own moments and not the pictures inside them, so my walk opens on what I last put up while each day still plays first to last. |
| Marking watched | DONE | `POST /moments/items/{id}/seen/` as each item comes up, and `POST /moments/{id}/seen/` on the item that ends the day — the phone's two calls, in the phone's places. |
| The heart | DONE (NOT VERIFIED live) | `POST /moments/{id}/react/`; a tap is `kStoryLike` (❤️) or a blank emoji to take it back; a long press opens `kStoryFaces` (❤️ 😂 🔥 👏 😮) under "Answer with". The server's answer is what is drawn, never a local guess. |
| The answers tally and the who sheet | DONE (NOT VERIFIED live) | drawn on my own day only, because `services._reactions` sends a non-owner `{count: 0, counts: {}, mine}` — so a reader is shown no number rather than a made-up one. The sheet reads viewers, reactors and (on a poll) voters **when it is opened**, and draws the app's three groups: "Who watched and answered", "Answered", "watched", and "Who chose what". |
| Reply | DONE (NOT VERIFIED live) | `POST /moments/{id}/reply/` — a message into a convo, not a like. The field is `Reply...`, 2200 characters, and focusing it holds the clock (`_held || _typing`). |
| Carry | DONE (NOT VERIFIED live) | A carry that has a picture on it opens the web's own editor first — `PhotoEditor` seeded with the carried bytes (`mediaBlob(asset.content_url)`), the item's mentions minus me already on it — and posts the composed file with `source`, so the credit and the Remention card are the server's. Everything with nothing to draw on (a clip, a note, a Vibe, a moment with no picture) carries straight through `POST /moments/{id}/carry/`. Two things the phone's editor carries and the web's does not: `links` and `tags` (the positions the named people were drawn at) — the mentions ride across, their pill positions do not |
| Share | DONE (NOT VERIFIED live) | gate then deed: `POST /moments/{id}/share/` with no body asks whether this account may share it, and only then does the picker open; `{thread}` is the send, one convo at a time, and the count reported is the number that actually arrived. A refusal is the server's own refusal, so the web never opens a sheet whose Send would fail. |
| Take down | DONE | behind `ConfirmDialog` with the app's own words — "Take this down?" / "It goes for everybody, now, and there is no getting it back." — then `DELETE /moments/{id}/`. |
| The three dots | DONE | `_hasOptions` is mine **and** a non-empty strip: the sheet is titled "This moment" and holds "Add to Memories" and nothing else. |
| Add to Memories | DONE (NOT VERIFIED live) | `AddToMemories` reads `/moments/awaiting/` and the Memory list, and files a new Memory (`POST /moments/memories/`) or adds to one (`PATCH /moments/memories/{id}/`). |
| `/app/moments?memories=1` | DONE (a dead button fixed) | "New Memory" on my own profile opened a route parameter that nothing read. `MomentsPage` now consumes it, opens `AddToMemories`, and strips the parameter so a reload does not reopen it. |
| The stage's own metrics | DONE | `MomentStage` now uses `kNoteColumn` / `kNoteMargin` (520 / 44) for a text moment's column and `kSongCoverGap` / `kSongCoverMargin` (18 / 28) for a track moment's title, and both it and the viewer draw over media with `_overMedia` — `text-shadow: 0 0 4px rgba(0,0,0,0.8)` — rather than a veil. |

Not claimed in this pass:

- **No live run.** No moment was posted, watched, answered, carried or shared
  against a running backend here. Every write above is **NOT VERIFIED**.
- **`links` and `tags` are not carried with a picture**, as described in the
  Carry row.

### The same day's follow-through

The first account of this pass named three things as missing or unported. Two
of them were looked at again the same day and one of them was not what it said.

| Item | Then | Now |
| --- | --- | --- |
| The Memory walk (`isMemory`) | MISSING — a Memory was listed and filed but not walked | **DONE (NOT VERIFIED live)**. `MomentViewer` draws a Memory as a Memory: no watchers and no eye row, no `seen`/`itemSeen`, "Your Memory" / "Memory" / "{n} in this Memory" with no `when`, answers at `/moments/memories/{id}/react|reply|reactors|share/`, "Whoever answers turns up here." in the who sheet, no three dots, Remove with the app's own question. The shelf and the Alerts row both open it through one shared `memoryAsMoment`, so the two doors cannot drift |
| Managing a Memory | not named at all | **DONE (NOT VERIFIED live)**. The long press on my own shelf card — the web's first — opens `manageMemory`'s four rows: Add more to it (the picker with the shelf already decided), Rename, Change the cover (one of its own pictures or one off this device), Remove |
| A Memory named in Alerts | refused — "Memories are not on the web yet." | **DONE (NOT VERIFIED live)**. `alertPath` answers `/app/moments?memory=<id>`; the page asks the shelf, finds the one it names and opens it. The refusal is gone |
| Together mode | "MISSING" | **not a feature**. `grep -rn "together\|Together\|watch party" app/lib` finds no such screen, widget or string. Named in error |
| Stickers/drawings | "MISSING" | **COMPLETE**. They are the *editor's* tool on both platforms — `PhotoEditor` and `ImageEditorScreen` — not the viewer's. `moment_view.dart` has neither |
| The ring on a face | not named | **DONE (NOT VERIFIED live)**. `useLiveRings()` answers the tray's `unseen` authors; `DropCard` and search's `PersonRow` ring from it |

Also closed the same day, outside Moments: the chat's accent on an uncoloured
convo now reads `--convo-accent` (`chatTint ?? accent`, the phone's
`convoAccent()`), and `TINT_HEX` carries the phone's light-scheme readings.

Also corrected in this pass, and recorded in
`XELVIC_MOBILE_FEATURE_INVENTORY.md`: the web had a composite moment it called
the **Morning Question**, built around a `prompt` field that exists on neither
`MomentSerializer` nor the app's model. It was fabricated, so it was removed and
the field was struck from `src/types/api.ts`.

## Transport pass (2026-11-01, eighth pass)

The goal of this pass was structural, not a feature: **one HTTP client, one
`services/` folder, and nothing left on the old `fetch` wrapper.**

| Item | Status | Where |
| --- | --- | --- |
| Axios as the client | DONE | `axios@1.21.0` |
| The one instance | DONE | `src/config/axios.ts` |
| Addresses and keys | DONE | `src/config/env.ts`, `src/config/urls.ts` |
| Service modules | DONE | `src/services/` — 21 service files, 202 methods, plus an `index.ts` barrel. (`circles.service.ts` added 2026-11-01; the number here is a fresh count, not the earlier 191 + 5) |
| Old call sites converted | DONE | every screen now calls a service, not the transport |
| Raw `fetch()` removed | DONE | 0 bare `fetch(` calls remain under `src/` (59 `refetch(` hits are react-query and are not transport) |
| Old wrapper deleted | DONE | `src/lib/api.ts` and `src/lib/env.ts` are gone; 0 imports of either remain |
| Upload progress | DONE | `uploadService.asset` — axios `onUploadProgress` replaced the hand-written XHR loop |
| Private media bytes | DONE | `mediaService.blob` — `responseType: "blob"` replaced the manual 401 retry |

### What the client does

`src/config/axios.ts` is the only module in the app that knows how to talk to
the server. It attaches the bearer token from `src/lib/session.ts`, sends the
session cookie (`withCredentials`), renews an expired access token **once** per
request through a single-flight refresh, turns a cancellation into the
`DOMException("Aborted", "AbortError")` that the existing call-site checks
already look for, and normalises every failure into the `ApiError` that
`src/lib/errors.ts` defines and the screens already read. `skipAuth: true` marks
the roads that must answer before there is an account (sign-in, the QR hand-off,
a shared playlist).

Two places talk to a third-party host rather than to our own API — the geocoding
lookups in `CameraCapture` and the public avatar fetch in
`features/marketplace/queries.ts`. Those use **bare `axios`**, never the shared
instance: the shared instance would attach the account's bearer token to a
request leaving for another origin and prefix the API base URL onto an absolute
URL. The public media read passes `authenticated: false` for the same reason.

### The twenty services

| Service | Methods |
| --- | --- |
| `alerts` | 4 |
| `audio` | 16 |
| `auth` | 22 |
| `calls` | 1 |
| `chat` | 32 |
| `collabs` | 2 |
| `deals` | 11 |
| `drops` | 32 |
| `marketplace` | 6 |
| `media` | 1 (blob read) |
| `moments` | 23 |
| `profile` | 1 |
| `reco` | 1 |
| `saved` | 3 |
| `social` | 17 |
| `spaces` | 8 |
| `sparks` | 5 |
| `stickers` | 2 |
| `upload` | 1 (progress upload) |
| `verify` | 3 |

Every method is `async`, takes the arguments the call site already had, and
returns `response.data` unreshaped. No service invents a value the server did
not send. Where a route is owned by two screens it is written once — the
`/sparks/wallet/` roads existed in two places before this pass and now exist
only in `sparks.service.ts`.

### Two things from the reference structure that were deliberately not copied

1. **`localStorage` for tokens.** The reference app keeps tokens there; this app
   keeps them in `sessionStorage` plus an in-memory copy in `src/lib/session.ts`.
   Copying that would have been a silent auth-persistence regression — a session
   outliving the tab — so the storage choice was left exactly as it was.
2. **A toast from the response interceptor.** The reference app raises a toast
   for every failed request. Here that would swallow each screen's own handling
   and double-notify, so failures still reach the call site and are reported
   where they always were. The project's rule that no fake success may ever be
   shown depends on that.

### Scope, stated plainly

No endpoint was added, removed or changed. The backend was read and not touched.
Every road the web calls after this pass is a road it called before; only the
module that dials it moved. Feature status elsewhere in this tracker is
therefore unchanged by this pass, and nothing here was exercised against a
running server: the transport is **NOT VERIFIED** at runtime in this
environment, like every other network claim in this file.

## Circles pass (2026-11-01, ninth pass)

The ask: the app's Moments page has a Circles section with "Pick your interests",
and the web has none. The reference is `app/lib/screens/circles.dart` (the
section, `CircleScreen` and `CirclePickerScreen`) and `app/lib/circles.dart` (the
model), with `backend/apps/circles/{urls,views,serializers,services}.py` and
`apps/drops/views.py:write_fields` read alongside them.

**One thing about the source, stated up front.** The phone's *Moments* page no
longer mounts the section — `app/lib/screens/moments.dart:629` draws `LiveNow`
("This is where the Circles section used to sit"), introduced in commit
`f4f7ffb7` on 2026-10-31. The section, both screens and all four backend routes
are still shipped; the web port follows that shipped source because that is what
was asked for, and this file records the difference rather than claiming the
phone's current Moments page and the web's match.

| Item | Status | Where |
| --- | --- | --- |
| The section | DONE (NOT VERIFIED live) | `features/circles/CirclesSection.tsx`, mounted under the rail on `/app/moments`. Header ("Circles", the month while nothing is picked / the run's flame once something is, "+" while there is room), the empty card that *is* the picker ("Find your people", "Pick your interests"), the cards, and "N more interests this month" off the server's `max_picks` |
| A card | DONE | `CircleCard` — field glyph, `field · COUNTRY`, seats ("N of 50 seats" / "N in the circle"), flame, chevron, task line, status, post button, the top three `RankRow`s and "See all N takes". The whole card opens the circle through one transparent button *under* the content, so the post button inside it does not also open the page |
| The picker | DONE (NOT VERIFIED live) | `InterestPicker` — "Your interests", "Choose up to {n}…" (or "That is all three for this month"), a row per interest with a tick, a lock at the cap, a plus, or a spinner on the one being chosen. Read every time it opens (`staleTime: 0`, `refetchOnMount: "always"`) because the ticks are monthly, and a pick lands straight in the circle it made (`POST /circles/pick/` answers with the day) |
| The circle page | DONE (NOT VERIFIED live) | `pages/CirclePage.tsx` at `/app/circles/:circleId` — `Faces`, the task card (`TaskLine`, `StatusLine`, `PostButton`), "Today's board" with the server's count, and a numbered `DropCard(read: false)` per take. No client-side ranking: `services.board` already ranks, and re-sorting would be a second opinion |
| Posting a take | DONE (NOT VERIFIED live) | The shared `DropComposer`, opened with `circle` set. `POST /circles/{id}/` runs the same `write_fields`, so a take's body is the drop composer's own — and the task's `kind` only chooses the door: `text` → the note door, `sound` → the sound door, `clip` → one video upload with the words as its caption, `picture` → pictures only (the clip and poll chips come off). Heading "Your take", button "Drop it" — the app's `Str.dropsYourTake` / `Str.dropsDropIt` |
| The card's state, honestly | DONE | `open` is false both before a day opens and after it closed, so the copy is chosen with `opens_in`: "The board opens when the day does." while it is still coming, "Nothing went up today." once it is over, and "Nobody has answered yet. Be the first." while it is open. The task is null while sealed (`views.py:85-86`) and is not invented |
| `DropCard(read: false)` | DONE (a small prop added) | the board is a list nobody scrolled, so its cards count no looks — the app's own `DropCard(read:)`. Default stays `true`, so every feed and profile card is unchanged |

Not claimed in this pass:

- **No live run.** No interest was picked, no take posted and no board read
  against a running server here. Every write above is **NOT VERIFIED**.
- **`Faces` shows the members the server sends** (`day.members`), in the order it
  sends them — at most twelve overlapping 31px avatars, with the seat line
  beside them ("N people here", or "N people, and M seats open" past twelve). It
  is a drawing of the list, not a claim that the list is everyone.
- **The phone's current Moments page does not draw this section** (see above).
  The port is faithful to `circles.dart`; it is not a claim about
  `moments.dart` today. Since the Audio and Live pass below, the web mounts the
  app's `LiveNow` strip directly under the rail and keeps this section beneath
  it — the one deliberate difference on that page.

## Audio and Live pass (2026-11-01, tenth pass)

The ask: *"ab audio aur live ko bhi app ke according kijiye jo jo jaise jaise app
me hai aur jaise sab kuch app me work kar raha hai waise hi web me bhi karna
chahiye"* — Audio and Live brought to the app's shape, doing what the app does.

Sources read (not modified): `app/lib/screens/audio.dart`,
`app/lib/screens/audio_bits.dart`, `app/lib/screens/audio_studio.dart`,
`app/lib/screens/live_now.dart`, `app/lib/screens/room.dart`,
`app/lib/screens/room_bits.dart`, plus `backend/apps/audio/{urls,views,studio}.py`
and `backend/apps/spaces/` for the contract.

### Audio

| Item | Status | Where |
| --- | --- | --- |
| The tab's doors | DONE (NOT VERIFIED live) | `pages/AudioPage.tsx` — the reco layer's category chips are doors (`/app/audio/c/{key}`), the weekly board strip opens `/app/audio/board`, and "Audio drops" reads `/audio/feed/`. Every row is the server's; no row is invented |
| A category's own page | DONE (NOT VERIFIED live) | `pages/AudioCategoryPage.tsx` at `/app/audio/c/:key` — `GET /audio/categories/<key>/`, the shelf's own title and subtitle from the tap, rows that play with the shelf as the queue, and the server's "nothing here yet" state instead of a made-up one |
| The weekly board | DONE (NOT VERIFIED live) | `pages/AudioBoardPage.tsx` at `/app/audio/board` — `GET /audio/board/`, the week's span (`weekSpan`) and the chart rows in the server's order. No client re-ranking |
| The studio | DONE (NOT VERIFIED live) | `pages/AudioStudioPage.tsx` at `/app/audio/studio` — `GET /audio/studio/`. One's own only; a number the server did not measure reads "Listeners not recorded", never 0 |
| One item, opened | DONE (NOT VERIFIED live) | `pages/AudioStudioDetailPage.tsx` at `/app/audio/studio/:itemId` — `GET /audio/studio/<uuid>/` and `GET /audio/studio/<uuid>/audience/?days=7`. Sections in the app's order: head, lifetime sums, the trend read (band and score only when `score` is not null, otherwise the outcome word and the server's `why`), rates, components, audience bars, "Where they are" (null countries → "Not recorded." + why), used-by, this week, and the rights that are false. `rates` of `null` reads "Not measured" |
| Every row wears its heart | DONE | `features/audio/rows.tsx` — the heart was hidden on `source === "drop"` rows; the app likes a drop at `POST /drops/{id}/like/`, so the row now draws the heart and tells `LikeButton` which half of the catalogue it came from |
| Episode number | DONE (fix) | `rowTrack` keeps a numeric `episode` and drops a string one, instead of passing `string | number | null` into `Track.episode` |

Not ported, and not claimed: the app's **downloads door** (a browser has no
kept-tracks store here) and the **full-screen swipe deck** over the reco rows.
Both are named in the page's own header comment. The Audio studio, previously
marked "platform-specific", is now a real web surface with its own item page.

### Live

The app has **no Live tab**: the Live surface is the `LiveNow` strip at the end
of Moments (`moments.dart:629`, where the circles used to sit), the room screen
(`room.dart`), and the sheet a room is created in. The web's Live shelf predates
this pass and stays as a web-only door to `/app/live`; everything below is the
app's own.

| Item | Status | Where |
| --- | --- | --- |
| A room's face | DONE | `features/live/parts.tsx` — `waveShape` (the app's own generator), `RoomCover` (seed tone, the room's wave, its kind's glyph), `crowdCount` (`listeners + stage.length`, the app's sum), `whenRoom` (Today / Tomorrow / Yesterday / "Nd ago" / weekday / "day/month" + clock, the app's own strings) and `crowdLine` ("Starts …" / "Over" / "Nobody in it yet" / "N people") |
| The "Live now" strip | DONE (NOT VERIFIED live) | `features/live/LiveNow.tsx`, mounted directly under the Moments rail where the app draws it. `GET /spaces/?shelf=kept` — the server answers *who this account keeps is on*, rather than the web filtering the live shelf. Header and "Start a room" always drawn; empty says "Nobody you keep is on right now."; `room.new` / `room.update` / `room.gone` refresh it; a failure is silent under the rail's own error. **Deliberate difference:** the web keeps `CirclesSection` *below* the strip, because the app has circles on their own shelf and the strip alone would leave a web reader with no way to reach them |
| Opening a room | DONE | `features/live/OpenRoomSheet.tsx` — one sheet for both doors (the Live shelf and the strip), because starting a room is one act with one set of rules, and it is the app's sheet: the four kind chips (Room / Stream / Game / AMA) with the line under them that says what each gets you, name, note, tags, and a "Start it later" switch with the app's three quick answers (In an hour / In two hours / Tomorrow). A Game goes on the wire as a stream — the board is put on it from inside the room. The sheet closes onto the room the server made and writes nothing into the cache itself; a failure is shown in the sheet in the server's words |
| The shelf card's count | DONE | `pages/LivePage.tsx` now says `crowdLine(room)` — "Starts …", "Over", "Nobody in it yet" or "N people" — instead of a bare listener count |
| The three dots | DONE (NOT VERIFIED live) | `pages/RoomPage.tsx` — the app's menu, in the app's order and conditions: Start now (host, scheduled), Share the room (always), Report the room (not host, not scheduled), Close the room (host, live), Leave quietly (inside). Everything that ends something is behind this one press; "Leave quietly" leaves first and only then closes the page |
| The room's head | DONE | Back, `RoomCover(34)`, title, "{host} · {crowdLine}", then the state in the app's three words: "Over", the start time, or the LIVE badge |
| Share | DONE | The share sheet's convos first (`POST /spaces/{id}/share/` `{thread}`), then **Share outside** — `navigator.share` with the clipboard as the fallback and the app's own sentence when it has to use it. The line is the app's `roomLine` plus the address, because a browser share with no link asks the reader to go and find the room |
| Report | DONE (NOT VERIFIED live) | `ReportSheet kind="room"` — the host's name, handle and face, with the room's title as the preview. Reasons are the server's (`GET /social/report/`); never on your own room, which is what the server enforces too |
| Scheduled and closed words | DONE | "It is announced. Start it whenever you are ready…" / "It has not started…" for a scheduled room, the app's "Close the room?" confirmation, and "Over" in the head |

Not claimed, and said on the page in as many words: **room sound is not
carried**. The app's stage audio is WebRTC over the `call.signal` relay
(`stage.dart`); the web has had a client for that relay since the calls
(2026-11-06), but the room page was not wired to it, so the room draws its
stage, hands, chat, reactions and board — all real — and the "How a room works"
card says the voices are not here yet. Nothing on the page plays a recording, and
no button pretends to open a microphone.

## Drops and Vibes pass (2026-11-02, eleventh pass)

The complaint was concrete: opening Drops played several songs at once, the
page scrolled forever without a real end, and it loaded far slower than the
app. All three were one root cause wearing three faces — every media element on
the page was mounted and fetched on mount, and the feed was asked for without
the app's own `seen=strict`.

### The one ear

`src/lib/playback.ts` is a registry of the media elements that currently hold
the ear. `claimEar(element)` pauses every other holder before adding itself;
`releaseEar` gives it back. `AuthedVideo` calls them from `onPlay` / `onPause`
/ `onEnded` and releases on unmount, and `PlayerProvider` does the same for the
music bar's `<audio>` — the browser does not fire `pause` when a clip ends, so
the end path releases explicitly. The rule is the app's: `feedPlayer`,
`_playingClip`, and `Sound`'s global mute (`sound.dart`, default **muted
true**).

`src/features/drops/sound.ts` is that mute, persisted under
`xelvic.sound.muted` and read through `useSyncExternalStore`. A feed clip is
silent until the speaker on a card is pressed, which is what the app does.

### What was actually playing several songs

`DropCard` mounted `<AuthedVideo autoPlay muted={false} />` on every video card
in the page. A page of drops therefore downloaded and started every clip it
contained. Now:

| Change | Where |
| --- | --- |
| A clip is fetched only when its card is within one screen (`rootMargin`), and played only while at least 60% of it is on screen (`threshold` 0 / 0.6 / 1) | `features/drops/DropCard.tsx` |
| The card's still is drawn underneath and the clip plays over it, so nothing jumps when the bytes arrive | `DropCard`, `AuthedVideo quiet` |
| `VibeViewer` mounts a player for the active slide and its two neighbours only; the rest show the still (`near={Math.abs(page - at) <= 1}`) | `features/drops/VibeViewer.tsx` |
| A card's clip pauses when it leaves the screen, and a mute toggle sits on the card | `DropCard` |

### The feed's end, in the app's words

`dropsService.feed` now asks `GET /drops/?seen=strict` (`DROPS_FEED_FIRST`) and
the shelf asks `GET /drops/vibes/?limit=8` (`VIBES_FEED_FIRST`), both the app's
own numbers (`DropFeedView` in `apps/drops/views.py`; `Drops._load`). Without
`seen=strict` the server re-deals the corpus once it has been read through: a
scroll that never ends, duplicate cards, and every repeated picture downloaded
again. `Page<T>` gained `caught_up`, and the empty state now says "You've seen
the whole feed" when the server says so, instead of "Nothing here yet".

The "Load more" button is gone. A sentinel `<div>` at the foot is watched with
`IntersectionObserver` (`rootMargin: 900px`) and calls `fetchNextPage()`, which
is the pattern `TagPage` and `AudioCategoryPage` already used. The Vibes rail is
capped at `slice(0, 12)`.

### Why it was slow

| Cause | Fix |
| --- | --- |
| `AuthedImage` fetched every picture on mount — `loading="lazy"` cannot defer a blob request made by hand | the fetch waits until the picture is within 700 px of the viewport (`IntersectionObserver`), and `peekMedia` redraws from cache with no second request |
| Every video in a feed page was fetched | mounted only when near (above) |
| `VibeViewer` mounted a player for every slide in the hand | three slides hold players |
| The aside's two queries ran on phones that never draw it | `useWideScreen()` gates it to `min-width: 1280px` |
| `media.ts` deleted cached blobs 30 s after release, so scrolling back re-downloaded | a 160-entry LRU that skips entries still in use and revokes only on eviction |
| The feed and shelf re-fetched on every mount | `staleTime: 60_000` on both |
| Removing a card refetched every cached page | `setQueryData` filters the card out of the pages in place |

### Status

Every claim above is a code claim. It is **NOT VERIFIED at runtime**: no
backend or signed-in session exists in this environment, so no clip was heard,
no feed was walked to its end, and no timing was measured in a browser. What is
verified is the four commands below and the emitted chunks.

## Checks run after these changes (2026-11-01)

| Command | Result |
| --- | --- |
| `npm run typecheck`  (`npx tsc -b`) | pass |
| `npm run lint` (`npx eslint src`) | pass |
| `npm test` | 29/29 pass (5 files; new `features/convo/model.test.ts`) |
| `npm run build` | pass |

All four were re-run after the settings, profile and notifications passes with
the same result (29/29, five files), and again after the transport pass:
typecheck pass, lint pass, 29/29 tests, build pass in 3.32 s. That pass also
grepped the source tree and found **0** bare `fetch(` calls, **0** imports of
the deleted `@/lib/api` and `@/lib/env`, and no request made outside
`src/services/`. The build now emits the client as its own `axios-*.js` chunk
(100.20 kB, 35.58 kB gzipped).
The emitted bundle was grepped for what the profile pass added — `Send request`,
`xelvic://u/@`, `data-birthday-fall`, `Hold to see their photo`,
`Nothing is up right now`, `Could not open those moments`, and the four
`xelvic-ask-*` keyframes — all present, and `MomentViewer` emitted once as a
shared chunk rather than copied into both pages.

The circles pass was run through the same four commands: typecheck pass, lint
pass, 29/29 tests, build pass (3.79 s on the last run, after the `Faces`
singular fix). The emitted bundle was then grepped for
the section's own copy — `Find your people`, `Pick your interests`,
`more interests this month`, `The board opens when the day does`, `Your take`,
`circles/fields/`, `circles/mine/`, `circles/pick/` — and all are present
(`MomentsPage-*.js`, `CirclePage-*.js`, `DropComposer-*.js`,
`parts-*.js`).

The Audio and Live pass was run through the same four commands: `npx tsc -b`
pass, `npx eslint src` pass, `npm test` 29/29 pass (5 files), `npm run build`
pass in 3.75 s. The emitted chunks include `AudioCategoryPage-*.js`,
`AudioBoardPage-*.js`, `AudioStudioPage-*.js`, `AudioStudioDetailPage-*.js`,
`OpenRoomSheet-*.js`, `LivePage-*.js` and `MomentsPage-*.js`, and `ReportSheet`
is emitted once as a shared chunk — the room's report and the drop's use the
same sheet.

The Drops and Vibes pass was run through the same four commands: `npx tsc -b`
pass, `npx eslint src --max-warnings=0` pass, `npm test` 29/29 pass (5 files),
`npm run build` pass in 3.82 s. The emitted drop-related chunks were
`DropsPage-*.js` 42.79 kB (12.53 kB gzip), `DropCard-*.js` 39.60 kB (11.58 kB),
`DropComposer-*.js` 23.32 kB (6.70 kB), `VibeStudio-*.js` 7.39 kB,
`VibeStudioPage-*.js` 6.73 kB, `drops.service-*.js` 2.89 kB and
`DropPage-*.js` 2.32 kB. The page chunk is route-lazy already; the remaining
weight is media, which is now fetched only as it is reached.

Nothing in this file is a live-backend claim. Every marketplace write is
**NOT VERIFIED** at runtime: no purchase, wear or figure pick was executed
against a running server in this environment.

## Still open (not started in this pass)

- Group admin surfaces (members/roles/invites/rooms) beyond the existing
  partial `ConvoSheet` flows.
- Notification preferences backed by the server (BLOCKED: no endpoint).
- A notification after the site is closed (BLOCKED: FCM-only push, no web
  address — see the notifications pass above).
- Mutuals, crew, mentions read surfaces.
- Account deactivation, language preference.
- Offline outbox / durable sync.
- Calls (WebRTC) — **drawn 2026-11-06** (see the section at the end of this
  file). Room sound is still open: the app's *stage* audio is the same WebRTC
  mesh, and the room page was not part of that pass, so it goes on saying the
  voices are not here.
- Deals, collabs, creator tooling, editors.
- Live cross-device verification (needs a second authenticated device), and now
  also a live marketplace run (buy, wear, figure pick) and a live moments run
  (post, watch, answer, carry, share, open a Memory) against a real server.

Closed since this list was first written — the Moments follow-through of
2026-11-01, the chat accent, the ring on the feed and in search, the Memory
walk, managing a Memory, a Memory opened out of Alerts, carry-with-edit, and
Circles (the section, the picker and the circle's own page — see the Circles
pass above). Deals, collabs and creator tooling are still open.
## Pass — Production folder structure and boot/load performance (2026-11-02)

Scope: `xelvic-web/` only. `xelvic/app` and `xelvic/backend` were not opened
for writing; the read-only check at the end of this pass is recorded below.

### Structure

| Area | Status | Where |
| --- | --- | --- |
| Hooks collected from features, lib and providers | DONE | `src/hooks/` (17 files) |
| Client stores separated from their React bindings | DONE | `src/store/` (8 files), `src/hooks/use*.ts` |
| Pure helpers and caches | DONE | `src/utils/` (7 files) |
| Context objects separated from provider implementations | DONE | `src/context/` (6 files) |
| Components grouped by responsibility | DONE | `components/ui`, `common`, `layout`, `media`, `overlays`, `icons` |
| Route table, guards and lazy registry | DONE | `src/routes/` |
| Shell layout | DONE | `src/layouts/AppShell.tsx` |
| Global stylesheet | DONE | `src/styles/index.css` |
| Storage keys in one written record | DONE | `src/constants/storage.ts` |
| Empty legacy folders removed | DONE | `src/lib/`, `src/features/auth/`, `src/app/` |

No folder was created without code to put in it. `workers/` does not exist
because no current task is heavy enough to move off the main thread; forms,
typography and navigation component folders are likewise absent because the
components they would hold do not exist in this app.

### Load performance

| Change | Status | Evidence |
| --- | --- | --- |
| Remembered account so a reload paints the shell while `/auth/me/` revalidates | DONE (NOT VERIFIED live) | `store/me.ts` (sessionStorage `xelvic.me`), `providers/AuthProvider.tsx` starts `authenticated` when a token and remembered user exist |
| Query cache kept for a session | DONE | `main.tsx`: `gcTime` 30 min, `staleTime` 60 s |
| Route chunks prefetched on hover/focus/touch | DONE | `routes/lazyPages.tsx` (`preloadRoute`), `hooks/useRoutePrefetch.ts`, `layouts/AppShell.tsx` (`PrefetchLink`, `PrefetchNavLink`) |
| Five shell tabs warmed on idle | DONE | `useIdlePrefetch(SHELL_ROUTES, !!user)` in `AppShell` |
| API origin preconnected before the bundle runs | DONE | `index.html` |
| Socket handshake deferred until idle (1.5 s ceiling) | DONE (NOT VERIFIED live) | `providers/SocketProvider.tsx` |
| Feed cards below the fold skipped by layout and paint | DONE | `.feed-item` in `styles/index.css`, applied in `pages/DropsPage.tsx` |

### Checks at the end of this pass

```text
npx tsc -b                      PASS
npx eslint src --max-warnings=0 PASS
npm test                        29/29 PASS (5 files)
npm run build                   PASS in 3.78 s
```

Build output: entry chunk 440.46 kB (139.24 kB gzip), stylesheet 121.62 kB
(22.55 kB gzip), per-page chunks 2–82 kB. No chunk-size advisory.

**Runtime status: NOT VERIFIED.** No backend or authenticated session was
available in this environment. The folder moves, the checks and the build are
verified; the effect of prefetching, the deferred socket and the remembered
account on a real first load has not been measured in a browser against a live
API. Nothing in this section should be read as a measured speed claim.

The read-only project check was re-run at the end of this pass and reported the
same pre-existing `app/` Flutter/Gradle edits as before, with nothing under
`backend/` and nothing outside `xelvic-web/` created, edited or deleted.

## Pass — First paint and feed scroll latency (2026-11-02)

Scope: `xelvic-web/` only. Prompt: every page shows API data late, and the next
feed page waits for a spinner before it appears.

### What was measured (not guessed)

The production API was probed from this machine with `curl`. The edge is
Cloudflare Singapore (`CF-RAY …-SIN`), so the numbers are dominated by distance
rather than by the Django view.

| Request | Measured |
| --- | --- |
| `GET /health/`, cold connection | TTFB 0.40–0.61 s (TCP ~0.10 s, TLS ~0.31 s) |
| `GET /health/`, same keep-alive connection | TTFB 0.16–0.27 s (median ~0.20 s) |
| `OPTIONS` preflight for `GET /api/v1/drops/feed/` | 0.42 s, `Access-Control-Max-Age: 86400` |
| First-visit cold start | DNS ~1.1 s, TLS ~1.3 s, TTFB ~1.8 s |

Read: roughly 400 ms before the first byte of any first request, ~200 ms per
warm request, and the preflight is cached for a day so it is paid once. No
serialised queue and no artificial `setTimeout` was found in the data path
(`src/config/axios.ts`, services, hooks).

The backend could not be started locally: `xelvic/backend` has no `.env`, no
virtualenv, expects Python 3.12 (this machine has 3.14), and nothing is
listening on PostgreSQL 5432 or Redis 6379. Running it would also mean writing
inside the read-only project, which the brief forbids. The production numbers
above are therefore the only live measurement.

### What was changed

| Change | Where | Status |
| --- | --- | --- |
| Allow-listed query answers hydrated from `sessionStorage` before the first render (per account, 15 min, 1.5 MB, cleared on sign-out/401/expiry) | `src/store/queryCache.ts`, `src/main.tsx`, `src/providers/AuthProvider.tsx` | DONE (NOT VERIFIED live) |
| Persisted set expanded to the per-entity pages a tap opens (profile, drop, tag, audio shelf, playlist, room, artist) | `src/store/queryCache.ts` | DONE |
| Query defaults: `staleTime` 60 s, `gcTime` 30 min, no refetch on window focus | `src/main.tsx` | DONE |
| First data read for a tab started on hover/focus/touch, along with its chunk | `src/routes/prefetchData.ts`, `src/hooks/useRoutePrefetch.ts` | DONE |
| Prefetch skipped on `saveData` / 2G | `src/hooks/useRoutePrefetch.ts` | DONE |
| Infinite-scroll sentinels moved 1400–2000 px out (Drops, profile shelf, audio shelf, alerts, tag) | `src/pages/*`, `src/features/profile/ProfileShelf.tsx` | DONE |
| Authenticated media reads capped at four in flight so thumbnails cannot starve the JSON request | `src/utils/mediaCache.ts` | DONE |
| API origin preconnect + dns-prefetch | `index.html` | DONE |
| Socket handshake deferred to idle | `src/providers/SocketProvider.tsx` | DONE |
| Feed cards skip layout/paint below the fold | `src/styles/index.css`, `src/pages/DropsPage.tsx` | DONE |

### Checks at the end of this pass

```text
npx tsc -b                      PASS
npx eslint src --max-warnings=0 PASS
npm test                        29/29 PASS (5 files)
npm run build                   PASS in ~3.7 s
```

Build output: entry chunk 454.13 kB (142.32 kB gzip; +13.7 kB raw, +3.1 kB
gzip for the persisted cache module), stylesheet 121.62 kB (22.55 kB gzip),
per-page chunks 2–82 kB. No chunk-size advisory.

**Runtime status: NOT VERIFIED.** The persisted cache, the data prefetch and the
wider scroll margins have not been timed in a browser against a signed-in
session. What is verified is the API's own latency and that every check passes.
No claim of "instant" is made here; the claim is that the first round trip is no
longer spent in front of an empty screen on a return visit.

### Read-only project check

`git status --short` inside `xelvic/` reports only the eight entries that were
already there on 2026-10-31 (`app/` Flutter/Gradle edits and the untracked
`.tools/`). Nothing under `xelvic/backend/` and nothing outside `xelvic-web/`
was created, edited or deleted during this pass.

## Pass — Open anything, draw it now (2026-11-02, second round)

Prompt: after the first latency pass, pages still showed data late; the ask is
that *any* page opened draws what it is showing without a loading step.

### What was still wrong

The first pass persisted sixteen named query keys and prefetched data only on
hover/focus/touch. That left the pages outside the list — a profile, a drop, a
settings screen, a thread's messages — cold on every open, and a phone has no
hover, so a tap started its request only once the page had mounted.

### What changed

| Change | Where | Status |
| --- | --- | --- |
| Every query answer persisted (deny-list instead of allow-list: search answers, mention/people pickers, QR sessions are excluded) | `src/store/queryCache.ts` | DONE (NOT VERIFIED live) |
| Copy lifetime 30 min, total budget 2.5 MB, single answer 400 KB, version bumped to 2 so old copies are dropped | `src/store/queryCache.ts` | DONE |
| Unchanged answers are no longer re-serialised on every flush — each entry's JSON is reused until its `updatedAt` moves | `src/store/queryCache.ts` | DONE |
| A drop opened from a feed draws from the feed's own cached row as `placeholderData` | `src/store/seed.ts`, `src/pages/DropPage.tsx` | DONE (NOT VERIFIED live) |
| A room opened from a shelf draws from the shelf's cached row | `src/store/seed.ts`, `src/pages/RoomPage.tsx` | DONE (NOT VERIFIED live) |
| A chat opens with the Convo tab's cached header (name, face, members, wallpaper); a row with a string gate is not seeded | `src/store/seed.ts`, `src/pages/ChatPage.tsx` | DONE (NOT VERIFIED live) |
| The other four shell tabs' first answers are warmed 1.2 s after idle, behind the screen that is open | `src/hooks/useRoutePrefetch.ts` | DONE (NOT VERIFIED live) |
| Restore/write road covered by unit tests (round trip, timestamp, expiry, transient key, signed-out tab, malformed copy) | `src/store/queryCache.test.ts` | DONE |

The seeded row is passed as `placeholderData`, which TanStack Query does not
write into the cache: it is what the first frame draws, never an answer another
screen can read as fresh.

### What is still not instant, and why

A page whose answer has *never* been in this tab still waits one round trip.
Measured on 2026-11-02: ~0.40 s to first byte on a new connection, ~0.20 s warm
to the Singapore edge. Nothing in the frontend can remove that; only a
server-rendered first byte or an edge cache in front of the API could, and both
need changes outside `xelvic-web/`.

### Checks at the end of this pass

```text
npx tsc -b                      PASS
npx eslint src --max-warnings=0 PASS
npm test                        35/35 PASS (6 files)
npm run build                   PASS in 3.5 s
```

Build output: entry chunk 454.44 kB (142.43 kB gzip), stylesheet 121.62 kB
(22.55 kB gzip), per-page chunks 2–82 kB. No chunk-size advisory.

**Runtime status: NOT VERIFIED.** The persistence, the seeds and the idle data
warm have not been timed in a browser against a signed-in session. The restore
road itself is unit-tested; its effect on a real first paint is not measured.

### Read-only project check

`git status --short` inside `xelvic/` is unchanged from the first pass: the
same eight pre-existing entries from 2026-10-31, nothing under `backend/`.

## Pass — Media arrives after the card (2026-11-02, third round)

Prompt: page loading is not the problem; after a page has loaded, the *media
inside the cards* — audio, video, image — still takes time to appear, on every
page.

### What was actually wrong

The pages were no longer the slow part. The pictures inside them were, for a
reason that is not visible in the React code: **authenticated media is read
through `fetch`/XHR with an `Authorization` header, and the API's media
responses carry no cache headers** (checked 2026-11-02: the media origin returns
no `Cache-Control` at all). The browser therefore does not reuse those bytes.
Every reload downloaded every picture in the feed again — and with a first byte
about 0.4 s away on a cold connection, that is exactly "card aa jaata hai, photo
baad me aati hai".

Two things made the wait visible rather than hidden:

1. the lazy observer asked for a picture only **700 px** before it reached the
   screen — under one screen of lead, so the reader arrived before the bytes;
2. every network read took one of **four** slots, so a feed's pictures arrived
   in waves of four instead of draining in one pass.

Audio goes down the same road (`PlayerProvider` → `useMediaUrl` → blob), so the
music bar waited for the whole file before it could play.

### What changed

| Change | Where | Status |
| --- | --- | --- |
| Media bytes kept in `Cache Storage`, one cache per account (`xelvic-media-<id>`, 400 files, 20 MB per file), read before any network request | `src/utils/mediaCache.ts` | DONE (NOT VERIFIED live) |
| A disk hit does not take a network slot: a picture already on disk is drawn without waiting behind the queue | `src/utils/mediaCache.ts` | DONE |
| Network reads raised from 4 to 6 in flight | `src/utils/mediaCache.ts` | DONE |
| The write to disk is off the critical path — the picture is drawn from the bytes already in hand | `src/utils/mediaCache.ts` | DONE |
| Pictures are asked for 1600 px (about three phone screens) before they can be scrolled into view | `src/components/media/Media.tsx` | DONE (NOT VERIFIED live) |
| Every `xelvic-media-*` cache is deleted on 401, on token expiry, on sign-in and on sign-out | `src/providers/AuthProvider.tsx` | DONE |
| Disk store covered by unit tests: round trip, miss, per-account separation, size limit, session-end wipe, browser without Cache Storage | `src/utils/mediaCache.test.ts` | DONE |

The cache name is derived from the remembered account, so one account's private
media is never drawn for another, and the four auth transitions already listed
wipe every account's cache in this browser — not only the current one.

### What is still slow, and why

A file this browser has **never seen** still waits one download. That is the
network floor: ~0.40 s to first byte on a new connection, ~0.20 s warm to the
Singapore edge, per file. The 1600 px lead is what hides it — the request starts
three screens early — but a cold feed on a cold connection is still a feed whose
first pictures land after the cards do. Nothing in `xelvic-web/` can remove that;
only edge caching or range-streaming at the API would, and both live outside
this directory.

Uploads and downloads still use the blob path unchanged; the disk store only
serves what has already been read once.

### Checks at the end of this pass

```text
npx tsc -b                      PASS
npx eslint src --max-warnings=0 PASS
npm test                        41/41 PASS (7 files)
npm run build                   PASS in 3.7 s
```

Build output: entry chunk 455.35 kB (142.89 kB gzip), stylesheet 121.62 kB
(22.55 kB gzip), per-page chunks 2–82 kB. No chunk-size advisory.

**Runtime status: NOT VERIFIED.** The disk store's logic is unit-tested, but no
timed browser run against a signed-in session was possible (no account
credentials, and the backend cannot be run locally). Whether a repeat open now
draws media with no network read has not been observed in a browser.

### Read-only project check

No file under `xelvic/`, `xelvic/backend/` or `xelvic/app/` was created, edited
or deleted in this pass. All three passes touched only `xelvic-web/`.

## Pass — Convo cards, the strip, and the share sheet (2026-11-02, fourth round)

The ask, as it was put: the chat screen's messages are not the app's — whatever
the phone draws, the site does not — the "This convo is encrypted" chip at the
very top of a thread is missing, and passing a post on does not work the way the
phone's does. All three were taken from the app's own source (`chat.dart`,
`chat_drop.dart`, `story_card.dart`, `chat_track.dart`, `chat_profile.dart`,
`share_who.dart`, `sheets.dart`) and the backend that feeds them — not from the
screen recordings, which do not exist in this repository.

### The strip at the top of a thread

| Item | Status | Where |
| --- | --- | --- |
| "This convo is encrypted" over the first message, on every thread | DONE | `ChatPage.tsx`, `_strip` in `screens/chat.dart:6476` |
| The same chip becomes "Disappearing convo · {window}" when vanish is on | DONE | accent border at 40 %, clock glyph, accent words |
| The app's geometry: `X.card` fill, radius 20, padding 11/6/12/6, glyph 12, words 10.5 w600 | DONE | the phone's numbers, one for one |

The chip used to be drawn only while disappearing messages were on, which left an
ordinary convo with no word at all about what it is. The app draws it over the
first message of every thread — "Index 0 sits at the bottom of a reversed list,
so the strip is the last item — which puts it at the very top of the thread" —
and its two sentences are the app's own strings, not new copy.

### Every card a convo can carry

A conversation carries more than a post. The app's dispatch (`chat.dart:8055`)
answers eleven kinds; before this pass the site answered six of them.

| Card | Status before | Status now | Where |
| --- | --- | --- | --- |
| Drop / post / Vibe share | DONE | DONE — card chrome, geometry and actions taken from `chat_drop.dart` | `ChatDropCard` |
| Mention / tag line over a card | missing | DONE — drawn only on the reader's copy, from the server's own `mention`/`tag`/`by` payload (`drops/services.py:4008`, `:4113`) | `ChatDropCard` |
| A share that has not resolved yet | drew **nothing** | DONE — the app's waiting shell, and the trouble line when the read fails | `ChatDropCard` |
| An uploaded sound shared into a convo | drawn as a still, unplayable | DONE — a real player over the drop's content route with a clock | `ChatSoundCard` |
| Playlist share | DONE | DONE (unchanged) | `SharedCard` |
| Live room share | DONE | DONE (unchanged) | `SharedCard` |
| Sticker | DONE | DONE (unchanged) | `SharedCard` |
| **Song share** (`payload.track`) | not drawn at all | DONE — sleeve, title, artist, the track's own wave (ported `waveShape`), the heart at the track's real route, play through the one player, clocks | `ChatTrackCard` |
| **Profile share** (`payload.profile`) | not drawn at all | DONE — snapshot card (face, name, mark, private) opening `/app/u/{handle}` | `ChatPersonCard` |
| **Story share** (`payload.story`, incl. the retracted shape) | not drawn at all | DONE — the app's fixed 348 px panel, name band, item bars, and a press that opens the real moment in the one viewer | `ChatStoryCard` |
| **Moment reply header** (`payload.moment_ref`) | not drawn at all | DONE — "Replying to their moment · clip" over the bubble, press opens the moment | `MomentQuote` |

Every one of the four new cards was checked against the backend before it was
drawn, because a card for a payload nothing writes is a card that can never
appear:

- `payload.playlist` / `memory` / `moment_ref` / `retracted` are written by the
  server (`audio/services.py:1643`, `moments/services.py:2356`, `:2162`, `:2818`,
  `:2889`, `:2912`).
- `payload.track` and `payload.profile` are written by the *phone* and passed
  through by the chat API (`chat/views_messages.py:113`). They are read, drawn,
  and never invented: the site draws them when a share carries them and says
  nothing when one does not.
- The stream is rebuilt from the id rather than trusted from the payload, with
  the two routes kept apart (`source: "drop"` → the drops content route, else the
  catalogue's) — the app's rule in `AudioTrack.toShare`.

### Passing a post on

The sheet was rebuilt from the app's `ShareCard` (`screens/sheets.dart:351`),
which is a different sheet from the one the site drew.

| Item | Status | Where |
| --- | --- | --- |
| Search box that narrows the convos in hand | DONE | `ShareSheet.tsx` |
| A strip of faces that tick in and out (cap of ten, the app's `_shown`) | DONE | ring + check, never a colour laid over somebody's face |
| A send button pinned above the strip, drawn only while somebody is ticked | DONE | "Send to 1 person" / "Send to N people" |
| One send per convo, tally of what landed, the app's `sendToMany` | DONE | `dropsService.share(base, id, {thread, where: "chat"})` per convo |
| A partial run says so; a run where nothing landed says that and keeps the sheet open | DONE | never a success claimed over a failed send |
| "Another app" hands off through the browser's sheet and is written **only** once the hand-off happened | DONE | dismiss writes nothing |
| "Copy a link" writes nothing and is not counted | DONE | kept although the app removed its own on 2026-10-27, because a desktop browser often has no sheet (`/app` has no `navigator.share` on several platforms) |
| The share count on the card moves by what actually landed | DONE | `onShared(sent)`, wired in `DropCard.tsx` and `VibeViewer.tsx` |
| **"Put it on your Moments"** | NOT IMPLEMENTED | the site's composer takes files off the roll (`ComposeMoment` takes `seed?: File[]`); there is no road from a post that is already up, so the row would open an empty composer. It is not drawn. |

### What is deliberately still not the app's

| Difference | Why |
| --- | --- |
| The story card does not play the story inside itself, carries no heart, and offers no "Remention" | The phone's card is a mini player with a clock, a heart and an offer whose press opens the editor before the picture goes up. A browser card that drew the offer without that editor road would be a button that does not do what it says. The card opens the story; playing, feeling and putting it on my own day are all in the viewer, which is the one implementation of each. |
| A shared song's heart starts unfelt | A share carries no liked state — "no play count, no heart, and no stream path" (`AudioTrack.toShare`) — and the site has no cross-screen track store like the phone's `Audio.it`. The heart moves only on the server's own answer. |
| The phone can *send* a song, a person or its own day into a convo and the site can only *receive* those | The site can send a playlist (`PlaylistPage`) and a moment (`momentsService.share`) into a convo. There is no "send this song" or "send this person" flow in `xelvic-web/`; nothing was drawn to pretend otherwise. |
| No "was this delivered / seen" claim is made anywhere in this pass | Nothing here is real-time beyond what the socket already carries. |

### Checks at the end of this pass

```text
npx tsc -b                      PASS
npx eslint src --max-warnings=0 PASS
npm test                        41/41 PASS (7 files)
npm run build                   PASS in 3.65 s
```

Build output: `ChatPage` chunk 96.19 kB (25.47 kB gzip), `MomentViewer` split into
its own lazy chunk of 43.01 kB (12.18 kB gzip) so a thread that carries no story
card never downloads the viewer. Entry chunk 455.79 kB (143.10 kB gzip). No
chunk-size advisory.

**Runtime status: NOT VERIFIED.** Every card here was written against the app's
source and the backend contract and passes the static checks, but no signed-in
browser run was possible in this environment (no account credentials, and the
backend cannot be run locally). In particular, none of the following has been
seen with a live session: a real song share, a real story share, a real moment
reply, the encrypted chip over a real thread, and a real multi-convo share with
the tally. They are **NOT VERIFIED**, not "done".

### Read-only project check

`git -C xelvic status --short` reports exactly the same eight pre-existing
entries it reported before this pass — seven modified `app/` Flutter/Gradle files
(`analysis_options.yaml`, `android/app/build.gradle.kts`,
`android/app/src/main/AndroidManifest.xml`, `android/build.gradle.kts`,
`android/build/reports/problems/problems-report.html`, `pubspec.lock`,
`pubspec.yaml`) and the untracked `.tools/` — and **nothing at all under
`backend/`**. No file outside `xelvic-web/` was created, edited or deleted.

---

## Pass — The camera's open, the sticker shelf, and all the songs (2026-11-02, fifth round)

Three complaints, three root causes, none of them what they looked like on the
surface.

### 1. The camera took a long time to open

The tap was doing three things in a row and none of them could start early: a
lazy `import()` of `CameraCapture` (57.46 kB) plus the `PhotoEditor` chunk behind
it (76.44 kB), a parse of both, and only then `getUserMedia`. So the first frame
sat behind ~130 kB of code and a device call.

| Item | Status | Where |
| --- | --- | --- |
| The camera's chunks are fetched in the browser's idle gap while the screen is being read | DONE | `features/camera/warm.ts`, called by `ChatPage` and `ConvoPage` |
| Hover, keyboard focus and touch on the camera button / menu row fetch the chunk on intent | DONE | the beat before the tap, the same rule the shell's tab prefetch uses |
| A failed warm is silent — the real `lazy()` import gets to try again and to fail where somebody is waiting | DONE | `warmCamera` clears its own promise |
| Metered and 2G connections are not warmed at all | DONE | same `saveData`/`effectiveType` rule as `useIdlePrefetch` |
| The convo's camera no longer draws `null` while its chunk arrives | DONE | a black sheet with a spinner and "Opening the camera…", so the tap is acknowledged |
| No camera, microphone or frame of anybody's face is asked for early | DONE | warming downloads a module and nothing else; `getUserMedia` still runs only inside the mounted component |

The convo *list* already had a real fallback, so it only needed the warming.

**Not changed, on purpose:** the first `getUserMedia` still asks for video *and*
audio in one call. Splitting it would show the preview sooner but would either
prompt for the microphone a second time (risking a silent clip) or quietly
record clips with no sound. A faster wrong answer is not a fix.

### 2. The stickers were not the app's stickers

This was the real find. `app/lib/editor/stickers.dart` reads the shelf from **our
sticker service** (`https://sticker.gaongram.in/api`) first and falls back to our
own `/api/v1/stickers/` only when that service refuses — *"that is where the
stickers are added now and it holds far more of them"*. The web read only our own
server, so it drew a different and much shorter list than the phone does.

Measured from this machine on 2026-11-02: the service answers **381** stickers
(`total: 381, matched: 381`), and it sends
`access-control-allow-origin: *`, so a browser can ask it directly with no token
and no proxy. Its pictures are Cloudinary URLs which also answer
`access-control-allow-origin: *`, so a sticker drawn on the editor's canvas keeps
the canvas untainted and the composed picture still uploads.

| Item | Status | Where |
| --- | --- | --- |
| The shelf is read from the sticker service first, paged 100 at a time up to 1000, and kept for the session | DONE | `stickersService.shelf()` |
| Our own server's shelf is the fallback when the service refuses or comes back empty, and a refusal is remembered for the session | DONE | the app's own rule, `_farDown` |
| An own-server row and a service row are both mapped to one shape (the service's name is its first tag, else its pack's name) | DONE | `shelfRowFromService`, `shelfRowFromOwn` |
| Every typed word has to land somewhere, so a second word narrows | DONE | `siftShelf`, the app's `Stickers.sift` |
| The editor's sticker sheet draws that shelf and has a search box that narrows it without a request per keystroke | DONE | `PhotoEditor.tsx` |
| A wide sticker is no longer stretched into a square | DONE | the row carries no width/height, so the box starts square and is corrected from the picture's own size |
| A convo can now send a sticker at all: **plus → Sticker** | DONE | `features/convo/StickerSheet.tsx`, the app's `_StickerPicker` |
| Comment and note pickers still read **our own server only** | DONE | `stickersService.list()` is unchanged; the app's `ownShelf: true` rule, because `_comment_sticker()` validates the id against our own rows |

**Fixed on the way past:** a sticker arriving from the phone drew
`"[object Object]"`. The web read `payload.sticker` as a string; the app's
payload is `{id, url, name}` and `chat.dart` sends it as an ordinary `text` line.
It is now drawn as the app draws it — the picture, 148 px, `object-contain` — and
a line with no address in it falls back to the words it already says. The web's
own invented `kind === "sticker"` was dropped from `isSharedMessage`, because it
marked a row bare and then drew nothing at all in it.

### 3. "All the songs" were not all the songs

`fetchAllAudioTracks` asked for `limit=100&page_size=100` and then looked for
`count`, `next` or `next_page` to walk the next page. `TrackListView`
(`backend/apps/audio/views.py:503`) has no cursor at all: it answers
`{tracks, query}` and slices to `min(limit, 500)` with a default of 200. So the
loop stopped after the first page and the picker held **100** songs where the
phone's own picker holds **200**.

| Item | Status | Where |
| --- | --- | --- |
| One ask for the server's own ceiling, `limit=500`, and no paging | DONE | `CATALOGUE_ASKS_FOR` in `PhotoEditor.tsx` |
| The dead `next`/`next_page`/`count` walk is gone rather than left to mislead | DONE | a comment records what the endpoint really answers |
| The home shelves are still the fallback when the catalogue read fails | DONE | unchanged |

The web now holds a superset of what the phone's picker does (the phone asks for
the default and never pages); neither can see past the server's own cap of 500.

### Also corrected

`Sticker.keywords` in `src/types/api.ts` was typed `string[]`. The column is a
`CharField` and the serializer sends the comma-separated string, so the type
described something the server never sends. It is `string` now. Nothing read it
before this pass; the shelf's search does.

### Checks at the end of this pass

```text
npx tsc -b                      PASS
npx eslint src --max-warnings=0 PASS
npm test                        52/52 PASS (8 files)
npm run build                   PASS in 3.64 s
```

Build output: entry 455.82 kB (143.12 kB gzip), `ChatPage` 99.95 kB
(26.38 kB gzip), `CameraCapture` 57.46 kB, `PhotoEditor` 76.44 kB, and the shared
chunk they both need 20.16 kB. No chunk-size advisory. `npm test` gained
`src/services/stickers.service.test.ts` — 11 cases over the two shelf shapes, the
search rule and the shelf list.

**Runtime status: NOT VERIFIED.** Every one of these was written against the
app's source, the backend's source and the live sticker service's own answers,
and all four checks pass. No signed-in browser run was possible in this
environment, so none of the following has been seen working: the camera opening
from the convo header, from the menu row or from the Spark row; a sticker
arriving from the phone and from this client; the editor's shelf filling with the
service's 381 stickers; and the audio sheet's "All" tab holding the full
catalogue. They are **NOT VERIFIED**, not "done".

### Read-only project check

`git -C xelvic status --short` reports exactly the same eight pre-existing entries
it reported before this pass — seven modified `app/` files and the untracked
`.tools/` — and **nothing at all under `backend/`**. No file outside
`xelvic-web/` was created, edited or deleted.

## Pass — The sound sheet's shelf, and the save that was never a route (2026-11-02, sixth round)

Reported: after the convo's camera opens a photo and the editor's sound sheet is
opened, it still shows only nine songs where the phone shows all of them, and
pressing Save does not save.

Both had one root cause and it was not a list that was too short. The sheet was
asking for **the wrong shelf**, and the bookmark was writing to **a route that
does not exist**.

### The shelf

`apps/audio/views.py:TrackListView` answers the *shipped catalogue* — the handful
of songs and episodes the app came with — unless it is asked for
`?source=drop`, which is the sounds people uploaded. The phone's picker
(`app/lib/screens/audio_picker.dart`) draws **no catalogue row on any of its
three chips**: `_uploads()` asks `source=drop`, `_trending()` keeps only rows
whose `source` is `drop`, and `_saved()` reads the account's own shelf. The
phone's own docstring says it outright, under the heading "What is on the
shelves": "Other people's uploads, and nothing else: the app's shipped
catalogue is not a chip and not a search result. Ten tracks the app came with
sat at the head of 'All audio' beside sounds real people had made, and the list
read as an inventory rather than somebody's music — worse, a song off it is one
nobody can put on a clip and be heard."

This sheet asked `GET /audio/tracks/` with no `source` at all, took the
catalogue, and — when that read came back empty — fell back to the Audio tab's
own `recent`/`podcasts`/`hero`, which is a **different list still**. It is the
same shape of fault the sticker sheet had: two shelves that look alike, and the
client reading the one the phone does not.

Which of those two lists the reported nine rows came from is not established from
here, and it is not load-bearing. The catalogue explanation is the better fit of
the two: the phone's own docstring puts the shipped catalogue at ten tracks, and
the local seed ships six rows, either of which reads as the short list that was
reported, while the Audio tab's `recent`/`podcasts`/`hero` would not naturally
land on nine. What the code settles is that the sheet could not have been drawing
uploads, because it never asked for them — and that the fallback is gone.

### The save

`PhotoEditor.tsx` had the row's bookmark writing two different places and
neither of them the right one: a catalogue row went to
`POST /audio/tracks/{id}/like/`, which is the **heart** and feeds a different
list, and an uploaded sound went to `POST /drops/{id}/save/` — which is not a
route in `apps/drops/urls.py` or anywhere else in this backend. So Save on a
sound somebody had posted answered **404 every time**, and the toast under it was
a lie about a write that never happened. `apps/saved/views.py` is the whole of
how anything gets onto the shelf: `POST /saved/` with `{kind, id, on}`, where
`kind` is `drop` or `track`.

The rest of this client already knew that — `DropCard`, `DropMenu` and
`VibeViewer` all go through `hooks/useSaved.ts` and `store/saved.ts`, whose own
header documents this exact mistake being fixed once before. The editor was the
last caller of `dropsService.save`, and it is gone.

### What changed

- New `src/features/audio/audioShelf.ts`: `fetchUploads` (`source=drop`,
  `limit=60` — the phone's `kPickerRows`), `boardUploads` (the week's chart with
  every non-`drop` row dropped), `keptToTrack` (a saved thing as a sound, the
  phone's `SavedThing.audio`), and `rowToTrack`. Pure and testable, which is why
  they are not in the component.
- `src/features/camera/PhotoEditor.tsx`: one loader per chip instead of one
  loader plus a fallback; the search asks the uploads shelf whichever chip is lit
  (the phone's rule); the carousel is the list's own first four rows rather than
  the tab's `hero` pinned above a different list; the row's bookmark is
  `useSaved.toggle(savedKindOfSound(row), row.id)`; a failed read says so instead
  of drawing a stand-in; an empty shelf says "Nothing here yet." and a failed
  search says `Nothing matched "x".` — the phone's own two sentences.
- `src/features/camera/PhotoEditor.tsx`: the home payload's loading flag no
  longer shares state with the search spinner, and the Trending chip waits for
  the board's read rather than drawing an empty week over an ask in flight.
- `src/store/saved.ts`: `savedKindOfSound`, the app's `AudioTrack.savedKind`.
- `src/types/api.ts`: `Track` gained `source`, `artist_id` and `artist_avatar` —
  all three are on every row `TrackListView` sends and none was declared.
- Deleted from the editor: `fetchAllAudioTracks`, `findAudioTrack`, `sameTrack`,
  `trackKey`, `streamTrackId`, `streamDropId`, `likeCandidates`, `rememberSaved`,
  `toggleTrackLike`, and the `likedTracks`/`likeBusy`/`savedTracks`/`savedLoading`
  state. All of it existed only to make a bookmark work against the wrong
  endpoint.
- Deleted `dropsService.save` and `DropSaveResponse` from
  `src/services/drops.service.ts`, with a comment in their place saying why the
  method is deliberately absent. The editor was its last caller, and a `save`
  sitting next to `like` and `hide` — same shape, same base, no such route — is
  how the wrong address got written the first time and would get written again.
  `POST /saved/` through `store/saved.ts` is the only road onto the shelf, and
  that is where the comment points.

### Checks at the end of this pass

```text
npx tsc -b                      PASS
npx eslint src --max-warnings=0 PASS
npm test                        62/62 PASS (9 files)
npm run build                   PASS in 4.22 s
```

Build output, from the run recorded last: entry 455.61 kB (143.08 kB gzip),
stylesheet 122.06 kB (`dist/assets/index-09GKHmfh.css`), `ChatPage` 99.88 kB,
`SettingsPage` 125.30 kB, `PhotoEditor` 74.61 kB, `CameraCapture` 57.46 kB,
`MomentViewer` 42.97 kB, `warm` 20.11 kB. The build time and the byte counts move
by a fraction between runs; these are the numbers off the final one, taken after
the dead `dropsService.save` below was deleted.
`npm test` gained `src/features/audio/audioShelf.test.ts` — 10 cases over the
three shelves, the `source` filter and the saved-thing conversion.

**Runtime status: NOT VERIFIED.** The shelf names, the route and the field names
were all read out of `apps/audio/views.py`, `apps/audio/services.py`,
`apps/saved/views.py` and `app/lib/screens/audio_picker.dart`, and all four
checks pass. No signed-in browser run was possible in this environment, so
**neither** of these has been seen working: the sound sheet drawing the uploads
shelf with more rows than the catalogue had, and Save filing a sound on the shelf
and it coming back under the Saved chip. They are **NOT VERIFIED**, not "done".

### Read-only project check

`git -C xelvic status --short` reports exactly the same eight pre-existing entries
it reported before this pass — seven modified `app/` files and the untracked
`.tools/` — and **nothing at all under `backend/`**. No file outside
`xelvic-web/` was created, edited or deleted.

## Pass — The part-length pill opens a menu, and it holds the other six lengths (2026-11-02, seventh round)

Reported: in "Choose a part", pressing the seconds button should open a
**dropdown**, and what it opened instead was a bar of its own.

That ask found a second thing behind it. The sheet's grid offered six lengths —
ten to thirty-five seconds, in fives — while the phone offers **eleven**:
`_WindowViewState._durationSeconds` is `[10, 15, 20, 25, 30, 35, 40, 45, 50, 55,
60]` (`app/lib/screens/audio_picker.dart`). So a forty-second part could not be
asked for at all on the web, and no amount of rearranging the six would have
fixed it.

### What changed

- New `src/features/audio/partLength.ts`: the list (`PART_LENGTHS_MS`, the
  phone's eleven) and `placePartMenu`, the arithmetic that decides where the menu
  goes. Both are pure, which is why neither is inside the editor.
- New `src/features/audio/partLengthMenu.tsx`: the menu, portalled to the body
  at `z-[210]` so the scrolling sheet it is opened from cannot clip it. It hangs
  off the pill's own measured rect, follows the pill while the sheet scrolls, and
  opens **upwards** when the room above is the better side — which, for a pill at
  the foot of a bottom sheet, is always.
- `PhotoEditor.tsx`: the portal bottom sheet is gone from that slot; the pill
  carries `aria-haspopup="menu"` / `aria-expanded` and opens the menu. The sheet
  heading and the `10s`…`60s` labels are the phone's own words.
- The start–end readout stopped being a button. The phone draws it as a plain
  pill (`_readout`) — no gesture on it at all — and on the web **both** pills
  opened the same chooser, so the line had two controls for one question. It is a
  `div` now, and the length pill is the only control on the line.

### Checks at the end of this pass

```text
npx tsc -b                      PASS
npx eslint src --max-warnings=0 PASS
npm test                        71/71 PASS (10 files)
npm run build                   PASS in 4.56 s
```

`npm test` gained `src/features/audio/partLength.test.ts`, 9 cases: the list is
the phone's eleven and holds the six that were missing; the menu opens up above a
foot-of-sheet pill with the full list, opens down when there is more room below,
stops at both window edges instead of hanging off them, grows no wider than the
longest label, takes the taller side and scrolls when neither fits, and is never
shorter than one row.

### Runtime status: NOT VERIFIED

The menu's own behaviour — that it draws above the pill, that it follows the
sheet's scroll, that a pick moves the frame — has not been watched in a browser.
The placement arithmetic is covered by the tests above and the list is the
phone's, read off `audio_picker.dart`; the rest is unverified.

### A deviation, named

The phone opens a **modal bottom sheet** here with the eleven choices in a
horizontal scroll of chips; this is a menu anchored to the pill instead, because
that is what was asked for. It is the one deliberate difference in this control.
Everything else about it — the list, the labels, the wording of the heading, the
readout being inert — is the phone's.

### Read-only project check

Unchanged: the same eight pre-existing entries, nothing under `backend/`, and no
file outside `xelvic-web/` created, edited or deleted.

## Pass — The feed's options stated once, and one scroll lock for four overlays (2026-11-02, eighth round)

Two reports, both of them a thing that was already built working badly.

### The error: `options.getNextPageParam is not a function`

Reported as intermittent on the drops feed, and never on a feed that had just
been opened. It is not a library bug: `infiniteQueryBehavior.js` calls
`options.getNextPageParam(...)` unguarded for every page after the first, and the
options it reads are the **query's** — `Query.fetch(options)` calls
`setOptions(options)` when it is given any, and `setOptions` *replaces* rather
than merges (`this.options = { ...this.#defaultOptions, ...options }`).

The one place in `src/` that stated an infinite query without that option was
`src/routes/prefetchData.ts`: its two drops prefetches used the page's key, the
page's first ask, and no page rule. It stays harmless until three things are
true at once — the prefetch actually re-reads (so the cached feed must be older
than the prefetch's `staleTime`), the feed holds more than one page (so the page
rule is reached), and an invalidate follows on a feed that is being read
(`invalidateQueries({ queryKey: ["drops"] })` → `refetchQueries` →
`query.fetch(void 0, …)`, which uses the query's options). Like, keep, comment,
hide and report all invalidate that key.

Reproduced before it was fixed, from the old shape, in a throwaway test: the
query went to `status: "error"` with exactly `options.getNextPageParam is not a
function`, and to `status: "success"` with the rule stated. The throwaway file
was deleted.

### What changed

- New `src/features/drops/feedQueries.ts` — `dropsFeedQuery` and
  `dropsVibesQuery` hold the key, the fetch, `initialPageParam`,
  `getNextPageParam` and the freshness, in one object each.
- `src/pages/DropsPage.tsx` reads those objects; `src/routes/prefetchData.ts`
  warms them through the same objects. The `onRemoved` patch writes to
  `dropsFeedQuery.queryKey` too, so not even the key is spelled twice.
- The stale window is the page's 60 s for both readers (the prefetcher warmed on
  30 s): the page treats an answer under a minute old as the answer, so warming
  a query the page will read as fresh is the point, and re-reading behind it is
  the waste the shorter window was buying.
- The file's docstring no longer promises that a drift here costs "a wasted
  request, never a wrong answer". That was the assumption the bug lived in.

### The scroll that never came back

Reported as: coming to the drops page from another page, the page does not
scroll; refreshing fixes it.

`document.body.style.overflow = "hidden"` is the whole of this app's page lock —
the document is the scroller, `AppShell`'s `main` only grows — and four overlays
wrote it as save/restore pairs: `Modal`, `src/features/drops/VibeViewer.tsx`,
`src/features/moments/MomentViewer.tsx` and the Spark viewer in
`src/pages/ChatPage.tsx`. Save/restore strands the lock in two everyday orders:
two overlays where the first closes before the second (the second restores
`hidden` onto a page with nothing on it), and an effect that re-runs while
another overlay is open (its cleanup writes back the value read before that
overlay opened, and adopts `hidden` as its own original). Both viewers re-run by
design — their effects depend on the clip or moment on screen and on their own
sheets — so the second order is not a corner.

- New `src/utils/scrollLock.ts`: `lockScroll()` reads the original once, at the
  first lock, writes it back once, at the last release, and hands back an
  idempotent release. A re-run in the middle changes nothing.
- All four sites take it. `grep -rn "style.overflow" src/` now finds no writer
  outside that one file.
- The convo's Spark viewer was locking more than it drew. It is mounted for the
  length of a convo and handed an empty run while no Spark is open, and its
  effect locked on mount — so a convo page held `overflow: hidden` whether or not
  a Spark was ever opened, which is a lock held by nothing on screen and exactly
  the sort of value the save/restore pairs handed on to the next page. The lock
  is now taken only while a run is open.
- The same component kept the walk's position across runs (`at` outlived a run
  because it is never unmounted): leave a two-look run at index 1 and open a
  one-look run, and it drew nothing — a tap that did nothing, which is the one
  thing this build is not allowed to ship. The position resets with the run, as
  do the reply draft and the sent mark.

### Checks at the end of this pass

```text
npx tsc -b                       PASS
npx eslint src --max-warnings=0  PASS
npm test                         80/80 PASS (12 files)
npm run build                    PASS in 5.79 s
```

Entry chunk 455.68 kB (143.11 kB gzip); stylesheet 122.08 kB, Tailwind's output
over a source tree no `.css` file of which was edited; the convo chunk 99.87 kB.

`npm test` gained `src/features/drops/feedQueries.test.ts` (3 cases: the rule is
on both shelves, a cursor becomes a path, and a two-page feed survives an
invalidate) and `src/utils/scrollLock.test.ts` (6 cases: release, two overlays
out of order, a re-run over a second overlay, an original value that is not
empty, a double release, no document).

### Runtime status: NOT VERIFIED

Neither fix has been watched in a signed-in browser. Both were reasoned from the
installed `@tanstack/query-core` source and are pinned by the tests above — and
the error itself was reproduced in Node against the old shape, which is
measurement rather than argument — but "the feed no longer throws after a
prefetch" and "a page arrived at from another page scrolls" are still
`NOT VERIFIED`. The two Spark-viewer defects are worse off than that: they were
read out of the code, not reproduced at all.

### Read-only project check

Unchanged: the same eight pre-existing entries, nothing under `backend/`, and no
file outside `xelvic-web/` created, edited or deleted.

## Pass — One surface for the camera's editor (2026-11-02, ninth round)

Reported: *"photo editor me jaise audio ka background aur text color hai waise hi
text aur sticker aur other tabs ka kijiye"*.

### The split that was there

The editor answered to two grammars. `--card` is `#ffffff` on the default theme,
so the Audio sheet, the "Choose a part" sheet and the Tag sheet have been white
sheets with near-black words, while the Sticker sheet was `bg-[#15151d]` with
white words and every panel that floats over the picture — Filter, Text, Draw,
Cut out, Crop, Aura, the layer bar — was `bg-[#171316]/95` with white words. The
audio tool's own strip was the odd one even among those: `bg-[#171316]/15` at
`rounded-lg`, against everyone else's 95% at `rounded-[22px]`.

### What changed

- `PANEL`, `CHIP`, `CHIP_OFF` and `CHIP_ON` are named once at the top of
  `PhotoEditor.tsx`, and every tool panel, every control on one and the sticker
  sheet read them. A surface restated per panel is a surface that drifts — the
  same shape of mistake as the eighth round's two copies of one query's options.
  The Audio sheet's own tab row now reads `CHIP_ON`/`CHIP_OFF` too, so the pair
  is provably the audio sheet's.
- The current tab is marked the way the audio sheet marks it — accent with
  `text-on-accent` — in the text panel's sub-tool row and the sticker sheet's
  Mention/Link/Time/Place row. Both used a brighter grey before, which on the
  dark panels was the only thing available.
- `inkOn()` (in `editorTypes.ts`, beside the palettes it is about) picks the ink
  for the pills that are painted in the colour they choose — Background and
  Outline. "White" was a near-white pill with white words on it in *every* theme
  before this pass; the panel's ink made the other eight the same way.

### The two deliberate subtractions

- The text field no longer writes its own words in the chosen colour. The palette
  opens on `#ffffff` and ends at `#111111`, so no single ground lets both be read
  — on a light panel the first is an empty-looking field, on a dark one the
  second is. The colour is the dot at the head of the field; the words are the
  theme's ink; and what the words will really look like is on the picture under
  the panel. This is the only change here a user could read as a loss.
- `inkOn` splits on luma at 0.5, which is a heuristic, not a WCAG measurement.
  Two of the palette's values (`#4da3ff` at 0.594, `#b36cff` at 0.524) sit near
  it.

### What did not change, on purpose

The controls that sit *on* the photograph — the header's close/undo/next pills,
the crop's dim and corner handles, the frame tool's zoom row and fill/fit chip,
the AudioArt glyph, the posting veil. Words over a picture need a scrim or a
shadow, and the theme cannot know what is behind them. The comment over the
constants says so.

The phone's own editor is charcoal in every tool's panel, so this pass is a
divergence from it rather than parity — recorded as one in
`XELVIC_FEATURE_PARITY_MATRIX.md`. Three of the web's four sheets had already
chosen the theme, and the user asked for the rest to follow them.

### Checks at the end of this pass

```text
npx tsc -b                       PASS
npx eslint src --max-warnings=0  PASS
npm test                         85/85 PASS (12 files)
npm run build                    PASS in 5.80 s
```

Entry chunk 455.68 kB (143.12 kB gzip); stylesheet 121.96 kB, down from 122.08 kB
because the eight hardcoded colours this pass removed were Tailwind arbitrary
values and no longer exist to be generated; the picture editor's chunk 76.20 kB,
down from 76.55 kB. The build was re-run after the last source edit and produced
the same chunk hashes, so these are the committed source's sizes and not an
earlier draft's.

`npm test` gained five cases in `src/features/camera/editorTypes.test.ts` for
`inkOn`: the two extremes, the panel-as-ground values, the translucent ends, the
white-plate/black-plate regression, and every plate in the row answering with a
definite ink.

### Runtime status: NOT VERIFIED

Nothing here was seen rendered. The pass is class names in one file and the suite
is `environment: "node"` — it does not render a component — so the four checks
prove it compiles, lints and bundles and nothing more. The light default theme,
which is where the two grammars were most visible, is exactly the state no run in
this environment can show. No contrast checker was run over the plate row or the
accent-filled tab.

### Read-only project check

Unchanged: the same eight pre-existing entries, nothing under `backend/`, and no
file outside `xelvic-web/` created, edited or deleted.

## Pass — The convo list's line, its count, and the Spark a row opens (2026-11-03, tenth round)

Reported: *"convo ke userlist me abhi sab kuch exact app ke jaisa nahi hai jaise
user name ke neeche galat data aa raha hai aur spark icon par click karne par
kuch aur open ho raha hai jabki app me spark ka modal show hota hai us user ke
related aur abhi unread count aa raha hai jab ki app me unread count dusare way
se hai username ke neeche hi"*.

### The line under a name

The app's rule, from `home.dart::listLine`: **never the message itself** — a chat
list is read over your shoulder. The web printed `preview.text` with a `You:`
prefix, a stub word per attachment (`Photo`, `A drop`), `Waiting for them`, and
`N new messages`. It now prints the phone's four answers, in its order: the
invitation (`Say something`) when there is nothing in it — ahead of any count —
then my own line's receipt word, then `N new` (no noun), then `Nothing new`. A
convo with myself keeps its own line (`Convo with yourself` or my receipt).

`lineTone` reads the colour off the words on screen rather than off the receipt
behind them, so a run of theirs cannot draw `Nothing new` in the accent.

### The count

`unread_count` was an accent circle at the far right of every row, `99+` clamped.
It is now the phone's shape: `N new` in the line under the name, and a plate at
the end of the name on group rows only — a one-to-one is one other voice and
already says how much of it is unread. The right-hand corner holds no count at
all any more.

The Unread lane also learned the phone's `convoInUnread`: a convo whose only
waiting line is a Spark stays off it (`inUnreadLane`, off `unread_other_count`,
with a missing key read as the old answer).

### The Spark

The chip navigated to `/app/sparks` — the wallet, a different question. It now
opens `SparkSheet`, a port of `screens/spark.dart`: ring, figure, worn awards,
both 48-hour clocks, the closing sentence, the broken and hidden banners, the
buy-back offer with its price and deadline, the next rung, the seven-rung
ladder, the hide switch and the rules. The sheet draws the row's copy at once,
refines it from `GET /sparks/threads/<id>/`, and counts down off the dates the
payload already carried. `setOff` and `restore` are the phone's two writes on
endpoints that already existed.

`src/features/sparks/model.ts` is the port of `sparks.dart`'s value layer — the
ladder, what a run wears, the two clocks, the offer, the figure — and is the
only place the awards' names and colours live.

### The rest of the marks row

The pin disc and the birthday cake, in the phone's order, plus its own gaps
(3 px timer→spark, 7 px spark→clock) and its 3 px bar inset 14 px rather than a
7 px rule down the edge. The birthday rule moved into one module
(`src/features/profile/birthday.ts`) and the two profile pages read it instead of
keeping their own copy; `UserCard` gained the `birthday` field the server has
been sending all along.

### Not done, and named

The play button (a run opened from the row needs the convo's own viewer, which
lives in `ChatPage`) and the sheet's "Add to Moments" pill (no spark-moment
composer here). Both are `NOT IMPLEMENTED` in `XELVIC_FINAL_GAP_REPORT.md`.
*(The pill was drawn in the eleventh round — see the pass below. The play button
still stands.)*

### Checks at the end of this pass

```text
npx tsc -b                       PASS
npx eslint src --max-warnings=0  PASS
npm test                        112/112 PASS (14 files)
npm run build                    PASS in 4.33 s
```

Entry chunk 456.05 kB (143.23 kB gzip); stylesheet 125.89 kB, up from 121.96 kB
for the new row's marks and the sheet; `ConvoLayout` (the row and the sparks
model) 86.91 kB, the convo 99.87 kB.

`npm test` gained 27 cases: `src/features/sparks/model.test.ts` (18),
`src/features/profile/birthday.test.ts` (6) and 6 more in
`src/features/convo/model.test.ts` (`listLine`'s seven answers,
`threadUnreadOther`/`inUnreadLane`).

### Runtime status: NOT VERIFIED

Nothing was seen rendered — the suite is `environment: "node"` — and the sheet's
live behaviour (the refresh read, the tick, the hide switch, the restore) has
never run against a server. The three routes were confirmed by reading
`backend/apps/sparks/urls.py`; the buy-back, the only write here that spends,
was not executed.

### Read-only project check

Unchanged: the same eight pre-existing entries, nothing under `backend/`, and no
file outside `xelvic-web/` created, edited or deleted. `home.dart`, `birthday.dart`
and the three backend files were read and not written to.

## Pass — The Spark card, and "Add to Moments" (2026-11-04, eleventh round)

Asked: *"please sparksheet me dekhiye wo sab kuch sahi hai isme jo app me hai
jaise ki add to moments button, please ise add kijiye"* — audit the sheet against
the phone's, and add the "Add to Moments" button it was missing.

### What the sheet gained

The tenth round drew the next rung's sentence alone. The sheet now draws the
phone's own `_comingUp()` row: that sentence, and the stadium pill beside it
(`Sparkles` 15 px, 12.5 px w700, `h12/v7`, `color-mix(accent 12%)` ground, accent
ink) — on **every** run the sheet can draw, broken and not-started included,
because the phone draws it on every run. Its tap opens the card page over the
sheet rather than navigating; when a moment goes up, the page and the sheet
behind it both close, which is the phone's arrangement.

### The card (`src/features/sparks/card.ts`)

A port of `spark_moment.dart`'s painter — the same reasoning the phone records:
the card is a **picture** by the time it leaves, so what the person sees is the
bytes that go up, not a drawing somebody else's client has to know how to make.
1080×1920 page, an 840×1520 card at left 120 / top 248 (the band a phone's crop
leaves, nudged 48 px below the middle), corner 64, paper = the award's colour at
10 % over white, fixed ink. On it: the flame in the award's colour, the two
curves with a chat mark and a call mark sitting on them at t=0.30 and t=0.62,
both faces with their names and the list's green dot, the ring with the award's
glyph, the award's name in caps, the days, the rule and the closing line between
a sparkle and a heart. Nothing is themed; the award is the one the run is *on*
(`headAward`), so a card never shows a flame for a Blaze. The glyphs are
`lucide-react`'s own path data written out by hand, so the picture keeps the
client's one icon language; faces come through `utils/mediaCache.ts` or fall back
to initials. The fallback is not decoration: a public media address comes back
from that cache untouched, and a cross-origin face drawn plainly taints the
canvas and loses the whole card (see **The card that was tainted**).

`SPARK_CARD_STYLES` is `["classic", "midnight", "sunset", "aurora", "noir"]` and
`randomSparkCardStyle()` picks one uniformly, so the sheet's card is a different
look on a different week without anything on the page choosing it. `classic` is
the phone's card and the only one the phone has (see **The four looks after the
first card**).

### The page (`src/features/sparks/SparkMoment.tsx`)

The phone's page in three parts: the card at the size it will be posted, the two
questions before the share, and one button. The header pill is the same
`AudienceSheet` the moment composers use; the switch names the other person in
the item's `mentions` (on by default — a run is a thing two people keep). The
picture drawn on the screen *is* the file that will upload: painted once per
opening, encoded once, shown back through an object URL. The share is
`uploadAsset(card)` → `POST /moments/`, and the success line is said only after
the server has taken it.

Who the switch names follows the phone's own two-step rule, read off the
`["sparks"]` cache and never fetched (`src/features/sparks/moment.ts`): the run's
own `other` first, so a page opened before the list has loaded still knows who it
is about, then the one live run this account keeps — and only when there is
exactly one, because two live runs have no honest default and a guessed name is
somebody's name in front of a thing that was not about them. A hidden run does
not count and the answer is never me. The card's second face takes the phone's
title fallback too (`widget.them ?? SparkFace(name: widget.title)`), through a
narrow `CardFace` type: a card reads a name and a photo and nothing else, and the
row behind the page sometimes knows only the name.

### The sound row — drawn 2026-11-05

**The phone's sound row** — "Add audio", its own window into the sound ("Choose
part") and a way to take it off — was `NOT IMPLEMENTED` until this round, on the
reasoning that a row opening nothing is a button that does nothing. What was
missing was not the row but the picker behind it, and the answer was to stop
having two of them: the whole "which part of this file plays" concern was lifted
out of the camera into `src/features/audio/` — `SoundPicker` (the three shelves
and search, the sheet the composer's audio tool already opened), `PartChooser`
(the drag surface), `audioWindow.ts` (how long a part a post needs), `soundBits`
(the sleeve and the readings of a row) and `preview.ts` (who started the
audition, so a sheet closing over somebody else's music leaves it alone).
`PhotoEditor` now imports them back, which is what the phone does: `audio_bits`
and `audio_picker` hold the one implementation every surface reads.

The row itself is `_soundRow()` ported: a music note and "Add audio" until there
is one, and then a tinted row with the sound's name, the window as
`soundWindowLabel`, "Choose a part" and an ✕. A card is one picture, so the part
offered is the one-picture thirty seconds (`momentSoundSpan()`), and "Choose a
part" re-opens the chooser over the window already chosen — the phone's own rule
that re-cutting cannot quietly hand back a longer piece.

Two things worth naming, and neither is a claim of parity. **This row has not
been looked at in a browser** — the shared sheets were built and read, not seen,
and the row is JSX against the phone's own numbers rather than a diff against a
phone's rendering. And **nothing has been posted with a sound from this client** —
the fields are the ones the server has accepted since before the page existed
(`sound`, `sound_start_ms`, `sound_end_ms` on `PostItemSerializer`), confirmed by
reading it, but no authenticated session exists in this environment, so the write
is `NOT VERIFIED`. The row's play button still stands as `NOT IMPLEMENTED`.

**The card's words are English only** — the phone reads them from
`strings/en.dart` (the days in their plural forms, `BROKEN`, the closing line),
so a Hindi phone draws a Hindi card; this client has no entries for them and the
painter takes no translator. And **my own face's green dot** comes from the
server's own answer for `me.online` rather than the phone's assumed `true`. Both
are named as differences, not claimed as parity.

### The card that was never drawn — fixed 2026-11-04

*"add moments par click karne ke baad jo modal open ho raha hai, usme card draw
nahi ho raha hai."* Real, and now fixed. `renderSparkCard` awaited three things
from outside itself with no bound: `document.fonts.ready`, my face, and the other
person's face. **A face whose bytes never arrive held the paint for ever** — the
modal opened on a spinner, the Share button stayed dead, and no sentence said
why. The phone has always bounded this (`Faces.patience`, fifteen seconds, added
for exactly this: *"a socket that has gone quiet without closing hands back
neither bytes nor an error"*); the port did not.

Two bounds now, in the phone's numbers: `FACE_PATIENCE_MS` = 15 s for each face
and `FONT_PATIENCE_MS` = 2 s for the font, through `within(work, ms)` — a bound on
*waiting*, never on the fetch, so a read shared with the rest of the screen still
fills the media cache. After the bound the card paints without that face, in the
initials plate the list itself uses. Measured in a browser before and after: the
same silent face went from **never painted** to **painted at 15 400 ms**, and a
face with no photo at all paints at 401 ms.

### The card that was tainted — fixed 2026-11-04

The bound above stopped the spinner and did not make the card: the page then said
*"Could not draw that card just now."* The painter was throwing, not waiting.

A public media address — a CDN or storage host, which is how avatars arrive on
this backend — is not a path this API serves, so `loadMedia` returns it
**untouched** (`if (!isBackendMediaPath(pathname)) return absolute`) instead of
reading bytes. An avatar already on screen is therefore cached as its own
`https://…` address, `peekMedia` hands that back, `faceImage` drew it, and a
cross-origin picture drawn without `crossOrigin` **taints** the canvas — which
`toBlob` refuses:

```text
Uncaught SecurityError: Failed to execute 'toBlob' on 'HTMLCanvasElement':
Tainted canvases may not be exported.
```

Measured in Chrome (one PNG, a second local origin, no CORS header): plain draw →
`TAINTED`, `toBlob` throws; the same URL with `crossOrigin="anonymous"` at a host
sending `access-control-allow-origin` → clean, 588 bytes. `faceImage` now sets
the attribute on any `http(s)` address, so a host that will not answer is a face
that did not come — initials, and a card that posts.

Three smaller holes closed in the same pass: the doc comment that promised a
fallback the code skipped whenever the cache had an answer; a name that is not a
string (now `nameOf`, read as nothing and drawn as initials); and a picture that
loads and then will not draw (caught around `drawImage`). And behind those, one
**retry** on a fresh canvas with neither picture before the page may say it could
not draw — `renderSparkCard` over `paintOnce`, which took `card.test.ts` from 17
cases to 21. The page also prints the reason under the sentence on a dev build
and logs it always.

### The four looks after the first card — 2026-11-05

*"ab charo naye moments spark cards ka design jaise image me dikh raha hai exact
waisa design kijiye, jo kewal naye wale card hai unka design karna hai aur ek jo
pahla card tha uske design me kuch bhi changes nahi chahiye."*

The four styles (`midnight`, `sunset`, `aurora`, `noir`) existed as names and as
thin alternate compositions that were invented here, not drawn from anything.
They were replaced with the composition the design sheet actually carries. **That
first replacement did not match the sheet either, and was itself replaced on
2026-11-05 — see the section below.**

**What the sheet is.** Four cards, one spark, on a near-flat lavender board. It
is 1199×1312, so every card in it is 4:5 and not the 840×1520 (a hair over 5:9)
the real card box is. Nothing could be lifted at pixel scale; what was lifted is
the *composition*. Read off the sheet by measuring it (a pure-stdlib PNG decoder
run with `-I` over the file, plus colour-band and connected-shape probes) and by
Windows' own OCR for the words:

- one skeleton under all four — two faces with names at the top, the motif at
  norm. y ≈ 0.40–0.44, the award's name at ≈ 0.65, the days at ≈ 0.75, the
  closing line at ≈ 0.88;
- a **violet pill behind the days** on every one of the four, and on three of
  them a second pill behind the closing line;
- grounds measured: TL `#F4F1FB`, TR `#201040` (a dark navy-violet, the only
  dark card), BL `#F3F2FB`, BR `#F1EAFB`;
- no brand wordmark anywhere on a card.

**The names are a judgement, and are recorded as one.** The sheet has no labels.
`sunset` was read as the top-left card (a filled disc — a sun — over a horizon
hairline), `midnight` as the top-right (the only dark ground), `noir` as the
bottom-left (the palest ground, a hard ring, deep marks) and `aurora` as the
bottom-right (the diagonal wave — ribbons of light). This is design reasoning
over a measured composition, not something the sheet states.

**What was drawn, round one — superseded.** The four were first put on the
classic skeleton with one flat ornament each: a sun of four concentric discs for
`sunset`, four discs and seven stars for `midnight`, three bezier ribbons for
`aurora`, and a low wash with diagonal hairlines and a rule for `noir`. That
version was **rejected**: none of the four read as the sheet's card. The
individual ornaments were inventions, not readings, and the cards came out as
flat pale paper with faint marks on it.

## 2026-11-05 — the four looks rebuilt against measurements of the sheet

*"jaise ki aap pahle 4 images me dekh sakte hai ko koi bhi card exact design ka
nahi hai jaise 5th image me cards ka design hai, please exact design kijiye."*

The first attempt failed for a structural reason that the earlier measurements
had missed: the sheet's cards are **not** bare paper with an ornament on them.
They are a near-white *field* — `#F8F5FE`, the commonest colour on all three
light cards — with the award's tone collecting along the left and right edges,
and a dense, mostly opaque motif at the centre. Against that, a flat pale ground
with a thin concentric ornament could never look like the sheet.

**How it was verified this time.** The earlier rounds painted blind. For this
round a throwaway harness (`harness.ts` outside the repo, bundled by `rolldown`
against the repository's own `card.ts`) paints all five looks into real canvases
in headless Chrome, and the resulting 1080×1920-per-card sheet is cropped to
each card box by arithmetic and read back with a pure-stdlib PNG decoder. Two
probes came out of it: `ascii.py`, which draws a picture as text by how far each
cell is from the ground — enough to see where a shape starts and stops — and
`patch.py`, which asks two differently-sized crops the same question so a sheet
crop and my own render can be compared on the same rectangle. There is no vision
model on this machine any more (`qwen2.5vl:7b` is gone; the two installed
models are text-only), so this is the whole of the feedback channel.

**What was rebuilt.** `lookField` lays the `#F8F5FE` field and the edge tone.
`styleDecorations` draws the motif in four branches, each now an opaque body
inside a halo of flat steps rather than a stack of concentric rings. `wave`,
`contours`, `tiltedSlab`, `iconButton`, `dashedRing`, `ellipse`, `ellipseRing`,
`softEllipse`, `disc`, `cloud`, `rocketMark` and the `ROCKET_BODY` /
`VIDEO_GLYPH` glyphs are new flat-shape helpers for it.

| look | ground | motif |
| --- | --- | --- |
| `sunset` | `#F4F1FC` field `#F8F5FE` | a planet: an opaque lavender body `blendOverWhite(award, 0.3)` inside a three-step halo, an orbit ring at 356×128 turned −0.34 with a rocket riding it, four sparkles, and a foot of tone one whole period across the card with its trough in the middle |
| `midnight` | `#241548` (the only dark card) | a night sky: four glow discs, a moon at radius 204 with a halo at 274, a dashed exhaust trail and a rocket climbing off it in `palette.ink`, eight stars, two shooting stars, and two clouds at the foot |
| `aurora` | `#F3F2FC` field `#F8F5FE` | a run still going: an outer ring at 386, a dashed segmented ring at 268, four round icon buttons at ±286 carrying the chat/heart/call/video glyphs, and one hairline riding a shallow water line |
| `noir` | `#F1EAFB` field `#F8F5FE` | a stack of three tilted rounded slabs, 420–432 px on a side and most of the card's width, each with a rim, over a six-row contour bed |

**Three defects the render loop found, and what was done about them.**

1. `aurora`'s ring was **invisible** — `awardRing` drew its track in
   `palette.track` (`#EFEAF2`), which is the first card's track for white paper
   and is almost the same value as the new field. `awardRing` now takes a track
   colour, and the three pale looks pass `fade(award.colour, 0.24–0.3)`.
2. `noir`'s stack was a third of the width the sheet's is. The slabs went from
   300 px at ±42/±46 to 420–432 px at ±96/+104 and gained rims, because without
   a rim three stacked tints read as one wash.
3. The foot of every pale look was a **flat full-width stripe**, where the sheet
   draws tone that climbs the two edges and dips through the middle. The foot is
   now `wave(..., wavelength = card width, phase = −π/2)`, which is exactly that.

A fourth fix was not cosmetic: the pinned test *"leaves the first card's own
painting exactly as it was"* failed, because `lookField` laid the `#F8F5FE` field
on `classic` as well. **The first card's paper had been changed to `#F8F5FE`.**
`lookField` now returns early for `classic` as well as `midnight`, and the
classic card measures `#FFFFFF` again. This is the second time that test has
earned its place.

Two decorations were also **removed** because the sheet does not have them: a
pair of `laurel` branches either side of the award's name (they rendered as a
tall bracket of leaves that the sheet's cards have no counterpart for), and the
`quadraticPoint` helper that only the laurel used.

**No gradients anywhere.** The house rule holds in the ornament as it holds
everywhere else (`birthday.dart`: *"No gradients, ever."*). What the sheet draws
as a glow is a stack of flat ellipses a step of alpha apart, and the night's
light is a flat `rgba()` at a fixed lift — `washOf` — and never
`createRadialGradient`. **This is the one place the result knowingly differs
from the sheet**: the sheet's softness is smooth and this file's is stepped.
Given the house rule, a stepped approximation is the closest honest match.

**The first card was not touched.** `classic` returns from `lookField` and from
`styleDecorations` without drawing anything, takes no `countSlab`, takes no
footer slab, keeps its white paper, its own ink, its `fade(award.colour, 0.18)`
outline, and its whole `twoOfUs` + `flame` + `rung` branch byte for byte. That is
held by a test rather than by care: the classic card's list of fills, in draw
order, is pinned as a literal 20-element array, so a slab or an ornament that
ever leaks into the first card fails the suite.

**What is measured and what is not.** The motif region (rows 30–60 %, columns
25–72 % of each card) now reads within about 4 % of its sheet counterpart on all
four: `sunset` `#D0C4F2` against the sheet's `#D9C6FA`, `midnight` `#B8ADD5`
against `#C3ADE8`, `aurora` `#E6DEF9` against `#E0D4F9`, `noir` `#DAD0F4`
against `#D7C7F3`. The compositions were checked shape by shape in text and
match the sheet's: two faces at the top, the motif at 26–60 %, the award's name
in dark ink, the days on a pill, the closing line, and tone at the two edges.

**What is not verified.** No card of any style has been *seen*; they have only
been rasterised and measured. Measuring is not looking, and a colour average can
be right while a shape is wrong. The sheet's cards are 4:5 and the real box is
840×1520, so the composition is adapted and is not a pixel-exact copy. And the
mapping of the four *names* onto the four cards is still a judgement the sheet
does not state (see above).

### Checks at the end of the four looks

```text
npx tsc -b                       PASS
npx eslint .                     PASS
npm test                        144/144 PASS (16 files)
npm run build                    PASS (5.28 s)
```

Entry chunk 456.11 kB (143.23 kB gzip) and stylesheet 127.50 kB, both unchanged —
the four looks added no CSS. `SparkMoment`'s chunk, which carries the painter,
went from 15.71 kB (6.88 kB gzip) to **20.26 kB (8.24 kB gzip)**: the four looks
and their ornament cost 4.55 kB raw (1.36 kB gzip). That is the price of drawing
four compositions rather than one, and it is paid only by a sheet whose "Add to
Moments" is tapped.

`src/features/sparks/card.test.ts` went from 21 cases to 26: a second recording
canvas that remembers what each shape was painted *in* (its fill, its stroke,
its rounded corners, its words), and five cases over it — each look has the
ground the sheet gave it, each draws two slabs and the first card none, the dark
card's words are the light and the others' are the app's ink, all five still draw
both people and the award, and the first card's fills are the pinned 20. The
second recorder resets its corner count at the end of every `fill`/`stroke`
because `glyph()` fills from a `Path2D` and walks no path of its own.

**What is not claimed:** the sheet was read by measurement, not by eye — this
session cannot see an image, so the composition, the grounds, the pill and the
motif of each card are measured facts, and the mapping of the four *names* onto
the four cards is the judgement recorded above. The count beneath the warning
sheet is 4:5 against the card's 5:9, so the design is a faithful adaptation of
the measured composition and not a pixel-exact copy. The four looks are
`NOT VERIFIED` in a browser: nothing here can render the canvas, so no card of
any style has been looked at on this machine, and **no card at all has been seen
on a phone**, where the four looks have no counterpart to compare against.

### Checks at the end of this pass

```text
npx tsc -b                       PASS
npx eslint src --max-warnings=0  PASS
npm test                        138/138 PASS (16 files)
npm run build                    PASS (3.5–4.6 s run to run)
```

Entry chunk 456.11 kB (143.24 kB gzip); stylesheet 127.50 kB. `ConvoLayout`
90.57 kB, `SparkMoment` 15.71 kB (6.88 kB gzip) as its own lazy chunk — it was
14.22 kB when first built; the bounds, the CORS ask, the fallbacks and the
retry cost 1.49 kB raw between them.

`npm test` gained 26 cases over two files. `src/features/sparks/card.test.ts`
(21) — the page's two geometry facts, the paper's blend, the award rule
(including the run that broke after a Century, and the fallback for a key this
build cannot read), the days' words, two whole cards walked end to end against a
recording canvas (one plain, one whose `drawImage` throws), a name that is not a
string, the glyph table's coverage of the ladder, the four that hold the bounds,
and the two that count the retry. `src/features/sparks/moment.test.ts` (5) — the
two-step mention rule and its three silences.

### Three things were looked at

The painter was run in a real browser on this machine — a throwaway page, the dev
server, and headless Chrome; the PNG came out with the award's paper, the white
card, the flame, `BLAZE`, `12 days`, the closing line, both names and the two
initials plates. Then, in the pass that fixed the fault above, the same throwaway
page was pointed at **`SparkMoment` itself** — mounted in `StrictMode` with the
real `Modal`, the real stylesheet and the real Manrope face behind it, and with
the tab's media routes answered by the dev server so a face could be made fast,
slow or silent. Chrome cannot be asked for its DOM after real seconds have
passed, so the page reported itself to the server and the paint was timed:

```text
face=hang     (accepted, never answered)   painted at 15 400 ms   ← was: never
face=slow     (bytes after six seconds)    painted at  6 410 ms
face=nothing  (nobody has a photo)         painted at    401 ms
face=fast     (bytes in hand)              painted at    410 ms
```

The third, once the taint was understood, was a single PNG on a second local
origin with no CORS header — drawn plainly (canvas `TAINTED`, `toBlob` throws
`SecurityError`) and then with `crossOrigin="anonymous"` at a host sending
`access-control-allow-origin` (clean, 588 bytes). That pair is the whole cause
of the second fault on two lines.

All of those pieces — both pages, the stub sessions, the log, the second origin
and the dev server — were removed afterwards and nothing of them is in the tree.
None of the runs signed in, so none says anything about a real avatar from this
API or a real post.

### Runtime status: NOT VERIFIED

The composer has never posted. `uploadAsset` and `POST /moments/` were read from
the contract and matched against the phone's `postMomentNow`, but there is no
authenticated session here, so no moment was created, no refusal was seen and
nothing in the rail was watched appear. The card was ported by reading the
phone's painter; it has not been diffed against a phone's own rendering. The
sheet's live behaviour (the refresh read, the tick, the hide switch, the restore)
remains unexercised from the tenth round.

### Read-only project check

Unchanged: the same eight pre-existing entries, nothing under `backend/`, and no
file outside `xelvic-web/` created, edited or deleted. `spark_moment.dart` and
`faces.dart` (for `Faces.patience`, the number the bounds are taken from) were
read and not written to.

---

## The calls — drawn 2026-11-06

**The ask.** *"jaise app me audio aur video call chal rha hai waise hi isme bhi
kijiye"* — the same calls the phone makes, in the browser.

**What was there before.** Two buttons in a convo's header and one on every
call-log row, all three of which said *"Calls are not on the web yet"*. Honest,
and the whole of the feature.

**What the server already had.** Everything. `apps/calls` owns the call, the
seats and the history; `apps/chat/consumers.py` relays every frame over the one
authenticated socket the web already holds; `GET /api/v1/calls/ice/` hands back
exactly the `{iceServers: […]}` shape `new RTCPeerConnection()` wants. Not one
line of the backend was read as something to change, and none was changed.

### What was built

| Piece | What it is |
| --- | --- |
| `src/services/calls.service.ts` | `history()` (already there), plus `ice()` and `detail(id)` — the relay's address, and one call read back for the people in it |
| `src/features/calls/model.ts` | The decisions that need no browser: the five phases, who is on a call, the goodbye line, `offersAfterCollision` — the rule that says which end starts again when two offers cross |
| `src/features/calls/engine.ts` | `RTCPeerConnection`, `getUserMedia`, the candidate queue, the glare rule, the `ref`/ack dance, and the nine events — the client half of `app/lib/calls.dart`'s protocol |
| `src/providers/CallProvider.tsx` | One engine for the tab, the frame subscription, `call.pending` when the socket returns or the tab comes to the front, `GET /calls/<id>/` to resync a call the socket slept through |
| `src/features/calls/CallOverlay.tsx` | The screen: dialling, ringing, live (video tiles and a self view, or faces and a clock), the goodbye, and mute / camera / hang-up / accept / decline |
| `src/pages/ChatPage.tsx`, `src/pages/ConvoPage.tsx` | The three buttons, no longer toasts |

### The rules that were ported rather than invented

- **Who offers.** The people already in the call offer to whoever arrives; the
  newcomer only answers. Both ends cannot offer at once, so the handshake has
  one direction.
- **A camera is a second reason to offer**, which means two offers can now
  cross. Both are thrown away, the connection is rebuilt, and the end with the
  higher id offers again — a rule both ends reach the same answer to alone, and
  opposite answers to each other. The end that gives way records what it still
  owed and offers again when the answer lands.
- **Candidates wait.** A candidate can arrive before the description it belongs
  to; adding one early rejects, and a rejection in an ICE callback is a call
  that connects to nothing. They queue until there is a remote description.
- **Who is rung at all.** The frame carries the server's own `reachable` beside
  `online`, so a dialling screen can say *Offline* about a phone in a pocket
  instead of leaving somebody listening to a ring that will not be answered.
- **A ring is given up on both ends**, on the server's own `ring_seconds`, so
  the two ends cannot disagree about how long a ring lasts.

### Honest gaps

- No ringtone and no vibration. A ring is a screen here.
- No answering from a system notification: the overlay is the answer.
- No earpiece/speaker switch and no camera flip — the browser offers no route
  control, and a facing-mode switch would need the camera re-asked. Nothing is
  drawn for either, so nothing pretends.
- `call.add` is not sent by this client: a group call that already exists is
  drawn as a grid, but nobody can be brought into one from the web.
- Room sound is still not here. A room's stage is a `Call` too, and the room
  page was not part of this pass.

### Runtime status: NOT VERIFIED

No backend was reachable from here and there is no second device and no
microphone, so **not one frame of this has been seen against a real server**.
What *is* verified is the half that can be: the state machine — an incoming
ring, a second ring refused while on a call, a party frame for somebody else's
call refused, a crossed goodbye ignored, a seat marked left, the first reason
for an ending kept, a ring running out on the server's clock, a request said
again when the socket comes up, a goodbye held when it could not be said — is
covered by 42 tests in `model.test.ts` and `engine.test.ts`, all passing under
`environment: "node"` with fake timers. The `RTCPeerConnection` half is covered
by nothing but reading, because the test environment has no browser in it.

### Read-only project check

Unchanged: the same eight pre-existing entries, nothing under `backend/`, and no
file outside `xelvic-web/` created, edited or deleted. Read and not written to
this round: `app/lib/calls.dart`, `app/lib/screens/call_bits.dart`,
`backend/apps/calls/{urls,views,services}.py`, `backend/apps/chat/consumers.py`,
`backend/apps/chat/events.py`.

## Round 18 — the ring, the notice, the camera, the layout, and a room's sound (2026-11-06)

**The ask.** The calls were drawn but blunt: they did not ring, they could not be
answered from anywhere but the screen, the picture was asked for at 1280x720 with
no guidance for the encoder, the layout did not fit a phone, and a room's stage
still carried no voices. This round answers all of it.

### What was built

| Piece | What it is |
| --- | --- |
| `src/features/calls/ring.ts` | the ringtone and the vibration — the app's own `public/ringtone/call.wav`, preloaded when the socket comes up, else a written Web Audio tone (22 cases) |
| `src/features/calls/notice.ts`, `public/call-sw.js` | the browser notification: one post per ringing call, Decline and Accept drawn by a worker with no fetch handler that feeds the press back into the engine (8 cases) |
| `src/features/calls/quality.ts` | 1920x1080 at 30 fps with a 640x480 floor, `maintain-resolution`, a bitrate from the picture's size, `contentHint`, the device list, and the `getStats` pill (30 cases) |
| `src/features/calls/CallOverlay.tsx` | rebuilt: `object-contain` with a fit/fill toggle, spotlight and grid, a draggable clamped self-view, fullscreen, and the tool row |
| `src/features/rooms/{mesh,stage,useRoomStage,RoomSoundView}`, `src/features/media/surfaces.tsx` | a room's sound, carried over the same relay an ordinary call uses (mesh, 21 cases) |
| `CallEngine.ignoreCall(callId)` | a room's stage is a call, so the room page names its call and the engine refuses to answer it on the 1:1 screen |

### The rules that were ported rather than invented

- **Who offers, on the stage.** `whoOffers` compares ids by code unit exactly as
  the phone's `compareTo` does, so both ends of a pair always reach the same
  answer; a listener, whom the stage has never heard of, always offers.
- **A signal that cannot be read is dropped, not thrown on.** `readSignal` returns
  null for anything unrecognised, because an exception inside an ICE callback is a
  connection that quietly never completes.
- **Nothing here renegotiates.** A change to who is on the stage rebuilds the pair
  rather than renegotiating it, and a connection marked failed is repaired the
  same way.
- **A listener opens no microphone** and names receive-only lines rather than
  sending nothing at all.

### Honest gaps

- The backend carries the stage plus its first 8 listeners (`MEDIA_LISTENERS`); a
  listener past that is still in the room and is simply not sent anything, and the
  page says so. The web holds its own copy of that number because no route reports
  it.
- No earpiece/speaker route switch — the browser offers no such control, and
  nothing is drawn for it. `call.add` is still not sent, so a group call can be
  drawn from the web but not started there.
- The ringtone is the app's own recording served **from this build**; it is not a
  system ring, and a browser that refuses audio gets a screen that says so.

### Runtime status: NOT VERIFIED

No backend was reachable from here, there is no second device, no microphone, no
camera, no vibrator and no real notification surface, so **not one of the six has
been seen working**. What is verified is the arithmetic and the state: the new
tests are `ring.test.ts` (22 cases), `notice.test.ts` (8), `quality.test.ts` (30)
and `mesh.test.ts` (21), and the whole suite is 275/275 PASS across 23 files under
`environment: "node"` with fake timers. The mesh's arithmetic is exactly that —
arithmetic — because the mesh itself has never connected to anything.

### Read-only project check

Unchanged: the same eight pre-existing entries, nothing under `backend/`, and no
file outside `xelvic-web/` created, edited or deleted. Read and not written to this
round: `app/lib/stage.dart` — the phone's mesh: who connects to whom, when a
listener is let go of, how a rebuild is decided — and `backend/apps/spaces/services.py`
(`MEDIA_LISTENERS = 8`, `_hears`, `room_row(..., media=True)`, `_go_live`,
`_sync_call`).

## Round 19 — the mirror, the cards that fit, and Vibes in the feed (2026-11-06)

**The ask.** Three of the owner's own reports and one omission: *"video me jo video
ban raha hai wo ulta ban raha hai aur phone me sahi hai"* (the picture was mirrored
when the phone would not mirror it), *"jo card video aur post ka ban raha hai wo
pure screen ke andar hi aaye screen se bahar na jaye jaise instagram me hai"* (a
card's picture could ask for a box taller than the screen), and a feed that never
carried a Vibe although the server states a `vibe_share` and the phone weaves one.
The first two are complete as code and `NOT VERIFIED`; the weave is complete as
code and `NOT VERIFIED live`; and the round's own limits are named `NOT
IMPLEMENTED` rather than left implicit.

### What was built

| Piece | What it is |
| --- | --- |
| `src/features/calls/engine.ts` | a `Facing` and a `mirrored` flag on the snapshot; `mirrored()` (own choice, else `facing !== "environment"`), `toggleMirror()`, `readFacing(track)` from `openCamera()` / `openDevice()`, both fields reset in `closeMedia()` |
| `src/features/calls/CallOverlay.tsx` | the self picture drawn `mirror={!call.sharing && call.mirrored}` and a **Mirror** pill after **Flip camera** |
| `src/features/rooms/{stage,useRoomStage,RoomSoundView}`, `src/pages/RoomPage.tsx` | the same rule and the same button on a room's own tile; the stage exposes `toggleMirror` |
| `src/features/drops/frame.ts` | the card's box: a clip capped at `62dvh` (the phone's `tallClipShare`), a still drawn at the poster's shape up to four-to-five, and `width: 100%` written outright in both so the box keeps the card's width and the ceiling takes the height. Rewritten 2026-11-06 after the owner's screenshot: the first version narrowed a still, which is the phone's rule and is invisible on a phone but left a strip of photograph in the middle of a wide card |
| `src/features/drops/DropCard.tsx` | `frameBox(drop.ratio, clip)` for the frame and the same box handed to the veil; an optional `onOpen` that waits out the 220 ms double-press window |
| `src/features/drops/SensitiveVeil.tsx`, `VibeViewer.tsx`, `src/styles/index.css`, `PollBlock.tsx` | `max-h-[78dvh]`; the walk as `fixed inset-x-0 top-0 h-[100dvh]`; `body` to `100dvh` with `overflow-x: clip`; `break-words` on an answer |
| `src/features/drops/mix.ts` | a whole port of `mixedFeed` / `_mixSlots` / `shelfOrder` / `shelfKey`, plus `mixPerBlock`, `filledWithVibes`, `RAIL_CLIPS = 10`, `railClips` — the strip's own rule, with its exclusion bounded to the feed's first block — and `walkOf`, which puts a clip the shelf has never held in front of it |
| `src/features/drops/model.ts` | `dropIsClip` — the app's own clip test, asked by the card (draw the clip?) and by the page (hand the card a door?), so the two halves cannot disagree |
| `src/features/drops/reco.ts` | each row's own `kind` (`drop` or `vibe`, as `Reco.served` writes it) rather than `vibe` for whatever was handed in |
| `src/features/drops/mix.test.ts`, `frame.test.ts`, `model.test.ts` | the phone's own weave over plain values, six cases for the strip, five for the walk's list, four for the box and four for the clip rule |
| `src/pages/DropsPage.tsx`, `src/types/api.ts` | `vibe_share` read off the feed's first page; the rail of ten; the weave; the fill past the rail; `Page<T>` gained `vibe_share?` |
| `src/features/drops/EditDrop.tsx`, `MomentDropCard.tsx` | the `?edit=<id>` link reads the drop route first and the Vibe route second; a `previewPath` naming a route that does not exist is deleted |

### The rules that were ported rather than invented

- **Only the front lens is mirrored.** `app/lib/calls.dart`'s `_selfMirrored` is
  the rule; the web mirrored unconditionally. The web's `mirrored()` now answers a
  person's own choice when they have made one and otherwise `facing !==
  "environment"`, with the facing read off the track's own `facingMode`. *(The
  "own choice" half was removed the same day — see Round 20, where the button was
  turned round to the pictures arriving and `mirrored()` became the lens alone.)*
- **The card's ceiling is the phone's own number.** `tallClipShare = 0.62` for a
  single clip, from `app/lib/screens/drops.dart`; a clip is cropped down to the
  ceiling. The phone answers the same ceiling for a photograph by *narrowing*,
  because there the whole picture survives it — the box loses about a tenth of its
  width on a 390-point card. On a wide, short browser window the same rule costs two
  thirds of the width, so the web fills the card and crops instead, at the poster's
  shape up to four-to-five. The difference and the report that made it are written
  out in `src/features/drops/frame.ts`.
- **The strip's exclusion reaches one screen, not the whole feed.** The app drops
  every clip the feed is drawing from the rail; a browser holds every page the
  reader has scrolled to, so eight clips against two scrolled pages emptied the
  strip and took the section off the page — the owner's report of 2026-11-06 — and
  the exclusion here stops at the feed's first block.
- **The weave is a share per block, not a coin toss.** `mixSlots` is a partial
  Fisher–Yates over ten slots, so a page of ten carries its `vibe_share` exactly —
  four clips at forty per cent, two at twenty — rather than each slot rolling its
  own dice.
- **The hash is masked to thirty-two bits, so the multiply is `Math.imul`.** The
  phone's `int` holds the whole product before masking; a JavaScript number does
  not, and an FNV-1a hash that drifts is a shelf in a different order on each
  platform.
- **A clip in the feed opens the walk, whether it is a Vibe or a video.** The
  app's `DropVideo.onOpen` is `isVibe ? openVibe : _openFrame`, and `_openFrame`
  is `openClip`, which is `openVibe` — the 2026-10-19 report *"agar drop sirf
  single video hai to ... vibe pe play hona chahiye"* is why `openClip` is not a
  screen of its own. A plain video is not on the shelf, so it is carried in front
  of it (`walkOf`), which is the phone's `Drops.it.carry`: the walk opens on the
  clip under the thumb and still has somewhere to swipe. A still is left alone,
  as the app leaves it.

### Honest gaps

- The mirror rule, the heights, the strip and the walk's door are all `NOT
  VERIFIED`: no device and no browser run was made and no live server was reached.
  A webcam that reports no `facingMode` at all falls back to mirrored, which is the
  honest default rather than a known-good one, and the `VibeViewer` height change
  is a reasoned fix with medium confidence, not a watched one.
- A Vibe still plays only its own `asset`. `recipe` and `clip_urls` are sent by the
  server and read by nothing, so a Vibe edited on the phone plays here as its first
  clip alone — no voiceover, no music lanes, no per-clip trim or speed, no overlays,
  no filter and no chosen frame shape. `NOT IMPLEMENTED`.
- No Vibe editor on the web: the composer posts `{asset, caption, music, mentions,
  sensitive}` and never sends `recipe`, `category`, `interests` or `track_id`, all
  of which the server accepts. `NOT IMPLEMENTED`.
- Play counts never move from the web: nothing calls `POST /drops/<id>/play/`
  (`app/lib/audio.dart:1975` does, on the phone), so a sound played in the browser
  does not advance `plays`. `NOT IMPLEMENTED`, a silent omission.
- `GET /drops/mine/` and `GET /drops/interests/` are unused, so there is no "my own
  posts" shelf and a post made here carries no interests and cannot be filed.
  `NOT IMPLEMENTED`.

### Runtime status: NOT VERIFIED

No device, no browser and no live server, so the mirror, the heights, the strip and
the walk's door are exercised nowhere it counts; the mix's arithmetic is covered by
the phone's own cases carried over into `mix.test.ts`, the clip rule by
`model.test.ts` and the card's box by `frame.test.ts`, and the whole suite is
307/307 PASS across 26 files with `npm run typecheck`, `npm run lint` and
`npm run build` all passing (entry chunk 507.29 kB / 158.29 kB gzip, up from
506.15 kB / 158.00 kB gzip). Each piece is recorded as its own honest word: the
mirror, the heights, the strip and the door are all `NOT VERIFIED`, and the weave
is `NOT VERIFIED live`.

### Read-only project check

Unchanged: the same eight pre-existing entries, nothing under `backend/`, and no
file outside `xelvic-web/` created, edited or deleted. Read and not written to this
round: `app/lib/calls.dart` (`_selfMirrored`), `app/lib/screens/drops.dart`
(`tallClipShare = 0.62`, the photograph's `0.78`), `app/lib/drops.dart`
(`mixedFeed`, `_mixSlots`, `shelfOrder`, `shelfKey`), `app/test/drops_mix_test.dart`
and `backend/apps/drops/services.py` (`feed_vibe_share`).

## Round 20 — the Mirror button, turned round (2026-11-06)

**The ask, in the owner's own words.** *"jo video call me mirror par click karne
par jo flip ho raha hai wo mere video card me raha hai jabki reciever user video
card me hona chahiye, please ise fix kijiye"*. Round 19's button did the opposite
of what was wanted: it overruled the self-view's own lens rule, so the one picture
on the screen that was already right was the one that turned over.

Asked which picture the button should turn, the owner chose **the other person's** —
the picture arriving here — with the self-view left on the phone's own rule.
Complete as code, `NOT VERIFIED`, and a deliberate divergence from the phone, which
has no such button at all.

### What was built

| Piece | What it is |
| --- | --- |
| `src/features/calls/engine.ts` | a `remoteMirrored` flag on the snapshot (`private remoteMirror`, false until pressed, cleared in `closeMedia()`); `toggleRemoteMirror()`; `mirrored()` reduced to `facing !== "environment"` — the hand-overrule removed with `toggleMirror()` |
| `src/features/calls/CallOverlay.tsx` | `RemoteTile` gained a `mirror?` prop handed to `VideoSurface`; all three sites (grid, spotlight, rail) pass `call.remoteMirrored`; the pill is active on `call.remoteMirrored` and waits for a picture to arrive rather than for this tab's own camera; `SelfView` unchanged at `mirror={!call.sharing && call.mirrored}` |
| `src/features/rooms/stage.ts` | `remoteMirrored` on `StageState` and in `IDLE`; `private remoteMirror`; `mirrored()` lens-only; `toggleMirror()` → `toggleRemoteMirror()`; the flag cleared in the room's own reset |
| `src/features/rooms/{useRoomStage,RoomSoundView}`, `src/pages/RoomPage.tsx` | the hook's `toggleRemoteMirror`; a tile draws `mirrored` for self and `remoteMirrored` for everybody else; the button is `aria-pressed={state.remoteMirrored}` with the same wait-for-a-picture guard |
| `src/features/calls/engine.test.ts` | three cases: the flag is false until pressed; the press sets it, publishes, and leaves this tab's own `mirrored` alone; the next call opens unflipped |

### The two rules this round is judged against

- **The phone mirrors its own tile and only its own tile.** `app/lib/screens/call.dart`
  draws `_mine` through `mirror: calls.selfMirrored` (front lens only) and every
  remote tile through `_feed(person, mirror = false)`; `app/lib/screens/room.dart`
  does the same with `mirror: person.id == mine && Stage.it.selfMirrored`. The
  self-view half of Round 19 is therefore kept, and the button is the new half.
- **A mirror is a display, not a transmission.** `VideoSurface`
  (`src/features/media/surfaces.tsx`) is the only place one is applied —
  `-scale-x-100` on a `<video>` element — and no track is ever transformed, so
  nothing this button does can reach another person's screen.

### Honest gaps

- **The flip was never watched.** No device and no browser run was made and no
  live server was reached: two ends on a real call is the only thing that can say
  the receiver's picture turns and the sender's does not. `NOT VERIFIED`.
- **The self-view can no longer be overruled by hand.** With the overrule gone, a
  webcam that reports no `facingMode` — most laptops — is drawn mirrored with no
  way to change it. This is a consequence of the owner's own choice of button, not
  an oversight, and it is named here rather than left to be found.
- **A remotely shared screen is turned over too.** A call frame carries no word for
  whether what is arriving is a camera or a screen, so there is nothing on this
  side to tell the two apart. `NOT IMPLEMENTED` — a per-stream distinction the
  server does not send.
- **The button is a divergence from the phone.** The phone has no Mirror button;
  this one exists because the owner asked for it, and it is `NOT VERIFIED` on a
  device.

### Runtime status: NOT VERIFIED

`npm run typecheck`, `npm run lint`, `npm test` (310/310 PASS across 26 files) and
`npm run build` all pass (entry chunk 507.43 kB / 158.33 kB gzip; stylesheet
133.89 kB). The three new cases cover the flag's default, the press that leaves
`mirrored` alone and the reset; the flip itself, on two ends, is exercised nowhere.

### Read-only project check

Unchanged: the same eight pre-existing entries, nothing under `backend/`, and no
file outside `xelvic-web/` created, edited or deleted. Read and not written to this
round: `app/lib/screens/call.dart` (`_mine`, `_feed`), `app/lib/calls.dart`
(`selfMirrored`), `app/lib/screens/room.dart` (`Stage.it.selfMirrored`).

## Round 21 — a shared screen shown whole, and a call that can be put aside (2026-11-06)

**The ask, in the owner's own words.** *"screen share wale me problem aa raha hai
jaise ki, main screen laptop me share kar raha hu aur koi apne mobile me dekh raha
hai to pura screen nahi dikh raha hai use kewal beech ka dikh raha hai"* and *"video
call karne par main video hata kar chat par aa raha hu aur call chal hi rahi hai to
phir main video call par nahi aa raha pa raha hu"*. Two separate faults: a shared
screen cropped to its middle on a viewer held upright, and no way to leave a call
screen and come back to it.

### What was built

| Piece | What it is |
| --- | --- |
| `src/features/calls/model.ts` | `sourceChanged(before, after)` and `SHAPE_SHIFT = 0.12` — whether the far end is now sending a different shape of picture, which is the only client-side word there is for "a screen appeared" |
| `src/features/calls/CallOverlay.tsx` | `fit`, `layout` and the focused seat reset when a call ends, so a **Fill** chosen once does not crop every later call; `remoteShapeChanged` returns the picture to **Fit** when the far end's frame changes shape; a **Minimize** pill and the small bar it swaps the screen for, with the picture, the clock, mute, camera and hang up, and `AudioSurface`s of its own so the sound survives |
| `src/features/calls/CallOverlay.tsx` | `RemoteTile` gained `onShape`, handed to the picture; a `MiniButton` for the bar's icon-only controls |
| `src/features/media/surfaces.tsx` | `VideoSurface` listens to the element's `resize` event as well as `loadedmetadata`, because a track replaced under a picture that is already playing — which is how a share starts — changes the frame without changing the stream |
| `src/features/calls/model.test.ts` | three cases for `sourceChanged`: a camera that keeps its frame, the 4:3-to-desktop switch in both directions, and a shape never yet measured |

### The two rules this round rests on

- **The crop was the viewer's own choice, kept too long.** `fit` was one piece of
  state in a component that lives as long as the tab, so Round 18's deliberate
  **Fill** control — added because the owner asked for a resize option — stayed on
  for every call after it. A choice belongs to the call it was made in.
- **A camera does not change its own frame mid-call.** That is what makes a shape
  change a truthful signal that the far end switched sources. It is a shape and not
  a word: a call frame carries no "this is a screen", and the relay accepts only
  offers, answers and candidates (`SIGNAL_TYPES` in `backend/apps/calls/services.py`),
  so there is nowhere to put one without changing the backend.

### Honest gaps

- **Neither fix was watched.** No device and no browser run was made: a shared
  screen seen on a phone, and a call minimized and picked up again, are the two
  things this round is for and neither was seen. `NOT VERIFIED`.
- **The shape rule is a heuristic.** A far end whose camera and shared screen have
  the same aspect ratio — 16:9 either way — produces no shape change, and the
  picture then stays at whatever the viewer last chose. The default after a call
  ends is Fit, so the next share is whole, but a **Fill** pressed during the same
  call still crops until the call ends.
- **The bar is not the phone's window.** The phone's small window is draggable and
  docks to an edge (`app/lib/screens/call_window.dart`); the web's bar is fixed to
  the bottom and is not draggable, and there is no third "hidden" size. `PARTIALLY
  COMPLETE`.
- **A reload still loses a live call.** After a page reload the engine has no
  `callId` and nothing in the read-only backend lists the calls this account is on
  (`calls.pending` answers only for rings), so a call that survives on the server
  cannot be rejoined from a fresh tab. `NOT IMPLEMENTED`, and named rather than
  implied.

### Runtime status: NOT VERIFIED

`npm run typecheck`, `npm run lint`, `npm test` (313/313 PASS across 26 files) and
`npm run build` all pass (entry chunk 510.67 kB / 158.99 kB gzip; stylesheet
134.30 kB). The three new cases pin the shape rule's arithmetic; the crop, the bar
and the return are exercised nowhere.

### Read-only project check

Unchanged: the same eight pre-existing entries, nothing under `backend/`, and no
file outside `xelvic-web/` created, edited or deleted. Read and not written to this
round: `app/lib/screens/call_window.dart` (the three sizes a phone gives a call) and
`backend/apps/calls/services.py` (`SIGNAL_TYPES`, the relay's own limit).

## Round 22 — the small call window is moved by hand (2026-11-06)

The owner's follow-up of the same day, about this round's predecessor: *"abhi video
call minimize karne par use drag aur drop nahi kar pa raha hoon chat screen me"*.
Round 21 gave a call somewhere to go and pinned that place to the bottom of the
screen in CSS; this round hands the place over to the person.

**New file, `src/features/calls/minibar.ts`.** The phone's rules from
`app/lib/screens/call_window.dart` (read, never written to), kept out of the
component because they own no DOM — `homeSpot`, `clampSpot` and `dockEdge` take
rectangles and return them. `WINDOW_GUTTER` is 12, the phone's own figure.

- `homeSpot` — the bottom right corner, 16 clear of the sides, and never off a
  screen too small to hold it.
- `clampSpot` — pulled back inside on every draw. The phone clamps every build for
  a reason worth keeping: a rotation or a resized window can leave a corner that
  was on the screen somewhere off it.
- `dockEdge` — the edge it was let go *into*, measured on the raw spot rather than
  the drawn one, because drawing is clamped and a clamped spot could never report
  a shove past the edge. "Into" and not "near", the phone's own argument: a
  floating window is held the gutter clear, so its edge can only be inside that
  gutter if somebody pushed it there.

**`CallOverlay.tsx`.** The bar is placed by `left`/`top` once it has been moved and
by its opening classes until then; a press is measured against the element's own
rectangle rather than against `miniSpot`, because until it has been moved it is CSS
that knows where it is. Pointer events on the bar with `setPointerCapture` after
`DRAG_SLOP = 6` pixels of travel, so the drag keeps following past the bar's own
rectangle and a slightly unsteady tap on the microphone still mutes. A drag that a
browser still turns into a click is stopped in the bar's capture-phase handler, so a
slipped finger cannot mute somebody. Docked, it draws a 28×64 tab at the edge it was
pushed into, at the height it was let go at, opened by a press rather than a drag —
the strip along a screen edge belongs to the browser's and the device's own back
gestures. The `<audio>` elements moved out of the window and beside it: folding the
window away must not take the call's voice with it. The bar's own size is measured
with a `ResizeObserver` (a video call carries a picture and a camera button an audio
call does not), the page's with a `resize` listener on the window and on
`visualViewport`, and `minibar.test.ts` carries eight cases.

**Named rather than hidden.** On a phone the bar fills almost the whole width, so it
rests already one gutter from both edges and comes back docked from the smallest
push; a test pins that cost instead of leaving it to be discovered. The phone's third
size — a call hidden to a single mark — is still `NOT IMPLEMENTED`, and so is
rejoining a call after a reload.

**Verified by the suite and by nothing else.** `npm run typecheck`, `npm run lint`,
`npm test` (321/321 PASS across 27 files) and `npm run build` all pass (entry chunk
514.54 kB / 159.90 kB gzip; stylesheet 134.52 kB). No browser run and no device run:
nothing was dragged, docked or pulled back on a real screen, so the whole round is
`NOT VERIFIED` where it counts.

**Read-only project check.** `app/lib/screens/call_window.dart` was read again and
not written to. Nothing outside `xelvic-web/` was created, edited or deleted.

## Round 23 — the emoji a message wears, and the mic that records (2026-11-11)

The owner's reports, in the order they came. Twice about **when** an emoji moves: *"abhi
emoji chatscreen me send karne par send ke baad aur hover par animate nahi kar raha hai,
please ise fix kijiye"*, then *"ye jo continue animate ho raha hai jabki send karne par aur
hover karne par animate hona chahiye"*. Then four about **what** it is drawn with, ending in
the instruction that closed the question: **"please dynamic emoji hata dijiye pahle jaise tha
waise hi kijiye jo google ka"**. Then, once the sets were settled, the panel itself, where the
same fault was worse because the whole grid moved at once: *"abhi input me jo plus hai usme
emoji par click karne par jo emoji panal open hota hai, usme emoji animate continue hote hi
rahte please ise aisa kijiye ki kewal hover karne par hi emoji animate kare"*. And last, sent
with a 94×194 crop of two pink bubbles: **"kisi kisi emoji me do do emoji aa raha hai ek hover
karne par animate hota hai aur ek nahi hota hai please ise fix kijiye jisse ek hi emoji aaye"**,
narrowed by himself a moment later — *"aur ye problem sabse jyada people & body wale me jyada
hai"*. The composer's mic, which had never recorded anything, was the round's other job.

**When an emoji may move, in `src/features/emoji/motion.ts`** — a file that owns no DOM, so
the rule is testable without a browser. The rule is one line and it is the pointer's:
**nothing moves for being on screen, a drawing moves while a pointer rests on it, and an emoji
inside a message also gets one pass when its message is sent or arrives** (`EmojiArt`'s
`burst`, fed by `src/features/convo/arrivals.ts`, which remembers the moment each message
arrived under either of its two names and forgets it after three seconds). Being in view
stopped being a reason to move and became only a condition: `wanted(inView, hovered)` still
asks, because nothing should play for something scrolled clean out of the page, but it is the
pointer that answers — for a tile in the picker and for an emoji in a sentence alike, which is
why the mode is no longer an argument. A consequence named rather than discovered: on a device
with no pointer that can rest — a phone, a tablet — the panel is still. `MOST_MOVING = 24`
players for the whole app, with a pointer allowed past the budget because the emoji somebody
has walked up to is the one that most deserves a place, and `giveBack` returning that place
only while the budget is actually overdrawn. `EmojiArt` keeps the guard the owner's first
report was about: a burst is not subject to the on-screen rule, because the observer's first
callback — "you are on screen", which is not a reason to move — stopped a burst that had only
just begun. `prefers-reduced-motion: reduce` plays nothing at all, and a hover does not
override it.

**Only Google's artwork is left, and none of the others is left dark.** Between the second and
the last of the owner's messages this round carried five resting looks — the device's font,
3moji (CC BY-SA 4.0), Fluent 3D, Fluent flat (MIT) and Google — plus a fourth candidate,
EmojiTwo (CC BY 4.0), measured and dropped before it was wired to anything. The last message
closed the question, so `looks.ts`, `fluent.ts`, `threed.ts`, `moji3d.ts`, `emojitwo.ts` and
their three test files are deleted, the `xelvic.emoji.look` key is gone from
`src/constants/storage.ts`, and the picker's Look chip and its five-drawing preview row are
gone with them. `EmojiArt` takes no look: Google's still, Google's animation over it, the
character underneath for the fourteen emoji Google draws nothing of.

**WhatsApp's artwork is the one thing that cannot be given, and it is named rather than
faked.** WhatsApp's emoji on an iPhone *are* Apple Color Emoji; Apple licenses that font for
Apple's own software and not for other people's websites, so this origin may not serve it. The
device's own font can be used, because it never leaves the device — which is why the
alternative-look work began there, and why the request that ended it (*"jo google ka"*) is the
one that could be honoured.

**The mic records now.** `src/features/convo/voicehold.ts` carries the phone's own numbers from
`app/lib/screens/chat_audio.dart` and `app/lib/screens/chat.dart`, and
`src/features/convo/useVoiceNote.ts` runs a `MediaRecorder` and an `AnalyserNode` over the same
stream — one loudness reading every 100 ms, into the 0–100 bar the phone sends
(`app/lib/media/recording_controller.dart`'s `_appendAmplitude` is that arithmetic, read and
not written to). The finished note goes out the door a picture already uses: `uploadAsset` with
`kind: "voice"` to `POST /chat/assets/`, then `chatService.send` with the asset's id, and the
length travels as the recording's own clock because a WebM/Opus element reports `Infinity`.

**The doubled emoji — `COMPLETE`, and the owner was right about where it hurt.** The character
layer at the bottom of `EmojiArt` was never hidden: Google's still sat over it, hiding most of
the machine's glyph, and on hover the still stepped aside for the animation whose figure is
thinner, leaving the glyph showing and still — the one drawing that did not move. `EmojiArt` now
derives `covered = drawn || animated` and fades the character out with `opacity-0` over the same
100 ms the still comes up in; `opacity` rather than `visibility` so a message's emoji stays
selectable and copyable. Measured in Chrome through the real `EmojiText`: character layer
`opacity: "0"` on all seven bubbles at rest and hovered, and forcing it back on — the old
rendering — changes **1,234 px at rest / 1,301 px hovered**, per emoji 😀 **0**, 👏 13, 👍 37,
✌️ 102, 🙏 132, 🙌 **189** (42px) and 761 for a 120px 🙏. That list is his *"sabse jyada people &
body"* measured: the face leaks nothing, the hands leak most. `hover-tiles.mjs` and
`emoji-text.mjs` were run again after the change and read exactly the same numbers, so nothing
else moved. What the fix does not claim: his picture showed two bubbles, which the code says are
two message rows, so whether he was looking at one doubled drawing or the same emoji said twice
is `NOT VERIFIED` — the doubling inside a drawing is what was found and fixed.

**Asked in a real browser, and live nowhere.** `google-only.mjs` mounted the real panel in
Chrome at the close of the round: Smileys drew 169 images, **all 169 from `fonts.gstatic.com`**,
none from jsDelivr and no Look chip in the panel; People & Body drew 386, all Google again.
`hover-tiles.mjs` then asked the panel the question the owner's last report was about, with
real `Input.dispatchMouseEvent` mouse moves and counting only Lottie's `<svg>` inside a tile's
stage span: pointer in a corner **`{"running":0,"drawn":169}`**, held on the grinning face
`{"running":1,"labels":["grinning face"]}`, pointer away `{"running":0}`, and the same one-up
one-down on heart eyes and on the smiling-open-mouth face. `emoji-text.mjs` asked the same of
the real `EmojiText`, driving `burst` through the same prop `ChatPage` uses: idle `running:0` →
hovered `1` → left `0` → burst `2` with no pointer anywhere → settled `0`. `voice.mjs`
recorded with Chrome's own fake microphone and produced a real 36,220-byte
`audio/mp4;codecs=mp4a.40.2` note of 2,195 ms with 19 bars, said *"Hold the mic to record — a
tap is too short to send."* for a 120 ms tap, and sent 35,113 bytes from a locked hold. But
**no live server was reached and nothing was done in the signed-in app**, so the upload of a
recording and the bubble that plays it back are `NOT VERIFIED`, and no emoji was ever seen
moving inside a real thread.

**Checks.** `npm run typecheck`, `npm run lint` and `npm run build` are clean; the suite is
**395 cases / 33 files PASS**, verified on `--pool=vmForks` four runs of four. The default pool
that `npm test` uses is **broken on this machine and not by this change**: all 33 suites die at
their first `describe` inside vitest's own worker bootstrap — *"failed to find the current
runner"* / `Cannot read properties of undefined (reading 'config')` — including suites with no
emoji in them, and it fails identically with `EmojiArt.tsx` reverted to its committed state
(33 of 33). It was passing earlier the same day until the previous round's build. Nothing in
`package.json` was changed to hide it; the workaround is `npx vitest run --pool=vmForks`.
Entry chunk 514.84 kB / 159.96 kB gzip, chat page 139.47 / 37.07, picker 97.73 / 24.83, and
`.transition-opacity`, `.duration-100` and `.opacity-0` are in the shipped stylesheet. The chat
page figure is measured over a working copy of `src/pages/ChatPage.tsx` that differs from the
last commit by 1,588 lines added and 523 removed, more than this round's own wiring, and is not
described here.

**Read-only project check.** `app/lib/screens/chat_audio.dart`, `app/lib/screens/chat.dart`,
`app/lib/media/recording_controller.dart`, and the backend's `apps/chat/services.py`,
`apps/chat/serializers.py` and `apps/chat/models.py` were read to confirm the recording's
numbers and the asset contract, and not written to. Nothing outside `xelvic-web/` was created,
edited or deleted.

## Round 24 — the plus menu's six rows, and a place that can be sent (2026-11-12)

The owner's request, and it names the rows: *"please ab convo ke chatscreen ke input me jo plus
par click karne par open hota hai, please usme photos and videos, file, Location, Spark, sticker
aur emoji ka option add kijiye"*. The menu had four (Photo or file, Sticker, Spark, Emoji) and has
six, in his order. Each one opens something that works.

**The menu — `COMPLETE (NOT VERIFIED)`.** Six `AttachRow`s in `src/pages/ChatPage.tsx`, one
written row shape rather than six copies of it, because six copies is six places for one of them
to drift: **Photos and videos** and **File** open two hidden inputs whose `accept` lists are the
old input's single list (`image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt`) cut in two at
the picture/file boundary; **Location** opens `LocationSheet`; **Spark** opens the camera and
warms its chunk on the way (hover, focus or a finger — the beat before the tap, which is what
`warmCamera` is for); **Sticker** opens the shelf; **Emoji** opens the panel. Measured in a real
browser against the real app: the six labels back in order with none disabled, and the two accept
lists as above. `chooseFile` is untouched, so the kind that travels is still the file's own.

**Location, end to end — `COMPLETE (NOT VERIFIED)`.** `src/features/convo/LocationSheet.tsx` is a
port of the phone's `app/lib/screens/place_sheet.dart`, *"the one door onto a place"*: the
browser's own fix at the top drawn with how sure it is, a search box under it for what the phone
cannot know, and the same two lookup functions behind both. `sendLocation` sends
`kind: "location"` with `{lat, lng, accuracy_m?}` in `payload` — no asset, because
`Message.Kind.LOCATION` is in `EMBED_KINDS` and not in `MEDIA_KINDS` in the backend's
`apps/chat/services.py` — and the receiving bubble already existed and was not touched. Measured:
the reverse-geocoded fix (`Shahid Major Kaustubh Rane flyover, Mumbai`, *Accurate to about 35 m*),
the same fix at 2,400 m (*Approximate — could be 2 km off*), a search for `Bandra` answering with
six real OpenStreetMap rows, the refusal line drawn when the browser will not say where it is
(*"This browser is not allowed to see where you are. A place can still be searched for above."*),
the footer enabling on a choice and closing on a send, and two `LOCATION` bubbles in the thread.
The three bodies put on the wire are recorded verbatim in `XELVIC_TESTING_REPORT.md`, Round 24 —
including a searched place travelling with **no `accuracy_m`**, because the browser never gave one.

**`src/utils/place.ts` is a move, not a second copy — `COMPLETE`.** `getJson`, `reversePlace`,
`searchPlaces` and `PlaceChoice` came out of `src/features/camera/CameraCapture.tsx` unchanged so
that the camera and the composer name a position the same way, and `myPlace` — the browser's
position folded into one of four refusals or a fix — sits beside them. `src/utils/place.test.ts`
pins the refusal vocabulary in 7 cases: no `navigator`, no geolocation, code 1 (`denied`, the one
a person can act on), code 3 (`timeout`), code 2 and an undefined code (`unavailable`), a fix no
geocoder can name (still a fix, labelled `19.0760, 72.8777`), and an accuracy the browser never
gave (`null`, not zero). The camera's own `findCurrentPlace` and its fallback are untouched.

**A row that was already missing, recorded rather than worked around.** The last commit's
`ChatPage.tsx` has a fifth row, **Ask the crowd**, behind a `PollComposer`. The working copy this
round edited does not — the panel it replaced held four rows — and `PollComposer`, `pollOpen` and
`sendPoll` are nowhere in the tree. Every session transcript on this machine was searched (115
files, subagents included): **no edit removed it.** So chat poll *creation* is
`NOT IMPLEMENTED` in the working copy — a gap against the last commit, **not** against the phone,
whose chat creates no polls either — while poll *answering* is intact (`PollMessage`, and
`vote()` → `chatService.vote`). Left as found: restoring somebody else's removal was not this
round's request, and whether that row returns as a seventh is the owner's call.

**Checks.** `npm run typecheck`, `npm run lint` and `npm run build` clean; the suite is **402
cases / 34 files PASS on plain `npm test`**. Round 23's broken-default-pool caveat is **not**
carried forward: the same `vitest run` that failed all 33 suites at their first `describe` on
2026-11-11 bootstrapped its workers again on this run with nothing changed in `package.json`,
`vitest.config.ts` or the tests. Chunks: entry 514.83 kB (159.97 gzip), chat page 141.86 (37.84)
against 139.50 (37.08) before, EmojiPicker 97.70 (24.86), `lottie_light` 169.07 (47.41), and
`place` 2.61 (1.18) as a shared chunk of its own.

**Not verified.** No server was reached and the live API was never contacted, so the location
message was never delivered: the send is verified as this client's request and its optimistic
bubble, with server acceptance read from the backend's own code and tests. The menu and the sheet
were measured with a mouse, not a finger. The web composer still cannot honour a room's media rule
(`channel_allows` on the phone; the web's `Channel` carries no rule) — pre-existing, named, not
fixed. A searched place has no accuracy, and a geocoder that is down draws "nothing by that name"
rather than an invented row.

**Read-only project check.** `app/lib/screens/place_sheet.dart`, `app/lib/screens/chat.dart` and
`app/lib/place_probe.dart` were read for the sheet this round ports and the phone's own attach
sheet, and the backend's `apps/chat/models.py` and `apps/chat/services.py` for the location kind.
None was written to. Nothing outside `xelvic-web/` was created, edited or deleted.

## Round 25 — the convo's Vibes, rebuilt on the Vibes screen's own clip (2026-11-12)

**The ask.** *"chatheader me jo vibes section hai please uska design fix kijiye aur usme like,
comment share aur save ka bhi option rakhiye aur abhi usme kewal followers ka hi videos aa raha
hai jabki sabhi ka aana chahiye aur jo jo drops ke vibe me wo sab kuch chatheader ke vibes me bhi
hona chahiye"* — four items: design, four rail actions, the shelf's reach, parity with the Drops
walk.

| Item | Status | Evidence |
|---|---|---|
| Panel design — clip + rail + caption + bar + player panel, no scrim | COMPLETE | `VibesPanel.tsx` rewritten; probe read the bar (`Close Vibes` / `Vibes` / `1 / 3` / `More`), the rail boxes and the caption |
| Felt on the panel's clip | COMPLETE | `POST /drops/vibes/<id>/like/ {"on": true}` recorded by the stub |
| Comments on the panel's clip | COMPLETE | sheet opened; `POST /drops/vibes/<id>/comments/ {"body": "from the vibes panel"}` recorded; panel survived the write |
| Share on the panel's clip | PARTIALLY COMPLETE | the share sheet opened on the panel's clip and drew *Send to Jaya* / *Another app* / *Copy a link*. **No share write was recorded**, because nothing was picked inside the sheet; the route the sheet posts to when a target is picked (`POST /drops/vibes/<id>/share/`) is read from `drops.service.ts`, not measured |
| Save on the panel's clip | COMPLETE | `POST /saved/ {"kind": "vibe", "id": "<id>", "on": true}`, glyph then `Saved`, `aria-pressed="true"` |
| Shelf reaches everybody | COMPLETE on the client | three strangers drawn from a shelf answered by three strangers; the only shelf request was `GET /drops/vibes/?limit=8`, no author or following parameter |
| Parity with the Drops walk | COMPLETE | one component (`features/drops/VibeSlide.tsx`) draws both; the walk's `VibeViewer.tsx` and the panel both render it |
| The door | COMPLETE | 40×40 `BUTTON`, `aria-label="Open Vibes"`, `aria-expanded`, accent tint while open — the 5 px strip is gone |
| Real-state copy on a real Vibe | PARTIALLY COMPLETE | rail/like/comment/share/save/player against a stub; a *played* real clip is **NOT VERIFIED** (the stub served a four-byte stand-in) |
| Live API behaviour | NOT VERIFIED | no live request was made; no real account was used |

**Files.** New: `src/features/drops/VibeSlide.tsx`, `src/features/convo/VibesPanel.tsx`.
Rewritten against the shared slide: `src/features/drops/VibeViewer.tsx`. Door:
`src/pages/ChatPage.tsx` (icon button before the ⋮). Nothing under `xelvic/` and nothing in
`xelvic-web/docs/` was touched.

**The hold bug, fixed in both screens.** The committed `VibeViewer.tsx` treated the browser's
release `click` as a tap, so a 500 ms hold opened the player and the release shut it. `onTap` now
returns when `longFired.current` is set; the probe's hold timeline went from `shut ×4, open …`
then shut, to `shut ×4, open ×6` — open and staying open.

**Why "only followers" is not this client.** `dropsVibesQuery` sends no author filter. The
read-only backend's `visible_vibes` is `Q(author=me) | Q(author__is_private=False) |
Q(author_id__in=following_ids(me))` plus block/mute/hidden/age/country/language and the reco lanes
behind off-by-default switches — there is no followers-only clause to remove. A shelf that looks
narrow on live is a property of the corpus the server deals, and the backend is read-only this
round.

**Checks.** `npx tsc -b` clean · `npx eslint .` clean · `npm test` 34 files / 402 tests passed ·
`npm run build` succeeded (`ChatPage` 148.38 kB / 39.73 gzip, `VibeSlide` 23.36 kB / 7.62 gzip,
entry 514.78 kB / 159.95 gzip; the >500 kB warning is pre-existing).

## Round 26 — the sticker sheet is the emoji picker's size, and every sticker one size (2026-11-12)

**The ask.** *"sticker me jo sticker panel open ho raha hai please us panel ka hight aur width exact
emoji panel ke jitna kijiye aur sticker panel jo stckers hai un sab ka size ek jaisa nahi hai, please
sabhi ka size ek jaisa kijiye, chota bada na dikhe"* — one box, and one size for every sticker.

| Item | Status | Evidence |
|---|---|---|
| The sticker sheet is the emoji picker's box | COMPLETE | measured in the running app: both **340 × 363**, rows **41 · 29 · 258 · 33**. The sheet was 340 × 339 with rows 41 · 264 · 32 |
| The box does not move with the network | COMPLETE | the missing title row was added, and the pack bar is now drawn even for a one-pack shelf — before, a one-pack shelf lost another 32 px |
| One file holds the box | COMPLETE | `src/components/ui/shelf.ts` — `SHELF`, `SHELF_SEARCH` (41), `SHELF_TITLE` (29), `SHELF_GRID` (`min(258px, 42vh)`), `SHELF_FOOTER` (33) — imported by **both** the picker and the sheet |
| The lazy-loading placeholder is the panel's size | COMPLETE | `ChatPage.tsx`'s Suspense fallback was `h-[320px] w-[350px]`; it is now built from the same four rows |
| Every sticker drawn at one size | COMPLETE | `src/components/media/StickerArt.tsx` measures each picture's **ink** by alpha scan and fits its longest visible edge to the 63 px box. Four stickers re-measured in the app: **63 × 52**, **63 × 37**, **63 × 42**, **63 × 56** — every longest edge 63 |
| The uneven sizes were real, and inside the files | COMPLETE (measured) | 90 stickers off the live catalogue: **49 carry a transparent margin**; ink between **775 and 3843 px²**, **22–63 px** tall; the worst (`image-removebg-preview (3)`, 512 × 279, ink 48% × 73%) was drawn **31 × 25** |
| Nothing cropped, nothing stretched | COMPLETE | only the transparent margin is taken up; a 1.86 : 1 sticker is still 1.86 : 1, drawn 63 × 34 |
| No second fetch for the measurement | COMPLETE | the canvas reads the `<img>` the grid already loaded — confirmed again in Round 27, where 602 cells cost exactly 602 requests |
| A host that refuses CORS is not a broken sticker | COMPLETE | retried **without** `crossorigin` and drawn the plain way; the catalogue's hosts answer `Access-Control-Allow-Origin: *`, so the measurement succeeds in practice |
| Real stickers off the live catalogue | COMPLETE | `ink.mjs` read the live catalogue; the sheet's own rows were drawn from the stub during the panel probes |
| The editor's own sticker shelf | NOT IMPLEMENTED — unchanged | `src/features/camera/PhotoEditor.tsx` still draws `size-full object-contain` with `loading="lazy"`, so it still shows uneven sizes and still loads lazily. Not touched, and not claimed |
| The phone's sticker sheet | NOT IMPLEMENTED — read-only | `app/lib/screens/chat_sticker.dart` uses a uniform square cell with `BoxFit.contain`; read, not changed — `xelvic/` is read-only |
| Touch behaviour | NOT VERIFIED | measured with a mouse, not a finger |
| Live API behaviour | NOT VERIFIED | every panel measurement was against a loopback stub; no live request and no real account |

**Files.** New: `src/components/ui/shelf.ts`, `src/components/media/StickerArt.tsx`. Edited:
`src/features/convo/StickerSheet.tsx`, `src/features/emoji/EmojiPicker.tsx`, `src/pages/ChatPage.tsx`.
Nothing under `xelvic/` and nothing in `xelvic-web/docs/` was touched.

**Not a parity claim.** Two panels now share one box and the shelf draws one sticker size, which is
what was asked; nothing else about the panels was unified, and no percentage moved.

**Checks.** `npx tsc -b` clean · `npx eslint .` clean · `npm test` 34 files / 402 tests passed ·
`npm run build` succeeded in 5.87 s (`ChatPage` 150.50 kB, `EmojiPicker` 97.30 kB, entry 514.78 kB /
159.95 gzip; the >500 kB warning is pre-existing).

## Round 27 — all 602 stickers draw, and there is no GIF section because there are no GIFs (2026-11-12)

**The ask.** *"Abhi sabhi stickers nahi aa raha hai, please ise fix kijiye jisse sabhi stickers aaye
aur agar isme koi gif ka bhi hai to isi me ek gif ka section add kijiye jisme sabhi gif dikhega aur
agar nahi hai to leave it kewal sabhi sticker ko laiye"* — bring every sticker, and add a GIF section
only if GIFs exist.

| Item | Status | Evidence |
|---|---|---|
| Are there GIFs to show? | **No — answered with evidence, so no GIF section was added** | the catalogue paged at `limit=100`: **602 rows / 7 pages / 602 unique ids**, and **`animated: true` is 0 of 602**. Per the owner's own *"agar nahi hai to leave it"*, nothing GIF-shaped was built |
| All the stickers were already in the data | COMPLETE (measured) | `sticker-count.mjs`: **602 cells built, 0 broken** — the shelf was never short of stickers |
| All the stickers now draw | COMPLETE | before: 76 drawn / 526 blank as it opened, and still **216 blank** after jumping to the very end (`scrollTop` 11,683). After: **602 / 602 / 0 / 0** at rest, after each of twenty screens, and at the very end |
| The carry: a shelf 11,941 px tall in a 258 px window | COMPLETE | 159 rows, **16 cells** visible at once — that is why `loading="lazy"` left the far cells blank |
| What it costs | COMPLETE (measured) | cold cache: **602 requests, 26 MB, last picture drawn ~7.5 s** after the panel opens; `asked` 602 = `files` 602, so the ink measurement costs no request of its own |
| Paid once, not once a visit | COMPLETE | every picture answers `immutable, max-age=2592000`; a warm re-open measured at `files: 0, mb: 0` |
| The first screenful is not starved | COMPLETE | `eager` is turned on **350 ms after the shelf opens**, not immediately, and off again when it closes |
| The pictures are not silently shrunk | Deliberately not done | the Cloudinary `w_512` in the URL is part of what is sent to the backend when a sticker is picked; shrinking the download would change the message |
| The box and the grid density | Unchanged | Round 26's 340 × 363 box with four columns stands — this round changed only *when* a picture is asked for |
| The editor's own sticker shelf | NOT IMPLEMENTED — unchanged | `src/features/camera/PhotoEditor.tsx` still loads `loading="lazy"` over the same 602 stickers, so it still behaves as the composer's shelf did before this round |
| The phone's sticker sheet | NOT IMPLEMENTED — read-only | `app/lib/screens/chat_sticker.dart` behaves the same; read, not changed |
| A slow connection | NOT VERIFIED | the 7.5 s figure is this machine on this connection; every sticker still arrives, but a slow link draws the shelf more slowly |
| Touch scrolling | NOT VERIFIED | measured with a mouse and a wheel, not a finger |
| Live API behaviour | NOT VERIFIED | the panel measurements were against a loopback stub; the catalogue's JSON and one image's headers were read live, nothing more |

**Files.** Edited: `src/components/media/StickerArt.tsx` (the `eager` prop; the doc comment's byte
figure corrected from a header-sample estimate of 54 MB to the measured 26 MB) and
`src/features/convo/StickerSheet.tsx` (the deferred `eager` state). Nothing new. Nothing under
`xelvic/` and nothing in `xelvic-web/docs/` was touched.

**Not a parity claim.** Every sticker in the catalogue now draws on the composer's shelf; the
editor's shelf and the phone still load lazily, and that is written down rather than implied.

**Checks.** `npx tsc -b` clean · `npx eslint .` clean · `npm test` 34 files / 402 tests passed ·
`npm run build` succeeded in 5.49 s (`ChatPage` 150.69 kB, `EmojiPicker` 97.30 kB, entry 514.78 kB /
159.96 gzip; the >500 kB warning is pre-existing).

## Round 28 — the character comes up over the composer, on the frame that was already arriving (2026-11-12)

**The ask, verbatim.** *"Alright, abhi jaise typing par charector typing indicator aa hai waise isme
nahi aa raha hai, please ise fix kijiye"* — bring the phone's character typing indicator to the web.

**What moved.** `src/features/convo/TypingPeek.tsx` is new: `_peek` from `app/lib/screens/chat.dart`
as a React component. It draws the other participant's character 72.24 px up out of the composer's
top edge while they write, at 84 × 84, with the phone's 260 ms slide and fade, `pointer-events-none`
so it takes no taps and a `role="status"` sentence for a reader who cannot see it. Whose character it
is, is the phone's rule: the figure **their** account is wearing, read off `UserCard.character`,
resolved against the same catalogue the shop sells from — because it is them, and my theme decides
what they see rather than what I see. Whether a figure may stand over a composer at all is staff's
`placement`, and that rule now has one name, `figureOnChat` in
`src/features/marketplace/model.ts` (the phone has the identical four lines twice, in
`app/lib/catalogue.dart`). `ChatPage`'s composer wrapper became `relative isolate`, the peek is its
first child, the visible `Ravi is typing...` line came out, and the message list's bottom inset is
the phone's `kPeekClear` — **82 px, held whether the character is up or not**, so the newest message
never jumps when somebody starts writing.

**What did not move, and this is the point of writing it down.** The real-time half was **already
there and was not touched**: the socket sends `{action:"typing"}` while the field has text and
`typing:false` 2400 ms after the last keystroke, and a received `thread.typing` frame fills `typers`
and clears it after the frame's own `ttl`. This round draws a figure on a mechanism that existed; it
did **not** build one, and no claim that it did is made.

**The three numbers are the phone's, taken rather than invented.** `PEEK_SIZE` = `kPeekSize` = 84 ·
`PEEK_RISE` = `kPeekAt` = 0.86 · `PEEK_CLEAR` = `kPeekClear` = `84 × 0.86 + 10` = 82 · slide 260 ms.
Measured in the running app, the transform reads `matrix(1,0,0,1,0,-72.24)` while up — `0.86 × 84`
exactly — and `matrix(1,0,0,1,0,0)` while down.

**Five states measured**, against a stub that really speaks WebSocket (so the frame arrives over the
socket, not from the page's own state): nobody writing → **down**; writing → **up**, in **their**
figure's `typing` pose; stopped → **down**; a figure staff set to `placement: "profile"` → stays
**down** while they write; a key with no catalogue row → **up**, in the app's own bundled figure. The
stub was asked for exactly one picture across the first pass (`/pose/typing`, its own figure's), never
the bundled one, and no painted words about typing existed at any of the five moments.

**Status: COMPLETE for what was asked; PARTIALLY COMPLETE against the phone's own chain.** The first
rung (their worn figure) and the third (the app's own) are reached; the middle rung — the figure a
theme ships — is not, because the web's catalogue carries a figure's pictures but not a theme's, so
an account wearing no shop figure falls back to the bundled one. Typing between two **live** accounts
is **NOT VERIFIED**: the frames came from a stub, and what is proven is that the page draws the figure
on the frame the backend is documented to send.

**Not a parity claim.** `app/lib/screens/chat.dart` was read and not changed (`xelvic/` is read-only),
touch was not used, and the theme-figure rung is named above rather than left to be found.

**Files.** New: `src/features/convo/TypingPeek.tsx`, `src/features/marketplace/model.test.ts`. Edited:
`src/pages/ChatPage.tsx`, `src/types/api.ts`, `src/features/marketplace/model.ts`. Nothing outside
`xelvic-web/`, and nothing in `xelvic-web/docs/`.

**Checks.** `npx tsc -b` clean · `npx eslint .` clean · `npm test` 35 files / 407 tests passed (five
new) · `npm run build` succeeded in 5.28 s (`ChatPage` 149.76 kB — *lower* than Round 27's 150.69 kB
because the words came out and the shared `marks` chunk went in; no improvement is claimed from it —
`ConvoLayout` 90.04 kB, `marks` 15.61 kB, entry 514.87 kB / 159.98 gzip; the >500 kB warning is
pre-existing).

## Round 29 — two characters, a precedence rule, and the gaze feature the web did not have (2026-11-12)

**The ask, verbatim.** *"Alright, abhi app jaisa nahi aa raha hai aap me jo jo hai exact waisa hi hona
chahiye aur usme typing aur wait 2 charector hai aur dono jaise work kar raha hai app me waise isme
bhi karna chahiye"* — the app has **two** characters over the composer, `typing` and `wait`, and both
must work here the way they work there.

**Why Round 28 did not already satisfy this.** Round 28 drew one character on a `typing ?? wait ??
bio` chain — a fallback, three pictures for one state. The phone has two **states** with a precedence
rule, and the second state is not "nobody is typing". It is "somebody is on one of my places without
saying anything" — a fact that arrives as a `focus` socket event and is owned by `app/lib/looking.dart`
plus `_watchOther`/`_sayLook` in `chat.dart`. The web had **no gaze code at all**; `grep` found only
`window.addEventListener("focus")` in an unrelated view. So this round ported a feature.

**What moved.**

| file | what it is |
| --- | --- |
| `src/features/presence/looking.ts` (new) | `lib/looking.dart`'s rules as pure functions: `lookOf`, `gazeFrom`, `sameLook`, `staleGazes`, and the three frames this side says |
| `src/features/presence/looking.test.ts` (new) | eleven cases, including the ratio that matters: `GAZE_STALE_MS === GAZE_RECHECK_MS * 2` |
| `src/context/looking.ts`, `src/providers/LookingProvider.tsx`, `src/hooks/useLooking.ts` (new) | who is looking at whom, the watch/ask/keep timers, and the `focus`/`ready` socket handling |
| `src/features/convo/peek.ts` (new) + `peek.test.ts` (new) | the two-character rule, kept out of the widget (nine cases) |
| `src/features/convo/TypingPeek.tsx` (rewritten) | takes `{typing, gaze}` and draws whichever the rule chose |
| `src/pages/ChatPage.tsx`, `src/features/profile/PersonProfile.tsx`, `src/main.tsx` (edited) | the convo watches and says `chat`; the profile says `profile`; the provider is mounted inside `SocketProvider` and outside every page |

**The rule, and its one asymmetry.** `pose: typing ? poses.typing : (peekPose(gaze) ?? last)` and
`up: typing || gaze != null`. Writing wins over merely being somewhere of mine, because writing is the
more specific fact. But being written to *ends* and being somewhere of mine *does not* — so when the
typing frame stops, the figure does not go down, it returns to `wait` and stays up. Both halves are in
`peekOn` in `src/features/convo/peek.ts`.

**The numbers are the phone's and the server's.** `GAZE_STALE_MS` 30 000 = the server's
`FOCUS_TTL_SECONDS` · `GAZE_RECHECK_MS` 15 000 = twice under it, so a genuine gaze is renewed twice
before the first poll could lapse · `GAZE_REFRESH_MS` 15 000 for my own word, because half of the
server's window is one dropped frame from being too long. The repeat is the half that is easy to leave
out, so it was **measured**: with the stub's frame log cleared at the start and the count retaken once
the page settled, the page said **2 more frames 8 s later** — one `ask` and one word about where it
was.

**Six states measured**, against a stub that really speaks WebSocket and speaks `focus` both ways
round. The gaze was set *before* the convo opened, so the page could only know it by asking: quiet on
my convo → **up**, `wait`, `/pose/wait`, 71 px over the seam · writing on top → **up**, `typing`,
`/pose/typing` · stopped writing, still there → **up**, `wait` again · gone → **down**, keeping the
pose it was drawn in · their figure `profile`-placed with both facts true → **down**, nothing drawn ·
their figure off the shelf → **up**, the bundled `/char/wait.png`. The transform read
`matrix(1,0,0,1,0,-72.24)` while up and the identity while down. The stub was asked for the `wait`
picture **without anybody typing** — which is the evidence that the second character is driven by the
gaze and not by the absence of the first. Navigating to `/app/u/jaya` and reading the frames the
**profile** said gives `{"kind":"profile","user":"2222…","phase":"idle"}`.

**Status: COMPLETE for what was asked; PARTIALLY COMPLETE against the phone's whole painting.** Both
characters work and both directions (convo says `chat`, profile says `profile`) are exercised. **NOT
VERIFIED**: the `focus` path against a **live account** (the frames came from a stub); the 30 s sweep
against a real lapse (unit tests only); a peer who vanishes without saying goodbye. **NOT
IMPLEMENTED**: presence-watching, which the phone also does and which is a different fact from where
somebody is looking. **A documented deviation**: the remembered last pose is keyed to the set of
pictures it came from (`memory.current?.art === art`), because the phone's poses are three files in its
own bundle that cannot go away while the web's are shelf URLs that change with somebody's figure.

**Not a parity claim.** `app/lib/screens/chat.dart`, `app/lib/looking.dart` and the backend's
`consumers.py`/`services.py`/`settings.py` were read and not changed (`xelvic/` is read-only), touch
was not used, and the three limits above are named rather than left to be found.

**Files.** New: `src/features/presence/looking.ts`, `src/features/presence/looking.test.ts`,
`src/features/convo/peek.ts`, `src/features/convo/peek.test.ts`, `src/context/looking.ts`,
`src/providers/LookingProvider.tsx`, `src/hooks/useLooking.ts`. Edited: `src/features/convo/TypingPeek.tsx`,
`src/pages/ChatPage.tsx`, `src/features/profile/PersonProfile.tsx`, `src/main.tsx`. Nothing outside
`xelvic-web/`, and nothing in `xelvic-web/docs/`.

**Checks.** `npx tsc -b` clean · `npx eslint .` clean · `npm test` 37 files / 428 tests passed (twenty
new) · `npm run build` succeeded in 4.92 s (`ChatPage` 150.53 kB, up from Round 28's 149.76 kB on the
watch/say wiring — no improvement claimed in either direction; `ConvoLayout` 90.04 kB, entry
517.35 kB / 160.77 gzip; the >500 kB warning is pre-existing).

## Round 30 — the chips in a convo, and the one that had never been drawn (2026-11-12)

**The ask, verbatim.** *"Alright, please ab chatscreen me jo chip banta hai jaise call ka, data ka etc
ka wo sab jaise aap me hai exact waisa kijiye"* — every chip a convo forms (a call, a file, and the
rest) exactly as the app has it.

**Four of the five chips were already exact.** Measured in a real browser against a stub carrying all
of them: the top strip (159.77 × 29.75, radius 20, `6px 12px 6px 11px`, icon 12, gap 5), a system note
(radius 16, `9px 13px`), the stamp over a picture (10px `--dim`, 4px above), and the day pill's
geometry. Only the day pill's **radius** needed a word: it was `rounded-full`, which a browser clamps
to 11.5px on a 28.5px pill, and the phone's `DayMark` is **20**.

**The real finding: the call chip had never been drawn at all.** `_write_log`
(`apps/calls/services.py`) writes a finished call as a system note whose payload is **one flat
dictionary** — `{"call": "<uuid string>", "media": …, "outcome": …, "seconds": …}`, `call` a *string*
with the rest as its **siblings**. The web's `callNote()` read `payload.call` as an *object* and looked
for `media` inside it, so the guard never passed and every call fell through to the ordinary-bubble
branch. It was proven by dumping the list's `outerHTML`: `Missed audio call` and `Video call · 12:31`
were wearing the bubble's own classes in `justify-start`/`justify-end` rows. Fixed by reading the
payload flat, exactly as `callNoteOf` (`app/lib/calls.dart:3758`) does.

**Second finding: the chip was not pressable**, and carried a comment claiming this client could not
place a call — untrue since Round 18. It is now a `<button>` under the phone's `_canCall`
(`thread.other.username` non-empty **and** `gate.can_call === true`), and pressing it sent
`{"ring":"2222…2222","kind":"audio"}` down the socket. Gate shut → a `<div>`, which is `onTap: null`.

**The file chip was a different object and was rebuilt.** The phone's `_FileRow` sits in a `_MediaFrame`:
`X.card` fill, radius 14, 1px `X.line`, 220–290 wide, padding 12, a 32px `X.accent` icon, gap 10, a
w700 name over an 11px `X.dim` details line, and **no download glyph** (the whole row is the InkWell).
The web had `bg-paper`, `px-3 py-2.5`, an 11.5px/600 name, a rounded-10 `accent-soft` square with a
16px glyph, a trailing `Download` arrow and no width bound. Measured after: **220 × 62.73**, radius 14,
padding 12, 32px `rgb(227,27,102)` glyph, gap 10, name 14px/700 `rgb(19,19,26)`, details 11px/400
`rgb(107,107,123)` reading `application/pdf · 1.1 MB`.

| file | what changed |
| --- | --- |
| `src/pages/ChatPage.tsx` | flat `callNote`, pressable call plate, rebuilt `ChatDocument` + `fileDetails`, day pill `rounded-[20px]`, `sparkShotLine` `pb-[2px]` |
| `src/utils/format.ts` | `mediaSize`, the phone's `formatMediaSize` rounding (one decimal below ten of a unit, none at or above; `0`/`null` → `Unknown size`) |
| `src/utils/format.test.ts` (new) | four cases pinning it |
| `src/types/api.ts` | `ThreadDetail.gate` typed as `ChatGate`, which already had `can_call?: boolean` |

**Status: COMPLETE for the chips the ask names; PARTIALLY COMPLETE against the phone's whole media
painting.** The call chip and the file chip are the phone's object, measured. **NOT VERIFIED**: two
live accounts (everything is a loopback stub); a video call actually placed; any file kind other than a
PDF, so the `Image`/`Video`/`Audio` labels and `_fallbackType` are read from source and not measured;
the file chip's download actually saving against a real backend. **An inference, recorded as one**:
`_FileRow` gives the name w700 and **no** `fontSize`, so it inherits Material's default 14 — the web
draws 14 to match the inheritance and that was not measured on a device.

**Not a parity claim.** `xelvic/` was read and not changed; touch and a real phone were not used; the
capture is a mouse at 1280 × 900. Two defects in the probe's own stub (call notes written as `text`
instead of `system`; `mime_type` instead of `mime`) were mine, were found by the DOM dump, and are
recorded because each would have made the page look wrong when it was not.

**Files.** Edited: `src/pages/ChatPage.tsx`, `src/utils/format.ts`, `src/types/api.ts`. New:
`src/utils/format.test.ts`. Nothing outside `xelvic-web/`, and nothing in `xelvic-web/docs/`.

**Checks.** `npx tsc -b` clean · `npx eslint .` clean · `npm test` 38 files / 432 tests passed (four
new) · `npm run build` succeeded in 4.93 s (`ChatPage` 151.10 kB, up from 150.53 kB in Round 29 on the
file-chip rebuild — reported as a rise, no improvement claimed; `ConvoLayout` 90.04 kB, entry
517.58 kB / 160.88 gzip; the >500 kB warning is pre-existing).

## Round 31 — the time a message carries, which the phone keeps in the long press (2026-11-12)

**The ask, verbatim.** *"Aur abhi isme message ka time nahi dikhta jaise app me dikhta hai, please ise
bhi fix kijiye"*.

**The phone was read first, and it does not put a clock on a bubble.** `messageStateRow`
(`chat.dart:579`): *"The time is not here either: it is read from the long-press menu now."*
`_actions` (`chat.dart:5073`): *"the bubble no longer carries it under the words, so pressing a message
is how anybody learns when it was sent. It sits at the top left, above the emoji, where a heading
would."* The only clock **on** the page belongs to a picture, and sits **above** it (`messageStamp`,
10px `X.dim`) — which the web already had. **Adding a clock to a bubble would have been the wrong
fix**: it would have made this client differ from the phone in the name of matching it.

**What changed.** The sheet now opens with the phone's own line as its **first child**, above the emoji
row — `Padding(fromLTRB(16,0,16,6))` → `Align(centerStart)` → `Text(at, X.dim, 11)`. Measured in the
open sheet: **11px / 400 / `rgb(107,107,123)`**, `top: 70`, ink **17px** in from the panel's left edge
(the phone's 16 plus the panel's 1px border; taken with a `Range` over the text node, because an inset
is internal padding and the box's own left edge says nothing about it). A **duplicate 9px clock inside
the quote card** was removed — the phone has one time in that sheet and it is the 11px headline.

**Why the web needs no `_menuClock`.** The phone's `clock()` answers `10:42` and appends `AM`/`PM`
itself so midnight does not read as morning. The web's `clock()` is `Intl.DateTimeFormat` with
`hour: "numeric"`, so it already answers **`11:05 AM`** and is locale-aware — one function for both the
sheet and the picture stamp, and the two cannot disagree.

**Status: COMPLETE for the ask; PARTIALLY COMPLETE against the phone's sheet.** **NOT VERIFIED**: an
unsent outbox row in the sheet, where the phone's clock is empty by design. **A recorded divergence**:
under a 24-hour locale the web reads `23:05` where the phone's `_menuClock` would append `PM` to a
`10:42`-style string — matching the phone exactly there would mean ignoring the viewer's own locale, so
it is recorded rather than fixed. Everything was measured on a **received** message against a loopback
stub; two live accounts were not used.

**Not a parity claim.** `xelvic/` was read and not changed. Nothing in `xelvic-web/docs/`.

**Checks.** Same run as Round 30 — `tsc -b` clean, `eslint .` clean, 38 files / 432 tests, build clean.

## Round 32 — the sound bubble is the phone's own player (2026-11-12)

**The ask, verbatim.** *"Alright, please audio message bubble ka design exact app ke jaisa kijiye"*.

**What it produced.** [VoiceBubble.tsx](src/features/convo/VoiceBubble.tsx) and
[voiceclip.ts](src/features/convo/voiceclip.ts) — the phone's `ChatAudioBubble`
(`app/lib/screens/chat_audio.dart:1109`) ported number for number: a 40 × 40 control beside a column
pinned to the phone's **150-point** track (`_track`), and inside it the phone's own bar maths — `height`
30, `mostBars` 56, `thick = (cell * 0.42).clamp(0.8, height >= 44 ? 5 : 4)`, `gap = ((cell - thick) /
2).clamp(0, 2)`, radius 2, `(4 + sample / 100 * 24) * unit`, 24 bars at rest, a 900 ms dance while
playing with no waveform to draw, and the 1 → 1.5 → 2 speed ring. `tone = accent ?? X.accent` on the
phone is `var(--accent)` here, which the convo page has already rebound to `--convo-accent`, so the
bubble wears the thread's tint with no prop.

**Measured in a browser** (dark "Alone", a loopback stub, one received voice note with a 90-sample
waveform and a silent WAV built in the page): the player **190 × 58** — the phone's own 150 + 40; the
control 40 × 40 at `rgb(43, 87, 198)`; the track **150 × 30** with **56 bars**, 1.11 wide,
`marginInline 0.776786`, radius 2; the readout `0:00 / 0:02` at 10px `--dim`; the speed chip **38 × 28**
at 14px/500, dimmed to `color-mix(in srgb, var(--ink) 38%, transparent)` while no ear is held.

**Status: COMPLETE for the ask; PARTIALLY COMPLETE against `ChatAudioBubble`.** **NOT MATCHED:** the
speed chip is `disabled={!held}`, so a speed cannot be chosen before the first press — which the
phone's own comment says is exactly what the chip is for (`_speedChoice`, `speedOf`). **NOT
IMPLEMENTED:** `InFront` (the phone stops a note when the page it is on stops being looked at), the
transfer controls (`_transferControls`: Pending, Uploading, Retry, Discard), and the sender a group
voice note wears above its player. The phone's control is a Material `IconButton` (24 icon, Material
3's 48-point tap target); the web's is an explicit 40 × 40 box.

**Not a parity claim.** Everything is a **loopback stub in a headless browser** with a silent WAV; a
real recording was never played and two live accounts were not used. `xelvic/` was read and not
changed. Nothing in `xelvic-web/docs/`.

**Checks.** `tsc -b` clean, `eslint .` clean, **40 files / 454 tests**, `npm run build` clean in 5.14 s
— `ChatPage` **156.50 kB** (was 151.10 kB in Round 30), `ConvoLayout` 90.04 kB, entry 517.76 kB
(160.96 kB gzip).

## Round 33 — three sounds, three designs, and the one that is not a bubble (2026-11-12)

**The ask, verbatim.** *"Alright, song message bubble aur audio message bubble do alag alag message
bubble hai aur dono ka design alag alag hai app me, please aise hi isme bhi kijiye"*.

**The phone draws three things, and only two are bubbles.** A voice note (`kind: 'voice'`) is
`ChatAudioBubble`; a sound file (`kind: 'audio'`) is `_mediaBubble` → `ChatAudioFileRow` → `_FileRow(
icon: Icons.audio_file_outlined)`, a file row **inside** a bubble; and a shared song is an ordinary
**text** line whose payload carries the track, drawn by `ChatTrackCard` with **no bubble at all**
(`bare`, `app/lib/screens/chat.dart`: *"a card brings its own"* edges), its own `messageStamp` above it
and 4 points of air, and its body line never repeated.

**What changed.** `soundKind` ([sound.ts](src/features/convo/sound.ts) + four cases in
[sound.test.ts](src/features/convo/sound.test.ts)) keeps the first two apart — the message's own `kind`
answers first, the asset's kind is the fallback. `voice` draws the Round 32 player; `audio` draws the
phone's file row. The song card was rebuilt to `chat_track.dart`: `ShareWho`, 9 points, `CoverArt 44`,
title 14/700 over an 11.5 `--dim` byline, `LikeButton size="md"` (34 box / 22 glyph, the phone's own
`LikeHeart` constraints exactly), a 34px filled round play button, 26 bars at 2.5 wide and
`3 + shape * 19` tall with the unplayed ink at `X.fade(X.text, 0.16)`, then 4 points and the
`_timeStyle` row at 10.5/600 tabular `--dim`.

**The accent split, which no reading of the code would have found by accident.** `ChatTrackCard` takes
no `accent` on the phone: it fills its play button with `X.accent`, while everything else in the thread
takes `convoAccent()` = `X.theme.chatTint ?? X.accent`. `ThemeProvider` now publishes
`--palette-accent` and the card rebinds `--accent` to it at its own root. **Measured on dark "Alone"**,
the one shipped case where the two differ: `--convo-accent` `#2B57C6` against `--palette-accent`
`#8FB4FF` — the card's play button painted `rgb(143, 180, 255)` while the voice note's play glyph and
the file card's glyph painted `rgb(43, 87, 198)`. **On every light theme the two coincide and the
rebind is invisible**, which is why the probe pinned the dark theme.

**Status: COMPLETE for the ask.** Measured in one thread: the song **272 × 152.89** with no background,
no border and **no radius**, padding 10, its stamp above at 10px `--dim`; the voice note a 220 × 84
bubble, `rgb(18, 26, 44)`, `18px 18px 18px 6px`, `10px 14px 8px`; the sound file a 250 × 88.73 bubble,
`rgb(15, 28, 60)`, `18px 18px 6px`, holding a 220 × 62.73 row.

**PARTIALLY MATCHED / NOT MATCHED.** The card is a flat `w-[272px]` where the phone is content-sized
inside 220–290. The failure line is hardcoded to "Could not play that." where the phone prints
`store.stuck!`. The file row's name truncates to one line where the phone allows two, and falls back to
"An audio file" where the phone uses `source.fileName`. **NOT IMPLEMENTED:** the file row's transfer
states (Pending, Uploading, Retry, Discard) and its open-a-local-file press — the web's `<a download>`
does neither. `ShareWho` names the person the reader's own way on the phone (aliases) and `name ||
username` here; unchanged this round. **NOT VERIFIED:** the heart's own box — the probe's selector
matched the play button twice, so no reading is claimed for it.

**Not a parity claim.** Three messages in one thread against a **loopback stub**; two live accounts
were not used, a real recording was never played, and the sound file measured was a WAV only.
`xelvic/` was read and not changed. Nothing in `xelvic-web/docs/`.

**Checks.** Same run as Round 32 — `tsc -b` clean, `eslint .` clean, **40 files / 454 tests**, build
clean. The temporary probe (`xelvic-web/probe/`) was deleted after the reading; the checks above were
re-run with it gone.

## Round 34 — the group behind the ⋮, and every control the phone keeps there (2026-11-13)

**The ask, verbatim.** *"Alright, please abhi group ke header me 3 dot par click karne par jo group
section open hota hai usme group settings par click karne par jo section open hota hai usme abhi wo sab
kuch nahi hai jo jo app me hai, please ise fix kijiye"*.

**What was there before.** The convo sheet's "Group settings" row opened `ThreadInfoPanel` — a
web-invented panel that showed the roster and little else.

**What replaced it.** [GroupPanel.tsx](src/features/convo/GroupPanel.tsx), a port of
`app/lib/screens/group.dart` (`GroupScreen`, lines 40–1428, plus `ChannelSheet` and `PickPeople`),
routed from [ChatPage.tsx](src/pages/ChatPage.tsx) whenever `thread.kind === "group"`.
`ThreadInfoPanel` stays for direct convos.

**The phone's rules that were ported rather than invented.**

- `_rank = {member: 0, admin: 1, owner: 2}`; `canRun = rank(myRole) >= 1`, `owns = myRole == "owner"`,
  and a member row's "…" menu appears only when `rank(row.role) < rank(myRole)`.
- The roster note is four different sentences: `"{shown} of {total} found"` while typing into a capped
  list, `"{total} found"` while typing, `"{shown} of {everyone}"` when idle and capped, `"{everyone}"`
  otherwise. The search box itself exists only when the roster is capped.
- A channel rule write always sends **both** `post` and `media`; the tick moves only after the server
  answers.
- Revoked invite links stay listed and marked off rather than disappearing.
- A member row is a link only when the card says `can_open` — never my own row — so a deactivated or
  blocking account cannot be opened from the roster.

**Status: COMPLETE for the ask.** Watched in a real browser against a loopback stub, two variants. As
an **owner**: two switches under "How the group runs"; flipping Lock issued
`PATCH /chat/threads/t1/room/ {"locked":true}` and the switch then read `aria-checked="true"`; opening
`# notices` showed both rule headings and all six choices, and picking "Photos only" issued
`PATCH /chat/threads/t1/channels/c2/ {"post":"admins","media":"photos"}` with the tick visibly moving
to it (`rgb(43, 87, 198)` against `rgba(43, 87, 198, 0.12)` on the others); three channels each with
its rule line and a "Change" affordance; two invite links ("Used by 3 people." / "Turned off."); five
members with role chips; Add people, Leave group, Delete group. As a **plain member**: no switches, no
invite section, no Add people, no Delete group, no "Change", no "New channel"; the roster reads "5 of
4.3k" with the paged note and a search box; the rule sheet still opens and reads, and tapping a rule
changes nothing — exactly as on the phone.

**NOT VERIFIED at runtime.** Avatar upload and removal, invite creation and revoking, a member's role
change and removal, leaving, deleting the group, renaming a channel, and the add-people picker were
built against the endpoints the phone uses but were not exercised in this pass. Every one of those
endpoints already existed — **the backend gained no endpoint, migration, setting or contract change.**

**Not a parity claim.** One stub thread, one browser, one account id. `xelvic/` was read and not
changed. Nothing in `xelvic-web/docs/`.

## Round 35 — the direct convo's own ⋮, and the one row it had never had (2026-11-13)

**The ask, verbatim.** *"Alright, please user ke liye bhi fix kijiye matlab kisi user ke chatheader me
3 dot par click karne par jo convo option section open hota hai isme jo jo app me hai wo sab add
kijiye"*.

**The phone's menu for a direct convo** is `ChatSheet(kind: SheetKind.convo)`
(`app/lib/screens/sheets.dart:2106-2780`): rename-on-this-device, pin, mute, vault, disappearing,
block/unblock, clear, trash. The web already had seven of the eight.

**What was missing: the name only you see.** `Aliases` on the phone is device-local, keyed
`"<account>|<person>"` with a `"<account>|@<handle>"` fallback, and never sent anywhere. The web had
no equivalent at all. Added as [names.ts](src/features/convo/names.ts): the same storage key
(`xelvic.names.mine`), the same two key shapes, and a `useSyncExternalStore` subscription so a rename
redraws every title without waiting for a refetch. [model.ts](src/features/convo/model.ts)'s
`threadTitle` now answers with the alias first for a non-group convo, which carries the chat header,
the empty-state line and every other `threadTitle` caller. `PromptDialog` gained `onReset` so the name
can be taken back.

**What was wrong: the block row has a side and the web did not know it.** The sheet showed "Unblock
Ada" whenever the gate said `blocked` — including when **Ada** was the one who blocked me, where there
is nothing of mine to undo. The phone draws that row only when `!_blocked || _blockedByMe`, and marks
it `bad` only when it is a Block. The gate already carried `blocked_by_me`
(`backend/apps/social/services.py:290-316`); it is now read, and the row is absent in the other
direction.

**Also aligned with the phone this round.** Mute and Trash are not drawn on the self convo; the clear
question says "Everything in it goes from your side." over the note "The convo itself stays open.";
the trash note reads "Nothing goes from their side."; the block question carries "You can undo this
from the same sheet."

**Status: COMPLETE for the ask.** Driven in a real browser against a loopback stub: the sheet's head
read "Ada @ada"; the rename dialog took "Ada Lovelace"; `localStorage` held
`{"u-me|u-ada":"Ada Lovelace"}`; the head then read "Ada Lovelace @ada"; the row relabelled itself to
"Change the name on this device"; and the chat header and the empty-state sentence both followed.
"Use their own name" cleared the key and the head went back to "Ada @ada". With the gate set to *they
blocked me*, no Block and no Unblock was drawn; with *I blocked them* it read "Unblock Ada" and was
not in the danger colour.

**PARTIALLY MATCHED.** The web sheet carries three rows the phone keeps on the person's profile
instead — "Media and files", "Wallpaper" and "Convo theme" — and they were left in place rather than
removed. The web also prints a `pinned/total` count the phone omits from inside a convo. The alias is
per browser, exactly as the phone's is per device.

**Not a parity claim.** A stub, one browser, one account id, no second person. `xelvic/` was read and
not changed. Nothing in `xelvic-web/docs/`.

**Checks (both rounds).** `tsc -b` clean, `eslint .` clean, **40 files / 454 tests**, build clean in
4.46 s — `ChatPage` 184.70 kB (50.20 kB gzip), entry 518.93 kB (161.21 kB gzip). The temporary probe
was deleted and all four checks re-run with it gone; the dev server on 5173 still answers 200.

## Round 36 — the intermittent render crash (2026-11-14)

**Reported:** *kabhi kabhi* `Cannot read properties of null (reading 'useContext')` on the error screen;
a refresh cleared it. Console showed two `401` responses on `/api/v1/spaces/?shelf=live` at the time.

**Diagnosed.** `TypeError` comes from `dispatcher.useContext` with a null dispatcher in React 19.3.1.
Ruled out, with evidence rather than assumption: hooks outside a component or custom hook (**0
violations**, two AST scans over 329 files, and `eslint-plugin-react-hooks` agrees); a component invoked
as a plain function (**0 call sites**); two React copies on disk (`npm ls react` — one, deduped) or in
the built bundle (**one chunk defines `ReactSharedInternals`**); the call service worker (no fetch
handler, caches nothing). A browser probe showed a same-copy hook outside render says "Invalid hook
call" instead, while a second copy of the React chunk reproduces the user's message exactly. The 401s
are a separate matter: the message is React's, not the API's.

**Changed.**

| File | Change |
| --- | --- |
| [vite.config.ts](vite.config.ts) | `optimizeDeps.include` pins every imported dependency; `resolve.dedupe` keeps one `react`/`react-dom` |
| [ErrorBoundary.tsx](src/components/common/ErrorBoundary.tsx) | recognises the class, draws a recovering screen, reloads once |
| [recover.ts](src/components/common/recover.ts) | NEW — `isBrokenTree`, `retriedRecently`, `claimRetry` |
| [recover.test.ts](src/components/common/recover.test.ts) | NEW — 12 tests |
| [storage.ts](src/constants/storage.ts) | new key `renderRetry` (`xelvic.render.retry`, session storage) |

**Status: COMPLETE** for the app's side and the recovery; **NOT VERIFIED** for the trigger that fired in
the user's own tab, which was never captured. No endpoint, migration or backend contract was touched.

**Checks.** `tsc -b` clean · `eslint .` clean · 41 files / 466 tests · build clean in 4.73 s.

## Round 37 — the component layer, inlined as Tailwind (2026-11-14)

**Asked:** *"is pure css ka hata kar ye janha janha use ho raha hai uske jagaha par tailwind css use
kijiye"* — remove the hand-written component classes and write Tailwind where they were used.

**Removed.** The `@layer components` block in [styles/index.css](src/styles/index.css) — 188 lines, 15
classes: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.icon-btn`, `.field`,
`.field-label`, `.card`, `.chip` (+`[data-active="true"]`), `.glass-nav`, `.story-ring`, `.skeleton`
(+`::after`), `.prose-copy` (+`strong`), `.scroll-area` (+two `::-webkit-scrollbar` rules). `:root`, the
base layer, both utilities layers, the keyframes, reduced-motion, the dark block and `.feed-item` are
untouched, and `@tailwind components` is still declared at the top of the file.

**Written instead.** 299 class strings in 78 files under `src/`, rewritten in place by an AST edit (46
sites were the button family, 41 the icon button, 38 `field` — never by hand, so no site was missed and
none was invented), plus four entries in [Button.tsx](src/components/ui/Button.tsx)'s `variants` map. 47
distinct utility strings cover the 299 sites, because each site's own overrides are honoured.

| File | Change |
| --- | --- |
| [styles/index.css](src/styles/index.css) | the `@layer components` block deleted (188 lines) |
| [tailwind.config.ts](tailwind.config.ts) | 11 colour tokens, `backgroundImage.skeleton`, `boxShadow.field-focus` |
| 78 files under `src/` | 299 class strings rewritten as utilities |
| [Button.tsx](src/components/ui/Button.tsx) | `variants` map is utilities now; the base class string split over four lines |
| [README.md](README.md) | Round 37, and the two places that named a removed class as current |
| [XELVIC_TESTING_REPORT.md](XELVIC_TESTING_REPORT.md) | the harness, the deviations, the dead classes |

**Why an AST and not a find-and-replace.** The class names are ordinary English words: a text scan found
748 `card`s, nearly all prose in comments. The scan used instead reads only class-list positions —
`className` attributes and properties, and the arguments of `clsx`/`cn`/`cx`/`cva`/`twMerge`/`twJoin`/
`classNames` — through conditionals, `&&` chains, arrays, object values, and constants declared in the
same file.

**Status: COMPLETE** for the removal and the substitution; **NOT VERIFIED** by eye — nobody has looked at
the app this round, and the five declared deviations are named in the testing report rather than rounded
away. **No parity row moves:** this is a styling refactor, and no feature changed behaviour. `.prose-copy`
was dead code in the sheet (no user in `src/`) and is gone.

**Checks.** `tsc -b` clean · `eslint .` clean · 41 files / 466 tests · build clean in 4.33 s · built CSS
143 179 bytes with 0 occurrences of the 15 removed class names · a scan of `src` for the same names in any
class list returns 0 sites.

## Round 38 — the convo's own wallpaper and theme, applied at the tap (2026-11-14)

**Asked:** *"abhi problem ye aa raha hai ki convo wallpaper me manual wallpaper nahi add ho raha hai aur
convo theme me koi theme add nahi ho raha hai, please in sab ko fix kijiye aur theme aur wallpaper turant
update hona chahiye change karte hi"* — a photo picked as a convo's wallpaper did not appear, picking a
convo theme changed nothing, and both had to show at once.

**What was wrong, cause by cause.**

| Symptom | Cause |
| --- | --- |
| A photo is picked and nothing appears | The picture lived only in `ConvoSheet`'s state and in a `localStorage` key no other component read; the chat root painted `thread.wallpaper` only |
| The photo is gone after a reload | It was written as a `blob:` object URL, which stops working once the document that made it is gone |
| The photo is lost when the request fails | It was saved only after `PATCH /skin/` answered |
| A convo theme is picked and nothing changes | `thread.tint` was written and never read; ChatPage mapped `--accent` to the account's `--convo-accent` |
| Neither is instant | Both waited on a request, then on the thread query's next refetch |

**Delivered.**

| File | Change |
| --- | --- |
| [look.ts](src/features/convo/look.ts) (new) | Per-thread store over `useSyncExternalStore`; data-URL rows; legacy `blob:` rows dropped; opacity clamped and written 150 ms after the slider stops; `readWallImage` keeps a PNG ≤1.5 MB for its alpha and otherwise frames to 1600 px at JPEG 0.82; a refused quota still shows the photo for the session and says so |
| [look.test.ts](src/features/convo/look.test.ts) (new) | 7 tests |
| [skin.test.ts](src/features/convo/skin.test.ts) (new) | 5 tests |
| [skin.ts](src/features/convo/skin.ts) | `chosenTint`; `FALLBACK_WALLS` keys aligned to the server (`xelvic`) and labels to the phone's `kWallNames` (City, Journey, Night, Gathering) |
| [ConvoSheet.tsx](src/features/convo/ConvoSheet.tsx) | `onSkin` callback; photo saved locally *before* and independent of the request; a file input attached to the document; rollback with an error toast; picking a named wall clears the photo and restores it if the request fails |
| [ChatPage.tsx](src/pages/ChatPage.tsx) | Reads the own wall; `useSkinOverlay` optimistically applies a pick and resets when the thread's stored values change; a picked tint rebuilds `convoColors` and writes the accent and bubble variables on the chat root; the built-in wash is now 78 % of `var(--page)` instead of 22 % black |
| [ThemeProvider.tsx](src/providers/ThemeProvider.tsx) | `convoPalette` and `rgbChannels` exported so ChatPage can rebuild the palette with the picked tint |

**Why the order changed.** The phone saves the picture locally first and only afterwards tells the server
`wallpaper: 'default'`, tolerating a failure (`_chooseOwn`, `app/lib/screens/convo.dart`): the picture is
the thing the person asked for, and the server has no key for it. The web now follows that order, so a
slow or refused request can no longer lose a photo.

**Status: COMPLETE** for the three complaints — the photo is stored and drawn, the picked tint paints the
thread, and both move on the tap. **NOT VERIFIED** by eye: no authenticated chat was opened, no backend was
running, and no pick was made through the UI in a browser; the evidence is 12 unit tests, a headless-Chrome
read of the built stylesheet, and a boot of the built app.

**One known gap is unchanged.** A convo nobody coloured still wears `theme.chatTint ?? theme.accent`, where
the phone's `tintOf` answers `theme.chatTint ?? #E31B66`; that is the existing **PARTIALLY COMPLETE** row
for the chat accent on an uncoloured convo, not something this round claimed to close.

**Checks.** `tsc -b` clean · `eslint .` clean · 43 files / 478 tests · build clean in 4.54 s · `docs/`
untouched · `xelvic/` read, not written · no `.env.local`.

## Round 39 — the gap between two emoji, put back (2026-11-14)

**Asked:** *"please chatscreen me emoji message bubble me 1 se jyada emoji message bubble me emojies ke
beech ka gap fix kijiye"* — and then, with a picture of three emoji in a pink bubble, *"jaisa ki aap
image me dekh sakte hai ki abhi bhi emoji chipka hua hai"*.

**What was wrong, and what the first attempt got wrong.**

| Symptom | Cause |
| --- | --- |
| Two emoji typed together are drawn overlapping | `EmojiText`'s box is declared `size-[1.15em]`, but the character layer inside it sizes the box's grid column (the machine's glyph advance, **1.3730em** = 41.19 px at 30 px), so the artwork fills that column and is drawn 41.19 px wide in a 34.50 px box. Two of them met at a 1.15em pitch: **−6.70 px**, measured |
| The first attempt did not look like a gap | `mr-[0.1em]` on every emoji is 3.00 px at 30 px, which leaves the drawings overlapping by 3.70 px |
| The character shows the same overlap before the artwork arrives | It is the same 1.373em-wide layer in the same 1.15em box |

**Delivered.**

| File | Change |
| --- | --- |
| [EmojiText.tsx](src/features/emoji/EmojiText.tsx) | an emoji carries `mr-[0.35em]` **when the next run is another drawable emoji**, merged with `INLINE` through `cn()` — no margin on a lone emoji, and none where the text around it already has a space |
| [text.test.ts](src/features/emoji/text.test.ts) | 3 tests: `onlyEmojiCount` twice, and the split the rule rests on — emoji typed next to each other become one run each |

**Why 0.35em and not a round number of pixels.** The margin stands in for the width the drawing has beyond
its box, and it is spent in the same unit as the text. Measured against the built stylesheet: a pitch of
1.500em at every size the bubble uses — clearance **+3.80 px** at 30 px, +4.55 px at 36 px, +5.31 px at
42 px, +1.89 px at 15 px — where 0.25em would have cleared by 0.80 px and 0.1em left an overlap of
3.70 px. A 3× screenshot of the shipped chain was read before this value was chosen: no margin and
0.15em still look stuck, 0.25em separates, 0.35em separates comfortably, and 0.5em starts to look spaced
out.

**Why the phone needed nothing.** `app/lib/screens/chat.dart` draws the body as one plain `Text`
(`messageFontSize` 38 / 26 / 15, `height: 1.35`, no letter spacing, no widget per emoji), so its spacing is
the emoji font's own advance. The web has to replace the glyph to draw Google's artwork, and the replacement
is what lost the advance.

**Status: COMPLETE** for the gap — two emoji typed together are drawn apart, in the artwork and in the
machine's fallback character alike, and the space between them is the emoji's own width rather than a
padding. **NOT VERIFIED** by eye: no authenticated chat was opened, no backend was running, and no bubble was
seen in a browser; the evidence is 3 unit tests and a headless-Chrome measurement of the built stylesheet.
**PARTIALLY COMPLETE** is recorded for the sizes: `bubbleType` answers 42 / 36 / 30 / 24 / 15 where the phone
answers 38 / 26 / 15, so a three-emoji row is twice the phone's size. **Unchanged and recorded:** the drawing
is taller than its line box (1.373em in a 1.05em line), so it hangs 6.70 px below its own line at 30 px.

**Checks.** `tsc -b` clean · `eslint .` clean · 43 files / 481 tests · build clean in 4.30 s
· `docs/` untouched · `xelvic/` read, not written · no `.env.local`.
