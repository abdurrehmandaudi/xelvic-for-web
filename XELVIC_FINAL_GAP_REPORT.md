# Xelvic Web — Final Gap Report

Date: 2026-11-01
Target: `xelvic-web/` only.
Reference (read-only): `xelvic/app` (Flutter, 151 screens, ~256k lines) and
`xelvic/backend` (Django, 24 apps).

## Honest headline

**Full mobile-to-web parity has not been reached.** The conversation system —
the stated highest priority — is implemented end to end at the code level and
passes typecheck, lint, unit tests and a production build. It has **not** been
verified against a live backend or a second device, because this environment
has neither.

The mobile app is 151 screens and ~256k lines; the web app is 25 page files in
`src/pages` and ~61k lines of `.ts`/`.tsx` across 191 files (recounted
2026-11-01 — the earlier "20 pages, ~31k lines" was a stale baseline). Closing
the rest is a multi-phase effort, not something this pass completed.

## Status key

- **COMPLETE** — web surface exists, main interactions call real endpoints,
  static checks pass.
- **PARTIALLY COMPLETE** — some workflows exist; named sub-features are absent.
- **MISSING** — no web surface.
- **BLOCKED** — no honest web-only implementation exists.
- **NOT VERIFIED** — code exists but was not exercised live.

## Project integrity

- No file under `xelvic/` (mobile or backend) was created, edited or deleted by
  this work. Only reads were performed against the backend and mobile source.
- Checked again at the end of the Spark/chat pass:
  `git -C xelvic status --short -- app backend` shows only the same pre-existing
  `app/` Flutter/Gradle edits that were already there before this work
  (`analysis_options.yaml`, `android/*`, `pubspec.*`); `backend/` shows no
  changes. Nothing from this session appears in that list.
- Checked again at the end of the marketplace pass: the same result — only the
  pre-existing `app/` edits, and `backend/` clean. The marketplace work read
  `apps/studio/urls.py`, `apps/drip/urls.py`, `apps/sparks/urls.py`,
  `apps/accounts/urls.py` and `config/urls.py` to confirm the six endpoints it
  calls exist and are mounted where it calls them; it changed none of them.
- All edits and all seven documents live inside `xelvic-web/`.
- Checked again at the end of the Moments pass: the same result. The pass read
  `app/lib/screens/moment_view.dart`, `app/lib/moments.dart`,
  `app/lib/screens/drop_card.dart`, `app/lib/screens/memory_add.dart`,
  `app/lib/strings/en.dart`, `backend/apps/moments/urls.py`,
  `backend/apps/moments/views.py` and `backend/apps/moments/services.py` to
  confirm the ten routes the viewer calls (eleven calls — `{id}/` is both the
  read and the Take down) and the rules it keeps; it changed
  none of them. All 22 Moments routes the web uses are tabulated against
  `apps/moments/urls.py` and `config/urls.py:175` in
  `XELVIC_API_COMPATIBILITY_REPORT.md`. `git -C xelvic status --short -- app
  backend` still shows only the pre-existing `app/` Flutter/Gradle edits.
- Checked again at the end of the Memory-alert wiring: the same result. That
  step read `apps/moments/urls.py`, `apps/moments/views.py` and
  `apps/moments/serializers.py` to place the four `memories/{id}/…` views and to
  read `MemoryEditSerializer`'s keys. It changed none of them.
- Checked again at the end of the Circles pass: the same result. That pass read
  `app/lib/screens/circles.dart`, `app/lib/circles.dart`,
  `app/lib/screens/drop_post.dart`, `backend/apps/circles/urls.py`,
  `backend/apps/circles/views.py`, `backend/apps/circles/serializers.py`,
  `backend/apps/circles/services.py`, `backend/apps/drops/views.py`
  (`write_fields`) and `config/urls.py:191` to confirm the four routes and the
  drop body a take is written with; it changed none of them. `backend/` is
  clean.
- Checked again at the end of the two Spark-composer fixes: the same result.
  Both passes read `app/lib/screens/spark_moment.dart` and `app/lib/faces.dart`
  (for `Faces.patience`) and nothing else outside `xelvic-web/`; they changed
  none of it. `git -C xelvic status --short` shows the same eight pre-existing
  entries (seven `app/` edits and the untracked `.tools/`) and nothing under
  `backend/`.

## Moments (ported from `MomentViewScreen`, 2026-11-01)

