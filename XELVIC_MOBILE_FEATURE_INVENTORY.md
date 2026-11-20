# Xelvic Mobile — Feature Inventory (reference audit)

Date: 2026-11-01
Reference root (read-only): `xelvic/`
Mobile client: `xelvic/app/` — 283 Dart files, 151 screens, 255,946 lines
Backend: `xelvic/backend/` — 24 Django apps, read-only contract source

This inventory is the authoritative feature list used by the parity matrix. It
was built from the screen/service file tree, the backend app tree, `WEB-API.md`,
and targeted source reads. Nothing in `xelvic/` was modified.

## 1. Application shell and identity

| Area | Mobile evidence | Notes |
| --- | --- | --- |
| Five-destination shell | `main.dart`, `nav.dart`, `screens/home.dart` | Drops, Moments, Convo, Vibe, Audio — `kDropsTab` 0 … `kAudioTab` 4. **There is no Live tab**: `Live.it.watchShelf` is switched on while the Moments tab is showing, because Live is the "Live now" strip on that page (see §7). The web's `/app/live` destination is a web-only door |
| Theme system | `theme_provider.dart`, `theme_shop.dart`, `theme_art.dart` | Server-synced theme key; dark/light |
| Language | `language.dart`, `screens/language_screen.dart` | Locale preference |
| Onboarding/permissions | `screens/onboarding.dart`, `permissions_screen.dart` | First run |
| QR sign-in (phone approves web) | `qr.dart`, `screens/qr_approve.dart`, `web_signin.dart` | Seven auth doors |
| Own QR code | `screens/qr_code.dart` | Display account QR |
| Account switching | `screens/switch_account.dart` | Multiple sessions |
| Session/device management | `screens/sessions.dart`, `session.dart` | Devices, revoke |
| Signup / OTP / reset | `signup.dart`, `phone.dart`, `reset.dart` | Phone-only account creation |
| Profile refinement/verification | `refine_profile.dart`, `get_verified.dart`, `professional_details.dart` | |

## 2. Social graph and profile

Profile (`profile.dart`, `person.dart`), cover/avatar (`cover_frame.dart`,
`avatar_frame.dart`), follows, requests (`requests.dart`), mutuals
(`mutuals.dart`), crew (`crew.dart`), blocking, reporting (`report.dart`),
insights (`insights.dart`), contacts (`contacts.dart`), audience selection
(`audience_sheet.dart`), share sheets (`share_in.dart`, `share_out.dart`,
`share_who.dart`), mentions (`mention_sheet.dart`, `mention_typing.dart`).

## 3. Drops (posts / feed)

`drops.dart`, `drop_feed.dart`, `drop_grid.dart`, `drop_post.dart`,
`drop_sheets.dart`, `drop_card.dart`, `vibes.dart`, `vibes_tab.dart`,
`video.dart`, `vibe_studio.dart`, `tags.dart`, `hashtags.dart`,
`gallery_grid.dart`, `media.dart`, `media_gallery.dart`, `send_media.dart`,
`respond_media.dart`, `like_heart.dart`, editor screens under `screens/editor/`.

Capabilities: cursor feed (people / mine / tag), text, image, poll, place,
tag, likes, saves, comments, notes, shares, hide, delete, vibes (short video)
playback and studio, image/video/vibe editors.

## 4. Moments (stories)

`moments.dart`, `moment_composer.dart`, `moment_post.dart`, `moment_view.dart`,
`moment_poll.dart`, `poll_moment.dart`, `spark_moment.dart`, `text_moment.dart`,
`track_moment.dart`, `story_card.dart`, `memories.dart`, `memory_add.dart`,
`add_to_memories.dart`.

Capabilities: tray (mine/unseen/seen), timed viewer, reactions/replies, image
and text moments, polls, track moments, sparks, viewers and reactors, memories
list/editor. Two corrections to this list, both made after reading the app
again on 2026-11-01: there is **no "together mode"** anywhere in `app/lib`
(`grep -rn "together\|Together\|watch party" app/lib` finds nothing), and the
Circles section this page used to carry is inventoried in §9 — `moments.dart:629`
draws `LiveNow` there since commit `f4f7ffb7` (2026-10-31), while the section
itself is still shipped.

### Correction, 2026-11-01 — the "Morning Question" was not a mobile feature

An earlier web build carried a composite moment it called the Morning Question,
built around a `prompt` field on the moment payload. There is **no `prompt` on
`MomentSerializer`** and no such field on the app's `Moment` model; the feature
and its copy were invented on the web side. It has been removed, and the `prompt`
field was struck from `src/types/api.ts` so a build cannot type against it
again. The app's own list above is what stands.

### What `moment_view.dart` actually does (read for the web port)

`MomentViewScreen` is one screen with more rules in it than its size suggests.
The ones the web port had to keep, each with the line that decides it:

- A tap steps and never leaves: left 32% of the width goes back, everything else
  goes forward. Where a moment's *carried thing* opens from is the hold, because
  a tap that did two different things was a tap nobody could predict.
- `kHoldToPause` = 480ms pauses the clock; `kHoldToPause + kHoldToLeave` =
  1230ms is where letting go means "take me to it", and `_carriedTo` says in
  words where that is.
- `MomentItem.hold` decides how long a picture is up: a clip plays exactly its
  `clip_start_ms`…`clip_end_ms` window; a sound holds for its own window capped
  at `kSoundLongest` (60s) but never less than the picture's own life; a picture
  carried in from a post keeps the life written on it; the floor is 5s.
- `_ownOrder` reverses the **days** on my own moments and not the pictures, so my
  own walk opens on what I last put up while each moment still plays first to
  last.
- `_carried` reads, in order: a Vibe on the item, then `made_from` (vibe or
  drop), then a sound, then `source_id`.
- The heart is `POST /moments/{id}/react/` with `kStoryLike`, a blank emoji
  takes it back, and a long press on the same button opens `kStoryFaces`. A
  reader is sent no tally (`services._reactions`), so the answers row and every
  sheet behind it are the author's alone.
- The reply field focuses into a held clock (`_held || _typing`) and its send is
  `POST /moments/{id}/reply/` — a message into a convo, not a like.
- Share is asked as a question first (`POST /moments/{id}/share/` with no body)
  and only drawn if the account's privacy allows it; `{thread}` is the deed.
- `_hasOptions` is mine **and** not a Memory **and** a non-empty strip: the three
  dots open onto "Add to Memories" and nothing else.
- A Memory is not a moment: it has its own header words, its own
  `/moments/memories/{id}/…` routes and Remove in place of Take down.
- `MemoryShelf.open` builds the walk out of a Memory; `manageMemory` behind a
  long press on my own card is its four rows — Add more to it, Rename, Change
  the cover, Remove — and `_patched` is how each reports. A playlist Memory
  leaves out the two rows that have no meaning over one and opens at its
  playlist instead.
- `Moments._rings` / `hasRing` is the ring on a face, fed by the tray's
  `unseen` authors rather than by a query of its own.
- There is **no together mode and no viewer-level sticker or drawing tool** in
  the app: `grep -rn "together\|Together\|watch party" app/lib` finds nothing.
  Stickers, drawings, text and frames belong to `ImageEditorScreen`, which is
  what the web's `PhotoEditor` stands in for.
- The sticker **shelf** is not ours first. `editor/stickers.dart` reads
  `https://sticker.gaongram.in/api/stickers` (a public, token-free catalogue that
  answers `access-control-allow-origin: *`) and falls back to our own
  `/api/v1/stickers/` only when that service refuses — *"that is where the
  stickers are added now and it holds far more of them"*. Measured 2026-11-02:
  381 stickers, served in pages of 100. It matters which shelf a picker reads:
  a respond's or a note's sticker sends its id back to our server, which can only
  check the stickers it has a row for (`_comment_sticker()`), so those pickers
  read the near shelf on purpose (`pickSticker(ownShelf: true)`).


## 5. Convo (messaging) — highest priority

List and shell: `convo.dart`, `screens/convo.dart`, `group.dart`,
`chat_profile.dart`, `request` states, search, saved/vault.

The list's own grammar (`screens/home.dart`) is four helpers the web now ports
one for one, and each is a rule rather than a layout detail:

- `listLine` — what a row says under the name, and **never the message itself**.
  Four answers in this order: `Say something` (nothing in it), my own receipt
  word, `N new` (a count with no noun), `Nothing new`. A convo with myself keeps
  its own line. A chat list is read over your shoulder, which is the whole reason
  the rule exists.
- `convoLineTone` — the line's colour, decided from the words on screen rather
  than from the receipt behind them.
