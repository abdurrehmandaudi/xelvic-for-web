# Xelvic Feature Parity Matrix

Date: 2026-11-01
Mobile reference: `xelvic/app` (151 screens, 255,946 lines)
Web target: `xelvic-web/src` (25 page files in `src/pages`, 191 `.ts`/`.tsx` files, ~61k lines — recounted 2026-11-01)
Backend: `xelvic/backend` (read-only, shared contract)

Status keys (per the project brief):

- **COMPLETE** — web surface exists and its main interactions are wired to real endpoints.
- **PARTIALLY COMPLETE** — some workflows exist; named sub-features are absent.
- **UI ONLY** — surface renders but no backend interaction.
- **API MISSING (web)** — endpoint exists but the web client does not call it.
- **MISSING** — no web surface.
- **BROKEN** — wired incorrectly (wrong path/shape/state).
- **BACKEND UNAVAILABLE** — no server capability; web cannot honestly implement.
- **PLATFORM-SPECIFIC** — mobile-only or requires native/browser capability not present.

`COMPLETE` is a code-and-contract judgement, not a live-backend verification.
See `XELVIC_TESTING_REPORT.md` for what was actually executed.

## Shell and identity

| Feature | Mobile | Web status | Evidence / gaps |
| --- | --- | --- | --- |
| Five-destination shell | `home.dart` | COMPLETE | `AppShell.tsx`; desktop rail, mobile glass nav |
| An overlay holds the page still | — (Flutter has no document to lock) | COMPLETE (NOT VERIFIED live) | `src/utils/scrollLock.ts`: one counted lock, released by each of the four overlays that need it (`Modal`, `VibeViewer`, `MomentViewer`, the convo's Spark viewer). The four save/restore pairs it replaced could strand `body { overflow: hidden }` on a page with nothing on it — two overlays closing out of order, or one effect re-running while another overlay was open — and the document is what scrolls here, so the page then would not move until it was reloaded. The Spark viewer also locked on mount rather than on opening, so a convo page held a lock of its own for as long as it was open; that is fixed too. See the eighth round of `XELVIC_TESTING_REPORT.md` |
| Branding/splash | APK assets | COMPLETE | `Brand`, `Splash`, local assets |
| Theme sync (light/dark + themes) | `theme_provider.dart` | COMPLETE | `ThemeProvider`, `/auth/me/theme/` |
| A theme repaints every screen | `theme_provider.dart`, `backdrop.dart` | COMPLETE (NOT VERIFIED) | Colours reach every screen as CSS variables on `documentElement`. The theme's *picture* now reaches the places the app draws one: the shell (`AppShell`), the marketplace and its preview (`Backdrop` inside `SettingsShell` / `ThemePreviewPage`) and the inside of a chat (`ChatPage`). Previewing a design moves the whole web, not a box in it |
| Pushed routes stand on a ground | `X.pageGround`, `backdrop.dart` | COMPLETE | `X.pageGround` is clear on any theme with art, so its bars are glass over the picture. Settings' own views copy the app's flat `Scaffold(backgroundColor: X.ink)`; only the Marketplace, which is a pushed screen in the app, takes a backdrop |
| Language selection | `language_screen.dart` | COMPLETE | `features/settings/LanguageView.tsx`, reached from the Language row; the row reads the same preference the page writes |
| QR web sign-in | `qr.dart`, `qr_approve.dart` | COMPLETE* | Full start/poll/rotate/collect; runtime unverified |
| Dev password sign-in | local only | COMPLETE | Gated by `VITE_ENABLE_DEV_LOGIN` |
| Token refresh / restore | `session.dart` | COMPLETE | Single-flight refresh in `src/config/axios.ts` |
| Logout | `session.dart` | COMPLETE | `/auth/logout/` |
| Own QR code | `qr_code.dart` | COMPLETE | `/app/qr` |
| Account switching | `switch_account.dart` | MISSING | Requires a second credential store |
| Devices / sessions | `sessions.dart` | COMPLETE (NOT VERIFIED live) | `features/settings/DevicesView.tsx` — `GET /auth/devices/`, revoke with the password the app asks for |
| Signup / OTP / reset | phone wizard | BACKEND UNAVAILABLE | Account is created on the phone (documented) |
| Deactivation | `/auth/deactivate/` | COMPLETE | `deactivateAccount()` in `SettingsPage`, behind a password confirmation |
| Profile view/edit | `profile.dart` | COMPLETE | `MyProfile` under `ProfilePage`, `/auth/me/`; the head, the four counts with their taps, the privacy pill, the Insights row, Memories and the shelf, the three floating discs and the ⋮ sheet. |
| Somebody else's profile | `person.dart` | COMPLETE (NOT VERIFIED live) | `PersonProfile`: cover band, the trade, the name and tick, `@handle · private/public`, the birthday line, the professional block, the counts the payload allows, the mutual strip, the bio, Memories and their shelf, the gate card, and the floating discs in the app's own order (⋮, convo / keep / let go / ask, their QR). |
| The day behind the face | `person.dart` `Ring`, `MomentViewScreen` | COMPLETE (NOT VERIFIED live) | `FaceButton` draws the app's flat 2.5px ring (accent while their day is unwatched, text-16% once it is) off the `["moments-tray"]` row for that person; a tap opens their day in `MomentViewer` over the page, exactly as `_openLive` does. |
| The face, as large as it goes | `showFace`, `_showPhoto` | COMPLETE | `FaceDialog` — a 240 square, rounded 22, their name under it; a tap on my own face, a hold on theirs. |
| Birthday fall | `birthday.dart` | COMPLETE | `BirthdayFall` on both profile pages on the day only: 13 balloons rolled from the fixed seed, six 11s crossings then rest, flat tones with no gradient, no pointer, nothing at all under reduced motion. |
| Avatar/cover upload | `cover_frame.dart` | COMPLETE | Multipart endpoints |
| Profile privacy switches | settings | COMPLETE | `/auth/me/privacy/` |
| Verification request | `get_verified.dart` | COMPLETE (NOT VERIFIED live) | `features/verify/VerifyView.tsx` — `GET /verify/status/`, `POST /verify/requests/` as a multipart form, the app's own field lengths |
| Contacts sync | `contacts.dart` | PARTIALLY COMPLETE | Matches shown; allow/upload phone-only |
| Professional profile | `professional_details.dart` | COMPLETE (NOT VERIFIED live) | `features/professional/ProfessionalView.tsx` writes `PATCH /auth/me/professional/`; the trade and the contact pills draw on both profile pages |

## Social graph

| Feature | Web status | Notes |
| --- | --- | --- |
| Follow / unfollow / withdraw | COMPLETE | `/social/users/{id}/*` |
| Follow requests accept/decline | COMPLETE | `/social/requests/` |
| Block / unblock | COMPLETE | |
| Report | COMPLETE | `/social/report/` |
| Mutuals | COMPLETE | `/social/users/{id}/mutuals/` behind `MutualStrip` → `MutualsModal` (port of `mutuals.dart`): the faces and the count come off the profile payload, and the list is read only when the strip is opened. |
| Crew | API MISSING (web) | Endpoint exists |
| Gate / insights | MISSING | Read-only where returned |
| Mentions | PARTIALLY COMPLETE | Mentionable search in composers |
| Circles | COMPLETE (NOT VERIFIED live) | Not social graph after all — it is a section on the Moments page; see the Moments table |
| Collabs | MISSING | `collab_sheets.dart` |
| Deals / creator directory | MISSING | `deals/*` |
| Marketplace (Drip / Themes / Logos) | COMPLETE | `MarketplaceView` + `DripView` / `ThemeShopView` / `LogoShopView`, ported from `marketplace.dart`, `drip.dart`, `theme_shop_view.dart`, `logo_shop_view.dart`; one page, three aisles, one purse, reached from the single Settings row. Runtime NOT VERIFIED |
| Codepad | MISSING | `codepad.dart` |

## Drops (posts / feed)

| Feature | Web status | Notes |
| --- | --- | --- |
| Cursor feed | COMPLETE (NOT VERIFIED live) | `GET /drops/?seen=strict` (`DropFeedView`, the app's `Drops._load`), the cursor walked by an `IntersectionObserver` sentinel at the foot of the page. The server's `caught_up` draws "You've seen the whole feed" instead of an empty page. See the Drops and Vibes pass of 2026-11-02 |
| The feed survives its own invalidates | COMPLETE (NOT VERIFIED live) | The page and the prefetcher read **one** options object each (`src/features/drops/feedQueries.ts`): key, fetch, first ask, page rule and freshness together. Stated twice, they drifted — the prefetch left out `getNextPageParam`, and a query's options are *replaced*, not merged, by the next fetch that carries any — so an invalidate over a feed with more than one page in hand threw `options.getNextPageParam is not a function`, intermittently. Reproduced from the old shape outside a browser, exact message, then fixed. See the eighth round of `XELVIC_TESTING_REPORT.md` |
| Playback: one ear | COMPLETE (NOT VERIFIED live) | `src/lib/playback.ts` — whatever starts pauses whatever was playing, across feed clips, the Vibes reel and the music bar. A feed clip is silent until the card's speaker is pressed (`features/drops/sound.ts`, the default in `sound.dart`), and plays only while it is the card on screen |
| Feed performance | COMPLETE (NOT VERIFIED live) | Pictures and clips are fetched when they come near the viewport rather than when the card mounts; the media cache is a 160-entry LRU over the session; the feed and shelf hold for 60 s; the aside is gated to ≥1280 px; a removed card leaves the cached pages without a refetch |
| Mine / user's drops | PARTIALLY COMPLETE (`/drops/mine/` NOT IMPLEMENTED) | A profile's own posts and Vibes are drawn from the profile routes (`/drops/users/<handle>/` and `.../vibes/`) and `/drops/mine/activity/` is read, but **`GET /drops/mine/` itself is called by nothing under `src/`** (recorded 2026-11-06), so there is no "my own posts" shelf here — `NOT IMPLEMENTED` |
| Saved drops | COMPLETE | `/drops/saved/` fallback |
| Text / image / poll / place / tag creation | COMPLETE | `DropComposer` |
| Likes, saves, shares, hide, delete | COMPLETE | |
| Comments + replies | COMPLETE | `CommentsModal` |
| Poll voting | COMPLETE | |
| Notes | API MISSING (web) | API supports; web focuses comments |
| Vibes | COMPLETE (NOT VERIFIED live) | The shelf (`/drops/vibes/`) and the walk (`VibeViewer`: real player, its own end behaviour per `vibeEnd.ts`, mute, the player sheet, the next-clip hint), plus the studio (`VibeStudioPage` + `features/drops/VibeStudio.tsx`, reached from a Vibe's own top bar and from the composer's `mode=vibe`). The shelf asks `GET /drops/vibes/?limit=8` like the app's `Drops._load`, and the walk mounts a player for the active slide and its two neighbours only. See the Drops/Vibes pass of 2026-11-01 and the Drops and Vibes pass of 2026-11-02 |
| Hashtags / trending | PARTIALLY COMPLETE | Degrades honestly when route absent |
| Media gallery / memories | PARTIALLY COMPLETE | Read surfaces |
| Camera / photo editor | PARTIALLY COMPLETE | `CameraCapture` + `PhotoEditor`; browser-only. Changed 2026-11-02: the code is warmed while the screen is being read and on hover/focus/touch of the trigger, so the tap is no longer the moment ~130 kB of chunks begins downloading, and the convo's mount draws a real sheet instead of `null` while it arrives. The editor's sticker sheet and sound sheet now read the same shelves the phone's do (see **Stickers** and **Audio** below), its bookmark files through `POST /saved/`, and "Choose a part" offers the phone's own eleven part lengths. `getUserMedia` still runs only inside the mounted component, and still asks for video and audio in one call (`features/camera/warm.ts`) |
| The editor's tool panels share one surface | — (deliberate divergence) | COMPLETE (NOT VERIFIED) | Every tool panel, every control on one and the sticker sheet now draw on the theme's card and ink — the pair the Audio sheet, the trim sheet and the Tag sheet already used (`PANEL`/`CHIP`/`CHIP_OFF`/`CHIP_ON` in `PhotoEditor.tsx`). **This is a divergence from the phone, not parity**: the app's editor is charcoal in every tool's panel (`_sheet` returns one `_chrome` for all of them in `app/lib/screens/editor/image_editor.dart`, and the sticker sheet's search row says in a comment that it is a dark row on a sheet that is dark in every theme), and the phone is the reference this matrix is measured against. The web had already gone the other way in three of its four sheets, and the ninth round of `XELVIC_TESTING_REPORT.md` finished the move at the user's instruction. The controls that sit *on* the photograph keep their dark scrim on both platforms. The text field no longer previews the chosen colour in its own words — the palette opens on white, so on a light panel that preview is an empty-looking field; the colour is now a dot at the head of the field. `inkOn()` in `editorTypes.ts` picks the ink for the pills painted in a colour, because the panel's ink is the plate's own colour for two of the nine rows |
| Vibe / video editor | MISSING | `screens/editor/*` |
| Send/respond media sheets | PARTIALLY COMPLETE | Attachment flow exists; share targeting limited |

## Moments

| Feature | Web status | Notes |
| --- | --- | --- |
| Tray (mine/unseen/seen) | COMPLETE | `/moments/tray/`; rail order is the server's — answered (always empty), unseen, seen, silenced |
| Viewer + timed advance | COMPLETE (NOT VERIFIED live) | `MomentViewer` is a port of `MomentViewScreen`: a 60ms ticker, the per-item hold (`MomentItem.hold` — clip window, sound window up to 60s, a carried picture's own life, else 5s), a video read off the element's own clock, and a step at the end of each. Tap steps (left third back, else forward); a hold pauses at 480ms and, where the item carries something, arms leaving at 1230ms |
| Mark seen | COMPLETE | Per item (`/moments/items/{id}/seen/`) as each comes up, and the moment once its last item is reached |
| React / reply | COMPLETE (NOT VERIFIED live) | The heart is `/moments/{id}/react/` (blank emoji takes it back, the server's answer is what is drawn); a long press on the button opens the five faces; the line written back is `/moments/{id}/reply/` and lands in a convo. Drawn on somebody else's moment only |
| Create image moment | COMPLETE | `CameraCapture` → `ShareMoment` (reach + audience) |
| Text/poll/track/spark moments | COMPLETE (NOT VERIFIED live) | `TextMoment` (note), `PollMoment`, `ComposeMoment` (`?compose=1`, the "Moment" row on a drop), `ShareMoment` |
| The tally, and who watched | COMPLETE (NOT VERIFIED live) | `_reactions` sends a reader no number, so the answers row is drawn on my own day only and is the way into the who sheet: `/moments/{id}/viewers/`, `/moments/{id}/reactors/`, and `/moments/items/{id}/voters/` for the poll, each read when the sheet is opened |
| Carried: a way out of the item | COMPLETE (NOT VERIFIED live) | `_carried` order — a Vibe on the item, then `made_from` (vibe → the Vibes walk at that clip, drop → the drop), then a sound (→ Audio), then `source_id` (→ that moment, opened as a walk of its own). The line at the foot of the picture names where the hold leads, and switches to "Let go to open X" past the leave threshold |
| Carry on, when the moment names me | COMPLETE (NOT VERIFIED live) | A picture opens in the web's own editor (`PhotoEditor`, seeded with the people it named minus me) and what comes back out of it is what goes up, posted with `source` so the server credits the original and sends the Remention card — `carryMoment`'s rule. A clip, a note, a Vibe or an item with no picture still carries through `POST /moments/{id}/carry/` unchanged. **Not carried:** `links` and `tags` (the drawn positions), because the web editor's document has no field for either |
| Share | COMPLETE (NOT VERIFIED live) | `POST /moments/{id}/share/` is the gate (a private account refuses with a reason instead of a sheet whose Send would fail); `{thread}` makes it the deed, one convo at a time, and the count said afterwards is the number that arrived |
| Add to Memories | COMPLETE (NOT VERIFIED live) | `AddToMemories` — pick what has run out its day (`/moments/awaiting/`), then an old shelf (`PATCH /moments/memories/{id}/`, or straight in from a shelf's long press) or a new one (`POST /moments/memories/`, name + cover from the kept pictures or an upload). Reached from the three dots on my own moment, from "New Memory" on my profile (`/app/moments?memories=1`), and from "Add more to it" under a long press on my own shelf |
| Add more to it | COMPLETE (NOT VERIFIED live) | `AddToMemories` with `into` set — the picker, then `PATCH /moments/memories/{id}/ {items}` with no "which shelf" step, which is `AddToMemoriesScreen(into:)` |
| Audience / reach on a moment | COMPLETE | `AudienceSheet`, the same reach the composer writes |
| Together mode | **not a feature** | Corrected 2026-11-01: `grep -rn "together\|Together\|watch party" app/lib` finds no such screen, widget or string in the mobile app. It was named here in error and is not a gap |
| Stickers/drawings | COMPLETE | They are the *editor's*, not the viewer's, on both platforms: `PhotoEditor` has stickers (`EditorLayer`), text, frames, filters, auras, cutouts and strokes, which is what `ImageEditorScreen` gives the phone. `moment_view.dart` itself has no sticker or drawing tool, and neither does `MomentViewer` |
| Viewing a Memory | COMPLETE (NOT VERIFIED live) | A shelf card opens the *same* viewer a moment opens in, built as a `Moment` with `isMemory: true` — the phone's `MemoryShelf.open`. Inside it: no watchers and no eye row, no `seen`/`itemSeen`, "Your Memory" / "Memory" / "{n} in this Memory" with no `when`, `/moments/memories/{id}/react|reply|reactors|share/`, "Whoever answers turns up here." in the who sheet, no three dots, and Remove with the app's wording. A Memory of a playlist opens at `/app/audio/{playlist}` instead |
| Managing a Memory | COMPLETE (NOT VERIFIED live) | The long press on my own shelf card — `manageMemory`: Add more to it (`PATCH … {items}` through the picker), Rename (`PATCH … {title}`), Change the cover (one of its own items, or a picture off this device through `/media/uploads/` then `{cover_upload}`), Remove (`DELETE /moments/memories/{id}/` with the app's own question and sentence). A playlist Memory leaves out the two rows with no meaning over one |
| The ring on a face | COMPLETE (NOT VERIFIED live) | `useLiveRings()` reads the `["moments-tray"]` answer and returns its `unseen` authors — `Moments._rings`. The profile's own face, the convo row, the *drops* feed (`DropCard`) and search (`PersonRow`) all ring from it |
| A Memory opened out of Alerts | COMPLETE (NOT VERIFIED live) | `/app/moments?memory=<id>`: the shelf is asked (`moments/memories/`, since a Memory has no by-id read), and the Memory it names opens in the viewer through the same `memoryAsMoment` the profile uses. A playlist Memory goes to the playlist, one this reader may not open says so, one that is gone says it is gone |
| Circles — the section, and "Pick your interests" | COMPLETE (NOT VERIFIED live) | `CirclesSection` under the rail on `/app/moments`, ported from `CircleSection` / `CircleScreen` / `CirclePickerScreen` in `app/lib/screens/circles.dart`. Three states, and they are the app's: nothing picked (the card *is* the picker — "Find your people", "Pick your interests"), one to three cards (field glyph, `field · COUNTRY`, seats, run flame, task line, status, post button, top-3 board, "See all N takes"), and "N more interests this month" off the server's own `max_picks`. The picker is `InterestPicker` — "Your interests", "Choose up to {n}", a tick / lock / plus / spinner per row, and a pick that lands straight in the circle it made. One circle opens at `/app/circles/:circleId` (`CirclePage`): the members' faces, the task card, "Today's board" with the server's ranking, and a numbered `DropCard(read: false)` — the app's own rule, so a board nobody opened counts no looks. Posting goes through the shared `DropComposer` with `circle` set; `POST /circles/{id}/` runs the same `write_fields`, so a take's body is the drop composer's own and the task's `kind` only chooses the door (text → note, sound → sound, clip → the clip door, picture → pictures). Note on the source: the phone's *Moments* page mounts `LiveNow` where this section used to sit (commit `f4f7ffb7`, 2026-10-31), while the section, both screens and all four routes are still shipped; the web now draws the app's `LiveNow` strip under the rail *and* keeps this section beneath it — the one deliberate difference on that page, because the app has circles on a shelf of their own and the strip alone would leave a web reader no way to reach them |

## Convo (messaging)

| Feature | Web status | Notes |
| --- | --- | --- |
| Two-pane desktop layout | COMPLETE | `ConvoLayout` persistent sidebar |
| Mobile full-screen chat | COMPLETE | sidebar hides under `:threadId` |
| Chat screen design / theme fidelity | COMPLETE (static) | heading is name/face/verified tick only; no clock above text bubbles (only on bare media/cards); day pills; 4/10/2 run spacing; sender name only at a run head (11.5 w700); receipt under every own bubble; edited marker inside cards; bubble 14/10/14/8 radius 18/6 max 76%; composer 12/8/8/8 with 22px field, 46px send |
| Emoji said on their own, and the space between them | PARTIALLY COMPLETE | **Round 39.** `EmojiText` replaces each emoji with an `EmojiArt` box declared `size-[1.15em]`, but the character layer inside it sizes the box's grid column to the machine glyph's own advance — **1.3730em**, 41.19 px at 30 px — so the drawing fills 41.19 px inside a 34.50 px box. Two emoji typed together therefore overlapped by **6.70 px** at a 1.150em pitch. An emoji whose next run is another drawable emoji now carries `mr-[0.35em]`: a **1.500em** pitch, measured clearance **+3.80 / +4.55 / +5.31 / +1.89 px** at 30 / 36 / 42 / 15 px, margins 10.5 / 10.5 / **0** px across a row, and the same clearance for the machine's fallback character. A lone emoji, or one with a space after it, is left alone. **Gaps:** the sizes are still the web's own — `bubbleType` 42 / 36 / 30 / 24 / 15 against `messageFontSize` 38 / 26 / 15 — so a three-emoji row is twice the phone's; and the drawing is 1.373em tall in a 1.05em line box, so it overhangs its own line by 6.70 px at 30 px where the phone's `height: 1.35` keeps its glyph inside the line. Not verified by eye in a real thread |
| Conversation search | COMPLETE | local list filter |
| New DM / new group | COMPLETE | `ConvoSheet`, `/chat/groups/` |
| Thread list + ordering | COMPLETE | pinned-first sort; live update on arrival; fixed 2026-11-01 |
| The line under a name | COMPLETE (NOT VERIFIED live) | Changed 2026-11-03. `listLine` is the phone's own rule: **never the message itself** — `Say something` when the convo is empty (ahead of any count), my own receipt word, `N new` with no noun, `Nothing new`; a convo with myself keeps its own line. The web used to print `preview.text` with a `You:` prefix, a stub word per attachment and `N new messages` |
| Unread count | COMPLETE (NOT VERIFIED live) | Changed 2026-11-03. `N new` in the line under the name, and a plate at the end of the name on **group rows only** (`convoUnreadBadge`); the right-hand accent circle on every row is gone. Muted rows read like any other |
| Unread lane membership | COMPLETE (NOT VERIFIED live) | Changed 2026-11-03. `inUnreadLane`: the count first, then `unread_other_count`, so a convo whose only waiting line is a Spark stays off the lane (the owner's rule of 2026-10-24). A card without the split keeps the old answer |
| Row marks (pin, birthday, timer, spark, clock) | COMPLETE (NOT VERIFIED live) | Changed 2026-11-03. The phone's one line in its order: a pin disc, a cake on the person's day (read off `other.birthday`), the timer at 3 px from the spark, the spark, the clock at 7 px. The waiting bar is the phone's 3 px mark inset 14 px, not a full-height rule |
| Play button on a row | NOT IMPLEMENTED | The phone's `SparkPlayButton` plays a convo's held Sparks from the row. This build's run viewer lives inside `ChatPage`, so a row cannot open one without a thread; the button is not drawn rather than drawn as a tap that does nothing |
| Live list update on arrival | COMPLETE (after goal 4.7) | patches card from `thread.update` |
| Cursor message history | COMPLETE | `useInfiniteQuery`, newest-first pages |
| Send text / image / video / audio / doc | COMPLETE | HTTP send + `/chat/assets/` |
| Voice recording | PARTIALLY COMPLETE | `MediaRecorder` + file fallback |
| A voice note and a sound file — two designs, not one | PARTIALLY COMPLETE (NOT VERIFIED live) | Round 32 ported the phone's `ChatAudioBubble` as [VoiceBubble.tsx](src/features/convo/VoiceBubble.tsx) + [voiceclip.ts](src/features/convo/voiceclip.ts): a 40 × 40 control beside a **fixed 150** track, `height` 30, `mostBars` 56, the phone's own cell/gap/height maths, a 24-bar idle shape and a 900 ms dance, and the 1 → 1.5 → 2 speed ring. Round 33 split the two kinds apart: `voice` draws that player inside its bubble (**220 × 84**, ground `rgb(18, 26, 44)`, radius `18px 18px 18px 6px`, holding a 190 × 58 player), and `audio` draws the phone's `ChatAudioFileRow` — a **220 × 62.73** file row inside its own bubble (250 × 88.73, `rgb(15, 28, 60)`, radius `18px 18px 6px`), 32px glyph, name 14/700, details 11px/400. **Named gaps:** the speed chip cannot be set before the first press (the phone's `_speedChoice` can), `InFront` is not ported, the transfer controls (Pending / Uploading / Retry / Discard) are absent, the phone's file name allows two lines and the web truncates to one, and the phone's `sender` on somebody else's voice note is not drawn |
| Reply | COMPLETE | |
| Edit | COMPLETE | text only, as backend permits |
| Delete for me / everyone | COMPLETE | `?scope=all` |
| Copy text | COMPLETE | |
| React | COMPLETE | |
| Poll create/vote | COMPLETE | |
| Forward | COMPLETE (after goal 4.5) | `/forward/` |
| Message info (group) | COMPLETE (after goal 4.6) | `/info/` |
| Attachments sheet / media index | COMPLETE | `/media/` |
| Optimistic send + reconciliation | COMPLETE (after goal 4.2) | `pending`/`failed`, `client_id` |
| Typing indicators | PARTIALLY COMPLETE | Since Round 29 the web draws the other side's **character in its `typing` pose** over the composer, which is what the app does — the dot line is gone. Named sub-feature still absent: a figure a **theme** ships is not in the web's catalogue, so an account wearing one gets the bundled figure (`PEEK_SIZE` 84, `PEEK_RISE` 0.86, measured at `translateY(-72.24px)`). The header no longer repeats it as text; the sentence survives `sr-only`. |
| Online presence | PARTIALLY COMPLETE | The **gaze** half is done: Round 29 ported `app/lib/looking.dart` and the convo now draws the `wait` pose for somebody sitting on my convo or profile, asking every 15 s and dropping a gaze the server has not renewed in 30 s. The **online/offline** half is still **NOT IMPLEMENTED** — that is a different fact from where somebody is looking. The header's old `online` text stays removed to match the app's heading (name, face, verified tick only). |
| Read / delivered receipts | COMPLETE (after goal 4.3) | server `status` + member watermarks |
| Spark / view-once send (camera → editor → send) | COMPLETE / NOT VERIFIED | app's own `CameraCapture`; sends `kind: image|video` + `payload: {view_once: true}` (the invalid `kind: "spark"` is gone) |
| Spark bubble (sent / opened / gone) | COMPLETE | recipient tile "A Spark for you / Tap to open · once only"; otherwise "Spark · sent / opened / gone" from `payload.opened_at` |
| Spark viewer + run | COMPLETE / NOT VERIFIED | full-screen black viewer, run of unopened incoming Sparks in ordinal order, tap to advance/close, reply bar, screenshot line from server `shot_at`. Fixed 2026-11-02 with the scroll lock: the host keeps the viewer mounted for the length of a convo, so its walk position crossed runs — a shorter run opened afterwards drew nothing. The position (and the reply draft and sent mark) now reset with the run |
| Spark sound band | COMPLETE / NOT VERIFIED | asset id in `payload.sound` → `/chat/assets/{id}/content/`, play/pause, start/end window, `sound_title` or "Sound attached" |
| Spark / view-once open | COMPLETE (after goal 4.4) | `open-once` path fixed; bytes fetched before the spend |
| Disappearing messages | PARTIALLY COMPLETE | mode shown; consent flow limited |
| Vault | PARTIALLY COMPLETE | `VaultModal`; code lock |
| Group members / roles | PARTIALLY COMPLETE | list + basic management |
| Group rooms / channels | PARTIALLY COMPLETE | room bar + send channel |
| Group invites | PARTIALLY COMPLETE | |
| Group avatar | PARTIALLY COMPLETE | |
| Wallpaper / tint | COMPLETE | `skin.ts`, `look.ts`, `ChatPage` — **Round 38**: a photo of your own is kept locally and drawn by the chat root (`own.opacity` over the page ground, full strength by default), a built-in wall wears the page at 78 %, and an explicitly picked tint now paints the thread; before that round the picker's writes were never read |
| Theme's own picture inside a chat | COMPLETE (NOT VERIFIED) | `ChatPage` draws `theme.chatWall` behind the thread when no wallpaper was picked, washed with the page's own ink at `WALL_SCRIM` and framed by `chatFrame` — the app's last-answer ordering (a picked wallpaper and a taken photo both outrank it) |
| Chat accent on an uncoloured convo | PARTIALLY COMPLETE | The phone's `tintOf` for `default` is `theme.chatTint ?? kChatTint` (`#E31B66`) — the app's pink, *not* the account accent. The web computes `--convo-accent` as `theme.chatTint ?? theme.accent`, so changing the account colour repaints every un-picked convo where the phone's stay pink. A convo with an explicit tint is now painted by that tint (**Round 38**), which is the half that used to do nothing; see the gap report |
| Clear / flags (pin, mute) | COMPLETE | `ConvoSheet` |
| Encrypted / disappearing strip over the first message | COMPLETE (NOT VERIFIED) | the app's `_strip`: "This convo is encrypted" on every thread, "Disappearing convo · {window}" with an accent border when vanish is on; `X.card` fill, radius 20, padding 11/6/12/6, glyph 12, words 10.5 w600 |
| Share cards — song (`payload.track`) | COMPLETE (NOT VERIFIED) | sleeve, title, artist, the track's own wave (ported `waveShape`), heart at the real route, play through the one player, clocks. Heart starts unfelt: a share carries no liked state. The site has no flow that *sends* a song. **Round 33** rebuilt it to `chat_track.dart` and drew it the way the phone does: **no bubble at all** (`bare`, the rule every other card already followed), 272 × 152.89, padding 10, 26 bars of 2.5px, the phone's 10.5/600 tabular clock row, a 10px stamp above it, and no repeated body — plus the palette accent rather than the convo tint (`--palette-accent`, measured `#8FB4FF` against `#2B57C6`). **Named gaps:** a fixed 272 where the phone is content-sized inside 220–290, and a hardcoded failure line where the phone prints `store.stuck!` |
| Share cards — person (`payload.profile`) | COMPLETE (NOT VERIFIED) | snapshot card opening `/app/u/{handle}`. The site has no flow that *sends* a person |
| Share cards — story (`payload.story`, incl. `retracted`) | PARTIALLY COMPLETE (NOT VERIFIED) | the app's 348 px panel, name band, item bars and a press that opens the real moment in the one viewer. In-card playback, the heart and "Remention" are **not** on the card — they are in the viewer, which is the one implementation of each |
| Moment reply header (`payload.moment_ref`) | COMPLETE (NOT VERIFIED) | "Replying to their moment · clip" over the bubble; the press reads the moment and opens it, and a moment that is gone says so |
| Drop share card | COMPLETE (NOT VERIFIED) | taken from `chat_drop.dart`: 258 px card, radius 18, mention/tag line on the reader's copy only, waiting shell when the read has not landed, trouble line when it fails, `likes_off` honoured |
| Uploaded sound shared into a convo | COMPLETE (NOT VERIFIED) | a real player over the drop's content route with a clock, instead of an unplayable still |
| Passing a post on (share sheet) | COMPLETE (NOT VERIFIED) | the app's `ShareCard`: search, a tick strip of ten faces, a pinned send button, one card per convo (`sendToMany`) with a tally of what landed, partial runs said out loud, "Another app" written only after the hand-off, "Copy a link" writing nothing. "Put it on your Moments" is **NOT IMPLEMENTED** — the site's composer takes files off the roll and a post already up has no road to it |
| Links / stickers / drop / live / playlist shares | COMPLETE (NOT VERIFIED) | drop (+Vibe), sound, playlist, room, sticker, song, person and story renderers all exist; the sheets that send a *song*, a *person* or a *story* into a convo are the phone's (`payload.track` / `payload.profile` are read, never invented) |
| Sticker picker (convo, editor, respond) | COMPLETE (NOT VERIFIED) | Added 2026-11-02. The convo's **plus → Sticker** opens the app's `_StickerPicker` shape (search box, four-column grid); the editor's sheet reads the same shelf with a search box that narrows what is in hand. The shelf is our sticker service's (381 rows, measured 2026-11-02), falling back to our own `/api/v1/stickers/`. A respond's and a note's picker stays on our own server, which is the only shelf `_comment_sticker()` can validate an id against |
| Sticker messages | COMPLETE (NOT VERIFIED) | Added 2026-11-02. Drawn as the app draws one — the picture at 148 px, `object-contain` — and sent as the app sends one: an ordinary `text` line whose payload carries `{id, url, name}`. A line whose payload has no address falls back to the words the line already says, rather than the `"[object Object]"` this used to print |
| Keep / collab / vanish consent sheets | MISSING | |
| Offline outbox / durable sync | PARTIALLY COMPLETE | refetch on reconnect; no outbox |
| Calls (audio/video) | PARTIALLY COMPLETE (NOT VERIFIED) | Added 2026-11-06. Real WebRTC: `features/calls/engine.ts` opens the devices, builds the mesh, and speaks the phone's own protocol over the app's one socket — `call.ring` / `call.accept` / `call.decline` / `call.leave` / `call.video` / `call.signal` / `call.pending`, with the relay's address from `GET /calls/ice/` and one call read back from `GET /calls/<id>/` after the socket returns. The convo header's two buttons and a call-log row's call-back button place a call; `features/calls/CallOverlay.tsx` draws dialling, ringing, live and the goodbye at full screen with mute, camera and hang-up. Who offers, the glare rule (`offersAfterCollision`) and the candidate queue are the phone's rules, ported. **Missing:** no ringtone or vibration, no answer from a system notification, no earpiece/speaker route switch, no camera flip, no `call.add` (a group call can be drawn, not started, from the web). **Not verified:** never run against a live backend, no second device, no microphone — the state machine has 42 tests, the connections have none |
| Message search | COMPLETE | `/chat/search/` rendered under the Convo search field |

## Audio

| Feature | Web status | Notes |
| --- | --- | --- |
| Home, recent, playlists, podcasts | COMPLETE | `/audio/` |
| The reco layer's category doors | COMPLETE (NOT VERIFIED live) | A chip opens `/app/audio/c/:key` (`AudioCategoryPage`) — `GET /audio/categories/<key>/`, the shelf's own title and subtitle, rows that play with the shelf as the queue, and the server's empty state |
| Weekly board | COMPLETE (NOT VERIFIED live) | `/app/audio/board` (`AudioBoardPage`) — `GET /audio/board/`, `weekSpan`, the chart in the server's order; no client re-ranking |
| Audio drops (reco strip) | PARTIALLY COMPLETE | `GET /audio/feed/` as a strip whose press plays the strip as the queue. The app's full-screen swipe deck is not ported |
| Downloads door | NOT IMPLEMENTED | The app keeps tracks on the device; a browser here has no kept-tracks store, so the door is absent rather than a button that does nothing |
| Track search | COMPLETE | |
| Persistent player | COMPLETE | one audio element |
| Playlist CRUD + cover + reorder | COMPLETE | |
| Shared playlist landing | COMPLETE | `/s/:token` |
| Artist page | COMPLETE | `/app/audio/artist/:slug` |
| Music sheet / share track | PARTIALLY COMPLETE | playlist share only |
| Row hearts | COMPLETE | Every row, an uploaded sound included: a drop is felt at `POST /drops/{id}/like/`, a catalogue track at `/audio/tracks/{id}/like/` |
| Audio studio | COMPLETE (NOT VERIFIED live) | `/app/audio/studio` (`AudioStudioPage`) — `GET /audio/studio/`, one's own only; an unmeasured number reads "Listeners not recorded", never 0 |
| One studio item and its audience | COMPLETE (NOT VERIFIED live) | `/app/audio/studio/:itemId` (`AudioStudioDetailPage`) — `GET /audio/studio/<uuid>/` and `/audience/?days=7`. The app's order: head, lifetime sums, the trend read (no band and no score when `score` is null — the outcome word and the server's `why` instead), rates ("Not measured" when the denominator was 0), components, audience bars, "Where they are" (null → "Not recorded." + why), used by, this week, false rights |
| The sounds a clip can be laid on | COMPLETE (NOT VERIFIED live) | Fixed 2026-11-02, sixth round. The editor's sound sheet is the phone's `_AudioPickerSheet`: three chips (**All** / **Trending** / **Saved**), a search box, a carousel of the first four rows, and the same list under all of them — the *uploads* (`?source=drop&limit=60`, the phone's `kPickerRows`), never the shipped catalogue. It used to ask `/audio/tracks/` with no `source`, which is the catalogue, and then fall back to the Audio tab's `recent`/`podcasts`/`hero` when that was empty, so it showed a handful of songs the phone does not show there. **Saved** is the saved shelf (`GET /saved/`, a saved drop turned into a sound row), not the hearts. Fixed in `src/features/audio/audioShelf.ts`, pinned by 10 cases in `audioShelf.test.ts` |

## Live

The app has **no Live tab**. Its Live surface is the "Live now" strip at the end
of Moments (`moments.dart:629`), the room screen (`room.dart`), and the sheet a
room is made in. The web's `/app/live` shelf predates this pass and is kept as a
web-only door.

| Feature | Web status | Notes |
| --- | --- | --- |
| Live shelf (web-only) | COMPLETE | `/app/live`, `GET /spaces/?shelf=live\|upcoming\|ended\|mine`. Cards say `crowdLine(room)` — "Starts …", "Over", "Nobody in it yet" or "N people" |
| "Live now" strip | COMPLETE (NOT VERIFIED live) | `LiveNow` under the Moments rail, where the app draws it. `?shelf=kept` — the server answers who this account keeps is on. Always drawn; empty says "Nobody you keep is on right now."; `room.new/update/gone` refresh it; a failure is silent. The web keeps `CirclesSection` below it (the app has circles on their own shelf) — a recorded difference |
| Opening a room | COMPLETE | `OpenRoomSheet`, shared by the shelf and the strip: kind, name, note, tags, start time. Empty start goes on air, a future one announces, and the words say which the server made |
| Room head and three dots | COMPLETE (NOT VERIFIED live) | Cover, title, "{host} · {crowdLine}", then "Over" / the start time / LIVE. The menu: Start now, Share the room, Report the room, Close the room, Leave quietly — the app's order and conditions |
| Share the room | COMPLETE | Convos (`POST /spaces/{id}/share/` `{thread}`) and Share outside (`navigator.share`, clipboard fallback). The line is the app's `roomLine` with the address |
| Report the room | COMPLETE (NOT VERIFIED live) | `ReportSheet kind="room"` — host name/handle/face, room title as the preview, reasons from `GET /social/report/`; never offered on your own room |
| Room join / chat / reactions | COMPLETE | `/app/live/:roomId`, socket `room.say` / `room.react` |
| Hands, stage, mute, camera | COMPLETE | `hand`, `stage`, `dismiss`, `mute`, `camera` |
| Room games / boards | COMPLETE (NOT VERIFIED live) | `GET /spaces/games/`, `game/open|play|join|again|close`, six board games — the line board is drawn, the others as their text state |
| Room bits | COMPLETE | `features/live/parts.tsx`: `waveShape`, `RoomCover`, `crowdCount`, `whenRoom`, `crowdLine` — the app's generator and its words |
| Room sound (WebRTC) | NOT IMPLEMENTED | The app's stage audio is a WebRTC mesh over the `call.signal` relay (`stage.dart`); the web has had a client for that relay since the calls (2026-11-06), but the room page was not wired to it, so the stage here still carries no voices. The page says so in "How a room works" and nothing pretends to open a microphone |

## Rewards / Sparks

| Feature | Web status | Notes |
| --- | --- | --- |
| Theme catalogue / preview / purchase | COMPLETE (NOT VERIFIED) | Themes aisle of the marketplace: `/catalogue/` shelf, per-design preview that moves the whole web, `/sparks/wallet/buy/`, `/auth/me/theme/`, `/catalogue/figure-pick/`, theme face/cover upload. The web-only duplicate on the Sparks page was removed — the app's `reward.dart` mounts only `WalletView` |
| Wallet / ledger / contributors | COMPLETE | `/sparks/wallet/`; the marketplace header's purse reads this same query |
| Medals / ladder | COMPLETE | |
| Spark sheet (one run, opened from a row) | COMPLETE (NOT VERIFIED) | Added 2026-11-03 as a port of `screens/spark.dart`: ring off the lap's `pct`, the figure (the one place a spark is a number), the awards worn, each side's 48-hour clock, the closing sentence, the broken banner with its leave date, the buy-back offer (price, balance, deadline, the server's refusal sentence), the hidden banner, the hide switch, the next rung, the seven-rung ladder and the rules. Draws the row's copy at once and refines it from `GET /sparks/threads/<id>/`; the clocks tick off the payload's own dates. `setOff` and `restore` are the phone's two writes. The phone's `_comingUp()` row — the next rung's sentence **and** its "Add to Moments" pill — landed 2026-11-04 |
| Spark card (`spark_moment.dart`'s painter) | COMPLETE (NOT VERIFIED) | Added 2026-11-04 (`features/sparks/card.ts`): a 1080×1920 picture of one run — 840×1520 card inside the widest crop a phone shows, 48 px below the middle, corner 64, paper = the award's colour at 10 % over white, fixed ink. The flame in the award's colour, the two curves with a chat and a call mark on them, both faces with their names and the list's online dot, the ring with the award's glyph, the award's name in caps, the days, the rule, and the closing line between a sparkle and a heart. Nothing is themed; the award is `headAward`'s, so a broken-after-Century run wears the medal. Glyphs are `lucide-react`'s own path data; a face is drawn only from the media cache or a local blob, else initials. A public avatar address comes back from that cache **untouched**, so it is asked for with `crossOrigin="anonymous"` — a cross-origin picture drawn plainly taints the canvas and `toBlob` throws, which is what a CDN avatar did (fixed 2026-11-04). A name that is not a string and a picture the browser refuses to draw both fall back to the same initials plate, and a whole paint that fails is retried once without pictures. **Two named differences from the phone:** the card's words are English only (the phone reads them from `strings/en.dart`, so a Hindi phone draws a Hindi card), and my own face's presence dot comes from the server's own answer for `me.online` rather than the phone's assumed `true`. **Not verified:** the painter was rendered in a real browser here, but never diffed against a phone's own rendering |
| The four card looks after `classic` | NOT IN THE PHONE — web only (NOT VERIFIED) | Added 2026-11-05. `SPARK_CARD_STYLES` = `["classic", "midnight", "sunset", "aurora", "noir"]`, picked uniformly at random per card; `classic` is the row above and is unchanged (its list of fills is pinned by a test). The four were drawn from a four-card design sheet: one skeleton under all four — both faces with names, the glyph, the award's name at y 985, the days, the closing line, all at the classic card's own coordinates — a violet pill behind the days and behind the closing line, and one flat motif per look. The first motifs were invented and did not match the sheet; **all four were rebuilt on 2026-11-05** against measurements of it: a near-white field of `#F8F5FE` with the award's tone collecting along the left and right edges, an opaque motif inside a stepped halo (a planet on an orbit with a rocket for `sunset`; a moon, a climbing rocket, stars and cloud for `midnight`; a segmented ring with four round icon buttons for `aurora`; three tilted slabs over a contour bed for `noir`), and a foot of tone that climbs the two edges and dips through the middle. The dark card's words are the light rather than the app's ink. **No gradients** — flat shapes stacked a step of alpha apart and a flat `rgba()` lift, per the house rule, so the sheet's smooth glow is *approximated* by flat steps and is the one place this knowingly differs from it. **This is beyond parity, not parity:** `spark_moment.dart` draws one card and has no counterpart for any of the four, so there is nothing on the phone to compare against. **Not verified:** the four were rasterised through the real painter in headless Chrome and measured against the sheet (the motif region of each now sits within ~4 % of its counterpart), but they have never been *seen* — measuring is not looking — the mapping of the four names onto the four cards is a judgement the sheet does not state, and the sheet's cards are 4:5 against the real box's 840×1520, so this is an adaptation of the composition and not a pixel-exact copy |
| Spark moment composer ("Add to Moments") | COMPLETE (NOT VERIFIED) | Added 2026-11-04 (`features/sparks/SparkMoment.tsx`, lazy chunk, a port of `SparkMomentScreen`): the card at post size (the file on screen *is* the upload — painted once per opening), the audience pill (`AudienceSheet`, `everyone`/`except`/`only`), the mention switch that sends the other person's id in the item's `mentions` (who that is comes from the phone's two-step rule in `features/sparks/moment.ts` — the run's own `other`, else the one live run's `other`, and nobody when two are alive, when the only run is hidden, or when the answer would be me), and one button in the award's colour — `uploadAsset` → `POST /moments/`, success said only after the server takes it. **The card is painted under a bound** (`FACE_PATIENCE_MS` = the phone's `Faces.patience`, fifteen seconds, for each face; `FONT_PATIENCE_MS` = two, for the font): a face whose bytes never arrive is drawn as the initials plate the list itself uses rather than holding the card — fixed 2026-11-04, when the first port awaited them unbounded and a silent media read left the composer on a spinner for ever with the Share button dead. The second fault was the taint: the page then said it could not draw the card, which was fixed the same day with the CORS ask, the three fallbacks and the retry (`card.ts`), the page printing the reason on a dev build, and four tests. **The sound row landed 2026-11-05**: `_soundRow()` ported — a music note and "Add audio", and once a sound is on the card a tinted row with its name, its window as `soundWindowLabel`, "Choose a part" and an ✕ to take it off. The sheets behind it are the app's own (`features/audio/SoundPicker` — the three shelves and search the composer's audio tool already reads — and `features/audio/PartChooser`, the same drag surface), lifted out of the camera so there is one implementation rather than two. A card is one picture, so the part offered is the one-picture thirty seconds (`momentSoundSpan()`), and "Choose a part" re-opens over the window already chosen, so re-cutting cannot silently hand back a longer piece. What goes up is `sound`/`sound_start_ms`/`sound_end_ms` on the item — `PostItemSerializer` has accepted all three since before the page existed (read, not written to). **Not verified:** nothing has been posted from this composer, with or without a sound (no authenticated session was available), and the sound row has not been looked at in a browser — the sheets were built and read, not seen |
| Logo shop | COMPLETE (NOT VERIFIED) | Logos aisle: `/catalogue/logos` shelf, `/sparks/wallet/buy-logo/`, `/auth/me/logo/`. The web-only "App logo" Settings row was removed — the app has exactly one Marketplace row |
| Drip (figures) | COMPLETE (NOT VERIFIED) | `/drip/` shelf, `/drip/buy/`, `/drip/wear/`, `/drip/profile/` |
| Sparks leaderboard | PARTIALLY COMPLETE | |
| Rewards screen | PARTIALLY COMPLETE | folded into Sparks |

## Notifications

| Feature | Web status | Notes |
| --- | --- | --- |
| Alerts list | COMPLETE | `/alerts/`; row geometry ported from `screens/alerts.dart` — 16pt card, 48pt face square, 44pt avatar or self-spoken glyph, 20pt tone badge ringed in the card's ground, the 28pt door that shares its corner, a 58×76 tile with its word *under* it, side-by-side keep answers, and a 9pt dot in a 48pt-high column |
| Mark read / read all | COMPLETE | `/alerts/read/` |
| Alert navigation | COMPLETE | one table, `alertPath`: a `route` for studio news, the target for everything else — a moment to `?moment=`, a Memory to `?memory=` (opened out of `moments/memories/`, since a Memory has no by-id read), a drop, a vibe, a convo, a profile |
| Real-time alerts | COMPLETE (NOT VERIFIED live) | socket `alert.new` / `alert.read` applied to the `["alerts"]` cache |
| In-app notice strip | COMPLETE | `features/notices`, a port of `notices.dart` + `notice_banner.dart`: 4s hold, queue of 5, same-conversation replacement, per-conversation ordinal dedupe, muted and the conversation being read skipped, chime only while the tab is in front, dismiss by tap, close or horizontal swipe |
| System notification while the site is open in another tab | COMPLETE (NOT VERIFIED live) | the browser's `Notification`, permission-gated; a hidden tab's strip is handed over to it, and a click focuses the tab and opens the row's destination |
| Notification after the site is closed | BLOCKED | the server's only push road is Firebase, to the tokens the phone app registers (`Device.push_token`). This build has no Firebase project config, no VAPID key and no service worker, and the backend is read-only, so nothing can be wired without work outside this project |
| Server-backed notification preferences | BLOCKED | the backend has no preference endpoint; the switch and the two sounds are local, and the page says so |

## Media

| Feature | Web status | Notes |
| --- | --- | --- |
| Image upload + thumbnail | COMPLETE | client-side thumbnail, `upload.ts` |
| Video upload + poster | PARTIALLY COMPLETE | metadata; no poster generation |
| Audio / voice upload | COMPLETE | |
| Preview before send | COMPLETE | composer attachment chip |
| Upload progress | COMPLETE | XHR `upload.onprogress` → `Uploading n%` on the bubble |
| Authed media fetch | COMPLETE | `useMediaUrl` / `AuthedImage` |

## Summary

- Mobile module families inventoried: 11.
- Web surfaces considered: 20 pages, 13 feature folders.
- Fully wired families: shell, drops core, vibes, moments, audio core, live core,
  sparks core, notifications core, messaging core, calls.
- Largest remaining families: deals, circles, collabs, creator tooling,
  editors, offline outbox, group/admin sheets, together mode and stickers on a
  moment, and the walk over a Memory's own items. (Room sound stood on this list
  until Round 18, which wired the room page to the relay the calls use.)
- Highest-value gaps addressed in this pass: conversation preview correctness,
  optimistic send/reconciliation, honest receipts, forward/info, view-once,
  live list updates, cross-conversation message search, upload progress, the
  whole marketplace (Drip / Themes / Logos) with the theme's picture reaching
  the shell, the shop, the preview and the inside of a chat, the Drops/Vibes
  pass of 2026-11-01, and the Moments viewer rebuilt as a port of
  `MomentViewScreen`.

## Round 18 (2026-11-06)

The round that closed the calls' own blunt edges and wired the one thing the calls
left named: a room's sound. Every row below is `PARTIALLY COMPLETE (NOT VERIFIED)` —
the code is written and its arithmetic tested, and nothing has been run against a
live backend, a second device, a microphone, a camera or a real notification
surface.

| Feature | Web status | Notes |
| --- | --- | --- |
| Ringtone (incoming and outgoing) | PARTIALLY COMPLETE (NOT VERIFIED) | Added 2026-11-06 (`features/calls/ring.ts`, 22 cases). Rings the app's own `public/ringtone/call.wav`, preloaded when the socket comes up; falls back to a written Web Audio tone — the phone's classic ring for an incoming call, a 440+480 Hz ringback that is deliberately *not* the ringtone for an outgoing one. An incoming ring vibrates where there is a vibrator. Where the browser refuses the sound the screen says so rather than pretending it rang |
| Call notification | PARTIALLY COMPLETE (NOT VERIFIED) | Added 2026-11-06 (`features/calls/notice.ts`, `public/call-sw.js`, 8 cases). One post per ringing call, tag `xelvic-call`, `requireInteraction`, Decline and Accept actions; the worker has no fetch handler and feeds the press back into the engine, so Accept really answers and Decline really declines. Permission is asked from a pill, never on load. A call this tab placed itself, or one already being talked on, is not posted |
| Camera quality | PARTIALLY COMPLETE (NOT VERIFIED) | Added 2026-11-06 (`features/calls/quality.ts`, 30 cases). 1920x1080 at 30 fps with a 640x480 floor, `maintain-resolution` on every video sender, a bitrate from the picture's size, `contentHint` `motion` / `detail`; a list of the browser's own devices for camera, microphone and speaker; a `getStats` pill that reports an unsettled or weak connection and says nothing otherwise |
| Call layout | PARTIALLY COMPLETE (NOT VERIFIED) | `CallOverlay.tsx` rebuilt 2026-11-06: `object-contain` with a fit/fill toggle, spotlight default with a grid toggle, a self-view that can be dragged and resized and is clamped inside the stage, fullscreen, and screen share / camera flip / device menus in one row. The picture can be lifted into the browser's own corner window (`requestPictureInPicture`) when there is a single picture to lift |
| Room sound (WebRTC) | PARTIALLY COMPLETE (NOT VERIFIED) | Added 2026-11-06. The row above reads `NOT IMPLEMENTED`; the room page is now wired. A room's stage is a `calls.Call`, carried over the same relay with **no new endpoint**: `features/rooms/mesh.ts` (21 cases), `stage.ts` (`RoomStage`, a reconcile with no renegotiation), `useRoomStage.ts`, `RoomSoundView.tsx`, and `features/media/surfaces.tsx`. `CallEngine.ignoreCall` keeps a room's stage off the 1:1 screen. A listener past the relay's limit (the stage plus 8, `MEDIA_LISTENERS`) is still in the room and simply not sent anything |

**No parity claim.** The five rows are the web containing what the round wrote, not
what a phone or a live server has confirmed. The mesh's arithmetic is tested; the
mesh itself has never connected to anything.

## Round 19 (2026-11-06)

The round that answered three of the owner's reports — the flipped picture, the
card that spilled off the screen, and a feed with no Vibe in it — and, with the
last of them, wove the Vibes in that the phone had been weaving all along. The
three "done" rows are the web containing what the round wrote and are
`NOT VERIFIED` against a device, a browser or a live server; the remainder are
named `NOT IMPLEMENTED` and nothing here is counted as parity.

| Feature | Web status | Notes |
| --- | --- | --- |
| Mirror control for the picture (calls and a room's stage) | COMPLETE (NOT VERIFIED) | Added 2026-11-06, **turned round the same day**. The phone mirrors only its front lens (`app/lib/calls.dart`, `_selfMirrored`) and has no Mirror button at all: `app/lib/screens/call.dart` draws `_mine` through `mirror: calls.selfMirrored` and every remote tile through `_feed(person, mirror = false)`, and `app/lib/screens/room.dart` does the same with `mirror: person.id == mine && Stage.it.selfMirrored`. `features/calls/engine.ts` carries a `Facing` — read from `track.getSettings().facingMode` in `openCamera()` / `openDevice()` — and `mirrored()`, which is now that facing alone (`facing !== "environment"`); the hand-overrule Round 19 added is gone, because it was flipping the one picture that was already right: *"jo video call me mirror par click karne par jo flip ho raha hai wo mere video card me raha hai jabki reciever user video card me hona chahiye"*. The button is now about the pictures **arriving**: `remoteMirrored` on the snapshot, set by `toggleRemoteMirror()`, passed to `RemoteTile`'s new `mirror?` prop at all three of its sites in `CallOverlay.tsx` (grid, spotlight, rail) — with `SelfView` unchanged at `mirror={!call.sharing && call.mirrored}`. The same meaning is on a room's tiles (`features/rooms/stage.ts`'s `toggleRemoteMirror`, `useRoomStage.ts`, `RoomSoundView.tsx` — self draws `mirrored`, everybody else `remoteMirrored` — and `RoomPage.tsx`). The pill waits for a picture to arrive rather than for this tab's own camera, and is false again on the next call. It is a **display and not a transmission** — `VideoSurface`'s `-scale-x-100` is the only thing a mirror touches, no track is transformed, so nobody else's screen changes. This is a deliberate **divergence from the phone**, which has no such button, added because the owner asked for it. **Not verified:** no device or browser run, so the flip needs two ends on a real call to be seen at all; a webcam that reports no `facingMode` is now drawn mirrored with no way to change it, since the hand-overrule is gone; and a remotely shared screen is flipped too, a call frame carrying no word for which a stream is |
| A card that fits the screen, in a column | COMPLETE (NOT VERIFIED) | Added 2026-11-06, rewritten the same day. The media box took the card's whole width and derived its height from the server's `ratio` with no ceiling, so a portrait post asked for a box taller than the screen at every width. `features/drops/frame.ts`'s `frameBox(ratio, clip)` now caps a single clip at `62dvh` (the phone's `tallClipShare`) and draws a still at the poster's shape up to four-to-five, with `width: 100%` written outright in both cases so the box keeps the card's width and the ceiling takes the height, cropped by `object-cover`. The first version of this row said a still answered the ceiling **by narrowing** (`maxWidth: calc(78dvh / ratio)`), which is the phone's own rule and is invisible there; on a wide, short browser window it left a portrait photograph in a third of the card with empty card either side, which is the owner's report and screenshot of 2026-11-06. `DropsPage.tsx`'s feed column is capped at 660 points and centred at every size (it was `max-w-[1240px]`, one column below `xl`, so a card was drawn the width of the window). `SensitiveVeil.tsx` takes the exact box as a `frame` prop; `VibeViewer.tsx`'s walk became `fixed inset-x-0 top-0 h-[100dvh]` because a four-edge `fixed` box resolves against the layout viewport; `styles/index.css` moved `body` to `100dvh` and added `overflow-x: clip`; `PollBlock.tsx` gained `break-words`. **Not verified** on a device; the `VibeViewer` change and the still's crop are reasoned fixes, the latter with the owner's screenshot as the evidence |
| Vibes woven into the feed | COMPLETE (NOT VERIFIED live) | Added 2026-11-06. Until this round the feed carried no Vibe: the server's `vibe_share` (0.20 a reader it knows, 0.40 a cold start) went unread and the phone's `Drops.mixedFeed` was never ported. `features/drops/mix.ts` is a whole port of `mixedFeed` / `_mixSlots` / `shelfOrder` / `shelfKey` (the hash multiply by `Math.imul`, which is the one place a JavaScript number would have diverged from the phone's `int`), pinned by 24 tests in `mix.test.ts` (13 for the weave, 6 for the strip, 5 for the walk's list). `DropsPage.tsx` reads `vibe_share` off the first page, keeps a rail of ten in `shelfOrder` less the clips the feed's **first block** is drawing (`railClips`, which never draws an empty strip over a shelf that has a clip on it — the app excludes over the whole feed it holds, and on 2026-11-06 that emptied the strip and took the whole Vibe section off a scrolled page: *"for you ke upar jo vibes ka section tha wo bhi hat gya hai, please use rakhiye"*), weaves via `mixedFeed`, opens any clip's picture into the walk, and fills a `caught_up` feed from the shelf's tail past the rail's ten. `DropCard.tsx`'s optional `onOpen` waits out the 220 ms double-press window; `Page<T>` gained `vibe_share?`. **Not verified** against a live server |
| A video in the feed opens in the walk | COMPLETE (NOT VERIFIED) | Added 2026-11-06. The web only gave a **Vibe** a door: a plain video played where it sat and a press on it did nothing — *"app me drops ke for you post me video post par click karne par ek dusare page me wo video open hota hai waise isme nahi ho raha hai"*. The app's `DropVideo.onOpen` is `isVibe ? openVibe : _openFrame`, and `_openFrame` is `openClip`, which is `openVibe` (`app/lib/screens/drops.dart`), so both open the same walk. `model.ts`'s `dropIsClip` is that test and now has both readers — the card asks it whether to draw the clip, `DropsPage.tsx` asks it whether to hand the card a door — so the two halves cannot disagree. A clip the shelf does not hold is carried in front of it (`mix.ts`'s `walkOf`), which is the phone's `Drops.it.carry`: the walk opens on the clip under the thumb, the shelf is a swipe away, and `onNeedMore` still asks for the next hand. A still is left alone, as the app leaves it. `reco.ts` sends each row's own `kind` (`drop` or `vibe`, as `Reco.served` writes it) because the server resolves an id against the table its `kind` names (`_KINDS` in `apps/reco/services.py`) — a plain video sent as a `vibe` was a row `_existing` could not find, dropped in silence. **Not verified** in a browser or against a live server |
| A Vibe's recipe playback (voiceover, music lanes, per-clip trim and speed, overlays, filter, frame shape) | NOT IMPLEMENTED | A Vibe still plays only its own `asset`. `recipe` and `clip_urls` are sent by the server and read by nothing in the web app, so a Vibe edited on the phone plays here as its first clip alone. Named in `XELVIC_API_COMPATIBILITY_REPORT.md` rather than left implied |
| A Vibe editor on the web | MISSING | `screens/editor/*`. The composer posts `{asset, caption, music, mentions, sensitive}` to `POST /drops/vibes/`; `recipe`, `category`, `interests` and `track_id` are accepted by the server and never sent |
| Play counts from the web (`POST /drops/<id>/play/`) | NOT IMPLEMENTED | Nothing under `src/` calls it (`app/lib/audio.dart:1975` does, on the phone), so a sound played in the browser does not advance `plays` and the poster's own numbers do not include it. A silent omission, not a claim on screen |
| `category` / `interests` on a post, and `GET /drops/interests/` | NOT IMPLEMENTED | The route is not called and the fields are not sent, so a post made here carries no interests and cannot be filed |
| `GET /drops/mine/` | NOT IMPLEMENTED | Called by nothing under `src/`; see the "Mine / user's drops" row above |

**No parity claim, and no percentage moved.** The three "done" rows are the round's
own code — arithmetic tested, nothing rendered. The five `MISSING` /
`NOT IMPLEMENTED` rows above stand exactly as they did, and no overall parity
figure in this file is to be read as covering them.
## Round 21 — a shared screen shown whole, and a call that can be put aside (2026-11-06)

Two of the owner's own reports, both about a call's picture, both complete as code
and `NOT VERIFIED`.

| Feature | Web status | Notes |
| --- | --- | --- |
| A shared screen drawn whole on the viewer's screen | COMPLETE (NOT VERIFIED) | The phone has no screen sharing at all (`screenShare` appears nowhere in `app/lib/screens/call.dart`), so this row has no parity reference and exists because the web gained the feature in Round 18. The fault was the **viewer's** own Fit/Fill choice: `fit` was one piece of state in `CallOverlay`, which lives as long as the tab, so a **Fill** pressed once stayed on for every later call and a wide desktop drawn to fill a portrait phone shows only its middle — *"main screen laptop me share kar raha hu aur koi apne mobile me dekh raha hai to pura screen nahi dikh raha hai use kewal beech ka dikh raha hai"*. `fit`, `layout` and the focused seat now reset when a call ends; `model.ts`'s `sourceChanged(before, after)` (a 12 % threshold) says when the far end's picture has changed shape, and the picture returns to **Fit** when it does; and `media/surfaces.tsx` listens to the video element's `resize` event as well as `loadedmetadata`, because `RTCRtpSender.replaceTrack` changes the frame under a picture that is already playing without changing the stream. It is a **shape** and not a word from the server: a call frame carries no "this is a screen", and the relay accepts only offers, answers and candidates (`SIGNAL_TYPES` in `backend/apps/calls/services.py`). **Not verified** on a device; the rule has one named hole — a far end whose camera and shared screen are both 16:9 produces no shape change, and a **Fill** pressed during that same call still crops until the call ends |
| A call that can be put aside and returned to | PARTIALLY COMPLETE (NOT VERIFIED) | The phone gives a call three sizes — a page, a window and a small mark — in `app/lib/screens/call_window.dart`; the web gave it one, a `fixed inset-0` overlay above the router, with no way to leave it and nothing to come back to — *"video call karne par main video hata kar chat par aa raha hu aur call chal hi rahi hai to phir main video call par nahi aa raha pa raha hu"*. `CallOverlay.tsx` now has a **Minimize** pill that swaps the screen for a bar over whatever page the person went back to, carrying the picture (or a phone glyph), the name and clock, the microphone, the camera on a video call and the red button, with the sound carried by `AudioSurface`s of its own; tapping it returns to the call, and it is reset when the call ends. **Partially complete** rather than complete because the phone's third size — a small mark and nothing else — has no counterpart here. The bar is draggable and docks to an edge as of Round 22, below; it was fixed to the bottom and was scolded for it the same day. **Not verified**: never minimized or restored on a device. A page reload still loses a live call outright: `calls.pending` answers only for rings and no read-only route lists the calls an account is on, so a call that survives on the server cannot be rejoined from a fresh tab — `NOT IMPLEMENTED` |

## Round 22 — the small call window is moved by hand (2026-11-06)

The same day's follow-up report, about Round 21's own bar: *"abhi video call minimize
karne par use drag aur drop nahi kar pa raha hoon chat screen me"*.

| Feature | Web status | Notes |
| --- | --- | --- |
| A call window that can be dragged anywhere, and docked against an edge | COMPLETE (NOT VERIFIED) | The phone's `call_window.dart` rules, carried into `src/features/calls/minibar.ts` — a file that owns no DOM, so the arithmetic is tested without a browser. Dragged by captured pointer events on the bar itself, with a six-pixel slop so a press on a button stays a press; clamped on every draw so a rotation or a resized window cannot leave it unreachable; and released **into** an edge it folds to a 28-pixel tab at the height it was let go at, which a press opens again. The sound is drawn beside the window, so folding it away does not take the call's voice. **Not verified**: nothing was dragged on a real screen. One cost is named and pinned by a test rather than left to be found — on a phone the bar fills almost the whole width, so it rests one gutter from both edges and docks from the smallest push, where the phone's own 116-point window does not |
| A call hidden down to a small mark and nothing else | NOT IMPLEMENTED | The phone's `CallView.hidden` — a single pill saying a call is running. The web has two sizes where the phone has three: the screen, and the draggable window |
| Rejoining a live call after a page reload | NOT IMPLEMENTED | Unchanged from Round 21 and not made worse: the engine holds no `callId`, `calls.pending` answers only for rings, and no read-only route lists an account's running calls |

**No parity claim, and no percentage moved.** The round closes a gap against the phone
that the previous round had opened by stopping short, and it leaves the phone's third
size and the reload gap exactly where they were.

## Round 23 — the emoji a message wears, and the mic that records (2026-11-11)

The owner's reports, in the order they came: when an emoji moves — *"abhi emoji chatscreen me
send karne par send ke baad aur hover par animate nahi kar raha hai"*, then *"ye jo continue
animate ho raha hai jabki send karne par aur hover karne par animate hona chahiye"*, and then,
once the artwork was settled, the same fault in the panel itself: *"abhi input me jo plus hai
usme emoji par click karne par jo emoji panal open hota hai, usme emoji animate continue hote hi
rahte please ise aisa kijiye ki kewal hover karne par hi emoji animate kare"* — and then, across
four messages about what it is drawn with, ending in **"please dynamic emoji hata dijiye pahle
jaise tha waise hi kijiye jo google ka"**. The composer's mic was the round's other job.

| Feature | Web status | Notes |
| --- | --- | --- |
| An emoji — in a message or in the picker — that moves while a pointer is on it, and once when a message is sent or arrives | COMPLETE (NOT VERIFIED) | The fault was that movement was tied to being **on screen** — the one thing about an emoji nobody chooses — so a thread was a wall of animations and neither sending nor hovering changed anything, and the panel's whole grid ran at once. `src/features/emoji/motion.ts` decides it: **nothing moves for being on screen**, a drawing moves while a pointer rests on it, and an emoji in a sentence also gets one pass on send or on arrival (`EmojiArt`'s `burst`, with `src/features/convo/arrivals.ts` knowing which message is new by either of its two names and forgetting after three seconds). `MOST_MOVING = 24` for the whole app, `giveBack` returning a pointer's place only while the budget is overdrawn, and `prefers-reduced-motion: reduce` playing nothing at all. Measured in a real browser with real mouse moves: the panel with the pointer away `{"running":0,"drawn":169}`, one tile held `{"running":1}`, pointer away `{"running":0}` again; `EmojiText` idle `running:0` → hovered `1` → left `0` → burst `2` → settled `0`. **Not verified**: no emoji was ever seen moving in a real thread with real messages, and the rule was measured with a mouse only — on a touch screen, where nothing can rest on an emoji, the panel is still |
| Google's own drawing for every emoji at rest, and Google's animation over it | COMPLETE (NOT VERIFIED) | `cdn.ts` keys an emoji by its own code points in lower-case hex, and the same key addresses the still (`/emoji.svg`) and the animation (`/lottie.json`); every one of the 1,906 rows was asked for by name when the table was generated (1,892 stills, 605 animations among the plain forms). The fourteen Google draws nothing of — ©️, ®️ and the ten keycaps — fall back to the character in the machine's own font. Measured in the real panel at the close of the round: Smileys drew 169 images, all 169 from `fonts.gstatic.com`, none from anywhere else; People & Body drew 386, all Google |
| One emoji drawn once — Google's, with the machine's own glyph no longer showing through it | COMPLETE (NOT VERIFIED) | The owner saw two emoji where there should be one, one of them moving on hover — *"kisi kisi emoji me do do emoji aa raha hai ek hover karne par animate hota hai aur ek nahi hota hai"* — and said where it hurt most: *"ye problem sabse jyada people & body wale me jyada hai"*. The character layer at the foot of `EmojiArt` was never hidden, so the machine's glyph showed around Google's still and, on hover, straight through the animation once the still stepped aside. `covered = drawn || animated` now fades the character out with `opacity-0` over the still's own 100 ms — `opacity` and not `visibility`, so a message's emoji stays selectable, copyable and readable, and the fourteen Google draws nothing of still show it. Measured through the real `EmojiText` in Chrome: every character layer `opacity: "0"`, and forcing it back on changes **1,234 px at rest / 1,301 hovered**, per emoji 😀 **0**, 👏 13, 👍 37, ✌️ 102, 🙏 132, 🙌 **189**, and 761 for a 120px 🙏 — his People & Body observation, measured. **Not verified**: his picture showed two bubbles, which the code reads as two message rows, so whether he saw one doubled drawing or the same emoji said twice is not something a screenshot settles |
| A picker holding the whole of Unicode, with search, a shelf of the last 24 and the five skin tones | COMPLETE (NOT VERIFIED) | `EmojiPicker.tsx` — 1,906 emoji in 9 groups, a search that requires every word typed (`SEARCH_LIMIT` 120), the recent shelf in `localStorage`, and the tones offered only where the page on screen holds something a tone can change. **What travels is plain text**: a pick lands on `onPick` as an ordinary character, so a message keeps its emoji on a device that has never heard of Lottie and no CDN is asked to serve a drawing to a reader. Fetched with `React.lazy` |
| A choice of which set an emoji is drawn with | NOT IMPLEMENTED — built, measured, then removed at the owner's instruction | Five resting looks were carried mid-round (the device's font, 3moji CC BY-SA 4.0, Fluent 3D and Fluent flat MIT, Google), chosen in the picker and remembered in `localStorage`, and a fourth candidate (EmojiTwo, CC BY 4.0) was measured and dropped before it was wired to anything. The owner closed the question — *"pahle jaise tha waise hi kijiye jo google ka"* — so `looks.ts`, `fluent.ts`, `threed.ts`, `moji3d.ts`, `emojitwo.ts` and their tests are deleted, the `xelvic.emoji.look` key is gone, and the Look chip is gone with them. Nothing is left dark: there is no switch that no longer does anything |
| WhatsApp's own emoji artwork | NOT IMPLEMENTED — and not this origin's to serve | WhatsApp's emoji on an iPhone *are* Apple Color Emoji, which Apple licenses for Apple's own software and not for other people's websites; no free redraw of it is the same pictures. The device's own font can be used, because it never leaves the device, which is why the alternative-look work started there — and why the request the owner settled on is the one that can be honoured. Said plainly rather than called parity |
| The composer's mic recording a voice note, held the phone's way | COMPLETE (NOT VERIFIED) | `voicehold.ts` carries the phone's numbers from `chat_audio.dart` and `chat.dart` (`CANCEL_SLOP = 70`, `LOCK_SLOP = 60`, `MIN_VOICE_MS = 1000`, thirty minutes, 25 MB, 120 samples at one per 100 ms); `useVoiceNote.ts` runs a `MediaRecorder` and an `AnalyserNode` over the same stream and sends what it recorded through `uploadAsset` with `kind: "voice"` and then `chatService.send`. A tap says "hold the mic"; a note under a second is thrown away. **The recording half was measured** in Chrome with a fake microphone (a real 36,220-byte MP4/AAC note of 2,195 ms with 19 bars); **the server half is unexercised** — no live server was reached, so the upload and the bubble that plays it back are `NOT VERIFIED` |
| A note's length that is the recording's own clock rather than the container's | COMPLETE (NOT VERIFIED) | Asked of Chrome 156, an `<audio>` element answers 2.56 s for a two-second MP4/AAC and `Infinity` for the WebM/Opus a browser without MP4 falls back to, because that container writes its length at the end where an element reading only the header never looks. A note sent with no length is a bubble that cannot say how long it is, so `durationMs` is measured as it records |

**No parity claim, and no percentage moved.** The phone's emoji come from its own keyboard —
the app's shelves are small and for one job each — so a picker is a **divergence from the phone
rather than parity with it**, and the same character has motion here that it does not have
there. The phone's voice note has no waveform problem and no browser to satisfy; what this round
did was port its gestures, its numbers and its bar, not invent a second set. Nothing about this
round touched a call, a room, a drop or a Moment: those still draw their emoji as text in the
machine's font, which is what the phone does everywhere.

## Round 24 — the plus menu's six rows, and a place that can be sent (2026-11-12)

The request named the rows: *"please ab convo ke chatscreen ke input me jo plus par click karne
par open hota hai, please usme photos and videos, file, Location, Spark, sticker aur emoji ka
option add kijiye"* — six ways to put something in a thread, where the menu had four.

| Feature | Web status | Notes |
| --- | --- | --- |
| A plus menu in the composer offering Photos and videos, File, Location, Spark, Sticker and Emoji | COMPLETE (NOT VERIFIED) | `src/pages/ChatPage.tsx` — six rows from one written row shape rather than six copies of it. Every row opens something that works: two file pickers, `LocationSheet`, the camera, the shelf, the panel. Measured in a real browser against the real app: the six labels back in the owner's order with none disabled. **Not verified**: measured with a mouse, not a finger, and the menu is inline JSX with no DOM test available (`vitest.config.ts` is `environment: "node"`), so the probe is the evidence |
| Photos and videos, and File, as two rows over two pickers | COMPLETE (NOT VERIFIED) | The one input's list (`image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt`) is now carried by two inputs, cut at the picture/file boundary — nothing new admitted, nothing that used to be picked stopped being pickable, and `chooseFile` still reads the kind off the file itself. Read back from the built page as `["image/*,video/*","audio/*,application/pdf,.doc,.docx,.txt"]` |
| Sending a place from the chat composer | COMPLETE (NOT VERIFIED) | `LocationSheet.tsx` → `sendLocation` → `chatService.send` with `kind: "location"` and `{lat, lng, accuracy_m?}` in `payload`. No upload: the backend's `Message.Kind.LOCATION` is in `EMBED_KINDS` and not in `MEDIA_KINDS`, so no asset is asked for. The receiving bubble and its Google Maps link existed already and were untouched. Measured: the sheet opened from the row, the place chosen, the footer turning to *Send this location*, and a **LOCATION** bubble left in the thread. **Not verified**: never delivered to a real backend — this client's request and its optimistic bubble are what was watched; server acceptance is read from the backend's own code and tests |
| A place searched for by name, not only the one the browser reports | COMPLETE (NOT VERIFIED) | The phone's own reason for its place sheet — *"location select karte time manually bhi search kar sake, jaise kisi hotel ka naam"* — ported with it. Measured with real key events: typing `Bandra` drew six real OpenStreetMap rows (Mumbai, Bihar, two Bosnian villages, two Madhya Pradesh hamlets) under a refusal line for the browser's position. A searched place travels with **no `accuracy_m`**, because there is none to send |
| The sheet saying how sure the browser's position is, and one sentence per refusal | COMPLETE (NOT VERIFIED) | `denied`, `timeout`, `unavailable` and `unsupported` each get their own sentence ending *"A place can still be searched for above."*, and only `denied` — the browser's own setting — may suggest allowing it. Measured at 35 m (*Accurate to about 35 m*) and 2,400 m (*Approximate — could be 2 km off*), and refused on purpose in the search probe, where the sheet still worked |
| Creating a poll from the chat composer | NOT IMPLEMENTED — and not removed by this round | The last commit has the row (**Ask the crowd**) and its `PollComposer`; the working copy does not, and neither identifier exists in the tree. No edit to `ChatPage.tsx` in any transcript on this machine removed it, and the panel this round replaced already had four rows, so it is a gap against the last commit and **not** against the phone — the phone's chat creates no polls either (polls are drops and Moments there). Answering a poll still works: the bubble, and `vote()` → `chatService.vote`. Left exactly as found |
| The phone's attach sheet, row for row | PARTIALLY COMPLETE | The phone's sheet has seven roads (`app/lib/screens/chat.dart`, `_showAttachmentSheet`): Camera photo, Camera video, Photos and videos, Sticker, Song, Audio file, File. The web's six cover Photos and videos, File (which takes audio too), Sticker and Spark (the camera, both roads at once) and adds Location and Emoji; **Song** has no row here, and no *Camera photo*/*Camera video* split |
| Trimming the attach list by the room's own rule | NOT IMPLEMENTED — pre-existing, named again | The phone shortens its sheet by `only` (`photo`/`video`) and by `text_only` before it draws, and the send route refuses what a room does not take (`channel_allows`, `services.py`). The web's `Channel` type is `{id, name, position}` with no rule on it, so a photos-only room here still offers *File*. Not caused by this round and not closed by it |
| A place sheet where the phone has one | NOT IMPLEMENTED elsewhere, and not asked for | The phone opens `place_sheet.dart` from the drop composer and the live camera. The web's drop composer still takes a place as a typed string (*"Where was this?"*) and its camera keeps its own `findCurrentPlace`; this round's sheet is the **chat composer's** only |

**No parity claim, and no percentage moved.** Two of the six rows are the phone's own words for
the same job (*Photos and videos*, *File*) and one — *Emoji* — is a divergence the phone cannot
have, because its emoji come from its keyboard (Round 23). *Location* is the interesting one: the
phone's **chat** has no location row, so the web now offers something the phone's chat does not;
what was ported is the phone's *place sheet*, its two halves and its vocabulary, and the message
it sends is a kind the phone has rendered all along. Poll creation left the working copy before
this round and is named rather than hidden. Nothing about this round touched a call, a drop, a
Moment, a comment or a room.

## Round 25 — the convo header's Vibes, and what it now shares with the walk (2026-11-12)

The request: *"chatheader me jo vibes section hai please uska design fix kijiye aur usme like,
comment share aur save ka bhi option rakhiye aur abhi usme kewal followers ka hi videos aa raha
hai jabki sabhi ka aana chahiye aur jo jo drops ke vibe me wo sab kuch chatheader ke vibes me bhi
hona chahiye wo sab features"*.

| Feature | Web status | Notes |
| --- | --- | --- |
| A Vibes panel beside a thread, drawn as a clip rather than a bare player | COMPLETE | `src/features/convo/VibesPanel.tsx` rewritten. The bar (`Close Vibes` / `Vibes` / `1 / 3` / `More`) carries a shadow instead of a scrim, because the app took flat scrims off clips on 2026-10-14 and this panel had put one back |
| Like, comment, share and save on the panel's clip | PARTIALLY COMPLETE | The rail is `Felt 46x52`, `Comments 46x50`, `Share 46x49`, `Save 46x27`, `Unmute 46x27`, measured in the real app. Three of the four writes reached the server's own addresses and were recorded by the stub: `POST /drops/vibes/<id>/like/ {"on":true}`, `POST /drops/vibes/<id>/comments/ {"body":…}`, `POST /saved/ {"kind":"vibe","id":…,"on":true}` (glyph then `Saved`, `aria-pressed="true"`). **Share is measured only as far as its sheet**: the sheet opened and drew *Send to Jaya* / *Another app* / *Copy a link*, but nothing was picked inside it, so no share write was sent. The route it posts to — `POST /drops/vibes/<id>/share/` — is read from `drops.service.ts` and not measured |
| One clip component for the walk and the panel | COMPLETE | `src/features/drops/VibeSlide.tsx` was lifted out of the walk this round; `VibeViewer.tsx` (full screen) and `VibesPanel.tsx` (panel) both render it. Two drawings of a rail would have drifted |
| The Drops walk's features, in the panel | COMPLETE | Caption with *Read more* past 120 characters, mentions, music, collab credit, comment strip plus the two `vibePrompts`, the 96 px empty room above Felt as the 2× pad, the player panel (scrubber, `0.5× / 1× / 1.5× / 2× speed`, `When it ends — The next Vibe plays / Replay`, `Done`), and the ⋮ with `DropMenu`, `StatsSheet` and `EditDrop`, all read back from the running page. Two things are deliberately **not** in the panel: *Your studio* and *New Vibe* — they navigate, and taking the whole app away from the thread being read is a different act from tapping them on the Vibes screen |
| A door in the convo header that a person can find | COMPLETE | 40×40 `BUTTON`, `aria-label="Open Vibes"` / `"Close Vibes"`, `aria-expanded`, accent tint while open. The five-pixel accent strip it replaces was not a control |
| The shelf reaching everybody, not only followed people | COMPLETE on the client | `dropsVibesQuery` sends no author, no following flag and no filter; the panel reads the same query the walk reads. Proved by drawing three strangers' clips from a shelf that answered with three strangers while the only shelf request on the wire was `GET /drops/vibes/?limit=8` (+ its `seen` report). The backend's `visible_vibes` has no followers-only clause either, so there is nothing on this side to remove |
| A held clip staying open after the finger lifts | COMPLETE | The release `click` after a 500 ms hold was read as a tap and shut the player that had just opened. Pre-existing in the committed `VibeViewer.tsx`; fixed in the shared `VibeSlide.tsx` (`longFired` guard at the top of `onTap`). Hold timeline after the fix: `shut ×4, open ×6` |
| Vibes drawn beside a thread in the phone | PARTIALLY COMPLETE (pre-existing) | The phone keeps this panel inline in its convo screen; the web's is now the walk's own component. Not read again this round — the phone files stay untouched |
| What a real clip looks like in the panel | NOT VERIFIED | The probe's stub served a four-byte stand-in, so the panel's video frames were not watched. The chrome, rail, caption, player and every write are measured; the picture is not |
| The panel against the live API | NOT VERIFIED | Every measurement above was against a local stub. No live request and no real account were used, and the live shelf's composition is the server's deal |

**No parity percentage moved.** The phone has this panel already; what changed is that the web's
panel stopped being a second, thinner player and became the Drops walk's own clip with a panel's
chrome around it. Nothing about calls, drops, Moments, rooms, the composer or the plus menu was
touched, and no backend file was read-only in name only — `backend/apps/drops/` was read to
confirm the shelf's filter and nothing there was created, edited or deleted.

## Round 26 — one box for both panels, and one size for every sticker (2026-11-12)

The request: *"sticker me jo sticker panel open ho raha hai please us panel ka hight aur width exact
emoji panel ke jitna kijiye aur sticker panel jo stckers hai un sab ka size ek jaisa nahi hai, please
sabhi ka size ek jaisa kijiye, chota bada na dikhe"*.

| Feature | Web status | Notes |
| --- | --- | --- |
| The sticker sheet is the emoji picker's height and width | COMPLETE | Measured before and after in the running app. Both panels now **340 × 363 with rows 41 · 29 · 258 · 33**; the sheet was **340 × 339 with rows 41 · 264 · 32** |
| The box cannot move with what came back from the network | COMPLETE | Two causes, both measured: the sheet had **no title row** (the row the picker spends on "Smileys & People"), and its pack bar was drawn only for a shelf of more than one pack — so a one-pack shelf lost another 32 pixels. The title row was added and the pack bar is now always drawn |
| One place holding the box | COMPLETE | `src/components/ui/shelf.ts` — `SHELF`, `SHELF_SEARCH` (41), `SHELF_TITLE` (29), `SHELF_GRID` (`min(258px, 42vh)`), `SHELF_FOOTER` (33). Both panels import the same rows, so they agree **by construction** rather than by two sets of numbers kept in step by hand |
| The lazy picker's placeholder is the panel's size | COMPLETE | `ChatPage.tsx`'s Suspense fallback for the lazy emoji picker was `h-[320px] w-[350px]` — a different size from the panel it was holding, which is a jump you can see. It is now built from the same four rows |
| Every sticker drawn at one size | COMPLETE | `src/components/media/StickerArt.tsx` measures each picture's **ink** through its alpha channel and fits the **longest visible edge** to the 63-pixel box: four stickers re-measured in the app at **63 × 52**, **63 × 37**, **63 × 42**, **63 × 56** — every longest edge **63** |
| Nothing cropped, nothing stretched | COMPLETE | Only the transparent margin is taken up. Equal **area** was considered and rejected: it would draw a wide sticker wider than its cell, cropping its wings or overlapping its neighbour |
| A host that forbids reading the picture | COMPLETE | The picture is asked for with `crossorigin="anonymous"`; if the host refuses that request outright the element is retried **without** it and the sticker is drawn the plain way rather than not at all. The catalogue's Cloudinary hosts answer `Access-Control-Allow-Origin: *` |
| Measuring without a second download | COMPLETE | The canvas reads the `<img>` the grid already loaded. Confirmed again in Round 27: 602 cells cost exactly **602** requests, not 1,204 |
| The editor's own sticker shelf | NOT IMPLEMENTED — unchanged, and named | `src/features/camera/PhotoEditor.tsx` still draws `size-full object-contain` and therefore still shows the same uneven sizes. Deliberately not changed, and not claimed |
| The phone's sticker sheet | NOT IMPLEMENTED — read-only | `app/lib/screens/chat_sticker.dart` gives every sticker a uniform square cell with `BoxFit.contain`, which fits the *file* for the same reason. Read, not changed — `xelvic/` is read-only |
| Touch behaviour | NOT VERIFIED | Measured with a mouse, not a finger |
| Live API behaviour | NOT VERIFIED | Every panel measurement was against a loopback stub; no live request and no real account |

**No parity percentage moved.** Two panels sharing one box and one sticker size is what was asked;
nothing else about the two panels was unified, and the phone — which has this shelf already — was
read and left alone.

## Round 27 — every sticker draws, and the GIF question answered with a count (2026-11-12)

The request: *"Abhi sabhi stickers nahi aa raha hai, please ise fix kijiye jisse sabhi stickers aaye
aur agar isme koi gif ka bhi hai to isi me ek gif ka section add kijiye jisme sabhi gif dikhega aur
agar nahi hai to leave it kewal sabhi sticker ko laiye"*.

| Feature | Web status | Notes |
| --- | --- | --- |
| A GIF section on the sticker shelf | **NOT IMPLEMENTED — because there are no GIFs, which is what the owner asked to be checked** | The catalogue (`GET https://sticker.gaongram.in/api/stickers?limit=&offset=`, public, no token) paged at `limit=100` answers **602 rows across seven pages, 602 unique ids**, and **`animated: true` is 0 of 602**. The owner's own words were *"agar nahi hai to leave it"*, so nothing GIF-shaped was built — a finding with evidence, not a skipped ask |
| Every sticker the catalogue has | COMPLETE | The shelf always had them: **602 cells built, 0 broken**. The defect was never the data |
| Every sticker visible | COMPLETE | **Before:** 76 drawn and 526 blank as the panel opened; after five, ten, fifteen and twenty screens 136 / 196 / 252 / 312; jumped to the very end (`scrollTop` 11,683) **386 drawn, 216 still blank**. **After:** **602 / 602 / 0 / 0** at rest, at every one of the twenty screens, and at the very end |
| Why they were blank | COMPLETE (diagnosed and measured) | `loading="lazy"` leaves a cell empty until it comes near the 258-pixel window the shelf scrolls in — over a grid of **159 rows and 11,941 pixels**, of which **16 cells** are visible at once. Twenty screens of patient scrolling and a jump to the bottom both left hundreds blank |
| The whole shelf arrives | COMPLETE | `StickerArt` gained an `eager` prop; `StickerSheet` turns it on **350 ms after the shelf opens** — long enough for the first screenful to take the connections — and off again when it closes |
| What it costs, measured rather than guessed | COMPLETE | Cold cache: **602 requests, 26 MB, the last picture drawn ~7.5 s** after the panel opens (2.1 s → 0 files; 4.2 s → 165 files / 8.9 MB; 7.5 s → 602 files / 26 MB). `asked` 602 and `files` 602, so one request per sticker |
| Paid once a month, not once a visit | COMPLETE | Every picture answers `cache-control: private, no-transform, immutable, max-age=2592000`. A warm re-open measured `files: 0, mb: 0` |
| The pictures not quietly shrunk to save bytes | Deliberately not done | The Cloudinary transform in the URL (`f_auto,q_auto,w_512,c_limit`) is part of the URL sent to the backend when a sticker is picked; asking for a smaller file would change the message |
| The box and the grid | Unchanged | Round 26's 340 × 363 box and four columns stand; this round changed only *when* a picture is asked for |
| The editor's own sticker shelf | NOT IMPLEMENTED — unchanged, and named | `src/features/camera/PhotoEditor.tsx` still uses `loading="lazy"` over the same 602 stickers, so it still behaves as the composer's shelf did before this round |
| The phone's sticker sheet | NOT IMPLEMENTED — read-only | `app/lib/screens/chat_sticker.dart` behaves the same and was read, not changed |
| A slow connection | NOT VERIFIED | The ~7.5 s figure is this machine on this connection. Every sticker still arrives on a slow link, but the shelf draws more slowly |
| Touch scrolling on a phone-sized viewport | NOT VERIFIED | Measured with a mouse and a wheel |
| Live API behaviour | NOT VERIFIED | Panel measurements were against a loopback stub; the catalogue's JSON and one image's headers were read live, nothing more |

**No parity percentage moved.** The composer's shelf now draws every sticker in the catalogue, which
is what was asked. It is not a claim that the editor's shelf or the phone does the same — both still
load lazily, and both are written down here as such.

## Round 28 — the typing indicator is a character now, and not a line of words (2026-11-12)

| Feature | Status | Note |
| --- | --- | --- |
| The other person's character over the composer while they write | **COMPLETE** | `src/features/convo/TypingPeek.tsx`, `_peek` from `app/lib/screens/chat.dart`. Measured up at `translateY(-72.24px)` = the phone's `0.86 × 84`, at 84 × 84, and back down again |
| Whose character it is | **COMPLETE for the two rungs the web can reach** | The figure **their** account wears, off `UserCard.character`, resolved against the catalogue; measured drawing *their* pose and never the bundled one |
| A figure a **theme** ships (the phone's middle rung) | **NOT IMPLEMENTED** | The web's catalogue carries a figure's pictures but not a theme's, so an account wearing no shop figure gets the bundled one — the same limit `PosedBio` records for the profile |
| Staff's word on whether a figure may stand over a composer | **COMPLETE** | `figureOnChat` in `src/features/marketplace/model.ts`, the phone's `CharacterRow.onChat` / `ThemeRow.figureOnChat`. Measured: a `placement: "profile"` figure stays **down** while they write |
| The room the newest message keeps clear of the character | **COMPLETE** | `PEEK_CLEAR` = 82 px, held whether the character is up or not, so the list does not jump when somebody starts writing |
| The words `Ravi is typing...` as something drawn | **REMOVED, on purpose** | The phone removed them in favour of the figure. They survive only as an `sr-only` `role="status"` sentence for a reader who cannot see the character |
| The live typing mechanism | **PRE-EXISTING, unchanged** | The socket send and the `thread.typing` receive were already there; this round added no real-time machinery and says so |
| A theme's `figure_peek` size | **NOT IMPLEMENTED** | A *shop figure's* `peek_size` is read from its own row; a theme's is on the theme's row and is not |
| Typing between two live accounts | **NOT VERIFIED** | The frames came from a loopback stub that speaks the backend's own frame shape. Read from `consumers.py` / `services.py`, never watched against the running backend |
| Touch / a real phone | **NOT VERIFIED** | Headless Chrome at 1280 × 900 with a mouse |
| The dead-man timer that clears a note nobody stopped | **NOT VERIFIED as behaviour** | The app reads the frame's `ttl` (the backend's `TYPING_TTL_SECONDS` is 6, the phone's own `kTypingNet` is also 6 s). The probe's waits were 700 ms, so the timer itself was never exercised |

**No parity percentage moved.** The character the owner asked for now comes up over the composer,
which is what was asked. It is not a claim that the web's figure chain is the phone's — the
theme-figure rung is missing and is in this table, and the phone's own behaviour was read rather than
measured.

## Round 29 — both characters, and the gaze feature the web did not have (2026-11-12)

The request: *"abhi app jaisa nahi aa raha hai aap me jo jo hai exact waisa hi hona chahiye aur usme
typing aur wait 2 charector hai aur dono jaise work kar raha hai app me waise isme bhi karna chahiye"*.

Round 28 drew one of the phone's two characters. The second one — `wait`, for somebody who is merely
*somewhere of mine* rather than writing to me — has no sender in the typing mechanism at all: it is fed
by the **gaze**, and the web had no gaze code. This round ported it, so the two rows above move.

| Feature | Status | Note |
| --- | --- | --- |
| The two characters, `typing` and `wait` | **COMPLETE** | `src/features/convo/peek.ts` — `peekOn({typing, gaze, last, poses})`, a direct port of `chat.dart:1415-1423`. All six states measured in the running app: quiet-with-a-gaze `wait`, writing `typing`, writing-stopped-still-there back to `wait`, gaze withdrawn `down` |
| The precedence rule, and its asymmetry | **COMPLETE** | Writing wins: `typing ? poses.typing : gaze ? poses.wait : last`. Writing **ends**; being somewhere of mine **does not** — so the figure returns to `wait` rather than dropping when the writing stops. Both halves measured; a probe that saw only the first could not tell a rule from a fallback chain |
| Where the other person is looking | **COMPLETE** | `src/features/presence/looking.ts`, a port of `app/lib/looking.dart` — `lookOf`, `gazeFrom`, `sameLook`, `staleGazes`, and the three frames the page says. Read off `ChatConsumer`: the ask is told apart by `"users" in content`, `kind: "none"` is answered as well as asked, and `kind: "chat" \| "profile"` is the whole of what the web draws |
| Asking who is looking | **COMPLETE** | `src/providers/LookingProvider.tsx` — a counted watch set, one interval, `{action:"focus", users:[…]}` every 15 s while anybody is watched. Measured: the gaze was set **before** the convo opened and still drew, so it is knowable only by asking |
| Saying where I am | **COMPLETE** | `{action:"focus", user, kind:"chat" \| "profile", phase:"idle"}`, repeated every 15 s, plus a **named** goodbye on leaving. The convo says `chat`; `/app/u/:username` says `profile`, measured as `{"kind":"profile","user":"2222…"}` reaching the socket from that page |
| Believing a gaze the server is still renewing, and only then | **COMPLETE** | `GAZE_STALE_MS` 30 s is the server's own `FOCUS_TTL_SECONDS`; `GAZE_RECHECK_MS` and `GAZE_REFRESH_MS` are 15 s, the phone's `Looking.recheck` / `Looking.refresh`. The 15/30 ratio is pinned in a test: a genuine gaze is renewed by every poll, so two missed polls are needed to lose it |
| The two characters when the figure is off the shelf | **COMPLETE for the two rungs the web can reach** | Their figure's `wait`/`typing` pictures when it has them, the bundled `/char/wait.png` and `/char/typing.png` otherwise — measured drawing the bundled figure at the same 84 × 84 and the same `translateY(-72.24px)` |
| The remembered last pose | **DELIBERATE DEVIATION** | The phone remembers one of three bundled files, which cannot go away while it runs. The web's poses are shelf URLs that change when somebody changes their figure, so `TypingPeek.tsx` keys the memory to `art` — without it a figure change mid-convo would leave the character standing in the previous figure's pose |
| Presence — is the other person **online**? | **NOT IMPLEMENTED** | A different fact from where they are looking. The phone watches it; the web does not, and does not claim to. (The gaze row above is where presence-like information does reach the composer) |
| A figure a **theme** ships | **NOT IMPLEMENTED — unchanged from Round 28** | The web's catalogue carries a figure's pictures but not a theme's |
| A theme's `figure_peek` size | **NOT IMPLEMENTED — unchanged from Round 28** | A shop figure's `peek_size` is read from its own row; a theme's is on the theme's row |
| Two live accounts looking at each other | **NOT VERIFIED** | Every frame came from a loopback stub that speaks the backend's frame shape. `consumers.py`, `settings.py` and `looking.dart` were read; the running backend was never watched |
| The 30-second sweep against a real peer who vanishes | **NOT VERIFIED as behaviour** | The boundary is exercised in unit tests (`believed at STALE − 1`, dropped at `STALE`); no probe waited out a real lapse, and no peer disappeared without saying goodbye |
| Touch / a real phone | **NOT VERIFIED** | Headless Chrome at 1280 × 900 with a mouse |

**No parity percentage moved**, and the two table rows that did move are the honest measure of why:
`Typing indicators` and `Online presence` were both `PARTIALLY COMPLETE` / `NOT IMPLEMENTED` before this
round and both are `PARTIALLY COMPLETE` after it, for named sub-features that are in this table and are
not hidden behind the word "complete". What changed for real is that the `wait` character exists at all
— before this round there was no surface it could have been drawn on.

## Round 30 — the chips a convo forms (2026-11-12)

The request: *"ab chatscreen me jo chip banta hai jaise call ka, data ka etc ka wo sab jaise aap me hai
exact waisa kijiye"*. Every chip below was measured in the running app against a stub carrying all of
them; each is the plate that paints, not a restatement of the source.

| Feature | Status | Note |
| --- | --- | --- |
| A finished call in the thread | **COMPLETE** | Was **never drawn at all**: `callNote()` read `payload.call` as an *object* and looked for `media` inside it, while `_write_log` writes `{"call": "<uuid>", "media": …, "outcome": …, "seconds": …}` as one **flat** dictionary — so every call fell through to a bubble. Now read flat, as `callNoteOf` (`calls.dart:3758`) does. Measured radius 16 / `9px 13px` / icon 16 / gap 8 / body 13 w600 / clock 10 dim, matching `_callRow` |
| Ringing back from that chip | **COMPLETE** | Was not pressable, with a comment claiming this client could not place a call — untrue since Round 18. Now a `<button>` under the phone's `_canCall` (`_hasCallee && _callOpen`). Pressing it sent `{"ring":"2222…2222","kind":"audio"}`. Gate shut → a `<div>`, the phone's `onTap: null` |
| A file somebody sent | **COMPLETE for a document** | Rebuilt to `_FileRow`/`_MediaFrame`: 220 × 62.73, `X.card`, radius 14, padding 12, a 32px accent glyph, gap 10, a w700 name over an 11px `X.dim` `_fileDetails` line, no download glyph. Measured. The phone gives the name **no** `fontSize`, so the web's 14 is an inference from Material's default — recorded, not measured |
| The file's size and duration word | **COMPLETE** | `mediaSize` is `formatMediaSize`'s own arithmetic: units B/KB/MB/GB, one decimal below ten of a unit and none at or above (`1183744` → `1.1 MB`), `<= 0` → `Unknown size`. Four cases in `format.test.ts` |
| The file's type word for a missing MIME | **NOT VERIFIED** | `Image` / `Video` / `Document` / `Audio` are read off `_fallbackType`; only a PDF was measured, so no fallback path ran |
| Downloading that file | **NOT VERIFIED** | The chip is an `<a download>` at the authenticated media URL; it was not confirmed to save against a real backend |
| The day pill | **COMPLETE** | Radius corrected `rounded-full` → **20** (a browser clamps `full` to 11.5px on a 28.5px pill; the phone's `DayMark` is 20). Geometry already matched: `5px 11px`, 11px w600, `0.2px` tracking, air 10 above / 12 below |
| A system note | **COMPLETE** | Radius 16, `9px 13px` — measured and already the phone's |
| The strip at the top of a thread | **COMPLETE** | 159.77 × 29.75, radius 20, `6px 12px 6px 11px`, icon 12, gap 5 — measured and already the phone's |
| The stamp over a picture | **COMPLETE** | 10px `X.dim`, 4px above the picture, left-aligned to it — `messageStamp`, already the phone's |
| Two live accounts, a real call, a camera | **NOT VERIFIED** | Every reading is a loopback stub. No call was placed or received; a video call was drawn from a note but not placed |

**No parity percentage moved.** The two rows that changed hands are recorded as what they are: a chip
that was invisible and unpressed became the phone's object, and a file chip that was a different object
became that object too. The unmeasured halves — other file kinds, the download, a live call — are named
above rather than folded into the word "complete".

## Round 31 — the time a message carries (2026-11-12)

The request: *"abhi isme message ka time nahi dikhta jaise app me dikhta hai, please ise bhi fix
kijiye"*.

| Feature | Status | Note |
| --- | --- | --- |
| The time inside the long-press sheet | **COMPLETE** | The sheet's first child is now the phone's own line — `Padding(fromLTRB(16,0,16,6))` → `Align(centerStart)` → 11px `X.dim`. Measured 11px / 400 / `rgb(107,107,123)`, ink 17px from the panel's left edge. One time in the sheet: a duplicate 9px clock inside the quote card was removed |
| The half of the day | **COMPLETE** | The phone appends `AM`/`PM` because its `clock()` answers `10:42`. The web's `clock()` is `Intl.DateTimeFormat` with `hour: "numeric"` and already answers `11:05 AM`, so one function serves both the sheet and the picture stamp and the two cannot disagree |
| A clock on an ordinary bubble | **NOT IMPLEMENTED — deliberately** | The phone has none: `messageStateRow` says *"The time is not here either: it is read from the long-press menu now."* Adding one would have made this client differ from the phone in the name of matching it |
| The clock on a picture | **COMPLETE** | `messageStamp`: 10px `X.dim`, **above** the picture, 4px clear of it — measured, and already the phone's |
| An unsent outbox row in the sheet | **NOT VERIFIED** | The phone's `_menuClock` is empty when there is no `created_at`; the sheet was measured on a received message only |
| A 24-hour locale | **DELIBERATE DIVERGENCE** | The web reads `23:05` where the phone's `_menuClock` would append `PM` to a `10:42`-style string. Matching the phone exactly there would mean ignoring the viewer's own locale, so it is recorded rather than changed |

**No parity percentage moved.** The row that changed is small and the two that did not are the point:
the phone deliberately puts no clock on a bubble, and the web now matches that by *not* adding one.

## Round 32 — the sound bubble is the phone's own player (2026-11-12)

The request: *"Alright, please audio message bubble ka design exact app ke jaisa kijiye"*. Every number
was read off `ChatAudioBubble` rather than guessed.

| Feature | Status | Note |
| --- | --- | --- |
| The track width | **COMPLETE** | The phone pins the waveform column to **150** (`_track`, `SizedBox(width: 150)`); the web's `WAVE_TRACK_WIDTH` is 150, measured at 150 × 30 |
| The waveform's own maths | **COMPLETE** | `height` 30, `mostBars` 56, `thick = (cell * 0.42).clamp(0.8, h >= 44 ? 5 : 4)`, `gap = ((cell - thick) / 2).clamp(0, 2)`, radius 2, `(4 + sample / 100 * 24) * unit`, 24 idle bars, a 900 ms dance — ported one for one into [voiceclip.ts](src/features/convo/voiceclip.ts). Measured: 56 bars, 1.11 wide, `marginInline 0.776786` |
| The convo's own tint | **COMPLETE** | `tone = accent ?? X.accent`, and the chat screen always names `convoAccent()`. The web reaches the same colour through the already-rebound `--accent`: measured `rgb(43, 87, 198)` = `#2B57C6` |
| The player's own size | **COMPLETE** | Measured **190 × 58** — the phone's own arithmetic (150 of track + a 40-wide control) |
| The readout and the speed chip | **COMPLETE** | `0:00 / 0:02` at 10px `--dim`; the chip **38 × 28** at 14px/500, dimmed to `color-mix(in srgb, var(--ink) 38%, transparent)` while no ear is held — the phone's `minimumSize: Size(38, 28)` |
| Setting a speed before the first press | **NOT MATCHED** | The phone's comment says the chip is *"Always a control: before the first press it chooses the speed that press will play at"* (`_speedChoice` / `speedOf`). The web's chip is `disabled={!held}` |
| `InFront` | **NOT IMPLEMENTED** | The phone stops a note when the page it is on stops being looked at; the web has the one-ear rule only |
| Pending / Uploading / Retry / Discard | **NOT IMPLEMENTED** | The phone's `_transferControls`; the web draws an "Expired" line and nothing else |
| The sender on somebody else's voice note | **NOT IMPLEMENTED** | The phone passes `sender: mine ? null : sender` and draws a face and a name above the player in a group |
| A real recording, two live accounts | **NOT VERIFIED** | A silent WAV built in the page, against a loopback stub |

**No parity percentage moved.** The player is now the phone's object; the six rows under it are what it
still is not.

## Round 33 — three sounds, three designs (2026-11-12)

The request: *"song message bubble aur audio message bubble do alag alag message bubble hai aur dono ka
design alag alag hai app me, please aise hi isme bhi kijiye"*.

| Feature | Status | Note |
| --- | --- | --- |
| A voice note | **COMPLETE** | The Round 32 player inside its bubble — measured 220 × 84, ground `rgb(18, 26, 44)`, radius `18px 18px 18px 6px`, padding `10px 14px 8px` |
| A sound file | **COMPLETE** | The phone's `ChatAudioFileRow` inside its own bubble — measured 250 × 88.73, ground `rgb(15, 28, 60)`, radius `18px 18px 6px`, holding a 220 × 62.73 row: padding 12, gap 10, radius 14, 32px `rgb(43, 87, 198)` glyph, name 14/700, details 11px/400 |
| A shared song | **COMPLETE** | `ChatTrackCard` drawn **bare** — no panel behind it, exactly as the phone's `bare` rule says a card brings its own edges. 272 × 152.89, padding 10; the stamp above it at 10px `--dim` with 4px of air, on the row's side; the body never repeated |
| The card's own wave | **COMPLETE** | 26 bars (`waveShape(track.seed, 26)`), 2.5 wide, `3 + shape * 19`, unplayed at `X.fade(X.text, 0.16)` = `color-mix(in srgb, var(--ink) 16%, transparent)`; measured heights 5.58 → 21.25 |
| The card's clock row | **COMPLETE** | `_timeStyle`: 10.5px / 600 / tabular / `--dim`, 4 points under the 252 × 22 wave — both margins measured |
| The palette accent against the convo tint | **COMPLETE** | `ChatTrackCard` takes no `accent` on the phone and fills its play button with `X.accent`, while the sound bubbles take `convoAccent()`. `--palette-accent` is now published by `ThemeProvider` and rebound at the card's root. Measured on dark "Alone": `#8FB4FF` on the card against `#2B57C6` in the thread. **Invisible on every theme where `chatTint` equals the accent** |
| The heart's box | **COMPLETE** | The phone's `LikeHeart` is an `IconButton` constrained to `34 × 34` around a 22 icon; the web's `LikeButton size="md"` is the same pair |
| The card's width | **PARTIALLY MATCHED** | The phone is `ConstrainedBox(minWidth: 220, maxWidth: 290)` and sizes to its content; the web is a flat 272 |
| The card's failure line | **NOT MATCHED** | The phone prints the store's own sentence (`store.stuck!`); the web prints "Could not play that." |
| The file row's name and its transfer states | **NOT MATCHED / NOT IMPLEMENTED** | The phone allows two lines and uses `source.fileName`; the web truncates to one and falls back to "An audio file". The phone's `_MediaFrame` carries Pending / Uploading / Retry / Discard and opens a local file; the web's `<a download>` has neither |
| `ShareWho`'s name | **NOT MATCHED** (unchanged this round) | The phone reads the alias the reader gave the person; the web draws `name || username` |
| Three live designs on a real backend | **NOT VERIFIED** | One thread, a loopback stub, a WAV sound file and a silent voice note built in the page |

**No parity percentage moved, and the split is the point.** What changed is which object each kind is:
the web used to have one sound bubble for everything, and now has the phone's three — a player, a file
row, and a card that is not a bubble at all.

## Round 34 — the group settings surface (2026-11-13)

| Phone feature (`GroupScreen`) | Status | Where |
| --- | --- | --- |
| Group photo — set from a file, clear | COMPLETE | `GroupPanel.tsx` → `threads/<pk>/avatar/` |
| Group name — rename | COMPLETE | `threads/<pk>/group/` |
| Locked switch | COMPLETE | `threads/<pk>/room/` |
| Invites-are-on switch | COMPLETE | `threads/<pk>/room/` |
| Channels — list with each rule | COMPLETE | `threads/<pk>/channels/` |
| Channel — new / rename / delete | COMPLETE | `channels/`, `channels/<cid>/` |
| Channel rule — who may post / what may be sent | COMPLETE | `channels/<cid>/` with both `post` and `media` |
| Invite links — list, create, turn off, share | COMPLETE | `threads/<pk>/invites/`, `invites/<iid>/` |
| Roster — roles, search, counts, paging | COMPLETE | `threads/<pk>/members/?q=` |
| Member "…" — make admin / remove | COMPLETE | `members/<user_id>/` |
| Add people | COMPLETE | `members/` POST |
| Leave / Delete the group | COMPLETE | `leave/`, `delete/` |
| A member's restricted view | COMPLETE | same panel, controls not drawn |

**PARTIALLY COMPLETE in one respect:** every row above is wired to the endpoint the phone uses and
renders correctly, but only the two switches, the channel rule sheet and the roster were exercised in a
browser. Avatar upload, invite creation and revoking, role changes, removal, leave, delete, channel
create/rename/delete and the add-people picker are **NOT VERIFIED at runtime**.

## Round 35 — the direct convo's options sheet (2026-11-13)

| Phone feature (`ChatSheet`, `SheetKind.convo`) | Status | Note |
| --- | --- | --- |
| Rename on this device | COMPLETE | new `names.ts`; per browser, as the phone is per device |
| Pin to top / Unpin | COMPLETE | already present |
| Mute / Unmute | COMPLETE | now hidden on the self convo, as on the phone |
| Move to / take out of the vault | COMPLETE | already present |
| Disappearing convo | COMPLETE | already present |
| Block / Unblock | COMPLETE | **fixed**: the row is now absent when the other side did the blocking |
| Clear convo | COMPLETE | note aligned with the phone |
| Trash convo | COMPLETE | note aligned; hidden on the self convo |

**NOT ON THE PHONE'S SHEET, STILL HERE:** "Media and files", "Wallpaper" and "Convo theme". The phone
keeps the first two on the person's profile and removed a per-convo theme altogether. They were left in
place rather than removed, so the web sheet is a superset here and this is **not** an exact match.

**No parity percentage moved.** Both rounds closed gaps inside surfaces that already existed; neither
added a screen.


## Round 36 — no parity row moves (2026-11-14)

This round repaired a **web runtime** failure, so the mobile-to-web matrix is unchanged: every row that
was COMPLETE, PARTIALLY COMPLETE, BLOCKED or NOT IMPLEMENTED before this round still carries the same
status. Nothing in the phone's screens was touched, and nothing in `xelvic/` was read for behaviour
beyond the earlier rounds' notes.

One new behaviour exists on the web and has **no phone equivalent**, recorded here so it is not mistaken
for parity:

| Area | Phone | Web | Status |
| --- | --- | --- | --- |
| A React tree React cannot repair | Not possible — a Flutter build holds one copy of its framework | The error screen recognises React's null-dispatcher failure and reloads the page once per twenty seconds, then shows the honest error screen | COMPLETE (web-only) |

The crash itself is not a feature and has no parity dimension. Its cause — two pre-bundled React copies
in one long-lived dev tab — is a dev-server artifact; the production bundle was measured and holds one.

## Round 37 — no parity row moves (2026-11-14)

This round moved style declarations from one stylesheet layer to the class attributes that use them, and
changed no behaviour that a feature row describes. Every row that was COMPLETE, PARTIALLY COMPLETE,
BLOCKED or NOT IMPLEMENTED before this round keeps its status. Nothing in the phone's screens was read or
touched for this round, and no row's evidence changed.

The one place a person could see a difference is the feel of pressing a button: its colour transitions
now run on the app's soft easing curve (`cubic-bezier(0.22, 1, 0.36, 1)`) where `.btn` used `ease`, over
the same 160 ms, because a Tailwind `transition-*` carries one timing function for the whole property
list. It is named here rather than rounded away, and it is not a parity question — the phone's own
buttons are Flutter widgets, not CSS.

## Round 38 — the convo paints its own wallpaper and theme (2026-11-14)

One row's evidence grew and one row's wording was corrected; no status moved. **Wallpaper / tint**
(COMPLETE) now names the whole path — a photo of your own kept locally and drawn by the chat root, a
built-in wall under the page's own 78 % wash, and a picked tint read by `ChatPage` — where before this
round the row's evidence was the existence of a picker whose writes nothing read. **Chat accent on an
uncoloured convo** stays PARTIALLY COMPLETE and now says what actually differs: the phone's default is the
app's pink (`kChatTint`), the web's is the account accent, so changing the account colour repaints every
convo that was never given one.

**The rule this round follows.** `skin.dart`'s `tintOf`: an explicitly picked key is that convo's own
colour and outranks a theme, which is why the web now rebuilds the convo palette from the picked reading
(`kTints`' light-scheme values, value for value in `TINT_HEX`) instead of mapping the chat to the account's
accent. `default` is not a colour of its own, and there the theme still has its say.

**The wash, measured against the phone.** `chat.dart` draws a built-in wall as `Image.asset` under
`ColoredBox(color: X.fade(X.ink, kWallScrim))`, and `XScheme`'s `ink` is the page ground — 78 % page over
the picture, not a black scrim. The web's veil now uses `var(--page)` at 0.78, where it had used black at
22 %. A photo of your own is drawn at `own.opacity` over the same ground with nothing over it; the web's
page veil at `1 − opacity` composites to the same arithmetic. The default is `1.0`, as in
`app/lib/screens/wall_frame.dart`.

**The phone's sheet.** It removed the per-convo theme row on 2026-10-24 and keeps wallpaper and media on
the person's profile; the web keeps both rows deliberately, so that a person who picked a tint can pick
another. `skin.dart` still defines the rule for a key, and that rule is what the web follows. Nothing in
`xelvic/` was changed this round; `skin.dart`, `chat.dart`, `convo.dart`, `wall_frame.dart` and
`wallpaper.dart` were read.

## Round 39 — one new row, and no status moved (2026-11-14)

The Convo table gained a row, **Emoji said on their own, and the space between them**, at **PARTIALLY
COMPLETE**; no existing row's status changed. It is new because nothing in the matrix had described how this
build draws an emoji inside a message, and this round's fix would be easy to read as parity when half of it
is not.

**What is now the phone's.** The space between two emoji. `chat.dart` draws a body as one plain `Text` and
lets the emoji font space it; this build replaces each emoji with an `EmojiArt` box declared `1.15em`, and
inside that box the character layer sizes the grid column to the machine glyph's own advance —
**1.3730em**, 41.19 px at 30 px — so the artwork is drawn 41.19 px wide in a 34.50 px box. Two emoji
typed together therefore overlapped by **6.70 px**. An emoji whose next run is another drawable emoji now
carries `mr-[0.35em]`: a pitch of **1.500em**, measured **+3.80 / +4.55 / +5.31 / +1.89 px** of clearance at
30 / 36 / 42 / 15 px, with margins of 10.5 / 10.5 / **0** px across a row. The rule is adjacency rather than
a blanket margin, so a lone emoji and an emoji with a space after it are left as they were, and the machine's
fallback character gets the same clearance the artwork does.

**What is still not.** The sizes. `bubbleType` answers 42 for one emoji, 36 for two, 30 for three, 24 for
four to twelve and 15 beyond; `messageFontSize` answers 38, 26 and 15. A row of three emoji is drawn twice
the phone's size, and a row of seven 24 px where the phone keeps 15. That is the reason the new row is
PARTIALLY COMPLETE rather than COMPLETE, and it is not something this round touched. It is also not the only
vertical divergence: the drawing is 1.373em tall in a line box of 1.05em, so it overhangs its own line by
6.70 px at 30 px, where the phone's `height: 1.35` keeps its glyph inside the line. The rule for what counts
as an emoji does match — `onlyEmojiCount` over grapheme clusters against `emojiCount` over
`text.characters`, both counting a joined or flagged emoji as one — and it now has three tests.

**Not verified by eye.** No authenticated chat was opened, so the row carries the same caveat the emoji rows
above it do: measured, not watched. Nothing under `xelvic/` was changed; `app/lib/screens/chat.dart` was read
for `emojiCount`, `messageFontSize`, `_isEmojiCluster` and the `Text` that draws a body.