| Piece | Status | Note |
| --- | --- | --- |
| Walk, clock and per-item hold | COMPLETE / NOT VERIFIED live | 60ms ticker; `MomentItem.hold` ported exactly (clip window, sound window capped at `kSoundLongest`, a carried picture's own life, else `HOLD_FLOOR`); a video's bar read off the element's own clock |
| Tap / hold gestures | COMPLETE / NOT VERIFIED | tap steps (left 32% back, else forward); hold pauses at 480ms (`kHoldToPause`) and arms leaving at 1230ms (`kHoldToPause + kHoldToLeave`); the click the browser fires after a hold is swallowed by hand, because the web has no gesture arena to do it |
| Carried, and the line that names it | COMPLETE / NOT VERIFIED | `_carried` order and `_carriedTo` words ported; "Hold to open X" / "Let go to open X" drawn only when the item carries something |
| Seen | COMPLETE | per item as it comes up, and the moment on its last item |
| Answers tally + who sheet | COMPLETE / NOT VERIFIED | drawn on my own day only, exactly as `_reactions` gates it; the sheet reads viewers, reactors and (on a poll) voters when it is opened |
| Faces and the heart | COMPLETE / NOT VERIFIED | tap = `kStoryLike` or a take-back, hold = `kStoryFaces`; the server's answer is what is drawn |
| Reply | COMPLETE / NOT VERIFIED | `/reply/`, a message into a convo; holding the clock while the field is focused |
| Carry | COMPLETE / NOT VERIFIED live | A picture off somebody else's item goes through the web's own editor first — `carryMoment`'s rule — and posts with `source`, so the credit and the Remention card are the server's. Everything with nothing to draw on (a clip, a note, a Vibe, no picture) still carries straight through `/carry/`. Two things the phone's editor carries are **not** carried on the web, because the web editor has no field for them: `links` and `tags` (the positions the named people were drawn at). The mentions ride across; the pills' own positions do not |
| Share | COMPLETE / NOT VERIFIED | gate then picker, one convo at a time, count reported from what actually arrived |
| Add to Memories | COMPLETE / NOT VERIFIED | `AddToMemories` from the three dots, and `/app/moments?memories=1` from "New Memory" on my own profile — which was a live dead button before this pass |
| Memory walk (`isMemory`) | COMPLETE / NOT VERIFIED live | Ported on 2026-11-01: a shelf opens the *same* viewer a moment opens in, told `isMemory`. No watchers and no eye row, no `seen`/`itemSeen` calls, "Your Memory" / "Memory" / "{n} in this Memory" for the header line, answers at `/moments/memories/{id}/react|reply|reactors|share/`, "Whoever answers turns up here." in the who sheet, no three dots (the one row behind them is "Add to Memories" and it already is one), and Remove with the app's own wording instead of Take down. A Memory of a playlist opens where that playlist lives rather than as a walk |
| Managing a Memory from the shelf | COMPLETE / NOT VERIFIED live | The long press on my own card — the web's first — opens the app's four rows: Add more to it (the picker, with the shelf already decided), Rename, Change the cover (one of its own pictures, or one off this device), Remove. A playlist Memory leaves out the two rows that have no meaning over one |
| A Memory named in Alerts | COMPLETE / NOT VERIFIED live | Done on 2026-11-01, once `MomentViewer` could draw one. `alertPath` sends a `memory` target to `/app/moments?memory=<id>`; the page asks `moments/memories/` (a Memory has no by-id read) and opens the one it names through the same `memoryAsMoment` the profile's shelf uses — playlist Memory to the playlist, a marked one it may not open to the app's own sentence, an empty one to "There is nothing left on this shelf". The old refusal ("Memories are not on the web yet.") is gone |
| Together mode, stickers/drawings | **not a gap** | Corrected on 2026-11-01 after reading the app again: `moment_view.dart` has no together mode and no sticker or drawing tools, and neither has the app anywhere else (`grep -rn "together\|Together\|watch party" app/lib` finds only unrelated wording). Stickers, drawings, text and frames are the *editor's* — `PhotoEditor` on the web and `ImageEditorScreen` on the phone — and the web has all four |
| The Morning Question | **removed** | A composite moment built around a `prompt` field that exists on neither the server nor the app. It was fabricated, so it is gone rather than hidden; `XELVIC_MOBILE_FEATURE_INVENTORY.md` records the correction |

## Circles (ported from `circles.dart`, 2026-11-01)

Added on request: the app's Moments page has a Circles section with "Pick your
interests" and the web had none.

**About the source.** The phone's Moments page no longer draws the section —
`app/lib/screens/moments.dart:629` mounts `LiveNow` ("This is where the Circles
section used to sit") since commit `f4f7ffb7` on 2026-10-31. The section, both
of its screens and all four backend routes are still shipped, and the port
follows that shipped source. That is the ask; it is not a claim that the web and
the phone's current Moments page match.

| Piece | Status | Note |
| --- | --- | --- |
| The section | COMPLETE / NOT VERIFIED live | `CirclesSection` under the rail on `/app/moments`. Header with the month while nothing is picked and the run's flame once something is, "+" while there is room, the empty card that *is* the picker, the cards, and "N more interests this month" off the server's `max_picks` |
| A circle card | COMPLETE | field glyph, `field · COUNTRY`, seats, flame, chevron, task line, status, post button, the top three rows and "See all N takes". One transparent button under the content opens the circle, so the post button inside it does not also open the page |
| The picker | COMPLETE / NOT VERIFIED live | "Your interests", "Choose up to {n}", a tick / lock / plus / spinner per row, read fresh every time it opens because the ticks are monthly, and a pick that lands straight in the circle it made (`pick/` answers with the day) |
| The circle page | COMPLETE / NOT VERIFIED live | `/app/circles/:circleId` — members' faces, the task card, "Today's board" with the server's count, and a numbered `DropCard(read: false)` per take. The board is already ranked by `services.board`; the web does not re-sort it |
| Posting a take | COMPLETE / NOT VERIFIED live | The shared `DropComposer` with `circle` set. `POST /circles/{id}/` runs the same `write_fields`, so the body is the drop composer's own; the task's `kind` only chooses the door (text → note, sound → sound, clip → a video upload, picture → pictures). Heading "Your take", button "Drop it" |
| The window, honestly | COMPLETE | `open` is false both before and after a day, so the copy is chosen with `opens_in`: "The board opens when the day does." / "Nothing went up today." / "Nobody has answered yet." A sealed day sends `task: null`, and the web draws the hour instead of inventing a task |

**Still open here:** the section and both screens are **NOT VERIFIED** against a
running server. No interest was picked, no take was posted and no board was read
live in this environment.

A side-by-side of the two Moments pages showed Circles on the web and not on the
phone, since both were honest to their own source. Since the Audio and Live pass
the web draws the phone's own `LiveNow` strip under the rail *above* the section,
so the only remaining difference is that one extra door — kept because the app
reaches circles from their own shelf and the web has no such shelf.

## Audio and Live (2026-11-01)

Brought to the app's shape on request. Sources read, not modified:
`audio.dart`, `audio_bits.dart`, `audio_studio.dart`, `live_now.dart`,
`room.dart`, `room_bits.dart`, with `apps/audio/{urls,views,studio}.py` and
`apps/spaces/` read for the contract.

| Piece | Status | Note |
| --- | --- | --- |
| Category doors | COMPLETE / NOT VERIFIED live | `/app/audio/c/:key` — the server's shelf, its title and subtitle, rows that play with the shelf as the queue |
| Weekly board | COMPLETE / NOT VERIFIED live | `/app/audio/board` — `weekSpan` and the server's order; no re-ranking |
| Studio | COMPLETE / NOT VERIFIED live | `/app/audio/studio` — one's own only; an unmeasured number says so |
| One studio item | COMPLETE / NOT VERIFIED live | `/app/audio/studio/:itemId` — lifetime sums, the trend read (no band or score when `score` is null; the outcome word and the server's `why` instead), rates ("Not measured"), components, audience bars, "Where they are" (null → "Not recorded." + why), used by, this week, false rights |
| Row hearts | COMPLETE | Every row, an uploaded sound included — a drop is felt at its own route |
| Downloads door, swipe deck | NOT IMPLEMENTED | A browser has no kept-tracks store here; the swipe deck was not ported. Both are named on the page's own header |
| "Live now" strip | COMPLETE / NOT VERIFIED live | `?shelf=kept` under the Moments rail; always drawn; socket-refreshed; silent on failure. Circles stay below it (recorded difference) |
| Create a room | COMPLETE | One `OpenRoomSheet` for both doors; the toast names what the server made — a room on air or an announcement |
| Room head and menu | COMPLETE / NOT VERIFIED live | Cover, "{host} · {crowd}", "Over" / start time / LIVE; Start now, Share, Report, Close, Leave quietly — the app's conditions, behind one deliberate press |
| Share outside | COMPLETE | `navigator.share` with the clipboard fallback; the line is the app's `roomLine` plus the address |
| Report a room | COMPLETE / NOT VERIFIED live | `ReportSheet kind="room"`, reasons from the server, never on your own room |
| **Room sound** | **NOT IMPLEMENTED** | The app's stage audio is a WebRTC mesh over the `call.signal` relay. The web has had a client for that relay since the calls (2026-11-06), but the room page was not wired to it, so the page draws the stage, hands, chat, reactions and board and says plainly that the voices are not here |

**Still open here:** none of it has been run against a live server in this
environment.

## Conversation system (Phase 4)

| Area | Status | Note |
| --- | --- | --- |
| Two-pane layout, responsive | COMPLETE | desktop sidebar + pane; mobile full-screen |
| Optimistic send | COMPLETE / NOT VERIFIED | `client_id`, pending row, server reconciliation |
| Failed send + retry | COMPLETE / NOT VERIFIED | retry reuses `client_id`, no duplicate; asset not re-uploaded |
| Upload progress | COMPLETE / NOT VERIFIED | XHR `upload.onprogress`, `Uploading n%` + bar |
| Message types | COMPLETE (NOT VERIFIED live) | text, image, video, voice/audio, doc, poll, location, collab, vanish-ask, system, and every shared card the app's `chat.dart` dispatches: drop/post/Vibe (+ the mention line and the waiting shell), an uploaded sound with a real player, a song (`payload.track`), a playlist, a person (`payload.profile`), a story (`payload.story`, including the retracted shape), a live room and a sticker. Corrected on 2026-11-02: the four that were being dropped on the floor are drawn now |
| The strip over a thread's first message | COMPLETE (NOT VERIFIED live) | Added 2026-11-02. "This convo is encrypted" on every thread, and "Disappearing convo · {window}" with the accent border when vanish is on — the app's `_strip`, its geometry and its own two strings. Before this it was drawn only while disappearing messages were on, so an ordinary convo said nothing about what it is |
| Reply to a moment (`payload.moment_ref`) | COMPLETE (NOT VERIFIED live) | Added 2026-11-02. The header over the bubble ("Replying to their moment · clip" / "Replied to your moment"), and the press reads the moment and opens it; a moment past its day says so rather than failing |
| Passing a post on | COMPLETE (NOT VERIFIED live) | Rebuilt on 2026-11-02 as the app's `ShareCard`: search, a tick strip of ten faces, a pinned send button, one card per convo (`sendToMany`) with a tally of what landed, a partial run said out loud, "Another app" written only once the hand-off happened, "Copy a link" writing nothing. "Put it on your Moments" is **NOT IMPLEMENTED** — the site's composer takes files off the roll, so the row would open an empty composer and is not drawn |
| Camera's open from a convo | PARTIALLY COMPLETE (NOT VERIFIED live) | Changed 2026-11-02. The tap used to be the moment two chunks (`CameraCapture` 57.46 kB + `PhotoEditor` 76.44 kB) began downloading, and `getUserMedia` could not start until both had parsed. The chunks are now fetched in the browser's idle gap and on hover/focus/touch of the camera button, and the convo's own mount draws a real sheet while it arrives instead of `null`. What remains: `getUserMedia` itself, which cannot start before the component mounts, and the first `getUserMedia` still asks for video and audio together — splitting that would either prompt twice or silently record clips with no sound, which is a faster wrong answer |
| The phone's own sticker shelf | COMPLETE (NOT VERIFIED live) | Changed 2026-11-02. `app/lib/editor/stickers.dart` reads `https://sticker.gaongram.in/api` first and our own `/api/v1/stickers/` only as a fallback; the web read the server alone and therefore showed a different, much smaller list. The service is a public, token-free read that answers `access-control-allow-origin: *`, so the browser asks it directly |
| "All" in the editor's audio sheet | COMPLETE (NOT VERIFIED live) | Rewritten 2026-11-02, sixth round. It now draws the **uploads shelf** — `GET /audio/tracks/?source=drop&limit=60`, the phone's own `kPickerRows` — which is what `app/lib/screens/audio_picker.dart` draws on all three of its chips. The earlier version of this row described an ask for the *catalogue* at `limit=500`; that was the bug, not the fix: with no `source`, `TrackListView` keeps the catalogue (the shipped songs and episodes — `seed_audio.py` ships four songs and two episodes, so that path draws a short list of exactly the shape reported), and the sheet fell back to the Audio tab's `recent`/`podcasts`/`hero` whenever that read came back empty. Either way the list was not the one the phone draws. Which of the two the reported nine rows came from cannot be told without the live database — the catalogue path is the better fit, since the phone's docstring puts the shipped catalogue at ten tracks and the local seed ships four songs and two episodes, either of which reads as a list that size; that the sheet read neither the uploads shelf nor anything like it is certain from the code. Both the wrong ask and the fallback are gone. Search narrows the same shelf (`?source=drop&q=`), as the phone's box does; neither platform pages, and the drop branch caps at 100 server-side |
| The editor's Save on a sound | COMPLETE (NOT VERIFIED live) | Fixed 2026-11-02, sixth round. It called `POST /drops/{id}/save/`, which is **not a route in any urlconf** — `apps/drops/urls.py` has no `save` path — so every Save on an upload was a 404 behind a success toast. It now files the sound through `POST /saved/` with `{kind, id, on}` (`src/store/saved.ts`, `hooks/useSaved.ts`), under the key the app itself uses: `AudioTrack.savedKind`, i.e. `drop` for an upload and `track` for a catalogue row. The catalogue path used to go to `/audio/tracks/{id}/like/`, the heart, which is a different question |
| The part-length chooser in "Choose a part" | COMPLETE (NOT VERIFIED live) | Fixed 2026-11-02, seventh round. It offered **six** lengths (10–35 s in fives) where the phone offers **eleven** (`_WindowViewState._durationSeconds`, 10–60 s), so a 40- to 60-second part could not be asked for on the web at all. The list is the phone's now, and it opens as a **menu anchored to the pill** rather than the portal sheet it used to open — the one deliberate difference from the phone, which draws a modal sheet of chips here (this was the ask). The start–end readout stopped being a button, as it is on the phone, so the line has one control for its one question instead of two that did the same thing |
| Replies / edit / delete / copy / react / vote | COMPLETE | existing, preserved |
| Forward | COMPLETE / NOT VERIFIED | `ForwardSheet` → `/forward/` |
| Message info (group) | COMPLETE / NOT VERIFIED | `MessageInfoSheet` → `/info/` |
| Receipts | COMPLETE | server `status` + watermarks only; no fabricated "Delivered" |
| Typing + presence | COMPLETE / NOT VERIFIED | socket events |
| View-once / Spark | COMPLETE / NOT VERIFIED | correct send contract (`payload.view_once`), `open-once/`, recipient tile, sent/opened/gone pill, run viewer, sound band, reply, server shot line |
| Chat-screen design fidelity | COMPLETE (static) | app heading, bubble/composer metrics, run spacing, day pills, sender-at-run-head, receipt and edited placement |
| Theme's own picture inside a chat | COMPLETE / NOT VERIFIED | `theme.chatWall` behind the thread when no wallpaper was picked, at `chatVeil ?? WALL_SCRIM` of the page's own ink; the bar and composer go glass while the theme stands on a picture |
| Chat accent on an uncoloured convo | COMPLETE / NOT VERIFIED live | Fixed on 2026-11-01. `ChatPage` rebinds the whole accent family (`--accent`, `--accent-soft`, `--accent-chip`, `--accent-strong`, `--accent-rgb`) to `--convo-accent`, which `ThemeProvider` already computed as `chatTint ?? accent` — the phone's `convoAccent()`. `TINT_HEX` now carries the phone's own light-scheme readings (`kTints`: `#0E7C8C`, `#0E7A4A`, `#96590A`, `#C42348`, `#9B2FAE`) instead of the server's dark-scheme hexes, and `tintHex` answers for `default` with the app's pink `#E31B66` rather than null |
| Typing / presence surface | PARTIALLY COMPLETE | Since Round 29 the web draws the app's **two characters** over the composer — `typing` while they write, `wait` while they are merely on one of my places — so the dot line is gone. Named gaps: the **gaze** is implemented (ported from `looking.dart`) but **online/offline is still NOT IMPLEMENTED**, and a figure a **theme** ships is not in the web's catalogue. Header `online` text stays removed to match the app |
| Live thread card + reorder | COMPLETE / NOT VERIFIED | `thread.update` patched in place |
| Conversation list line, unread count and row marks | COMPLETE (NOT VERIFIED live) | Rebuilt 2026-11-03 as `home.dart`'s row. The line under a name is never the message: `Say something`, my own receipt word, `N new`, or `Nothing new` (`listLine`). The count is `N new` under the name plus a plate at the end of a **group** name, and no longer an accent circle at the far right of every row. The right-hand side is the phone's one line in its order: pin, birthday cake, timer (3 px from the spark), spark, clock (7 px). The waiting bar is the phone's 3 px mark inset 14 px. The Unread lane drops a convo whose only waiting line is a Spark (`inUnreadLane`, off `unread_other_count`) |
| Message search | COMPLETE / NOT VERIFIED | `/chat/search/` in the Convo search field |
| Drafts, emoji, attach menu, auto-grow | COMPLETE | |
| Scroll / pagination | VERIFIED (static) | anchor preserved when older pages load; optimistic rows sort last |
| Group admin (members/roles/invites/rooms) | PARTIALLY COMPLETE | list and basic management only |
| Vault / vanishing | PARTIALLY COMPLETE | mode shown; consent flow limited |
| Disappearing-message consent sheets | MISSING | |
| Sticker picker | COMPLETE (NOT VERIFIED live) | Built on 2026-11-02 as the app's `_StickerPicker`: **plus → Sticker** in a convo, a search box, a four-column grid, and the shelf read from our sticker service first (381 stickers measured 2026-11-02) with our own server as the fallback. A picked sticker sends the app's own contract — an ordinary `text` line whose payload carries `{id, url, name}` — so the picture stays where it lives and a build that has never heard of stickers still reads the name. Before this there was no sticker entry in the attach menu at all |
| Sticker in the editor and in a respond | COMPLETE (NOT VERIFIED live) | The editor's sheet reads the same shelf, with the search box narrowing what is already in hand; a respond's and a note's picker still reads **our own server only**, because `_comment_sticker()` validates the id against our own rows. A sticker arriving from the phone used to draw `"[object Object]"` — it now draws the picture the app draws, 148 px, `object-contain` |
| Keep / collab consent sheets | MISSING | |
| Offline outbox / durable sync | MISSING | `/chat/sync/` unused; needs design |
| Calls (audio/video) | PARTIALLY COMPLETE (NOT VERIFIED) | Added 2026-11-06. Real WebRTC, not a placeholder: the engine opens the devices, builds the peer mesh and speaks the phone's own socket protocol, with the relay's address from `GET /calls/ice/`. The convo header's two buttons and a call-log row's call-back button now place calls instead of toasting; the call screen draws dialling, ringing, live and the goodbye. **Missing:** ringtone, notification-based answering, an earpiece/speaker switch, camera flip, and `call.add` — a group call can be drawn but not started from the web. **Not verified:** no live backend and no second device here, so the state machine is tested and the connections are not |

### The convo row: what is still not the app's (2026-11-03)

- **The play button** — `NOT IMPLEMENTED`. The phone's `SparkPlayButton` plays the
  Sparks a convo is holding, one after another, fetched by the row's own tap. This
  build's Spark run viewer lives inside `ChatPage` (it needs the thread's pages
  and its lock), so a row cannot open one; the button is left off rather than
  drawn as a tap that navigates and then does nothing.
- **The Spark card's sound row** — `COMPLETE` as of 2026-11-05, and it was the
  last part of the card composer that was missing. "Add audio" opens the app's own
  picker (`features/audio/SoundPicker` — trending, saved, your uploads and search,
  which is what the composer's shelf already reads), its answer opens the part
  chooser (`features/audio/PartChooser`, the same drag surface the editor's audio
  tool uses), and the row then shows the sound, the part of it that will play,
  "Choose a part" and a way to take it off — the phone's `_soundRow()` exactly.
  What goes up is `sound`/`sound_start_ms`/`sound_end_ms` on the item, which the
  server has accepted since before the page existed. **Nothing has been posted
  with a sound from here against a live server**, and that is the one thing about
  this row that is `NOT VERIFIED`.
- **The muted row's tone** — unchanged, and a divergence. The phone passes a
  muted row's count as zero into its line's tone in one of its two row builders;
  this build draws a muted row exactly like any other. The tags themselves match
  (`Group`, then `Muted`, under the line).
- **The row's type sizes are the web's** — the name, the line and the clock are
  a tenth of a point to a point larger than the phone's, which is the desktop
  reading chosen in the first pass, not a port. The marks, their order and their
  gaps are the phone's.
- **Nothing here has been seen rendered.** See above.

## Other module families

| Family | Status | Remaining gap |
| --- | --- | --- |
| Shell, theme, navigation | COMPLETE | account switching missing (needs a second credential store); language preference now has its page |
| Auth (QR, dev, refresh, logout) | COMPLETE / NOT VERIFIED live | deactivation is surfaced behind its password; signup remains phone-only (backend unavailable concept) |
| Profile, privacy, devices | COMPLETE (NOT VERIFIED live) | both profile pages, the day behind the face, the face dialog, the birthday fall, mutuals, their QR; professional profile and verification each have their page; devices list and revoke. Named gaps below. |
| Social graph | PARTIALLY COMPLETE | mutuals and the crew lists are surfaced, and Insights has its page; collabs and deals remain missing (Circles is not a social-graph feature — it is on the Moments page and has landed; see the Circles rows above) |
| Drops / feed | COMPLETE core | notes and the full media sheets still partial; the Vibes shelf, walk and studio are in, and since 2026-11-06 the feed **weaves Vibes in** through the server's `vibe_share` and the phone's `mixedFeed` (`NOT VERIFIED live`). Still not in, and named rather than implied: a Vibe plays only its own `asset` (its `recipe` and `clip_urls` are read by nothing, so no voiceover, music lanes, per-clip trim or speed, overlays, filter or frame shape), there is no Vibe editor on the web, play counts never move (`POST /drops/<id>/play/` is uncalled), `category`/`interests` are never sent, and `GET /drops/mine/` is uncalled so there is no own-posts shelf — all `NOT IMPLEMENTED` |
| Moments | COMPLETE at the code level (NOT VERIFIED live) | The viewer is a port of `MomentViewScreen` — hold, carried, faces, who sheet, carry-with-edit, share gate, Add to Memories — and of its Memory branches, the shelf's long press and the Alerts deep link; see the rows above. Three things are still not the app's, and they are the only three: `links`/`tags` do not ride across with a carried picture (the web editor has no field for them), the Morning Question was removed as fabricated rather than ported, and nothing here has been run against a live backend |
| Audio | COMPLETE core (NOT VERIFIED live) | the tab's doors (category pages, the weekly board), the reco strip and every row's heart are in, and the **studio** is now a real surface — `/app/audio/studio` and one item at `/app/audio/studio/:itemId` with its audience read. Still not the app's: the full-screen swipe deck over the reco rows, the music-sheet share (playlist share only), and the downloads door (a browser has no kept-tracks store here) |
| Live rooms | COMPLETE core (room sound NOT IMPLEMENTED) | The app's Live surface is the "Live now" strip under the Moments rail, the room screen and the create sheet — all three are now the web's, plus the room's three dots (Start now / Share / Report / Close / Leave quietly) and `ReportSheet kind="room"`. The web's `/app/live` shelf is a web-only door. **Room sound is NOT IMPLEMENTED**: the app's stage audio is a WebRTC mesh over the same relay the calls use, and although the web has had a client for that relay since 2026-11-06, the room page was not wired to it; the page says so |
| Sparks / rewards | PARTIALLY COMPLETE | leaderboard and reward screen partial; the run sheet opened from a convo row landed 2026-11-03 (`SparkSheet`, a port of `screens/spark.dart`) and its "Add to Moments" pill, the card painter and the composer behind it landed 2026-11-04 (`features/sparks/card.ts`, `SparkMoment.tsx`); the composer's own two faults were both found by opening it and both fixed the same day (an unbounded face wait, then a cross-origin avatar tainting the canvas — the picture is now asked for CORS-clean, falls back to initials, and is retried once without pictures). On 2026-11-05 the painter gained **four looks the phone does not have** (`midnight`, `sunset`, `aurora`, `noir`, drawn from a four-card design sheet, chosen at random per card; `classic` is the phone's card and is unchanged and pinned by a test — that test caught the one regression that reached it, a field colour laid over its white paper, which is fixed). The four were rebuilt later the same day against measurements of the sheet after the first attempt was rejected for not matching it. That is the web being *ahead*, not a gap — but it is also `NOT VERIFIED`: the four were rasterised in headless Chrome and measured (each within ~4 % of its sheet counterpart in the motif region), but never seen; measuring is not looking, the names on the four cards are a judgement the sheet does not state, and the house rule against gradients means the sheet's smooth glow is approximated by stacks of flat steps |
| Marketplace (Drip / Themes / Logos) | COMPLETE / NOT VERIFIED | one page, three aisles, one purse, ported aisle by aisle from `marketplace.dart`, `drip.dart`, `theme_shop_view.dart`, `logo_shop_view.dart`; every write goes to an existing endpoint |
| Themes, logos and drip in the shell | COMPLETE / NOT VERIFIED | a theme's picture now reaches the shell, the marketplace, the preview and the inside of a chat; the preview moves the whole web rather than a box in it |
| Notifications | COMPLETE on the app's own rules (NOT VERIFIED live) | list, in-app strip, hidden-tab rows and one routing table; a row after the site is **closed** is BLOCKED (FCM-only push), and server-backed preferences do not exist |
| Media pipeline | PARTIALLY COMPLETE | video poster generation missing; upload progress now done |
| Deals / collabs / codepad | MISSING | large separate modules. Circles landed on 2026-11-01 and is tabulated above |
| Studio / editors (image, video, vibe) | PARTIALLY COMPLETE / MISSING | browser-constrained |

## Profile: what is still not the app's

The two profile pages are ports, not redrawings, and the list below is what a
careful reading of `profile.dart` and `person.dart` still finds missing.

| Item | Status | Why |
| --- | --- | --- |
| The theme-bundled figure behind a bio | PARTIALLY COMPLETE | `PosedBio` draws the pose and the character's name, but the web's theme catalogue does not carry the figure's *pictures*, so the figure itself is absent. The name is real; the art is not on this build. |
| The ⋮ sheet's convo section on somebody else's page | MISSING | `person.dart` folds that convo's own settings into the sheet (rename, mute, wallpaper, vanish). The web has no convo-settings sheet on a profile, so the web's ⋮ holds mute and report only — it does not draw rows it cannot honour. |
| Live-moment ring on the *drops* feed and in search | COMPLETE / NOT VERIFIED live | Done on 2026-11-01. `useLiveRings()` (`src/features/moments/live.ts`) reads the same `["moments-tray"]` query the Moments tab draws and answers with the `unseen` authors, which is `Moments._rings` / `hasRing` on the phone. `DropCard` rings the author's face with it and so does `PersonRow` in search — the feed and the results no longer draw a bare face for somebody with something still to watch |
| The face's hold on a touch screen | COMPLETE, NOT VERIFIED | The hold is a 480ms pointer hold with the follow-up click swallowed. It has not been tried on a real touch device here. |

## Notifications: what stands, and what cannot

The third phase of the ask — *notifications exactly as the app has them, real
time, and a popup when the site is closed* — is two thirds done and one third
impossible from inside this project.

| Piece | Status | Why |
| --- | --- | --- |
| Alerts list, to the app's geometry | COMPLETE (static) | card, face, badge, mark door, tile, keep answers, unread dot and scroll-for-more all read off `screens/alerts.dart` |
| Alert kinds the row did not know | COMPLETE | `friend_moment` and `studio` now have a sentence, a tone, a glyph and a route |
| Live alerts | COMPLETE (NOT VERIFIED live) | `alert.new` / `alert.read` patch the list; a hidden tab also gets a system row |
| In-app strip | COMPLETE (NOT VERIFIED live) | `features/notices`, the phone's `Notices` rules: 4s hold, five deep, same-conversation replacement, ordinal dedupe, muted and watching skipped, chime only in front |
| The tab's own row while the site is open in the background | COMPLETE (NOT VERIFIED live) | the browser's `Notification`; a strip that is up when the tab goes away is handed over to it |
| A row after the site is **closed** | **BLOCKED** | the server's only push road is Firebase, to `Device.push_token`. A web push endpoint needs a Firebase project config, a VAPID key and a service worker — none exist in this build, and the backend may not be changed. Nothing was faked: the Notifications page says the sound stops when the site closes |

This is a limit of the address, not of the code: the same server, asked by the
phone, rings a pocket. A browser has no such address yet.

## What is deliberately not claimed

- **No 100% parity claim.** Large product families above remain unimplemented.
- **No live real-time claim.** The socket wiring is implemented and matches the
  backend frames, but no live two-client run happened here. Cross-device sync
  is `NOT VERIFIED`.
- **No fabricated state.** Receipts, unread counts, previews and forward counts
  come from server responses. Where a capability is absent (calls, signup,
  sync replay), the UI says so instead of simulating it. The marketplace keeps
  this rule as tightly as the chat does: nothing is bought optimistically, a
  purchase that the server refuses leaves the shelf exactly as it was and says
  so, and no button in the three aisles is a button that does nothing.
- **No card is drawn for a payload nothing writes.** The four convo cards added
  on 2026-11-02 (`payload.track`, `payload.profile`, `payload.story`,
  `payload.moment_ref`) were each traced to a writer first — the server for the
  playlist, the story and the moment reference, the phone (passed through by
  `chat/views_messages.py`) for the song and the person — and the story card's
  "Remention" offer, which on the phone opens the editor before the picture goes
  up, is not drawn on the web rather than drawn as a button that could not do
  what it says.
- **No live convo run.** Not one of the eleven card kinds has been seen in a
  browser against a real thread, and no share was sent. `ChatPage`'s chunk was
  built and its types checked; that is all that was checked.
- **No live marketplace run.** Not one purchase, wear or figure pick was
  executed against a running backend. The aisles are wired to endpoints that
  were confirmed to exist by reading the backend's URL conf, and that is all
  that was confirmed.
- **No claim to have seen the four card looks.** The four looks added on
  2026-11-05 were built from a design sheet that was *measured*, not looked at —
  this session cannot view an image, so the sheet was read by a PNG decoder
  written here, by colour-band probes over each card rectangle, and by Windows'
  own OCR for the words. The composition, the grounds and the pill are therefore
  measurements. Two things are not, and are recorded as judgement rather than as
  fact: **which of the four names belongs to which of the four cards** (the sheet
  carries no labels) and the adaptation itself, since the sheet's cards are 4:5
  while the real card box is 840×1520. Nothing has been rendered: no card of any
  style has been drawn on this machine, and the phone has no counterpart to
  compare against.

- **No live audio-shelf or save run.** The two sixth-round fixes — the editor's
  sound sheet drawing the uploads shelf, and Save filing a sound through
  `POST /saved/` — were made against a route read out of `apps/audio/views.py`
  and a write read out of `apps/saved/views.py`, and both are pinned by unit
  tests over the pure rules (`src/features/audio/audioShelf.test.ts`). Neither
  has been watched happening in a signed-in browser, so both are
  `NOT VERIFIED`, not done. In particular, how many rows the uploads shelf
  actually holds on the live database was never counted.
- **No live run of the part-length menu either**, from the same seventh-round
  pass: that it draws above the pill inside the sheet, follows the sheet's scroll
  and moves the frame when a length is picked are all unwatched. Its arithmetic
  is covered by `src/features/audio/partLength.test.ts` and its list was read off
  the phone, but nothing has rendered it.
- **No live run of the two eighth-round fixes.** The feed's error
  (`options.getNextPageParam is not a function`) was reproduced outside a browser
  against the old shape and is gone with the shape fixed
  (`src/features/drops/feedQueries.ts`), and the stuck page lock is a counted
  lock now (`src/utils/scrollLock.ts`) instead of four save/restore pairs that
  could strand it. Both are pinned by unit tests; **neither has been watched in a
  signed-in browser**, so neither is called verified. The bug reports themselves
  were intermittent, which is the one thing a unit test cannot reproduce.
- **Two more defects were found while reading that code and are only read, not
  reproduced**: the convo's Spark viewer held the page lock for the whole life of
  a convo rather than while a Spark was open, and its walk kept its position
  across runs, so a shorter run reopened afterwards drew nothing at all — a tap
  that did nothing, now reset. Both are fixed in the same pass and both are
  `NOT VERIFIED`, same as everything above them.
- **No live look at the editor's one surface either** (ninth round). Every tool
  panel, every control on one and the sticker sheet now draw on the theme's card
  and ink — the pair the audio sheet already used — from four named class
  constants in `PhotoEditor.tsx`. The suite does not render a component, so the
  four checks prove it compiles, lints and bundles and nothing else; the light
  default theme, which is where the two grammars were most visible, is exactly
  the state no run here can show. `inkOn`'s black-or-white split is a luma
  threshold, not a contrast measurement, and no checker was run over the plate
  row or the accent-filled tab.
- **And one thing was deliberately taken away.** The editor's text field used to
  write its own words in the chosen colour. It no longer does: the palette opens
  on `#ffffff` and ends at `#111111`, so on a light panel the first is an
  empty-looking field and on a dark one the second is, and no single ground fixes
  both. The colour is now a dot at the head of the field. It is the only
  subtraction in this pass and it is stated here rather than left to be noticed.
- **The editor is not the phone's editor.** The app's own panel is charcoal in
  every tool's sheet; the web's is now the theme's card. That is a divergence
  from the reference this build is otherwise measured against, taken at the
  user's instruction and recorded as a divergence, not as parity, in
  `XELVIC_FEATURE_PARITY_MATRIX.md`.
- **No live run of the convo row or the Spark sheet either** (tenth round). The
  three reported defects are fixed in source and pinned by tests — the line's
  grammar, the plate's placement and the lane's membership are pure functions
  with cases over them — but the suite is `environment: "node"` and renders
  nothing, no backend is reachable here, and the sheet's live behaviour (the
  refresh read, the 1-second tick, the hide switch, the restore button) has
  never been exercised. The buy-back is the one write in this pass that spends,
  and no wallet was drawn down. The three routes it uses were confirmed by
  reading `backend/apps/sparks/urls.py`, the backend was not written to, and
  nothing was added to the contract.
- **The Spark sheet's last pill is now drawn, and its card with it** (eleventh
  round, 2026-11-04). The sheet ends with the phone's `_comingUp()` row — the next
  rung's sentence and the "Add to Moments" pill — and the pill opens a real
  composer: the card painted exactly as `spark_moment.dart` paints it, the
  audience pill, the mention switch, and one button that uploads the card and
  posts it to `POST /moments/`, saying so only after the server has taken it. One
  thing about it is not claimed: **nothing has been posted from this composer** —
  the routes were read from the contract and matched against the phone's own
  `postMomentNow`, but no authenticated session exists in this environment, so no
  moment was created and no refusal was observed. The painter was run in a real
  browser on this machine and looked at, and so was the composer page itself —
  mounted with the real `Modal`, the real font and real media answers, where the
  card was timed as painting at 401 ms with no photos and at 15.4 s against a
  media read that is never answered; the picture has not been diffed against a
  phone's own rendering. The phone's sound row, which this pass left off, landed
  on 2026-11-05 (see the sound row above); two differences from the phone are
  still named rather than closed: the card's words (English only here; the phone
  draws them from `strings/en.dart`, so a Hindi phone draws a Hindi card, and the
  painter takes no translator), and my own face's presence dot (this client passes
  the server's answer for `me.online` rather than the phone's assumed `true`). The
  row's play button still stands as `NOT IMPLEMENTED` for its own reason.