- `convoUnreadBadge` — the count, as a plate at the end of the **group** name and
  not as a badge on the far right; a direct convo relies on `N new` under its
  name (the owner's call, 2026-10-23). Height and least width are both 18.
- `convoInUnread` — the Unread lane's membership. A convo whose only waiting line
  is a Spark stays off it (`unread_other_count`, the owner's rule of 2026-10-24),
  and a card without the split reads as the old answer.

The row's right-hand side is one line, in this order: pin disc, birthday cake
(`isBirthdayTodayIn(other)`), the play button, the 48-hour timer, the spark, the
clock — with the phone's own gaps (3 between the timer and the spark, 7 between
the spark and the clock). The waiting bar is 3 wide, inset 14 from the top and
bottom, rounded at its trailing end. The web draws every one of those but the play
button; see `XELVIC_FINAL_GAP_REPORT.md`.

Conversation: `chat.dart` (9,741 lines) and 15 supporting sheets:

- `chat_media.dart` — image, video, document, audio attachments
- `chat_audio.dart` — voice notes and recorded audio
- `chat_sticker.dart` — stickers
- `chat_drop.dart`, `chat_live.dart`, `chat_playlist.dart`, `chat_track.dart` — shares
- `chat_link.dart` — link previews
- `chat_keep.dart` — Keep requests
- `chat_collab.dart` — collab requests
- `chat_share_preview.dart` — forwarding/preview
- `chat_vanish_consent.dart` — disappearing-message consent
- `message_info.dart` — per-member delivery/read info
- `vault.dart`, `lock_chat.dart` — code-locked conversations
- `mention_sheet.dart` — mentions

Behavior: text/media sends, replies, edits, delete for me/everyone, reactions,
polls, forwarding, message info, typing, presence, read/delivered receipts,
disappearing messages, group rooms/channels, group membership and roles,
invites, group avatar, pinned/muted/vaulted seats, sparks (view-once), clear,
wallpaper/tint themes, offline sync/outbox.

Calls: `app/lib/calls.dart` (the state machine), `screens/call.dart` (the
screen), `screens/call_banner.dart`, `screens/call_bits.dart`,
`screens/call_window.dart`, `screens/calls_list.dart` (the history),
`call_platform.dart` (the platform bits — earpiece routing, wake locks,
vibration). Signalling rides the chat socket and the media is peer to peer, so
nothing of a call except its state ever reaches the server.

Read on 2026-11-06 for the web port, because a call is the one feature where
being *nearly* the same as the phone means two handsets that never connect. What
the port had to match exactly:

- **The ring window is the server's.** `ring_seconds` arrives on the party frame
  and both ends give up on that same clock; the constant 45 is only what is used
  when a frame says nothing. Two ends timing a ring differently is how one screen
  says "No answer" while the other still rings.
- **Who offers is fixed, not negotiated.** People already in the call offer to a
  newcomer; the newcomer only answers. The second reason to offer is a camera
  being turned on, which re-offers to everybody already linked.
- **A crossing is settled by id.** When both ends offer at the same instant,
  `offersAfterCollision(mine, theirs)` is `mine > theirs`: the lower id drops its
  connection, records that it owes an offer, and offers again after the answer
  arrives. Dart's `compareTo` and JavaScript's `>` order strings identically,
  which is what lets the two clients agree without either telling the other.
- **Candidates that arrive before a description are queued**, per peer, and
  flushed after `setRemoteDescription` on both sides.
- **Media is opened during the ring**, and picking up starts the media and the
  connection in parallel with `call.accept` rather than after it.
- **The goodbye is 1400 ms** and the first reason a call ended is the one kept;
  a call this phone walked out of and could not say is said when the socket comes
  back.
- **A ring that arrived while the phone was asleep is asked for**, not waited on:
  `call.pending` goes out the moment the socket comes up and on every return to
  the front, which is why a ring is the one frame that cannot wait to be
  collected.

`call.add` and the delete on a history row exist on the phone; the web draws
neither.

## 6. Audio

`audio.dart`, `audio_section.dart`, `audio_window.dart`, `audio_deck.dart`,
`audio_prefs.dart`, `player.dart`, `track_list.dart`, `artist.dart`,
`music_sheet.dart`, `share_track.dart`, playlist screens, audio studio
(`audio_studio.dart`, separate product surface).

Read on 2026-11-02 because the web's clip editor was drawing a different list
than the phone's picker: **`screens/audio_picker.dart` is the sheet that chooses
a sound for a picture, a Vibe or a moment**, and it draws **uploads only, on all
three of its chips** — `_uploads()` is `GET /audio/tracks/?source=drop` with
`limit: kPickerRows` (60), `_trending()` is the week's board with everything whose
`fromDrop` is false filtered out, and `_saved()` is `Saved.it.open()` →
`Saved.it.shelf` → `thing.audio`. It holds no catalogue row on any chip, the
carousel is the list's own first four rows (`rows.take(4)`) and stands down while
the search box has anything in it, the search debounces 250 ms and asks the
*uploads* shelf whichever chip is lit. Two consequences worth keeping: a saved
catalogue track arrives as a row already and a saved upload arrives as the drop's
card and has to be turned into a row, and **a sound's bookmark is filed by which
table its id addresses** — `AudioTrack.savedKind` is `fromDrop ? 'drop' : 'track'`
(`app/lib/audio.dart:256`), which the web was getting wrong in the editor.

Not to be confused with `editor/tracks.dart`, whose `kBundledTracks` is dead
code: nothing in the app imports it.

The same file also holds **"Choose a part"** — `_WindowView`, the trim a picture,
a Vibe, a drop or a moment opens on a sound. Three numbers live on it and each is
the app's own: the part may be **ten to sixty seconds in fives** and no other
value (`_WindowViewState._durationSeconds`), the two times are a plain pill with
**no gesture on it** (`_readout` — the only control on that line is the length
beside it), and the length pill opens a **modal sheet** of those eleven chips
heading "How many seconds" (`_pickDuration`, `Str.audioHowManySeconds`). The
frame on screen is the same width whatever the span is, so a fifty-second part of
a twenty-minute song is slid into place rather than squeezed — see
`audio_window.dart`.

## 7. Live rooms

`live_now.dart`, `room.dart`, `room_talk.dart`, `room_bits.dart`,
`room_boards.dart`, `room_game.dart`, `games.dart`, `live_socket.dart`.

The surface is three things, not a tab: the `LiveNow` strip at the end of
Moments (`moments.dart:629`, `?shelf=kept`), the room screen with its three-dot
menu, and the sheet a room is made in. Stage audio and video travel as a WebRTC
mesh over the `call.signal` relay (`stage.dart`); the web ports the strip, the
room, its menu, share, report and board, and carries no media — recorded on the
room page itself and in the gap report. The room's media is **the same relay the
calls use** and the web now has a client for it (2026-11-06), but the room page
was not wired to it: the stage still carries no audio or video here, and the page
says so rather than drawing a microphone that would do nothing.

## 8. Rewards and Sparks

`sparks.dart`, `sparks_leaderboard.dart`, `reward.dart`, `wallet_view.dart`,
`logo_shop.dart`, `logo_provider.dart`, `catalogue.dart`, `theme_shop.dart`,
`screens/spark.dart`.

`screens/spark.dart` is the sheet a convo row's spark opens — the modal that is
the whole of what this feature is, and the reason the row itself carries an award
and never a number:

- a ring off the lap's own `pct` around the head award's glyph;
- the figure — `12` / `days`, `Broken`, `Hidden`, `Not started`, `Count starts
  again` — the one place a spark is ever a number;
- the awards worn, each in its own colour, faded when the run is cold;
- **two clocks, per person**: past 24 hours of one person's silence their timer
  shows, at 48 hours the run breaks to 0. The sheet says each side separately
  because the two start at different moments;
- the closing sentence, which names *whose* clock is running out;
- the broken banner with the day the run leaves the list, and the buy-back offer
  (price, wallet, deadline);
- the hidden banner and the "Hide this Spark" switch — mine alone, and the run
  keeps counting for both either way;
- the next rung, the seven-rung ladder (`Ember` … `Century`, 1–3 … 100+ days) and
  the rules paragraph;
- "Add to Moments" (`spark_moment.dart`), which draws a card of the run.

`spark_moment.dart` is 1,275 lines of its own — a painter, a page and the write
between them — and it is worth reading as three things rather than one:

- **The card is painted, not composed.** A fixed 1080×1920 page with the card
  840×1520 inside it, left 120 and 248 down — the band a vertical moment's crop
  leaves, nudged 48 px below the middle because the viewer's bars are not the
  same height at both ends. The paper is the award's own colour at 10 % over
  white and everything else is fixed ink; nothing here is themed, because a card
  is looked at on somebody else's phone. On it: the flame in the award's colour,
  two curves from the faces up to it with a chat mark and a call mark sitting on
  them at t=0.30 and t=0.62, each face ringed in the award's colour with the
  list's green dot when that person is here, then the ring with the award's
  glyph, the award's name in letter-spaced caps, the days, a rule, and one
  closing line between a sparkle and a heart. The award drawn is the one the run
  is **on** (`_head`'s rule), so a run that broke after a Century wears the medal.
- **The page shows the upload.** The card is painted once into a canvas and
  encoded once; what is on screen is that file read back (`PreparedMediaSource`),
  so the picture a person approves is the bytes that go up. Painted in
  `initState` — a card that repainted itself under the tap would swap the picture
  out from under the person about to share it.
- **Three things are asked before the share**: the reach (`audience_sheet.dart`,
  the same sheet every moment composer uses), whether the other person is named
  (`_mention`, on by default, sent as `mentions: [id]`), and the sound
  (`_soundRow()`: "Add audio" opens `audio_picker.dart`, and once a sound is on
  the card the row shows it with "Choose part" — `AudioWindowSheet` — and a way
  to take it off). The write is `postMomentNow` with `sound`/`soundStartMs`/
  `soundEndMs`, and it is silent on success: the page pops, and the sheet behind
  it pops too because a moment went up.

- **`Faces.patience` is a bound the card inherits.** `_faceImage` goes through
  `faces.dart`, and that store waits at most fifteen seconds for one face —
  *"a socket that has gone quiet without closing hands back neither bytes nor an
  error"* — before the card is painted with initials on it. The web port copied
  the painter and not that bound at first, and a silent media read left its
  composer on a spinner for ever; the bound was taken from here on 2026-11-04
  (`FACE_PATIENCE_MS` in `features/sparks/card.ts`).

The painter also has a hazard of the browser the phone does not have: a face
loaded from a public host is cross-origin, and drawing it without
`crossOrigin="anonymous"` taints the canvas so it cannot be exported at all —
which is the fault the composer then showed as "could not draw that card". The
web asks for the picture cleanly and treats a host that will not answer as a face
that did not come: initials, and a card that posts.

The web port (2026-11-04, sound row 2026-11-05) is `features/sparks/card.ts` and
`features/sparks/SparkMoment.tsx`, and all three things it asks are there — the
reach, the name, and the sound row, which is `_soundRow()` ported. The picker
behind it is the app's own `features/audio/SoundPicker` (the three shelves every
other sound surface reads) and the part chooser is `features/audio/PartChooser`,
the same drag surface the editor's audio tool opens. A card is one picture, so
the part it offers is the one-picture thirty seconds — `momentSoundSpan()`.

**The one place the web is ahead, and it is not parity.** On 2026-11-05 the web
gained four further card looks — `midnight`, `sunset`, `aurora`, `noir` —
alongside this card, which the web calls `classic`. The phone has no
counterpart: `spark_moment.dart` draws the one card above and nothing else, so
there is nothing on this side to be parity *with*. The four were drawn from a
four-card design sheet — first as invented ornaments that did not match it, then
rebuilt on 2026-11-05 against measurements of it — and are described in full in
`XELVIC_PROGRESS_TRACKER.md` and `XELVIC_TESTING_REPORT.md`. They are
**`NOT VERIFIED`**: rasterised in headless Chrome and measured against the sheet,
but never seen. `classic` is this card and was not changed.

The shop itself is one page with three aisles, and the file layout says so:

- `marketplace.dart` — the page: the way out, the title, the tab strip and the
  purse (`ShopTab.drip/themes/logos`, `SparkPurse(compact: true)`). The three
  bodies below it own no scaffold, no app bar and no title, which is what makes
  them shelves of one shop rather than three shops. `opensOn` is how a link that
  already names a shelf lands on it.
- `drip.dart` (`DripView`) — the figures a convo draws: the one on now with its
  time left, the shelf, the profile switch, the figure's own page.
- `theme_shop_view.dart` (`ThemeShopView`) — the Mode button, the design shelf
  three to a row, and the "Mix your own" picker.
- `logo_shop_view.dart` (`LogoShopView`) — twelve plates, the tile is the
  preview, a locked one opens a price sheet and buying wears it in the same
  breath.
- `backdrop.dart` (`ThemeBackdrop`) — the one widget that draws a theme's
  picture, used by the shell, by the marketplace and preview as pushed screens,
  and by the inside of a chat. `page` defaults to `XPage.convo`.

## 9. Other modules

- Deals / creator directory: `deals/creator_directory.dart`, `deals_home.dart`,
  `deal_detail.dart`, `invite_compose.dart`
- Circles: `circles.dart` (the model — `Interest`, `CircleTask`, `CircleDay`,
  `title`, `filling`, `waiting`), `screens/circles.dart` (`CircleSection`,
  `_CircleCard`, `CircleScreen`, `CirclePickerScreen`). **The section is ported
  to the web** (`src/features/circles/`, `/app/circles/:circleId`) — see the
  Circles pass in `XELVIC_PROGRESS_TRACKER.md`. One thing to know when reading
  the app: `screens/moments.dart:629` no longer mounts `CircleSection`; it draws
  `LiveNow` ("This is where the Circles section used to sit") since commit
  `f4f7ffb7` (2026-10-31). The section and both screens are still in the tree
  and all four backend routes are still mounted, which is what the web port
  follows
- Collabs: `collabs.dart`, `collab_sheets.dart`
- Marketplace: `marketplace.dart`
- Codepad: `codepad.dart`
- Birthday: `birthday.dart`
- Alerts/notifications: `alerts.dart`, `screens/alerts.dart`,
  `notification_settings.dart`, `push.dart`, `notices.dart`,
  `screens/notice_banner.dart`
- Camera: `screens/camera/*`, `editor/*`
- Offline: `offline/*` (repository, store, runtime, models)
- Telemetry: `telemetry.dart`

## 10. Transport and state services

| Service | Evidence | Contract |
| --- | --- | --- |
| REST client | `api.dart` (1,925 lines) | Bearer access token, `/api/v1/` |
| Auth/session | `session.dart` | access + refresh, device id, secure storage |
| Realtime | `live_socket.dart`, `live_socket_web.dart` | `wss://<api>/ws/?token=...`; frames `{event,data}` |
| Presence | `presence.dart` | socket action `presence`, `presence` frames |
| Offline sync | `offline/*`, `chat` sync | `/chat/sync/?cursor=` journal |
| Push | `push.dart`, `notices.dart` | FCM/APNs; notice payloads mirror socket |
| In-app notice | `notices.dart`, `screens/notice_banner.dart` | The `thread.update` frame's `notice` turned into one strip: 4s hold, queue of 5, same-conversation replacement, muted and typing skipped, per-conversation ordinal dedupe, skip when that conversation is on screen, chime after. **Ported to the web** in `src/features/notices/`; `alert.new` never becomes a strip on the phone either |

## 11. Backend capability map

Apps: accounts, alerts, audio, calls, chat, circles, collabs, common, console,
deals, discovery, drip, drops, hashtags, links, mlapi, moments, reco, saved,
social, spaces, sparks, stickers, studio, telemetry, verify.

The backend is the shared source of truth. Its chat contract is documented in
`XELVIC_API_COMPATIBILITY_REPORT.md`.

## 12. Round 18 — the phone's own stage, read and ported (2026-11-06)

This round read one more of the phone's files to port rather than invent, and it
belongs here beside the rest.

- **`app/lib/stage.dart` — the stage's mesh.** A live room's sound on the phone is
  a WebRTC mesh, not a broadcast, and its rules are the ones the web now follows:
  who offers to whom, when a connection is rebuilt rather than left to recover, and
  when a listener is let go of. The web's `src/features/rooms/mesh.ts` holds
  `whoOffers` — the lower id offers, compared by code unit exactly as `stage.dart`'s
  own ordering is, so both ends of a pair reach the same answer, and a listener,
  whom the stage has never heard of, always offers — beside `needsRebuild`,
  `readSignal` and `receiveOnlyKinds`; `stage.ts` holds the mesh itself. The file
  was read, not written to.
- **A stage is a `Call`.** On the backend a room's stage is a `calls.Call`
  (`backend/apps/spaces/services.py`), carried over the same `call.signal` relay an
  ordinary call uses. That is why the web's room sound needed no new endpoint, only
  wiring — the same reason the earlier calls pass needed none either.
- **A listener is bounded by the relay.** The server carries the stage plus its
  first 8 listeners (`MEDIA_LISTENERS`); past that a listener is in the room and is
  simply not sent anything. The web page says so.
- **Still not ported from the phone's call and stage code:** `call_platform.dart`'s
  half — earpiece/speaker routing and the screen-awake lock — because a browser has
  no equivalent, and `call.add`, which the web still does not send. Neither is
  claimed, and nothing is drawn for either.

## 13. Round 19 — the phone's mirror rule, its card heights and its feed weave, read and ported (2026-11-06)

This round read three more of the phone's files to port rather than invent, and
they belong here beside the rest.

- **`app/lib/calls.dart` — `_selfMirrored`.** The phone mirrors only its front
  lens; the web mirrored unconditionally, which is what the owner reported
  (*"video me jo video ban raha hai wo ulta ban raha hai aur phone me sahi hai"*).
  The web's `src/features/calls/engine.ts` now carries the same rule: a `Facing`
  read off the track (`track.getSettings().facingMode`, in `openCamera()` and
  `openDevice()`) and a `mirrored` flag that answers a person's own choice when
  there is one and `facing !== "environment"` otherwise, with a **Mirror** pill on
  the call's picture and on a room's own tile. The file was read, not written to.
- **`app/lib/screens/drops.dart` — the card heights and the card's door.** A card's
  media box took the
  card's whole width and derived its height from the server's `ratio` with no
  ceiling, so a portrait post spilled off the screen. The web now uses the phone's
  own number for a clip — `tallClipShare = 0.62`, capped in height and cropped —
  and the phone's `0.78` is not used as written: there a photograph answers the
  ceiling by *narrowing* its box, which costs about a tenth of a 390-point card
  and so is invisible on a phone, but costs two thirds of a wide, short browser
  window's card and left a strip of photograph with empty card either side — the
  owner's report and screenshot of 2026-11-06. The web fills the card's width and
  crops instead, at the poster's shape up to four-to-five. The comment beside
  those constants is the owner's earlier report of 2026-10-27.
  The same file's tap rule is carried over too: `DropVideo.onOpen` is
  `drop.isVibe ? openVibe : _openFrame`, `_openFrame` is `openClip`, and
  `openClip` is `openVibe` (the 2026-10-19 report, *"agar drop sirf single video
  hai to click karne pe single screen pe ja raha, hata kar vibe pe play hona
  chahiye"*), so a **plain video** in the feed opens the walk exactly where a Vibe
  does. A still is left alone — `_media`'s single tap opens tags/people only when
  the post names somebody, which is a separate door this client already has. The
  file was read, not written to.
- **`app/lib/drops.dart` — `mixedFeed` and its shelf.** The server states a
  `vibe_share` and the phone lays the clips out; the web ignored the field and had
  no weave. The web's
  `src/features/drops/mix.ts` is a whole port of `mixedFeed` / `_mixSlots` /
  `shelfOrder` / `shelfKey` — `shelfKey` an FNV-1a hash, `mixSlots` a partial
  Fisher–Yates over ten slots, `RAIL_CLIPS = 10` — and the port uses `Math.imul`
  for the hash multiply, which is the one place it could have gone quietly wrong:
  the phone's `int` holds the whole product before masking and a JavaScript number
  does not. The phone's own cases (`app/test/drops_mix_test.dart`) are carried
  over as `mix.test.ts`, thirteen of them, and the strip's own rule
  (`Drops.rail`) is carried over as `railClips` with its exclusion bounded to the
  feed's first block: the app asks its question of the whole feed it holds, and a
  browser holds every page the reader has scrolled to, so the app's reading
  emptied the strip and took the section off the page (reported 2026-11-06).
  `Drops.it.carry` is carried over as `walkOf`: a clip the shelf has never held —
  a single video is not a Vibe — is put in front of the shelf so the walk opens
  on the clip that was pressed and still has somewhere to swipe. The
  file was read, not written to.

**Still not ported, and named rather than implied:** the Vibe's `recipe` — the
voiceover, the music lanes, each clip's trim and speed, the overlays, the filter
and the chosen frame shape — and the addresses of the uploads it names
(`clip_urls`). Both are sent by the server and read by nothing here, so a Vibe
plays as its first clip alone. There is no Vibe editor on the web either, play
counts never move (`POST /drops/<id>/play/` is uncalled), and
`GET /drops/mine/` and `GET /drops/interests/` are unused. All `NOT IMPLEMENTED`.

**Read-only project check.** Read and not written to this round:
`app/lib/calls.dart`, `app/lib/screens/drops.dart`, `app/lib/drops.dart` and
`app/test/drops_mix_test.dart`, as well as the backend's
`apps/drops/services.py` for `feed_vibe_share`. Nothing outside `xelvic-web/` was
created, edited or deleted.

## 14. Round 20 — the phone has no Mirror button, and now the web's means the same thing (2026-11-06)

Read to settle a report rather than to port a feature, and it settled it the other
way round: *"jo video call me mirror par click karne par jo flip ho raha hai wo mere
video card me raha hai jabki reciever user video card me hona chahiye"*.

- **`app/lib/screens/call.dart` — `_mine` and `_feed`.** There is no Mirror button
  on the phone at all. `_mine` draws this tab's own tile through
  `mirror: calls.selfMirrored`, and every remote tile is drawn by
  `_feed(person, mirror = false)` — the received picture is never turned over. That
  is the whole of the phone's rule, and it is the opposite shape to Round 19's
  button, which overruled the self-view instead.
- **`app/lib/screens/room.dart`.** The same rule for a room, in one line:
  `mirror: person.id == mine && Stage.it.selfMirrored`. Nothing arriving is flipped.
- **`app/lib/calls.dart` — `selfMirrored`.** Still the lens's answer and only the
  lens's, which is what the web's `mirrored()` is again now that the hand-overrule
  is gone.

**What the web does that the phone does not.** `toggleRemoteMirror()` — a button
that turns over the pictures *arriving* here, kept for the call it was pressed in
and cleared by the next. The phone has no such control; it was added because the
owner asked for it, and it is a display only: `VideoSurface`'s `-scale-x-100` on a
`<video>` element, with no track ever transformed, so nothing reaches another
person's screen. It is a stated divergence, not a port. The two files were read, not
written to.
## 15. Round 21 — the phone's call has three sizes; the web's had one (2026-11-06)

Read to answer *"video call karne par main video hata kar chat par aa raha hu aur
call chal hi rahi hai to phir main video call par nahi aa raha pa raha hu"* and to
give the screen-share fix a reference.

- **`app/lib/screens/call_window.dart` — the three sizes.** `CallWindow` is drawn
  in one of three ways: a page that fills the screen, a small window that can be
  dragged and docks to an edge, and a hidden mark — a line of chrome that says the
  call is still running and can be pressed to bring it back. Leaving the call screen
  on the phone is therefore never a one-way door. This is the phone equivalent the
  web lacked: `CallOverlay` was `fixed inset-0` above the router with no control
  that put it aside, so going to chat meant the call screen was gone for good even
  though the call itself kept running.
- **`app/lib/screens/call.dart` and `app/lib/screens/room.dart` — no screen
  sharing.** `screenShare` does not appear in either file, and there is no
  `getDisplayMedia` call anywhere under `app/lib/`. The fault the owner reported —
  a shared laptop screen cropped to its middle on a phone — is therefore entirely on
  the web's side: the share was added here in Round 18, and the crop was the
  viewer's own **Fill** choice surviving from an earlier call because `fit` was
  component state that lived as long as the tab. There is no phone behaviour to
  match, only a sane default.

**What the web does now.** `CallOverlay.tsx` gains a **Minimize** pill and a bar
that carries the call over another page — the picture or a phone glyph, the name and
clock, mute, camera, hang up, with the sound played by its own `AudioSurface`s —
and both it and the Fit/Fill choice are reset when the call ends. This is
**partially** the phone's window: the bar is fixed to the bottom where the phone's
window can be dragged and docked, and the phone's third size — a mark and nothing
else — has no counterpart. `NOT VERIFIED`; nothing was run on a device.

**Read-only project check.** `app/lib/screens/call_window.dart`, `app/lib/screens/call.dart`
and `app/lib/screens/room.dart` were read and not written to. Nothing outside
`xelvic-web/` was created, edited or deleted.

## 16. Round 22 — the phone's window can be moved, and so can the web's now (2026-11-06)

Read again to answer *"abhi video call minimize karne par use drag aur drop nahi kar
pa raha hoon chat screen me"*, and this time the answer was to port the behaviour
rather than to note its absence.

- **`app/lib/screens/call_window.dart` — the drag.** `_spot` is where the window has
  been dragged to, kept in `State` and not in the engine, with the phone's own reason:
  where somebody parked a window is not a fact about the call, it is sent nowhere, and
  it is forgotten when the call ends. `onPanUpdate` adds every drag to where the
  window is *now* rather than to where the last build saw it, because two pointer
  moves can arrive inside one frame. `onPanEnd` calls `_settle`, and `_place` clamps
  on every build — a rotation or a keyboard can leave a corner off the screen.
- **`_gutter = 12` and `_settle`.** "Into an edge, not merely near it": while the
  window floats it is held the gutter clear, so the only way its own edge can be
  inside that gutter is if somebody pushed it there — and the file argues the point
  itself, that at a snap of 64 on a phone where the window is half the width, all but
  48pt of it would count as "near".
- **`_Edge` and `_tab`.** Docked, it is one small tab at the edge, and it comes back
  with a **tap** rather than a drag, because Android's gesture navigation claims
  horizontal swipes that begin in the edge strip. `CallView.hidden` — the third size,
  a single pill — lives in `_pill` and has no counterpart on the web.

**What the web does now.** All of the above, in `src/features/calls/minibar.ts` and
`CallOverlay.tsx`: the same gutter, the same clamping on every draw, the same
"into not near" rule measured on the raw spot, the same press-to-open tab, and the
same placement kept outside the call's own state. One divergence is honest and
tested: a web bar is wider than a phone's window, so on a phone it rests already one
gutter from both edges and folds away from the smallest push. `NOT VERIFIED` —
nothing was dragged on a real screen.

**Read-only project check.** `app/lib/screens/call_window.dart` was read and not
written to. Nothing outside `xelvic-web/` was created, edited or deleted.

## 17. Round 23 — the phone's emoji come from its keyboard, and its mic holds to record (2026-11-11)

Read again to answer *"abhi emoji chatscreen me send karne par send ke baad aur hover par
animate nahi kar raha hai"* and, four messages later, *"please dynamic emoji hata dijiye pahle
jaise tha waise hi kijiye jo google ka"* — and, for the composer's mic, to port the phone's
own hold-to-record rather than to imitate it.

- **The phone has no emoji picker, and that is the honest shape of this row.** Its keyboard
  supplies emoji; the app's own shelves are small and each for one job — `kReactions` six,
  `kStoryFaces` five, `roomThrows` five, and `drop_post.dart`'s sixty-tile caption board (all
  read in earlier rounds, unchanged by this one). A browser has no emoji key, which is why the
  web has a panel at all: 1,906 emoji in 9 groups with search, a shelf of the last 24 and the
  five skin tones. That is a **divergence from the phone**, not parity with it.
- **`app/lib/screens/chat_audio.dart` — the hold.** `voiceHoldSlide` and its two slops are the
  gesture the web now reads: down starts the recording, up sends it, sliding left throws it
  away, sliding up locks the recorder so the finger can come off. `CANCEL_SLOP = 70` and
  `LOCK_SLOP = 60` in `src/features/convo/voicehold.ts` are those same numbers, and the longer
  of the two travels is the one a diagonal finger meant, with a dead heat keeping the recording
  — an ambiguous gesture should never be the one that throws a note away.
- **`app/lib/screens/chat.dart` — the shortest note.** `_minVoiceDuration` is one second, which
  is `MIN_VOICE_MS`: a shorter note is a finger that slipped rather than something anybody said.
- **`app/lib/media/recording_controller.dart` — the ceilings and the bar.**
  `VoiceRecordingController`'s own defaults are `maxDuration` thirty minutes, `maxBytes` 25 MB
  and `maxWaveformSamples` 120 at `mimeType` `audio/mp4`; `_appendAmplitude` clamps the reading
  to 0–1 and multiplies by 100, which is the 0–100 integer the bubble draws and the arithmetic
  `amplitudeBar` in `voicehold.ts` now answers. The web takes one reading every 100 ms over the
  same stream a `MediaRecorder` is writing, and sends the newest 120 with the note.
- **What the browser cannot inherit.** A page has no native recorder, so `useVoiceNote.ts`
  chooses a container from what the browser will actually record, from
  `audio/mp4;codecs=mp4a.40.2` down to `audio/ogg;codecs=opus`, and the length travels as the
  recording's own clock rather than the container's: asked of Chrome 156, an `<audio>` element
  answers `Infinity` for the WebM/Opus a browser without MP4 falls back to, because that
  container writes its length at the end where an element reading only the header never looks.

**What the web does now.** All of the above, in `src/features/convo/{voicehold,useVoiceNote}.ts`
and `VoiceStrip.tsx`, with the note sent the way a picture already goes —
`POST /chat/assets/` with `kind: "voice"`, then `chatService.send` with the asset's id. The
emoji side is the chat screen's and only the chat screen's: `motion.ts` decides when one may
move — **only while a pointer rests on it, and once when a message is sent or arrives**, which
is the owner's own rule after the thread and then the panel (*"usme emoji animate continue hote
hi rahte please ise aisa kijiye ki kewal hover karne par hi emoji animate kare"*) — `arrivals.ts`
decides which message is new, and every drawing is Google's, because the owner asked for
Google's after the other sets were tried. The phone needs no such rule: a touch arrives and
leaves in the same instant, so nothing there rests on an emoji either. One more divergence, and
it is worth naming because the phone cannot have the fault the owner reported: Google's artwork
is drawn here as **one** drawing — `EmojiArt` fades the machine's own character out once Google's
still or animation is on the page, his *"kisi kisi emoji me do do emoji aa raha hai ek hover
karne par animate hota hai aur ek nahi hota hai … sabse jyada people & body wale me"* — where
the phone draws the character in its own font and Google's pictures are nowhere in it. Measured
in Chrome through the real `EmojiText`: forcing the character back on changes 1,234 px at rest /
1,301 hovered, per emoji 😀 0, 👏 13, 👍 37, ✌️ 102, 🙏 132, 🙌 189. `NOT VERIFIED`: the
recording was measured in a real browser with a fake microphone, but no live server was reached,
so the upload and the bubble that plays a note back are unexercised, and no emoji was seen
moving in a real thread; the panel's rule was measured with a mouse only. WhatsApp's artwork is
`NOT IMPLEMENTED` and cannot be: it is Apple's, and Apple licenses it to Apple's own software.

**Read-only project check.** `app/lib/screens/chat_audio.dart`, `app/lib/screens/chat.dart` and
`app/lib/media/recording_controller.dart` were read and not written to. Nothing outside
`xelvic-web/` was created, edited or deleted.

## 18. Round 24 — the phone's place sheet, and an attach menu the phone words differently (2026-11-12)

Read again for *"please ab convo ke chatscreen ke input me jo plus par click karne par open hota
hai, please usme photos and videos, file, Location, Spark, sticker aur emoji ka option add
kijiye"* — six rows in the web's composer menu, and the phone turns out to be two different
answers inside one question: the *menu* it has, and the *place sheet* it has somewhere else.

- **`app/lib/screens/chat.dart`'s `_showAttachmentSheet` (line 4314) is the phone's attach menu,
  and it has seven roads.** Camera photo, Camera video, Photos and videos, Sticker, Song, Audio
  file, File — `_attachRow` for five of them and a `ListTile` each for Sticker and Song, with the
  phone's own words in `strings.dart` (`chatCameraPhoto`, `chatCameraVideo`,
  `chatPhotosAndVideos`, `chatStickerWord`, `chatSong`, `chatAudioFile`, `chatFile`). **No row in
  it is a place**: the phone's composer cannot share a location, and it cannot add an emoji either,
  because its emoji come from its keyboard (Round 23). Its chat *renders* both — `chatQuoteLocation`
  and `chatQuotePoll` are labels for what somebody else sent — and creates neither.