## Recommended next steps, in priority order

1. Run the live pass in `XELVIC_TESTING_REPORT.md` §5 with a real device pair.
2. Group admin surfaces (members, roles, invites, rooms) — the largest
   remaining conversation gap.
3. Web push, if the backend ever grows a browser address: a Firebase web app, a
   service worker and a `Device` row are the three missing pieces, and none of
   them can be added from `xelvic-web/` alone.
4. Offline outbox design (this is where the mobile app's `offline/*` store has
   no web equivalent yet).
5. Then the large independent modules (collabs, deals, editors), one at a
   time, each with its own tracker entry. Circles was closed out on 2026-11-01
   (see its section above) and is no longer on this list.

Closed in the 2026-11-01 Moments pass, and left here so the list is not read
as the whole of it: the Memory walk (`isMemory`), managing a Memory from the
shelf, a Memory opened out of Alerts, carry-with-edit, the live ring on the
feed and in search, and the chat accent on an uncoloured convo — and, in the
Circles pass the same day, the whole Circles section, its picker and its own
page.

## Round 18 — what is still not claimed (2026-11-06)

The round that added a ring, a call notice, camera quality, a new call layout and
a room's sound. Everything below is what it does **not** claim.

- **No live verification of any of the six.** The backend was not reachable from
  here, and there was no second device, no microphone, no camera, no vibrator and
  no real browser notification surface. A ring, a notice, a device list, a
  `getStats` pill and a room's voices are all written and tested as arithmetic; not
  one has been seen working. They are `PARTIALLY COMPLETE (NOT VERIFIED)`.