- **It trims itself by the room, and refuses before it draws.** `only` is the room's rule
  (`photo` or `video`) and shortens the list — *"a room set to photos offers the two roads to a
  photo and none of the roads to anything else, because every row taken off this sheet is a row
  that would have ended in a refusal the send route writes"* — while a text-only room stops the
  sheet opening at all (`_gate['text_only'] == true`). The sheet is not trusted as the rule: the
  phone's library picker cannot be asked for photos alone, so a clip can still come back from it
  and the send route is what refuses that (`channel_allows` in `backend/apps/chat/services.py`).
- **The phone's own browser build draws those rows dead, with the reason under them.** `_attachRow`
  takes a `why` (`kBrowserNoPicker`, `kBrowserNoCamera`) and asks `whyNotHere` for the line, so
  there is *"one spelling of 'this build cannot'"* — `lib/browser.dart` and the same rows, greyed.
  The web has no such gate because it is not that build: it is the page, and each of its six rows
  opens the browser's own answer to the question.
- **`app/lib/screens/place_sheet.dart` is where the phone keeps its location sharing** — *"The one
  door onto a place"*, opened from `drop_post.dart` (the drop composer) and
  `screens/camera/live_camera.dart`, and written because of two things the owner said on
  2026-10-15: *"jaha jaha location dalne wala option hai drops moments vibe har jagh location
  select karte time manually bhi search kar sake, jaise kisi hotel ka naam"*, and, of a phone
  placed by its connection rather than by a satellite, *"mumbai se lucknow aa jau, abhi bhi mumbai
  aa raha"*. Its two halves are the phone's own answer at the top, drawn with how sure it is, and
  a search box under it, both behind the same two functions (`PlacePicker.search = searchPlaces`,
  `PlacePicker.detect = detectPlaceFix`, swappable so a test can drive it), with `pause` at
  **350 ms** after the last keystroke because *"a search per character is a round trip per
  character, and the geocoder is a service this phone does not own"*. It is a plain sheet rather
  than one behind `Modals` because nothing is read before it opens.

**What the web does now.** Six rows in the composer's plus: **Photos and videos** and **File**
(over two pickers whose accept lists are the old single list cut in two), **Location**, **Spark**,
**Sticker**, **Emoji**. Two of the six use the phone's own words for the same job, and one —
Photos and videos — is the phone's `chatPhotosAndVideos` exactly. **Location is the port**: the
web's `LocationSheet` keeps the phone's two halves, its vocabulary and its reason for existing,
with the same two lookup functions behind both (`myPlace`, the browser's own position, and
`searchPlaces` by name), the sheet's line drawn from the accuracy the browser reported, and one
sentence per way a position can be refused — only `denied`, the browser's own setting, may suggest
allowing it. Three divergences are named rather than smoothed over: the web's debounce is **450 ms**
where the phone's is 350; a searched place travels with **no `accuracy_m`** because a browser gives
no accuracy for a name somebody typed; and the web's search and its reverse lookup ask
OpenStreetMap from the browser, which is the camera's pre-existing behaviour here, not the phone's
own geocoder.

`NOT VERIFIED`: measured with a mouse, not a finger; never delivered to a real backend, so the
wire bodies are this client's request and not a message watched landing; the room's rule is still
not honoured by the web (`Channel` carries `{id, name, position}` and no rule, so a photos-only
room still offers *File*); **Song** has no row here, and no *Camera photo*/*Camera video* split,
which the phone has and this round did not build; and the phone's place sheet is opened on *drops,
Moments, Vibes and the camera*, where the web's new sheet is the **chat composer's** only — the
web's drop composer still takes a place as a typed string.

**Read-only project check.** `app/lib/screens/chat.dart`, `app/lib/screens/place_sheet.dart`,
`app/lib/place_probe.dart` and `app/lib/strings/strings.dart` were read and not written to.
Nothing outside `xelvic-web/` was created, edited or deleted.

## 19. Round 25 — the phone's convo keeps Vibes in the thread; the web's now keeps the walk's clip

**What the phone has, as read in earlier rounds.** The phone's chat screen carries Vibes inline —
the clip in the thread's own surface rather than in a panel drawn beside it, with the rail and the
caption the phone draws everywhere else. The phone draws one Vibe one way: `VibeViewer`-shaped
widgets share their rail and their gestures across the walk and the convo, which is why a clip
felt in the walk is felt in the thread and reads the same in both.

**What the web had.** Two drawings. `VibeViewer.tsx` walked the shelf full-screen with a rail,
a caption, a scrubber, a comment sheet and a ⋮; `VibesPanel.tsx` — the thing the convo header's
five-pixel accent strip opened — was a player of its own with a play/pause button, a
previous/next pair and an "n / total" counter, and no way to answer the clip at all.

**What changed this round, 2026-11-12.** The drawing was moved to
`src/features/drops/VibeSlide.tsx` and both surfaces render it, which is the phone's own rule:
one clip, drawn once. The panel now carries the rail the phone's thread carries — Felt,
Comments, Share, Save, Mute — plus the caption, the comment strip, the two prompts and the 2× pad,
and its player panel has the scrubber, the four speeds and *When it ends*. The one deliberate
divergence from the full-screen walk is that the panel has no *Your studio* and no *New Vibe*:
both navigate, and the phone does not take the app away from a thread either.

**The phone's own vocabulary, kept.** The rail's first button is *Felt* and the comment sheet's
box is *Your respond*, as on the phone; *Save* writes `POST /saved/` with `kind: "vibe"`, which is
the phone's own shape. Nothing was renamed this round.

**Still not the phone's, and named rather than hidden.** The phone draws Vibes inline in the
thread; the web draws them in a panel beside it, and this round did not move them into the
message list. The phone's panel and the web's panel have therefore not been compared element by
element this round — the phone's files were not read again, and none of them were modified.

## 20. Round 26 — the phone's sticker grid is uniform squares; the web's now draws one size too

**What the phone has.** `app/lib/screens/chat_sticker.dart` draws the shelf as a grid of uniform
square cells, each holding the sticker with `BoxFit.contain`. Read in this round (read-only — nothing
under `xelvic/` was created, edited or deleted). `BoxFit.contain` fits the **file**, which is the
same rule the web had and which produces the same unevenness: a file that is mostly transparent
margin draws small inside its cell, next to one that fills the cell.

**What the web had.** Uniform **cells** already — measured at 75 × 75 with a 63 × 63 drawing box —
and `object-contain` inside them. So the cells were never the difference; the difference was inside
the files. Measured off the live catalogue: **49 of 90 stickers carry a transparent margin**, their
ink spans **775 to 3843 px²**, and they stood between **22 and 63 pixels** tall. One — a 512 × 279
file whose ink occupies 48% × 73% — was drawn **31 × 25** next to a sticker filling its box.

**What changed this round, 2026-11-12.** `src/components/media/StickerArt.tsx` measures each
picture's ink through its alpha channel and fits the **longest visible edge** to the box, so every
sticker's longest edge is drawn at the same size. Nothing is cropped and nothing stretched — only the
transparent margin is taken up. The web's sheet also stopped being a different size from the emoji
picker: `src/components/ui/shelf.ts` now holds the four rows both panels import, and both measure
**340 × 363 with rows 41 · 29 · 258 · 33**.

**Still not the phone's, and named rather than hidden.** The phone's shelf still fits the file rather
than the ink, so it still shows the uneven sizes this round removed on the web. That is **not** a
claim of parity — the phone was read, not changed, and its files stay untouched. The web's editor
shelf (`src/features/camera/PhotoEditor.tsx`) is in exactly the same position: unchanged, and still
drawing the old way.

## 21. Round 27 — the phone's shelf loads as it is scrolled; the web's now asks for the whole shelf

**What the phone has.** The same sticker catalogue and the same lazy loading: a cell's picture is
asked for when it comes near the window, so a shelf that is scrolled quickly arrives drawn behind the
reader. Read in this round, not changed — `xelvic/` is read-only.

**What the web had, and what the owner saw.** 602 cells built with **0 broken** — every sticker in
the catalogue was on the shelf — but only **76 drawn** when the panel opened, and still **216 blank**
after jumping to the very end of a shelf **11,941 pixels** tall. `sticker-count.mjs` and
`scroll-count.mjs` measured both roads (twenty patient screens, and a jump to the bottom) and both
ended with hundreds of blanks.

**What changed this round, 2026-11-12.** `StickerArt` gained an `eager` prop and `StickerSheet` turns
it on **350 ms after the shelf opens**, so the whole shelf is asked for rather than only the part the
eye can reach. Measured after the change: **602 drawn, 0 blank** at rest and at the very end. The
cost is written down: a cold open pulls **602 pictures, 26 MB, one request each**, with the last drawn
about **7.5 s** after the panel appears; every picture is `immutable, max-age=2592000`, so later opens
cost almost nothing.

**On GIFs.** The owner asked for a GIF section only if the catalogue holds GIFs. It does not: paging
`https://sticker.gaongram.in/api/stickers` at `limit=100` gives **602 rows, 602 unique ids**, and
**`animated: true` is 0 of 602**. So none was added — the phone therefore has no GIF section to
match, and none is missing.

**Still not the phone's, and named rather than hidden.** The phone's sticker sheet still loads lazily
and was not changed, so on a long shelf it still behaves as the web's did before this round. This is
**not** a parity claim, and it is not a statement about the phone's correctness — the phone was read,
not measured in a running app, and nothing under `xelvic/` was modified.

## 22. Round 28 — the phone's typing character; the web now draws it too

**What the phone has.** In `app/lib/screens/chat.dart`, somebody writing to you is not a line of words
but **their character**, standing up out of the seam between the thread and the composer:

- `_peek` draws it as a `Positioned` layer **before** the bar in the same stack
  (`children: [Positioned, bar]`), so the figure stands *behind* the composer's own fill and its lower
  body is covered by the field and the buttons. It takes no taps.
- `kPeekSize = 84` — the height of the *picture*, not of the person in it, because each pose is
  squared on its own artwork and the figure stands the full height of that square and about three
  fifths of its width.
- `kPeekAt = -0.86` — how far up it is drawn as a fraction of its own height, the sliver that clears
  the bar: **72.24 px**.
- `kPeekClear = kPeekSize * -kPeekAt + 10` = **82** — the room the newest message keeps clear of the
  character, held **whether the character is up or not**, because a list that jumped its last message
  up every time somebody started typing would be worse than the overlap it avoids.
- 260 ms `AnimatedSlide` + `AnimatedOpacity` for the rise and the fall.
- The words `online` / `typing...` were **deliberately removed** from the phone in favour of the
  figure.
- Whose figure: `other.character` (the Drip key on their card) → else the figure their **theme**
  ships → else the app's bundled one. `onChat = placement != 'profile' && placement != 'none'`.
- `kTypingNet = 6 s` is a **net, not the mechanism**: the other phone says when it stops, and this is
  only what covers the case where it never gets to say anything.

**What the web now has, and where it stops short.**

| the phone | the web | status |
| --- | --- | --- |
| The character over the composer, behind the bar, taking no taps | `src/features/convo/TypingPeek.tsx`, same three numbers, same 260 ms | **COMPLETE** — measured up at `translateY(-72.24px)` and back down |
| `kPeekClear` holding the newest message clear | `PEEK_CLEAR` = 82 px as the list's bottom inset, whether the figure is up or not | **COMPLETE** |
| Whose figure: their worn key first | `UserCard.character` → the catalogue row → its `typing` pose | **COMPLETE** — measured drawing the stub's own pose, never the bundled one |
| Second rung: the figure their **theme** ships | — | **NOT IMPLEMENTED**. The web's catalogue carries a figure's pictures but not a theme's, so an account wearing no shop figure falls back to the bundled one |
| Their `placement` gate on standing over a composer | `figureOnChat` in `src/features/marketplace/model.ts` | **COMPLETE** — a `placement: "profile"` figure was measured staying down while they wrote |
| `kTypingNet`, 6 s | the frame's own `ttl`; the backend's `TYPING_TTL_SECONDS` is **also 6** | Same length by a different route. The web's number comes from the frame, so it would follow a backend change the phone's constant would not. **Not exercised by the probe** (its waits were 700 ms) |
| The words, removed in favour of the figure | one `sr-only` `role="status"` sentence for a reader who cannot see it | **COMPLETE** for the accessibility half |

**Read and not changed.** `app/lib/screens/chat.dart` (`_peek`, the `kPeek*` numbers, `kTypingNet`,
the `TypingNote` widget), `app/lib/catalogue.dart` (`CharacterRow.onChat` at line 532,
`ThemeRow.figureOnChat` at 355, `figureOnChat`'s four-line rule) and `app/lib/characters.dart`. Nothing
under `xelvic/` — app, backend or iOS — was created, edited or deleted. **Typing between two live
accounts was not tested**, and the phone was read rather than measured in a running app: this is **not**
a parity claim.

## 23. Round 29 — the phone has **two** characters, and the second one is fed by the gaze

**What the phone has.** Round 28 above described one of the phone's two characters and called it the
typing figure. The phone draws **two**, and the line that chooses between them is one expression
(`app/lib/screens/chat.dart:1415-1423`):

```dart
pose: typing ? poses.typing : (peekPose(gaze, poses: poses) ?? last),
up:   typing || gaze != null,
```

- `typing` — the other person is **writing to me right now**. Fed by the `thread.typing` socket frame,
  the mechanism Round 28 already had on the web.
- `gaze` — the other person is **somewhere of mine and not writing**: sitting on my convo, or looking
  at my profile. `peekPose` returns `poses.wait` when a gaze exists and `null` when it does not. Fed by
  a completely different socket frame, `focus`, which the web had **no code for at all**.
- **Writing wins over merely being there**, and the two end differently. Writing ends and the figure
  stays up, back in `wait`, because being on my convo is a fact that does not come and go; the gaze
  ends and the figure goes down. This asymmetry is the whole of the rule and is the half that a
  one-character implementation cannot express.
- Whose gaze: `app/lib/looking.dart`, 272 lines. A `FocusWatch` says `{action:"focus", user, kind,
  phase:"idle"}` about itself and asks `{action:"focus", users:[…]}` about others; the answer arrives
  as `{event:"focus", data:{user_id, kind, phase, direction}}` and is read by `kind` **only** —
  `none` and anything unrecognised draw nothing, which is what lets a newer server name a third place
  without the older app inventing a character for it.
- The three timers, and why each exists: `refresh` 15 s (**re-say where I am** — a gaze that is said
  once expires at the server's 30), `recheck` 15 s (**re-ask who is looking at me**), `stale` 30 s (a
  sweep that drops a gaze nobody has renewed). `focus_ttl` is **30** in the backend's own `ready`
  frame (`config/settings.py:1458,1553`), so a real gaze is renewed twice per lifetime and only two
  missed polls can lose it.
- A refresh of the same look updates the clock **without** notifying the UI, so a steady gaze does not
  repaint the figure four times a minute.

**What the web now has, and where it stops short.**

| the phone | the web | status |
| --- | --- | --- |
| The two characters, `typing` and `wait` | `src/features/convo/peek.ts` — `peekOn({typing, gaze, last, poses})`, the same expression written out | **COMPLETE** — all six states measured in the running app |
| Writing wins; writing ends, being there does not | the same precedence in `peekOn`, and the same asymmetry | **COMPLETE** — writing → `typing`, writing stopped with the gaze held → back to `wait` still up, gaze withdrawn → `down` |
| `peekPose`'s `?? last` — the pose it was last drawn in | a `memory` ref in `TypingPeek.tsx` | **COMPLETE**, with one deliberate deviation |
| The remembered pose | keyed to the **set of pictures it came from** | **DELIBERATE DEVIATION.** The phone's poses are three files in its own bundle that cannot vanish; the web's are shelf URLs that change with somebody's figure. Unkeyed, a figure change mid-convo would leave the character in the previous figure's pose |
| Where the gaze comes from — `app/lib/looking.dart` | `src/features/presence/looking.ts`, line for line: `lookOf`, `gazeFrom`, `sameLook`, `staleGazes`, the three frames | **COMPLETE** |
| Saying where I am, and re-saying it every 15 s | `src/providers/LookingProvider.tsx` — `say`, one interval, a **named** goodbye | **COMPLETE** — measured as `{"kind":"chat","user":"2222…","phase":"idle"}` from the convo and `{"kind":"profile",…}` from `/app/u/:username` |
| Asking who is looking at me, and re-asking every 15 s | `watch` / `unwatch`, a counted set, one interval | **COMPLETE** — the gaze was set **before** the convo opened and still drew, so it is only knowable by asking |
| The 30 s sweep | `staleGazes(seen, now, GAZE_STALE_MS)` | **COMPLETE in unit tests** — believed at `STALE − 1`, dropped at `STALE`. **NOT VERIFIED** against a real lapse or a peer who vanishes without a goodbye |
| `kind: "none" / unknown` drawing nothing | `lookOf` returns null for both | **COMPLETE** — pinned in a test, including a third place name the web cannot draw |
| Reading the `ready` frame's `focus_ttl` | `GAZE_STALE_MS = 30_000`, the same value | Same number by a different route, as with `kTypingNet` |
| Presence — is the other person **online**? | — | **NOT IMPLEMENTED.** A different fact from where they are looking; the phone watches it, the web does not |
| Second rung: the figure their **theme** ships | — | **NOT IMPLEMENTED**, unchanged from Round 28 |

**Read and not changed.** `app/lib/looking.dart` in full, `app/lib/screens/chat.dart` (`_peek`,
`_watchOther`, `_sayLook`), `apps/chat/consumers.py:862-866` (the ask is told apart by `"users" in
content`; `_focus_asked` answers both ways round including `none`; `_focus_said` carries only between
direct partners) and `config/settings.py` (`FOCUS_TTL_SECONDS` 30, `TYPING_TTL_SECONDS` 6,
`PRESENCE_TTL_SECONDS` 45). Nothing under `xelvic/` — app, backend or iOS — was created, edited or
deleted, and the backend gained no endpoint, migration, setting or contract change: the `focus` frames
the web now sends and reads are frames the backend **already had**. **Two live accounts looking at
each other were not tested**, and the phone was read rather than measured in a running app — this is
**not** a parity claim.

## 24. Round 30 — the phone's chips in a convo, and the one the web had never drawn

**What the phone has.** A convo draws five things that are **not** messages, and the phone gives each
one its own object rather than a bubble with different words in it:

- **A finished call** — `_callRow` (`chat.dart`). Not a bubble: a centred plate, radius 16, `X.card`,
  a 1px `X.line`, `fromLTRB(13,9,13,9)`, holding `Icon(16)`, 8, the body at 13 w600, 8, and
  `clock(created_at)` at 10 `X.dim`. `missed = outcome != 'ended'` and `alarm = missed && !mine` — an
  alarm reads `X.bad`, everything else `X.dim`. The glyph is `videocam_off`/`videocam` for video and
  `call_missed`/`call` for audio. It is an `InkWell` whose `onTap` is `_canCall ? () => _call(video ?
  'video' : 'audio') : null`, and `_canCall = _hasCallee && _callOpen`, where `_hasCallee` is
  `personBehind(thread) != null` — it needs `thread['other']` to be a Map with a non-empty `username`
  — and `_callOpen` is `_gate['can_call'] == true`.
- **What writes it** — `_write_log` in `apps/calls/services.py`, through `chat.system_note(thread,
  call.caller, body, {"call": str(call.pk), "media": call.kind, "outcome": outcome, "seconds":
  seconds})`. **One flat dictionary**, `call` a **string**, and `media`/`outcome`/`seconds` as its
  **siblings**. The bodies are already whole sentences: `"Audio call · 2:14"`, `"Audio call
  declined"`, `"Missed audio call"`. `callNoteOf` (`app/lib/calls.dart:3758`) reads it as a Map,
  requires `payload['call'] != null`, and requires `payload['media']` to be `audio` or `video` — all
  siblings. The dispatcher (`chat.dart:8012-8030`) checks `callNoteOf` **before** `kind == 'system'`.
- **A file** — `_FileRow` (`chat_media.dart:500`) inside `_MediaFrame`: `X.card` fill, radius 14, a 1px
  border that goes `X.card → X.line`, `ConstrainedBox(minWidth: 220, maxWidth: 290)`, `Padding(all:
  12)`, then `Icon(size 32, X.accent)`, 10, and a column of the name (`X.text` w700, maxLines 2,
  ellipsis, **no `fontSize` given** so it inherits Material's default 14) over `_fileDetails` (`X.dim`
  11, maxLines 1). **There is no download glyph** — the whole row is the `InkWell`.
- **`_fileDetails`** — `'$type · ${formatMediaSize(size)}$duration'`. `formatMediaSize`: `<= 0` says
  `Unknown size`; units are B/KB/MB/GB; `digits = unit == 0 || value >= 10 ? 0 : 1`, which is why
  1183744 bytes reads `1.1 MB` and not `1184 KB`. `_fallbackType` supplies `Image`/`Video`/`Document`/
  `Audio` when there is no MIME. The duration is appended only for `audio`/`voice`.
- **A day mark** — `DayMark`, radius **20**. **A system note** — radius 16, `fromLTRB(13,9,13,9)`.
  **The strip at the top** — radius 20, `fromLTRB(11,6,12,6)`, icon 12, gap 5. **The stamp over a
  picture** — `messageStamp`, 10 `X.dim`, drawn **above** the picture because a strip below a
  photograph is a band of the thread's background between it and the next message.

**What the web now has, and where it stops short.**

| the phone | the web | status |
| --- | --- | --- |
| A finished call as a centred plate | `callNote()` in `ChatPage.tsx`, reading the payload **flat** as `callNoteOf` does | **COMPLETE.** Was **never drawn at all** — the web read `payload.call` as an *object* holding `media`, a shape no server has ever sent, so every call fell through to a bubble |
| The alarm colour, the four glyphs, the clock at 10 dim | the same four readings from the same payload | **COMPLETE** — measured radius 16 / `9px 13px` / icon 16 / gap 8 / 13 w600 / 10 dim, `rgb(217,43,43)` for an alarm |
| `InkWell(onTap: _canCall ? … : null)` | a `<button>` gated on `thread.other.username && gate.can_call === true` | **COMPLETE** — pressing it sent `{"ring":"2222…2222","kind":"audio"}`; with the gate shut it is a `<div>`, which is `onTap: null` |
| A file on its `_MediaFrame` | `ChatDocument` rebuilt to the same plate | **COMPLETE for a document** — measured 220 × 62.73, radius 14, padding 12, 32px accent glyph, gap 10, 14 w700 name, 11 dim details |
| `formatMediaSize`'s rounding and units | `mediaSize` in `utils/format.ts`, four cases in its test | **COMPLETE** |
| `_fallbackType`'s four words | the same four words | **NOT VERIFIED** — read from source; only a PDF was ever measured, so no fallback ran |
| The name's size is Material's default | 14, to match the inheritance | **AN INFERENCE, recorded as one.** `_FileRow` gives the name no `fontSize`; the default was not measured on a device |
| The whole row tapping to download | an `<a download>` at the media URL | **NOT VERIFIED** — not confirmed to save against a real backend |
| A day mark at radius 20 | `rounded-[20px]` | **COMPLETE** — was `rounded-full`, which a browser clamps to 11.5px on a 28.5px pill |

**Read and not changed.** `app/lib/screens/chat.dart` (`_callRow`, `_noteRow`, the dispatcher at
8012-8030, `_hasCallee`, `_callOpen`, `_canCall`, `personBehind`), `app/lib/calls.dart`
(`callNoteOf`), `app/lib/screens/chat_media.dart` (`_FileRow`, `_MediaFrame`, `_fileDetails`,
`formatMediaSize`, `_fallbackType`, `mediaFrameBorder`), `apps/calls/services.py` (`_write_log`,
`_outcome`, `_talked`, `_clock`), `apps/chat/services.py` (`system_note`) and `apps/chat/serializers.py`
(the asset field on the wire is `mime`, not `mime_type`). Nothing under `xelvic/` was created, edited
or deleted, and the backend gained no endpoint, migration, setting or contract change. **Two live
accounts were not used and no call was placed or received** — every reading came from a loopback stub
in a headless browser — so this is **not** a parity claim.

## 25. Round 31 — where the phone keeps a message's time, and why it is not on the bubble

**What the phone has.** The phone deliberately does **not** draw a clock under an ordinary bubble, and
it says so in two places. `messageStateRow` (`chat.dart:579`): *"The time is not here either: it is
read from the long-press menu now."* `_actions` (`chat.dart:5073`): *"the bubble no longer carries it
under the words, so pressing a message is how anybody learns when it was sent. It sits at the top left,
above the emoji, where a heading would, and it says the half of the day."* The line under a bubble
carries the **receipt** instead — `Sent`, `Delivered`, `Opened`, or what this phone is still doing with
it — and the phone asked for that explicitly on 2026-10-20 so the card would not change size.

The clock exists in exactly two places:

- **The long-press sheet**, as its **first child**: `Padding(fromLTRB(16, 0, 16, 6))` →
  `Align(AlignmentDirectional.centerStart)` → `Text(at, TextStyle(color: X.dim, fontSize: 11))`. Above
  the emoji row, so it reads where a heading would.
- **A picture or a card**, above rather than under it: `messageStamp` returns a row of the edited word
  and `clock(created_at)` at 10 `X.dim`.

And one function makes the sheet's value: `_menuClock` (`chat.dart:615`) — it takes `clock(iso)`'s
`10:42` and appends `' AM'`/`' PM'` from the local hour, because `10:42` at midnight reads as the
morning. An unsent outbox row has no timestamp and answers nothing at all, so the line is skipped
entirely.

**What the web now has, and where it stops short.**

| the phone | the web | status |
| --- | --- | --- |
| The clock at the top of the long-press sheet, 11 `X.dim`, left-aligned, above the emoji | `<p className="px-4 pb-1.5 pt-3 text-[11px] text-dim">` as the sheet's first child | **COMPLETE** — measured 11 / 400 / `rgb(107,107,123)`, ink 17px from the panel's left edge (`top: 70`) |
| One time in that sheet | the 9px clock that had been sitting inside the quote card was removed | **COMPLETE** |
| `_menuClock`'s `AM`/`PM` | `clock()` already answers `11:05 AM` — `Intl.DateTimeFormat` with `hour: "numeric"` | **COMPLETE by a different route**, and locale-aware. One function serves the sheet and the picture stamp, so the two cannot disagree |
| A clock above a picture, 10 `X.dim` | `messageStamp`'s equivalent | **COMPLETE** — measured 10 / 400, 4px above the picture, left-aligned to it |
| No clock on an ordinary bubble | none added | **MATCHED, deliberately.** Adding one would have made the web differ from the phone in the name of matching it |
| An unsent row says nothing | the same | **NOT VERIFIED** — the sheet was measured on a received message only |
| `10:42` + the meridiem, in the phone's own zone | the viewer's locale | **DELIBERATE DIVERGENCE.** Under a 24-hour locale the web reads `23:05` where the phone would append `PM` to a `10:42`-style string. Matching the phone exactly there would mean ignoring the viewer's own locale, so it is recorded rather than changed |

**Read and not changed.** `app/lib/screens/chat.dart` (`messageStateRow`, `messageStamp`,
`messageUnderLine`, `_menuClock`, `_actions` and its sheet's first child) and `app/lib/strings/en.dart`
(the receipt words). Nothing under `xelvic/` was created, edited or deleted, and the backend gained no
endpoint, migration, setting or contract change. Every reading is from a loopback stub in a headless
browser; **two live accounts were not used** — this is **not** a parity claim.

## 26. Round 32 — the phone's voice-note bubble, number by number

**What the phone has.** `ChatAudioBubble` (`app/lib/screens/chat_audio.dart:1109`). Its build is a
`Row` of exactly two things, and every number in it was chosen:

- **A control.** `IconButton` at 24, `color: tone`, replaced by an 18-point `CircularProgressIndicator`
  with `strokeWidth: 2` while the bytes are still being fetched. `onPressed` is null when there is
  nothing to play — a note whose bytes were never fetched can only be played through the download the
  bubble was handed.
- **A column pinned to 150 points.** `_track` is `SizedBox(width: 150, child: child)`, and its comment
  says why: *"the size a bubble in a conversation has room for."* `ChatAudioBubble.wide` (a sound drop
  on a card) never reaches it — that path wears `AudioPlayerBar`, which measures itself.
- **Inside it, `AudioWaveform`** — `height: 30`, `mostBars: 56`, and a bar laid out off its **cell**
  rather than a fixed width: `thick = (cell * 0.42).clamp(0.8, height >= 44 ? 5.0 : 4.0)`,
  `gap = ((cell - thick) / 2).clamp(0.0, 2.0)`, radius 2, `(4 + sample / 100 * 24) * unit`. With no
  waveform at all it draws **24** bars of `(4 + (index % 6) * 2) * unit`, and while such a sound plays
  they rise and fall on a **900 ms** `AnimationController` at `(5 + (wave + 1) / 2 * 21) * unit`.
- **Under it, the readout and the speed chip** — `formatAudioTime(position) / formatAudioTime(duration)`
  at 10 `X.dim`, and a `TextButton` whose `minimumSize` is `Size(38, 28)`, whose label is
  `'${speed}×'`, and whose comment is explicit: *"Always a control: before the first press it chooses
  the speed that press will play at."* The ring is 1 → 1.5 → 2, held per sound in
  `_speedChoice`/`speedOf` so a choice made before anything was playing is spent on the first open.
- **A colour that is the convo's, not the app's.** `tone = widget.accent ?? X.accent`, and the chat
  screen always names one — `convoAccent()`, the convo's own tint.
- **A face**, in a group only and never on my own: `sender: mine ? null : sender`.

**What the web now has, and where it stops short.**

| the phone | the web | status |
| --- | --- | --- |
| A 150-point track, `height` 30, `mostBars` 56 | `WAVE_TRACK_WIDTH` 150, `WAVE_HEIGHT` 30, `WAVE_LIMIT` 56 | **COMPLETE** — measured 150 × 30 with 56 bars 1.11 wide |
| The cell-based bar maths, the 24-bar idle shape, the 900 ms dance | [voiceclip.ts](src/features/convo/voiceclip.ts), one for one | **COMPLETE** |
| `tone` = the convo's tint | `var(--accent)`, already rebound to `--convo-accent` in the convo page | **COMPLETE** — measured `rgb(43, 87, 198)` |
| The readout at 10 `X.dim` | `0:00 / 0:02` at 10px `--dim` | **COMPLETE** |
| The chip's `Size(38, 28)` | 38 × 28 at 14px/500, dimmed while no ear is held | **COMPLETE in geometry** |
| The chip sets a speed *before* the first press | `disabled={!held}` | **NOT MATCHED** |
| `InFront` stops a note whose page is not being looked at | the one-ear rule only ([playback.ts](src/utils/playback.ts)) | **NOT IMPLEMENTED** |
| `_transferControls`: Pending, Uploading, Retry, Discard | an "Expired" line and nothing else | **NOT IMPLEMENTED** |
| `sender: mine ? null : sender` on somebody else's note | the player alone | **NOT IMPLEMENTED** |
| A Material `IconButton` (24 icon, 8 padding, a 48-point tap target) | an explicit 40 × 40 box around a 24 glyph | **COMPLETE in the visual box** — the tap target may not be |
| A real recording, played | a silent WAV built in the page | **NOT VERIFIED** |

**Read and not changed.** `app/lib/screens/chat_audio.dart` (`ChatAudioBubble`, `_track`,
`AudioWaveform`, `_idleOrDancing`, `_transferControls`, `_speedChoice`, `speedOf`, `InFront`). Nothing
under `xelvic/` was created, edited or deleted, and the backend gained no endpoint, migration, setting
or contract change. **This is not a parity claim.**

## 27. Round 33 — the phone's three sounds, and the one that is not a bubble

**What the phone has: three objects, not two.** The owner's ask named two — a song bubble and an audio
bubble — and the phone draws three:

| what arrived | what draws it | a bubble? |
| --- | --- | --- |
| `kind: 'voice'` | `ChatAudioBubble` (see §26) | yes |
| `kind: 'audio'` | `_mediaBubble` (`chat.dart:7138`) → the `'audio'` arm → `ChatAudioFileRow` (`chat_media.dart:474`) → `_FileRow(icon: Icons.audio_file_outlined)` | yes — a file row **inside** one |
| a shared song — an ordinary `kind: 'text'` line whose `payload` carries the track | `ChatTrackCard` (`chat_track.dart:37`), drawn at `chat.dart:8325` | **no** |

**Why the third one is not a bubble.** `bare` (`chat.dart`, above the content chain): *"None of these
is a bubble, and for the same reason. The panel a word is written on exists so the word has something
to sit on; a picture is already a rectangle with edges of its own, and a card brings its own. A panel
behind either puts a margin down the sides of something somebody framed themselves."* Its clock is
`messageStamp` — 10 `X.dim`, above it, and `if (bare) ...[stamp, const SizedBox(height: 4)]` puts 4
points between them — and its words are never repeated, because the body `Text` lives in the **final
`else`** of the chain and a card is an earlier branch.

**`ChatTrackCard`, whole.**

- `ConstrainedBox(minWidth: 220, maxWidth: 290)`, `Padding(EdgeInsets.all(10))`, and a column that
  starts at the left.
- `ShareWho(sender)` when there is one, then 9 points.
- `CoverArt(size: 44)`, 10 points, the title at 14/w700 `X.text` over the byline at 11.5 `X.dim` — and
  the byline is `'${track.byline} · ${track.title}'` for a podcast, `track.byline` for a song.
- `LikeHeart` — an `IconButton` with `constraints: BoxConstraints.tightFor(width: 34, height: 34)`
  around a **22** icon, `X.accent` when felt and `X.dim` when not.
- `RoundButton(size: 34, filled: true)`, `Icons.pause_rounded`/`Icons.play_arrow_rounded`.
- `_wave`: **26** bars off `waveShape(track.seed, 26)` in a 22-point `Row` — `width: 2.5`,
  `height: 3 + shape[index] * 19`, `margin: EdgeInsets.symmetric(horizontal: 0.8)`, radius 2, played
  `X.accent` and unplayed `X.fade(X.text, 0.16)`.
- 4 points, then `_timeStyle`: `X.dim`, **10.5**, w600, `FontFeature.tabularFigures()`.
- The failure line, when the store is stuck: `store.stuck!` at 11.5 `X.bad`.
- **No `accent` parameter anywhere.** The play button and the played bars take `X.accent`, the app-wide
  one — while the thread around it takes `convoAccent()` = `X.theme.chatTint ?? X.accent`. On a theme
  where those differ, the card and the sound bubbles are **meant** to be different colours.

**`ChatAudioFileRow` is a `_FileRow`.** `_MediaFrame` around a `ConstrainedBox(minWidth: 220,
maxWidth: 290)` and `Padding(EdgeInsets.all(12))` of `Row`: `Icon(icon, color: X.accent, size: 32)`, 10
points, then the name (w700, `maxLines: 2`) over `SizedBox(height: 3)` and `_fileDetails(source)` at
11 `X.dim`. `_MediaFrame` is also where the transfer states live — Pending, Uploading, Retry, Discard —
and its press opens a local file rather than downloading.

**What the web now has, and where it stops short.**

| the phone | the web | status |
| --- | --- | --- |
| Three objects: a voice note, a sound file, a song card | `soundKind` splits voice from audio; a song share is a card | **COMPLETE** |
| A song card with **no panel** behind it | `bare`, measured `background rgba(0,0,0,0)`, `border rgba(0,0,0,0)`, `border-radius 0`, `padding 10px` | **COMPLETE** |
| Its stamp above it, 10 `X.dim`, 4 points of air, on the row's side | `mb-1 text-[10px] leading-none text-dim`, `margin-bottom: 4px`, `text-right` when mine | **COMPLETE** |
| Its body never repeated | `caption && !hasCard` | **COMPLETE** |
| `ConstrainedBox(220…290)`, content-sized | a flat `w-[272px] max-w-[76vw]` | **PARTIALLY MATCHED** — a long title widens the phone's card and never this one |
| The 26-bar wave, 2.5 wide, `3 + shape * 19`, `X.fade(X.text, 0.16)` | the same maths; measured 26 bars, heights 5.58 → 21.25, unplayed ink at 16 % | **COMPLETE** |
| `_timeStyle` 10.5/w600/tabular `X.dim` | `num mt-[4px] text-[10.5px] font-semibold text-dim` | **COMPLETE** — measured 10.5px/600 |
| `LikeHeart` at `34 × 34` around a 22 icon | `LikeButton size="md"` = 34 box / 22 glyph | **COMPLETE by construction** — not measured (the probe's selector matched the play button twice) |
| `store.stuck!` | "Could not play that." | **NOT MATCHED** |
| A file row with two allowed lines and `source.fileName` | one truncated line, "An audio file" when unnamed | **NOT MATCHED** |
| Pending / Uploading / Retry / Discard; a press that opens the local file | an `<a download>` and no transfer states | **NOT IMPLEMENTED** |
| `ShareWho` naming the reader's own alias (`Aliases.it.name`) | `name \|\| username` | **NOT MATCHED**, unchanged this round |
| The card's `X.accent` against the thread's `convoAccent()` | `--palette-accent`, rebound at the card's root; measured `#8FB4FF` against `#2B57C6` on dark "Alone" | **COMPLETE** — and **invisible on every theme where `chatTint` equals the accent** |
| Three live designs on a real backend | one thread against a loopback stub | **NOT VERIFIED** |

**Read and not changed.** `app/lib/screens/chat.dart` (`_mediaBubble`, `bare`, the content chain,
`messageStamp`), `app/lib/screens/chat_media.dart` (`ChatAudioFileRow`, `_FileRow`, `_MediaFrame`),
`app/lib/screens/chat_track.dart` (whole), `app/lib/screens/audio_bits.dart` (`LikeHeart`, `waveShape`),
`app/lib/screens/share_who.dart` (`ShareSender`, `ShareWho`) and `app/lib/convo_theme.dart`
(`convoAccent`). Nothing under `xelvic/` was created, edited or deleted, and the backend gained no
endpoint, migration, setting or contract change. **This is not a parity claim.**

## 28. Round 34 — the phone's `GroupScreen`, control by control

`app/lib/screens/group.dart` (whole, 40–1428), its `ChannelSheet` and `PickPeople`, plus
`app/lib/counts.dart` (`shortCount`, `Plurals`) and the group strings at `app/lib/strings/en.dart`
2066–2205.

**What the phone has, in the order it draws it.**

1. **Head** — a 56 avatar with a camera badge and a pencil, both only for `canRun`; the title at 18/w800;
   under it `"{n} members · {n} channels · you are {role}"`.
2. **How the group runs** (admins only) — "Locked" and "Invites are on", each a switch with its own
   sentence, on `threads/<pk>/room/`.
3. **Group photo** (admins only) — the row that opens the camera or the files.
4. **Channels** — every channel as `# name`, with its rule joined (`Admins only · Words only`) or "The
   only room left, so this one stays." on the last one; admins also get "Change" and "New channel".
5. **Invite links** (admins only) — each live link with `Used by N people.` and a Share, each dead one
   with `Turned off.` and an Off; `New invite link` is disabled while invites are off.
6. **Members** — the roster's own count, a search field only when the roster is capped, role chips on
   anyone who is not a member, an "…" menu on anyone strictly below me, and `Add people`.
7. **Leave group**, and **Delete group** only for the owner.

**The ranking that decides all of it.** `_rank = {'member': 0, 'admin': 1, 'owner': 2}`;
`canRun = rank(myRole) >= 1`; `owns = myRole == 'owner'`; and a row gets its "…" only when
`rank(row.role) < rank(myRole)`.

**The roster contract.** `GET /chat/threads/{id}/members/?q=` answers with
`{members, shown, total, everyone, capped}`, where `total` is how many matched the query and `everyone`
is the size of the group — three numbers for four different sentences.

**What the web does now.** All of the above, with the same words and the same gating. What it does not
do is anything the probe did not exercise; the list is in `XELVIC_TESTING_REPORT.md`.

## 29. Round 35 — the phone's convo menu, and the name only you see

`app/lib/screens/sheets.dart` (`ChatSheet`, 2106–2780; `SheetHead`, 161–243; the alias row at
2629–2656), `app/lib/aliases.dart` (whole), `app/lib/screens/rename.dart` (whole), and the copy at
`app/lib/strings/en.dart` 3719–3756 and 4436–4443.

**The eight rows, in order.** Rename on this device · Pin · Mute · Vault · (divider) Disappearing convo ·
Block/Unblock · (divider) Clear convo · Trash convo. Mute is not drawn on the convo with myself and
neither is Trash; the block row is not drawn when the person on the other side is the one who blocked me.

**The alias.** `Aliases` keeps `xelvic.names.mine` in shared_preferences as one JSON object, keyed
`"<account>|<person>"` with `"<account>|@<handle>"` as a fallback. `name()` falls back in four steps —
my name for them, their name, their handle, nothing. A rename is a name, not an account: the handle is
never rewritten anywhere. `renameOnThisPhone` asks `What do you call {1}?` with the note `Leave it empty
to go back to their own name.`, caps at 40, and toasts `Saved on this phone.` or `Back to their own name`.

**What the web does now.** The same eight rows, the alias in `localStorage` under the same key and the
same two shapes, and the same fallbacks in `threadTitle`. The word is "device" rather than "phone"
because that is what it is.

**NOT ON THE PHONE'S SHEET, STILL ON THE WEB'S:** Media and files, Wallpaper, Convo theme. Nothing was
removed — the phone keeps the first two on the person's profile and dropped a per-convo theme
altogether.

## Round 36 — no inventory change (2026-11-14)

The phone has no equivalent of this round's work and needs none: a Flutter build cannot end up with two
copies of its framework in one running app the way a browser tab can with two pre-bundled React chunks.
Nothing was added to, removed from or re-read in the mobile inventory for this round; no phone screen
was consulted, because no phone behaviour was in question.

The web-only addition — an error screen that reloads itself once when React's dispatcher is null — is
recorded in [XELVIC_FEATURE_PARITY_MATRIX.md](XELVIC_FEATURE_PARITY_MATRIX.md) as having no phone
counterpart, so it cannot be read as parity.

## Round 37 — no inventory change (2026-11-14)

The phone has no equivalent of this round's work and needs none: it draws with Flutter widgets and has no
stylesheet layer to remove. Nothing was added to, removed from or re-read in this inventory, and no phone
screen was consulted, because no phone behaviour was in question.

One thing worth recording because the two platforms are read side by side: the web's component classes
(`.btn`, `.chip`, `.field`, `.card`, `.icon-btn` …) were never the phone's names. They were a shorthand
the web invented to hold one flat style per shape, and this round replaced that shorthand with the
utilities it stood for. The painted result is what this inventory reads, and it did not move.

## Round 38 — the phone's own photo, and the wash it is read through (2026-11-14)

This round was about a convo's wallpaper and theme, so the phone's own path was read end to end
(`app/lib/wallpaper.dart`, `app/lib/screens/wall_frame.dart`, `convo.dart`, `chat.dart`, `skin.dart`) and
the web was brought to it. Five facts decided the work:

| Phone | Detail | Web now |
| --- | --- | --- |
| The photo never leaves the device | `OwnWalls` keeps it in application support under `walls/`; nothing is uploaded. The server is told `wallpaper: 'default'` only afterwards, and a failure is tolerated | A data URL in `localStorage`, never sent; `PATCH {wallpaper:'default'}` fired after the local save, its failure ignored |
| One photo per convo, replaced not added | `save()` prunes the picture it replaces; an unreadable manifest reads as no walls | One row per thread, overwritten; an unreadable row reads as no photo |
| Drawn at the strength the person chose | `Opacity(opacity: own.opacity)` over `X.ink`, with nothing over the photo; `0` draws no picture at all; the default in `wall_frame.dart` is `1.0` | The photo is the root's `background-image`; the page is composited over it at `1 − opacity`; the default is `1`; `0` draws nothing |
| A built-in wall is washed, not darkened | `ColoredBox(X.fade(X.ink, kWallScrim))` — the page ground at `0.78`, so the picture shows at 22 % | `var(--page)` at `0.78` |
| Picking a wall replaces the photo | `_pick` removes the own photo before it asks the server for the key | `setSkin` clears the own wall, keeps it, and restores it if the request fails |

**The tint rule the web now follows.** `tintOf` returns `kTints[key]` for a picked key — the light-scheme
readings, which `TINT_HEX` carries value for value — and only `default` defers to the theme
(`chatTint ?? kChatTint`, the app's pink). The web now paints a picked key with that same reading; its
`default` still defers to `theme.chatTint ?? theme.accent`, which is the one recorded divergence, not a
claim of parity.

**What this inventory did not change.** No phone screen is described differently, no feature was added to
or removed from the list, and the phone's sheet still has no per-convo theme row — that removal
(2026-10-24) is recorded above and the web's deliberate keeping of the row is unchanged. Nothing under
`xelvic/` was modified; the five files above were read.

## Round 39 — how the phone draws an emoji in a message (2026-11-14)

Only `app/lib/screens/chat.dart` was read, and only for the way a message body is drawn. Three facts decided
this round:

| Phone | Detail | Web now |
| --- | --- | --- |
| The body is one `Text` | `Text(text, style: TextStyle(color: …, fontSize: messageFontSize(text), height: 1.35))` — no `letterSpacing`, no widget per emoji | Each emoji is an `EmojiArt` box declared `size-[1.15em]`, whose inner grid column the character layer sizes to the glyph's own advance (**1.373em**); an emoji whose next run is another emoji now carries `mr-[0.35em]`, restoring a 1.500em pitch |
| One stands up, two take the middle size, three or more are ordinary | `messageFontSize`: 38 / 26 / 15, and `isEmojiMessage` is false for anything with words in it | `bubbleType`: 42 / 36 / 30 / 24 / 15 — **not the phone's numbers**; recorded as PARTIALLY COMPLETE |
| The line is 1.35 tall, so an emoji fits inside it | `height: 1.35` on that `Text`; a 38 px glyph sits inside a 51 px line | The web's emoji-only bodies use `leading-[1.05]`, so a drawing 1.373em tall overhangs its own line by 6.70 px at 30 px — pre-existing, unchanged this round, and recorded |
| Counting is by grapheme cluster | `emojiCount` counts `text.characters` whose cluster is emoji, skipping whitespace; `_isEmojiCluster` accepts a joined, toned, flagged or keycapped emoji as one | `onlyEmojiCount` over `Intl.Segmenter`, the same rule, now covered by two tests |

**The consequence for the phone's spacing.** Because the phone never replaces the glyph, the space between
two emoji there is the emoji font's own advance — **1.3730em** in the font this machine has. The web had
set two adjacent drawings at a 1.15em pitch while they are 1.373em wide, so it had to add the difference
back; 0.35em puts the pitch at 1.500em. The phone also keeps the space a person typed between two emoji, and
so does the web: the margin is only for emoji that are next to each other.

**What this inventory did not change.** No phone screen is described differently, no feature was added to or
removed from the list, and the phone's sizing rule is recorded as it is rather than as the web's. Nothing
under `xelvic/` was modified; `chat.dart` was read.