- **No claim that the mesh connects.** `features/rooms/mesh.ts` and the calls' own
  rules are covered by unit tests over plain values: who offers, when a pair is
  rebuilt, what a signal reads as. `RoomStage` itself — the connections, the
  candidate queue, the rebuild — is covered by nothing, because `environment:
  "node"` has no `RTCPeerConnection` in it.
- **No claim that a notification is answered.** The service worker's Decline and
  Accept are drawn and the press is fed back into the engine, but no browser
  notification was ever shown one, so the round trip from the notice to the call is
  unexercised.
- **No sound for a listener past the relay's limit.** The server carries the stage
  plus its first 8 listeners (`MEDIA_LISTENERS`); a listener past that is in the
  room and is not sent anything, and the page says so rather than pretending
  otherwise. The web's copy of that number is a client-side constant that will
  drift silently if the server's value moves.
- **No audio a browser refuses.** Where a browser denies sound outright — no
  recording and no audio context — the ring screen says so. Nothing claims a
  ringtone in a browser that will not play one.
- **No parity claim, and no call the phone cannot make.** `call.add` is still not
  sent by this client, so a group call can be drawn but not started or grown from
  the web, and there is no earpiece/speaker route switch because the browser offers
  no such control. The room's sound rides the same relay the phone's `stage.dart`
  uses; it is a port of it, not a second implementation to be trusted.

## Round 19 — what is still not claimed (2026-11-06)

The round that answered three of the owner's own reports — the flipped picture,
the card that spilled off the screen, and a feed with no Vibe in it — and, with
the last of them, wove the Vibes into the feed that the phone had been weaving all
along. Everything below is what it does **not** claim.

- **No live verification of any of the three.** The mirror rule, the card that
  now fits the screen and the feed weave are all written; the weave's arithmetic
  is tested, and nothing else is. No device and no browser run was made, and no
  live server was reached, so not one of the three has been seen working in a real
  browser or against real data. The mirror rule falls back to *mirrored* for a
  camera that reports no `facingMode` at all, which is an honest default rather
  than a known-good one, and the `VibeViewer` height change is a reasoned fix with
  medium confidence, not a watched one.
- **A Vibe still plays only its own `asset`.** The server sends the recipe
  (`recipe`) and the addresses of the uploads it names (`clip_urls`) and this
  client reads neither, so a Vibe edited on the phone — with a voiceover, music
  lanes, per-clip trim and speed, overlays, a filter and a chosen frame shape —
  plays on the web as its first clip alone. `NOT IMPLEMENTED`.
- **No Vibe editor on the web.** The composer posts `{asset, caption, music,
  mentions, sensitive}` to `POST /drops/vibes/`; `recipe`, `category`, `interests`
  and `track_id` are accepted by the server and never sent by this client.
  `NOT IMPLEMENTED`.
- **Play counts never move from the web.** Nothing under `src/` calls
  `POST /drops/<id>/play/`, which the phone calls (`app/lib/audio.dart:1975`), so
  a sound played in the browser does not advance `plays` and the poster's own
  numbers do not include it. `NOT IMPLEMENTED` — a silent omission, not a claim
  on screen.
- **No own-posts shelf, and nothing to file into.** `GET /drops/mine/` is called
  by nothing here, so there is no "my own posts" shelf, and `GET /drops/interests/`
  is uncalled with `category` / `interests` never sent, so a post made here
  carries no interests and cannot be filed. `NOT IMPLEMENTED`.

## Round 24 — what is still not claimed (2026-11-12)

The round that answered the owner's six-row composer menu — *"please ab convo ke
chatscreen ke input me jo plus par click karne par open hota hai, please usme photos
and videos, file, Location, Spark, sticker aur emoji ka option add kijiye"* — and
with it sent a place for the first time. Sections for Rounds 20 to 23 were not
written into this file; this one is, because a feature left the tree. Everything
below is what the round does **not** claim.

- **Creating a poll in a chat is MISSING from the working copy, and this round did
  not remove it.** The last commit's `ChatPage.tsx` has a fifth menu row —
  **Ask the crowd** — opening a `PollComposer`; the working copy has neither, and
  `PollComposer`, `pollOpen` and `sendPoll` are in no file in the tree. Every
  session transcript on this machine (115 files, subagents included) was searched:
  no edit removed that block, and the panel this round replaced already had four
  rows. **Answering** a poll still works (`PollMessage`, `vote()` →
  `chatService.vote`). It was left exactly as found — restoring somebody else's
  removal was not this round's request. Not a parity loss against the phone, whose
  chat creates no polls either.
- **No live verification of the location send.** No server was reached and the live
  API was never contacted, so a location message was never delivered: the send is
  verified as this client's request and its optimistic bubble, with the backend's
  acceptance of `kind: "location"` read from `apps/chat/models.py:562` and
  `apps/chat/services.py:65-67` (in `EMBED_KINDS`, not in `MEDIA_KINDS`, so no asset
  is asked for). `PARTIALLY COMPLETE (NOT VERIFIED)`.
- **A room's own rule is still not honoured by the composer.** The phone shortens
  its attach sheet by the room (`only`, `text_only`) and `channel_allows` exists in
  `services.py`, but the web's `Channel` type carries `{id, name, position}` and no
  rule, so a photos-only room here still offers *File*. Pre-existing, named, not
  closed. `MISSING` a rule to read.
- **The phone's attach sheet is not matched row for row.** Seven roads there
  (Camera photo, Camera video, Photos and videos, Sticker, Song, Audio file, File)
  against six here, which add *Location* and *Emoji* and fold audio into *File*:
  **Song** has no row, and there is no *Camera photo* / *Camera video* split.
  `PARTIALLY COMPLETE`.
- **The place sheet is the chat composer's only.** The phone opens
  `app/lib/screens/place_sheet.dart` from the drop composer and the live camera; on
  the web the drop composer still takes a place as a typed string
  (*"Where was this?"*) and the camera keeps its own `findCurrentPlace`. `MISSING`
  elsewhere, and not asked for.
- **Naming a position asks a third party.** The reverse lookup and the search go to
  OpenStreetMap (Nominatim, with a BigDataCloud fallback) from the reader's browser,
  as the camera has always done — moved, not new. No accuracy travels with a
  searched place because a browser gives none, and a geocoder that is down draws
  "nothing by that name" rather than an invented row.
- **Measured with a mouse, not a finger.** The menu and the sheet were driven in a
  real browser against the real app; no touch screen, and no real backend, was
  involved.
## Round 25 — what is still not claimed (2026-11-12)

The round that answered the owner's four asks about the convo header's Vibes — *"uska design fix
kijiye aur usme like, comment share aur save ka bhi option rakhiye aur abhi usme kewal followers
ka hi videos aa raha hai jabki sabhi ka aana chahiye aur jo jo drops ke vibe me wo sab kuch
chatheader ke vibes me bhi hona chahiye"*. Everything below is what the round does **not** claim.

- **The picture was never watched.** The probe's stub served a four-byte stand-in in place of a
  video, so what the panel looks like playing a *real* Vibe is **NOT VERIFIED**. What is measured
  is the chrome — the bar, the rail and its hit boxes, the caption, the comment strip, the
  prompts, the pad, the player panel — and every write. The frames are not.
- **No live anything.** Every measurement was against a local stub on loopback. No live request
  was made, no real account was used, and the live shelf's composition, live media delivery and
  live moderation are **NOT VERIFIED**. The shelf's `limit=8` hand, its cursor paging and the
  off-by-default reco lanes are exactly as they were.
- **"Only followers' videos" was answered by measurement on this side, not by a fix.** The client
  sends no author filter, and the read-only backend's `visible_vibes` has no followers-only
  clause — so if the live shelf still looks narrow, that is the corpus the server deals, and it
  was not changed here. **The backend is read-only this round**: no endpoint, migration, setting
  or contract change.
- **Share is verified as a sheet, not as a send.** The rail's Share opened the app's own sheet on
  the panel's clip — *Send to Jaya*, *Another app*, *Copy a link* — but nothing was picked inside
  it, so **no share write was ever sent** and no server accepted anything. Felt, comment and save
  were each recorded on the wire; share was not. `PARTIALLY COMPLETE`.
- **Touch is NOT VERIFIED.** The panel was driven with a mouse and a keyboard in a headless
  browser. The 500 ms hold, the double tap and the 2× pad were exercised as pointer events with
  the correct timings, which is how the release-click bug was found — but a finger on glass was
  not used, and a phone's own gesture arbitration is not in evidence.
- **The phone's own file was not re-read.** This round's comparison with the phone rests on
  earlier rounds' reading of its convo screen. The phone draws Vibes inline in the thread and the
  web draws them in a panel beside it; that difference was not closed, and the two panels were
  not compared element by element.
- **Not a claim of parity.** The panel stopped being a second, thinner player and became the
  walk's own clip with a panel's chrome. Two controls are deliberately absent from it — *Your
  studio* and *New Vibe* — because both navigate away from the thread; a reader who wants parity
  should read that as a decision, not an oversight.
- **The composer's poll row is still missing**, unchanged from Round 24, and this round's edits to
  `ChatPage.tsx` were confined to the header's Vibes door. It was left exactly as found.

## Round 26 — what is still not claimed (2026-11-12)

The round that answered the owner's two asks about the composer's sticker sheet — *"us panel ka
hight aur width exact emoji panel ke jitna kijiye aur sticker panel jo stckers hai un sab ka size ek
jaisa nahi hai, please sabhi ka size ek jaisa kijiye, chota bada na dikhe"*. Everything below is what
the round does **not** claim.

- **The editor's sticker shelf was not changed.** `src/features/camera/PhotoEditor.tsx` draws its own
  shelf at `size-full object-contain` over the same 602 stickers, so it **still shows the uneven
  sizes** this round removed from the composer's sheet. It was deliberately left as it was and is
  named here rather than quietly implied to be fixed. `NOT IMPLEMENTED` there.
- **The phone was read, not changed, and not measured.** `app/lib/screens/chat_sticker.dart` gives
  every sticker a uniform square cell with `BoxFit.contain`, which fits the *file* for exactly the
  same reason — so the phone shows the same unevenness. `xelvic/` is read-only and nothing in it was
  created, edited or deleted. **Not a claim of parity.**
- **Touch is NOT VERIFIED.** Both panels and all four re-measured stickers were measured with a
  mouse in a headless browser. A finger on glass was not used.
- **No live anything.** Every panel measurement was against a loopback stub on loopback. No live
  request was made and no real account was used. The catalogue the stickers came from *is* live and
  public, but it was read for its rows and its pictures' alpha channels, nothing more.
- **The two panels are one box and one sticker size — and nothing more.** The box and the sizing rule
  were unified because that is what was asked. The two panels were not otherwise made identical, and
  no parity percentage moved.
- **Equal area was considered and refused.** Every sticker's *longest visible edge* is what is
  equalised, so a genuine 1.86 : 1 sticker is still drawn 63 × 34. Equal area would have meant drawing
  a wide sticker wider than its own cell, cropping its wings or overlapping its neighbour. That is a
  decision, not an oversight.
- **The backend is read-only this round** — no endpoint, migration, setting or contract change — and
  the pictures' own hosts are third-party services this client has always used.

## Round 27 — what is still not claimed (2026-11-12)

The round that answered the owner's two asks about the shelf of stickers — *"Abhi sabhi stickers nahi
aa raha hai, please ise fix kijiye jisse sabhi stickers aaye aur agar isme koi gif ka bhi hai to isi
me ek gif ka section add kijiye jisme sabhi gif dikhega aur agar nahi hai to leave it kewal sabhi
sticker ko laiye"*. Everything below is what the round does **not** claim.

- **No GIF section — because there are no GIFs, and that is a finding, not an omission.** The
  catalogue paged through seven pages gives **602 rows, 602 unique ids**, and **`animated: true` is 0
  of 602**. The owner's own instruction covered this case (*"agar nahi hai to leave it"*), so nothing
  GIF-shaped was built. If the catalogue ever gains animated rows, nothing on this shelf would show
  them as animated — they would be drawn as still pictures, exactly as they are today.
- **"Every sticker arrives" is claimed for the composer's shelf only.** The editor's own shelf
  (`src/features/camera/PhotoEditor.tsx`) still uses `loading="lazy"` over the same 602 stickers, so
  on a long shelf it **still behaves as the composer's shelf did before this round**. Unchanged and
  unmeasured. `NOT IMPLEMENTED` there.
- **The phone was read, not changed, and not measured in a running app.** `app/lib/screens/
  chat_sticker.dart` loads its pictures lazily too, so the same behaviour is still the phone's.
  `xelvic/` is read-only; nothing in it was created, edited or deleted. **Not a claim of parity.**
- **The cost is real and it is a first-open cost.** A cold open pulls **602 pictures, 26 MB, one
  request each**, with the last drawn about **7.5 s** after the panel appears. That is the trade this
  round made: a shelf that arrives drawn instead of a shelf that arrives blank. Every picture answers
  `immutable, max-age=2592000`, so a warm re-open measured `files: 0, mb: 0` — but the first open of
  a month pays it, and on a slow connection it will take longer than 7.5 s.
- **A slow connection is NOT VERIFIED.** The timing above is this machine on this connection. The
  number that does not change on a slow link is the one that matters: every sticker still arrives —
  but *when* was not measured anywhere but here.
- **Touch is NOT VERIFIED.** The shelf was scrolled with a wheel and clicked with a mouse in a
  headless browser. A finger's flick, and its momentum, were not used.
- **No live anything behind the app.** Every in-app measurement was against a loopback stub. No live
  request was made and no real account was used. The catalogue itself was read live — its JSON, and
  one picture's headers.
- **The pictures were not made smaller, on purpose.** The Cloudinary transform in a row's URL is part
  of the URL that is **sent to the backend** when a sticker is picked, so asking for a smaller file
  would have changed the message rather than the download. The 26 MB stands.
- **The box and the grid were not touched.** Round 26's 340 × 363 box, four columns and 63-pixel
  drawing box are as the owner asked in the previous round; this round changed only *when* a picture
  is asked for.
- **The backend is read-only this round** — no endpoint, migration, setting or contract change — and
  none of the addresses this round used are the backend's at all.

## Round 28 — what is still not claimed (2026-11-12)

The character now comes up over the composer while the other person writes, at the phone's own three
numbers, and the measurements above say so. What follows is what that does **not** mean.

- **The web's figure chain is shorter than the phone's, and this is a real gap.** The phone tries
  their worn figure, then the figure their **theme** ships, then the app's own. The web's catalogue
  carries a figure's pictures but **not a theme's figure pictures**, so the middle rung cannot be
  reached from here: an account wearing no shop figure gets the **bundled** figure rather than the one
  their theme bought. Recorded as `NOT IMPLEMENTED`, not smoothed over. The alternative — inventing a
  lookup the API cannot answer — would have drawn a figure that is not theirs, which is worse than
  drawing the app's own.
- **A theme's `figure_peek` size is not read.** A *shop figure's* `peek_size` is read from its own
  row, and a figure with no row falls back to the phone's 84. The phone also reads the size off the
  theme's row; the web does not, and does not draw one.
- **Typing between two live accounts is NOT VERIFIED.** Every frame the round was measured against
  came from a loopback stub that speaks the shape read out of `consumers.py` and `services.py`. No
  live request was made for the typing frames and no real second account was used. What is proven is
  that the page draws the figure on the frame the backend is documented to send — not that the
  backend and the app agree in production.
- **The dead-man timer was not exercised.** The app clears a typer after the frame's own `ttl`; the
  backend's `TYPING_TTL_SECONDS` is 6 and the phone's `kTypingNet` is also 6 seconds. The probe's
  waits were 700 ms, so whether a note that never stops really falls after six seconds is read from
  the code and **not measured**.
- **Touch and a real phone were not used.** The capture is a mouse at 1280 × 900. The character is
  `pointer-events-none` and was read as taking no taps, but a finger on a phone-sized viewport was not
  tried.
- **The words are gone on purpose, and that is worth saying rather than discovering.** The phone
  removed `typing...` in favour of the figure, and the web now does too. What remains for a reader who
  cannot see the character is a single `sr-only` `role="status"` sentence, measured reading
  `Jaya is typing...` while the figure is up and `""` while it is down. A sighted reader who preferred
  the words no longer has them.
- **The real-time half was not built this round and no claim that it was is made.** The socket send
  and the `thread.typing` receive both predate this round and were left alone; the round changed what
  is **drawn** on a frame that was already arriving.
- **The phone was read, not measured.** `app/lib/screens/chat.dart` and `app/lib/catalogue.dart` were
  read for the numbers and the rule, and nothing under `xelvic/` — app, backend or iOS — was created,
  edited or deleted. The phone was not run, so its own behaviour is quoted from its source rather than
  observed. **This is not a parity claim.**
- **`ChatPage`'s chunk got smaller and that is not an achievement.** 150.69 kB → 149.76 kB, because the
  visible words came out and `Pose`/`marks` is a shared chunk now. It is recorded because the number
  moved, not because it means anything.

## Round 29 — what is still not claimed (2026-11-12)

Both of the phone's characters now stand over the composer, and the measurements in
`XELVIC_TESTING_REPORT.md` say which one stands at each of six moments. What follows is what that does
**not** mean.

- **The second character needed a feature the web did not have, and this is the round's real content.**
  `wait` is not fed by the typing mechanism. It is fed by the **gaze** — where the other person is
  looking — which arrives as a `focus` frame, and the web had no code for it at all: a search for it
  found only `window.addEventListener("focus")` in an unrelated view. So this round ported
  `app/lib/looking.dart` (272 lines) and the convo's and profile's halves of it before there was
  anything to draw. Saying "the typing indicator now has two characters" without that would have hidden
  the actual work, and would have been a claim about a feature that did not exist.
- **Two live accounts looking at each other is NOT VERIFIED.** Every frame came from a loopback stub
  that speaks the shape read out of `consumers.py` and `settings.py`. No live request was made for the
  `focus` frames and no real second account was used. What is proven is that the page asks, says and
  draws on the frames the backend is documented to send — **not** that two phones and a browser agree
  in production. **This is not a parity claim.**
- **The 30-second sweep is a unit test, not an observation.** `GAZE_STALE_MS` is the server's own
  `FOCUS_TTL_SECONDS` (30) and is pinned at its boundary — believed at 29 999 ms, dropped at 30 000 —
  but no probe waited out a real lapse. The other half of that story, a **peer who vanishes without
  saying goodbye**, is exercised through `staleGazes` and never through an actual vanished peer.
- **Presence — is the other person *online* — is NOT IMPLEMENTED.** The phone watches it; the web does
  not. The gaze is a different fact and does not stand in for it; the two are separate rows in
  `XELVIC_FEATURE_PARITY_MATRIX.md` and both stay `PARTIALLY COMPLETE`.
- **The web's figure chain is still shorter than the phone's.** `Round 28`'s gap stands unchanged: the
  catalogue carries a figure's pictures but not a **theme's** figure pictures and not a theme's
  `figure_peek`, so an account wearing no shop figure gets the bundled one rather than the one their
  theme bought. Recorded as `NOT IMPLEMENTED`, not smoothed over.
- **One deliberate deviation, written down as one.** The phone remembers "the last pose" as one of
  three files in its own bundle, which cannot go away while it runs. The web's poses are shelf URLs
  that change when somebody changes their figure, so the memory in `TypingPeek.tsx` is **keyed to the
  set of pictures it came from**. Without that key a figure change mid-convo would leave the character
  standing in the previous figure's pose. This is not what the phone does; it is what the web has to
  do to mean the same thing.
- **The `left` frame in the convo's own log is a dev-mode artefact, and it is not offered as
  behaviour.** One clean open logged `ask → say chat → left → ask → say chat`, the `left` being React
  **StrictMode** double-invoking the effect (mount, cleanup, mount). A production mount runs it once.
  The teardown order is deliberate — unwatch first, then a **named** goodbye, so a goodbye for one
  person can never be read as somebody else's — but the extra pair is StrictMode and is recorded as
  such.
- **A defect was found in the probe, not in the page.** The first attempt to measure that the ask and
  my own word are *repeated* printed "8 asks and 9 words about me" because the stub's frame log had
  been accumulating since a **previous run** — a leftover counted as a repeat. The stub grew
  `POST /__clear`, the driver calls it at the start, and the check now measures a delta. The corrected
  reading is **2 frames 8 seconds after the page settled**: one `ask` and one word about where the page
  is. It is written here because the wrong number existed and would otherwise have been believed.
- **One of the round's own tests failed first, and the fault was the fixture.** `staleGazes(seen,
  30_000)` was expected to drop an entry at `at: 500`, which is only 29.5 s old — the assertion was
  wrong, not the rule. Fixed to `now = 60_000` with entries at 0, 45 000 and 20 000.
- **Touch and a real phone were not used.** The capture is a mouse at 1280 × 900.
- **The phone was read, not run.** `app/lib/looking.dart`, `app/lib/screens/chat.dart`,
  `apps/chat/consumers.py` and `config/settings.py` were read for the rule and the numbers; nothing
  under `xelvic/` — app, backend or iOS — was created, edited or deleted. The backend remained
  strictly read-only: the `focus` frames this round now sends and reads are frames the backend
  **already had**, and no endpoint, migration, setting or contract was changed.
- **`ChatPage` grew, and it is reported as growth.** 149.76 kB → 150.53 kB, from the watch/say wiring
  the convo now needs. Unlike Round 28's fall, this one is not offered as anything.

## Round 30 — what is still not claimed (2026-11-12)

The chips a convo forms are now the phone's own objects, and one of them had **never been drawn at
all**. What follows is what that does not mean.

- **The call chip's absence was a client bug, not a contract question, and calling it a "chip fix"
  would understate it.** `callNote()` read `message.payload.call` as an *object* holding `media`, while
  `_write_log` has always written one **flat** dictionary — `{"call": "<uuid string>", "media": …,
  "outcome": …, "seconds": …}`, `call` a string with the rest as its siblings. The guard never passed,
  so **every call in every thread fell through to an ordinary bubble** — from the day the code was
  written. It was proven by dumping the message list's `outerHTML`, not by reading the source.
- **Two live accounts were not used and no call was placed or received.** Every reading came from a
  loopback stub in a headless browser. What is proven is that a note of that shape draws the phone's
  plate and that pressing it sends the ring frame the relay documents — **not** that a real call
  produced it. **This is not a parity claim.**
- **Only a PDF was measured, so the fallback words are NOT VERIFIED.** `Image`, `Video`, `Document` and
  `Audio` come from `_fallbackType` in `chat_media.dart`; no file without a MIME went through the page,
  so that path is read and not exercised. The duration suffix on a voice note was likewise not
  exercised.
- **The file chip's download was not confirmed to save.** It is an `<a download>` pointing at the
  authenticated media URL the API returns. That it renders and reads correctly is measured; that a
  browser writes the file to disk against a real backend is **NOT VERIFIED**.
- **The phone's file-name size is an inference and is recorded as one.** `_FileRow` gives the name
  `X.text` at w700 and **no `fontSize`**, so it inherits Material's default 14. The web draws 14 to
  match the inheritance. If that default ever moves, this is the number that silently becomes wrong,
  and it was never measured on a device.
- **Two defects in this round's own probe were mine, and both would have made the page look wrong.**
  The stub wrote the call notes as `kind: "text"` where `chat.system_note` writes `system`, and used
  `mime_type` where the serializer's field is `mime`. Both were caught by dumping the DOM. They are
  written here because a probe that is wrong about the contract is a probe that indicts the page.
- **A third probe fault was a measurement fault.** The day pill's radius was first read off a
  `rounded-full` span, where a browser clamps `full` to half the height (11.5px on a 28.5px pill). The
  reading was taken from the plate instead, and that is what changed the code to `rounded-[20px]`.
- **A video call was drawn from a note but never placed**, and the same is true of every call state —
  declined, missed, ended. The four glyphs and the two inks are measured as drawings, not as calls.
- **Touch and a real phone were not used.** The capture is a mouse at 1280 × 900.
- **The phone was read, not run.** `app/lib/screens/chat.dart`, `app/lib/calls.dart`,
  `app/lib/screens/chat_media.dart`, `apps/calls/services.py`, `apps/chat/services.py` and
  `apps/chat/serializers.py` were read for the shape and the geometry; nothing under `xelvic/` — app,
  backend or iOS — was created, edited or deleted, and the backend gained no endpoint, migration,
  setting or contract change.
- **`ChatPage` grew again, and it is reported as growth.** 150.53 kB → 151.10 kB, from the file-chip
  rebuild. No improvement is claimed in either direction.

## Round 31 — what is still not claimed (2026-11-12)

Where a message's time is read is now the phone's answer. What follows is what that does not mean.

- **The phone deliberately puts no clock on an ordinary bubble, and the web now matches that by not
  adding one.** `messageStateRow` (`chat.dart:579`) and `_actions` (`chat.dart:5073`) both say the
  time is read from the long-press menu. Adding a clock under the words would have been the obvious
  reading of the request and would have made this client **differ** from the phone in the name of
  matching it. The one clock that is on the page belongs to a picture and sits **above** it.
- **The sheet was measured on a received message only.** The phone's `_menuClock` answers nothing for
  an unsent outbox row, and that state was not opened here. **NOT VERIFIED.**
- **A 24-hour locale diverges, deliberately.** The phone's `clock()` answers `10:42` and `_menuClock`
  appends `AM`/`PM` itself, so its sheet always carries the half of the day. The web's `clock()` is
  `Intl.DateTimeFormat` and is locale-aware, so under a 24-hour locale it reads `23:05` where the phone
  would read something like `10:42 PM`. Matching the phone exactly there would mean ignoring the
  viewer's own locale, which is worse; it is recorded as a **divergence**, not smoothed over.
- **Everything was measured against a loopback stub; two live accounts were not used.** What is
  proven is that the line the phone draws is the line the web draws, at the same size, weight, colour
  and inset — **not** that a real backend's thread renders identically. **This is not a parity claim.**
- **The inset reading needed a different instrument, and that is worth recording.** The clock's left
  inset was first measured off the element's own box, which read 1px and says nothing: an inset is
  padding *inside* the element. It was re-read with a `Range` over the text node, which gave the 17px
  that is the phone's 16 plus the panel's 1px border.
- **Touch and a real phone were not used.**
- **The phone was read, not run.** `app/lib/screens/chat.dart` and `app/lib/strings/en.dart` were read
  and not changed; nothing under `xelvic/` was created, edited or deleted, and the backend gained no
  endpoint, migration, setting or contract change. Round 31 sent nothing new on the wire at all.

## Round 32 — what is still not claimed (2026-11-12)

The web now draws the phone's own voice-note player, to the bar. What that does **not** mean:

- **A speed cannot be chosen before the first press.** The phone's chip is *"Always a control: before
  the first press it chooses the speed that press will play at"*, held per sound in
  `_speedChoice`/`speedOf`. The web's is `disabled={!held}` — the chip is drawn, sized and coloured
  like the phone's, and it does less. **NOT MATCHED.**
- **`InFront` is not ported.** The phone stops a note when the page it is drawn on stops being the one
  being looked at, and it stops rather than pauses because *"a row left showing itself as playing is a
  claim about a sound nobody can hear."* The web has the one-ear rule and no page gate, so a note can
  go on playing under a sheet that has been opened over it. **NOT IMPLEMENTED.**
- **The transfer controls are not drawn.** Pending, Uploading, Retry and a red Discard (`_transferControls`)
  are absent; the web draws an "Expired" line only.
- **A sender is not drawn on somebody else's voice note**, which the phone does in a group
  (`sender: mine ? null : sender`). **NOT IMPLEMENTED.**
- **The tap target is not the phone's.** The phone's control is a Material `IconButton` with Material
  3's 48-point minimum; the web's is an explicit 40 × 40 box. The visual box matches; the finger's room
  may not.
- **Nothing was heard.** The harness plays a **silent WAV built in the page** against a **loopback
  stub**; no recording was played, no seek and no speed change was performed, and two live accounts
  were not used. **This is not a parity claim.**
- **A reading from this run was thrown away rather than used.** The probe's selector for the heart
  matched the play button a second time and returned its box twice; rather than report that as the
  heart's geometry, the reading is discarded and the heart is recorded as **NOT VERIFIED** here.
- **The phone was read, not run.** `app/lib/screens/chat_audio.dart` was read and not changed; nothing
  under `xelvic/` was created, edited or deleted, and the backend gained no endpoint, migration,
  setting or contract change.

## Round 33 — what is still not claimed (2026-11-12)

The web now draws the phone's **three** sounds — a voice note, a sound file and a song card — as three
different objects, and the song card is not a bubble. What that does not mean:

- **The card's width is not the phone's rule.** The phone is `ConstrainedBox(minWidth: 220, maxWidth:
  290)` around content-sized children, so a long title widens the card and a short one narrows it. The
  web is a flat `w-[272px] max-w-[76vw]`. **PARTIALLY MATCHED** — recorded rather than fixed.
- **The failure sentence is not the phone's.** The phone prints `store.stuck!`, the store's own words
  about what went wrong; the web prints "Could not play that." No failure was provoked in this run, so
  even the web's own sentence was not seen on screen. **NOT MATCHED.**
- **The file row is thinner than the phone's.** The phone allows **two** lines for the name and
  ellipsises at the second; the web truncates to one. An unnamed file reads "An audio file" here where
  the phone uses `source.fileName`. And the phone's row is a `_MediaFrame` with Pending / Uploading /
  Retry / Discard and a press that **opens** a local file, while the web's is an `<a download>` — **no
  transfer states, and a different thing happens when it is pressed.**
- **`ShareWho` names a person differently.** The phone reads the alias the reader gave them
  (`Aliases.it.name(id, name, username)`); the web draws `name || username`. Unchanged this round and
  recorded here rather than passed over.
- **The accent split is real but invisible on every light theme.** `--palette-accent` against
  `--convo-accent` was measured on the dark "Alone" theme — `#8FB4FF` on the card, `#2B57C6` in the
  thread — and on every theme where `chatTint` equals the accent the two values are the same, so **no
  visual difference is claimed there.**
- **The heart was not measured.** The phone's `LikeHeart` constraints (`34 × 34` around a 22 icon) and
  the web's `LikeButton size="md"` were both **read from source**; the probe's selector matched the
  play button twice, so the geometry is **COMPLETE by construction, NOT VERIFIED by measurement**.
- **Nothing was heard.** Three messages in one thread against a **loopback stub**; the sound file was a
  WAV, the voice note was silent, no failure was provoked, and two live accounts were not used.
- **The phone was read, not run.** `app/lib/screens/chat.dart`, `chat_media.dart`, `chat_track.dart`,
  `audio_bits.dart`, `share_who.dart` and `convo_theme.dart` were read and not changed; nothing under
  `xelvic/` was created, edited or deleted, and the backend gained no endpoint, migration, setting or
  contract change. Rounds 32 and 33 sent nothing new on the wire at all — they read `asset.waveform`,
  `asset.duration_ms`, `message.kind` and `payload.track`, all of which were already arriving.

## Round 34 — what is still not claimed (2026-11-13)

- **NOT VERIFIED at runtime:** the group avatar (upload and clear), invite creation and revoking, a
  member's promotion and removal, leave, delete, channel create / rename / delete, the group rename,
  and the add-people picker. They are wired to the endpoints `group.dart` uses and pass typecheck,
  lint, tests and build, but no probe clicked them and no real server answered.
- **NOT VERIFIED against a live backend at all.** Every reading in the testing report came from a
  loopback stub that answered with hand-written JSON.
- **PARTIALLY MATCHED:** the panel is a web layout, not a pixel port. The phone's `GroupScreen` is a
  full route with its own scroll physics; the web's is a column inside the convo's aside. Sizes,
  spacing and the switch's exact track were not measured against the phone.
- **NOT IMPLEMENTED:** the phone's avatar picker offers camera and gallery as two doors
  (`image_picker` with a source choice); the web uses one file input plus a `capture="environment"`
  input, which is the browser's limit, not a design choice.
- **No backend change.** No new endpoint, migration, setting or contract change. `xelvic/` was read
  and not changed, and nothing in `xelvic-web/docs/` was touched.

## Round 35 — what is still not claimed (2026-11-13)

- **NOT VERIFIED against a live backend.** The rename, the reset and all three gate states were driven
  against a loopback stub.
- **PARTIALLY MATCHED:** the web's convo sheet still carries three rows the phone puts elsewhere —
  Media and files, Wallpaper and Convo theme. They were left in place, so the sheet is a superset of
  the phone's, not a match for it.
- **PARTIALLY MATCHED:** the alias is keyed the same way and lives under the same storage key, but it
  does not reach the places the phone's does beyond the convo header and the empty-state line — a
  notification title, a share card's `ShareWho`, and the Android service's own name lookup have no web
  counterpart here.
- **NOT IMPLEMENTED:** nothing new. No row was added that does nothing, and the one row that could do
  nothing — Unblock on the wrong side of a block — was removed by reading a field that was already on
  the wire.
- **No backend change**, no new endpoint, no migration, no contract change. `xelvic/` was read and not
  changed, and nothing in `xelvic-web/docs/` was touched.

## Round 36 — what remains open (2026-11-14)

**Fixed and verified.** The error screen no longer strands the user on React's unrecoverable failures: it
recognises them, reloads once, and falls back to the honest screen if the failure repeats. Verified in a
browser against the exact error (probe `case=twocopy`): first paint `Putting this screen back together`,
`navigation.type === "reload"`, claim written to `xelvic.render.retry`, and on the reloaded page the
honest screen with **no** second reload.

**Reduced but not eliminated — NOT VERIFIED.** The dev server no longer has a reason to re-bundle
mid-session (every imported dependency is now in `optimizeDeps.include`, and `resolve.dedupe` asks for
one React), but a re-optimization can still be triggered by a dependency or config change, and the app
cannot prevent a tab that already holds the old chunk from picking up the new one. The exact trigger in
the user's own tab was never captured, so the claim here is "this is the only mechanism that produces
this message, and the screen now recovers from it" — not "this can never happen again".

**Deliberately untouched.** `date-fns` and `lottie-web` are declared dependencies that nothing imports;
`xelvic-web/docs/` was not modified; nothing under `xelvic/` was written to.

## Round 37 — what remains open (2026-11-14)

**Done and verified.** The `@layer components` block is gone from `src/styles/index.css` (188 lines, 15
classes) and all 299 uses across 78 files are Tailwind utilities, checked in a browser against the app's
own stylesheet: 622 element pairs over ~60 computed properties each, in four states and for disabled
buttons, agreeing everywhere except the five deviations below. The built stylesheet was also read from a
real page over HTTP — the field, the active chip, a button, an icon button, a card, a skeleton — and the
built app boots with no error screen.

**The five deviations, in full.** (1) **Real:** a button's colour transitions now use
`cubic-bezier(0.22, 1, 0.36, 1)` instead of `ease` — the transform keeps the easing it always had, the
duration is unchanged, and one Tailwind `transition-*` cannot carry two timing functions. (2)
`transition-duration` serializes as one value where the old rule listed five identical ones. (3)
`rounded-full` is `9999px` where `.icon-btn` said `100%` and `.chip` `999px` — identical geometry for
every element in the app, since each is square or 34 px tall. (4) A focused field's `box-shadow` gains two
transparent zero layers ahead of the real `0 0 0 3px` ring, because Tailwind's shadow utilities compose
three variables; the ring's colour and geometry are the old rule's own. (5) A focused field's outline is
`2px solid transparent` instead of `none` — invisible in both cases, and drawn in a system colour under
forced-colors, which is the only place it can be seen.

**Reported and deliberately not fixed.** 32 class names used in the app are absent from the built
stylesheet, all for pre-existing reasons: Tailwind v3 has no `shadow-xs`, `text-md` or `animate-float-up`,
and the opacity steps `/12 /14 /22 /62 /72 /86 /88` (`bg-white/12` in `CallOverlay.tsx`, `text-white/86`
in `VibeSlide.tsx` …) are not in the default scale. One of them, `text-md`, sits in a class list this
round rewrote — the two `SignInPage` inputs — but it was already there. They are outside this round's
request, so they are named and left alone.

**Not verified.** Nobody has looked at this app with their own eyes this round. The harness proves that
the styles compute to the same values; it cannot say that a screen looks right, and no screen behind the
sign-in was opened at all (no live backend was involved). Two files were edited by hand rather than by
the rewrite — `Button.tsx`'s variant map and base string — and are covered by the same checks as the rest.

**Deliberately untouched.** `xelvic-web/docs/` was not modified; nothing under `xelvic/` was read or
written; no `.env.local` was written. The probe scripts live in `%TEMP%`, outside the repository, and the
four files written into `dist/` for the shipped-value read were deleted.

## Round 38 — what remains open (2026-11-14)

**Done, and how it was checked.** A photo picked as a convo's wallpaper is now stored (`look.ts`) and
read by the chat root, as a data URL so it survives a reload; it is saved before the server is told
`'default'`, so a failed request no longer loses it; a picked convo tint is read by `ChatPage` and paints
the chat's accent and bubbles; both move on the tap through an optimistic overlay that rolls back to the
old values with an error toast if the request fails. 12 new unit tests, a headless-Chrome read of the
built stylesheet (a `data:` photo at `cover`, a 78 % page wash on a built-in wall, `#0E7C8C` on
`bg-accent`/`text-accent`/`border-accent`/`rgb(var(--accent-rgb)/0.5)`), and a boot of the built app with
no error screen.

**Still open — wallpaper.**

- **No cropping step.** The phone frames a photo to the phone's own shape (`wall_frame.dart`); the web keeps
  the whole picture, downscaled to 1600 px on the long edge (PNG ≤1.5 MB kept for its alpha, everything
  else JPEG at 0.82), and lets `cover` decide. A tall screenshot chosen as a wallpaper will be cropped
  differently from the phone.
- **`localStorage` is the medium.** The phone writes a file; the web writes a data URL into the origin's
  quota. When `setItem` throws, the photo still shows for the session and the toast says "Wallpaper set for
  this session" with the reason — a quota failure is never reported as saved. The practical limit is a few
  megabytes shared with everything else the site stores.
- **Old rows are dropped, not migrated.** Rows the previous build wrote with a `blob:` address cannot be
  drawn after a reload; the store ignores them rather than showing a broken background. Those people pick
  their photo again.

**Still open — theme.** The chat accent on an **un-coloured** convo still follows `theme.chatTint ??
theme.accent`, where the phone's `tintOf` answers `theme.chatTint ?? #E31B66`; changing the account colour
therefore repaints every convo that was never given a tint of its own, where the phone's do not move. That
is the existing PARTIALLY COMPLETE row and this round neither fixed nor worsened it. A picked tint now
outranks the theme, as `skin.dart` says it must.

**Not verified.** No authenticated chat was opened — no backend runs here, no credentials were used,
`.env.local` was not written — no wallpaper or theme was picked through the UI in a browser, and nobody
has looked at these screens by eye. The computed-style probe is a statement about declarations, not about
whether a chat looks right.

**Deliberately untouched.** `xelvic-web/docs/` was not modified; nothing under `xelvic/` was written (five
Dart files were read); no `.env.local` was written. `vite preview` ports used for the probe were stopped
by PID, the user's server on 5173 was left running, and the probe files and Chrome profiles live in
`%TEMP%`, outside the repository.

## Round 39 — what remains open (2026-11-14)

**Done, and how it was checked.** Two emoji typed next to each other are no longer drawn overlapping.
`EmojiText` gives an emoji `mr-[0.35em]` when the run after it is another drawable emoji, which takes the
pitch from 1.150em to 1.500em against drawings 1.373em wide: measured clearance **+3.80 px** at 30 px
(+4.55 / +5.31 / +1.89 px at 36 / 42 / 15 px) where no margin left **−6.70 px** of overlap. The machine's
fallback character measures the same, so a blocked CDN no longer shows overlapping glyphs. An emoji with a
space or a word around it is untouched, because the text already spaces it; the round's first attempt
(0.1em on every emoji, which still overlapped by 3.70 px) is recorded in the testing report rather than
quietly dropped.

**Still open — the sizes.** The web's emoji-only sizes are its own: 42 px for one, 36 for two, 30 for
three, 24 for four to twelve and 15 beyond; the phone's `messageFontSize` answers 38, 26 and 15. So a row of
three emoji is drawn twice the phone's size and a row of seven 24 px against 15. This round did not touch
them, and the parity matrix now carries it as a **PARTIALLY COMPLETE** row (*Emoji said on their own, and the
space between them*) so that a fixed gap is not read as parity.

**Still open — the vertical overhang.** The drawing is 1.373em tall inside a line box of 1.05em, so it
hangs **6.70 px** below its own line at 30 px (8.05 / 9.38 / 3.36 px at 36 / 42 / 15 px), measured as the
artwork's bottom against the paragraph's own box, and in a body of several lines that overhang reaches into
the line below. It predates this round, the margin does not change it, and the phone is free of it because
`chat.dart` gives that `Text` a `height` of 1.35. A line-height or a size rule is where it would be fixed;
this round did not touch either.

**Not verified.** No authenticated chat was opened — no backend runs here, no credentials were used,
`.env.local` was not written — and nobody has looked at a message of three emoji in a browser. The
measurement is a statement about the shipped declarations in the component's own class chain, with Google's
real artwork and with it left out; it is not a statement about how the bubble looks.

**Deliberately untouched.** `xelvic-web/docs/` was not modified; nothing under `xelvic/` was written
(`app/lib/screens/chat.dart` was read); no `.env.local` was written. The probe pages, the screenshots and the
Chrome profiles live in `%TEMP%`, outside the repository, and no server was started on 5173.
