# Xelvic API Compatibility Report

Date: 2026-11-01
Backend (read-only): `xelvic/backend` — Django + DRF + Channels
Web client: `xelvic-web/src/config/axios.ts` (the one HTTP client) and the
`xelvic-web/src/services/` modules that call it

The mobile app and the web app share one backend. No endpoint, serializer,
migration, setting or contract was changed. This report records what the web
calls, the shape it expects, and any mismatch found.

## Conventions (verified in source)

- Base: `VITE_API_URL` + `/api/v1/` (`src/config/env.ts`), dialled through the
  shared axios instance in `src/config/axios.ts`.
- Auth: `Authorization: Bearer <access>` on everything except the anonymous QR
  doors and the public playlist route.
- Errors: `{"error": {"code", "message", "fields?"}}`.
- Lists: `{"results": [...], "next": "...", "previous": "..."}`; messages use
  `MessagePage`, 40 per page, newest first.
- IDs are UUID strings. Timestamps are ISO-8601 with timezone.
- Uploads: `POST /chat/assets/` multipart (`file`, client `upload_id`, `kind`,
  optional `thumb`, `width`, `height`, `duration_ms`), response `{asset}`.
- Sockets: `wss://<api-host>/ws/?token=<access>`; frames are `{event, data}`;
  actions are sent as `{action, ...}`.

## Chat contract used by the web

| Purpose | Method + path | Web caller | Status |
| --- | --- | --- | --- |
| Thread list | `GET /chat/threads/` | `ConvoPage` | MATCH |
| Thread detail | `GET /chat/threads/{id}/` | `ChatPage` | MATCH |
| New group | `POST /chat/groups/` | `ConvoPage` | MATCH |
| New DM | `POST /chat/threads/` `{user}` | `NewConvoPanel` | MATCH |
| Message page | `GET /chat/threads/{id}/messages/` | `ChatPage` | MATCH (newest first) |
| Send | `POST /chat/threads/{id}/messages/send/` | `ChatPage` | MATCH |
| Edit | `PATCH /chat/threads/{id}/messages/{mid}/` | `MessageOptions` | MATCH |
| Delete | `DELETE ...?scope=all` | `MessageOptions` | MATCH |
| React | `POST .../react/` | `ChatPage` | MATCH |
| Vote | `POST .../vote/` | `ChatPage` | MATCH |
| Forward | `POST .../forward/` `{threads:[ids]}` | added goal 4.5 | MATCH |
| Message info | `GET .../info/` (groups) | added goal 4.6 | MATCH |
| Media index | `GET /chat/threads/{id}/media/?kinds=` | `MediaSheet` | MATCH |
| Read | `POST /chat/threads/{id}/read/` `{ordinal}` | `ChatPage` | MATCH |
| Read all | `POST /chat/threads/read/` | `ConvoPage` | MATCH |
| Spark send | `POST .../messages/send/` `{kind: image|video, payload:{view_once:true}}` | `CameraCapture`, `ChatPage` | **FIXED** — `kind:"spark"` was sent before; the backend has no such kind, so every Spark from the web was refused. A Spark is an ordinary photo/clip with `payload.view_once`. |
| View-once open | `POST .../open-once/` | `ChatPage` `SparkViewer` | **FIXED** — was POSTing `/open/` (404, swallowed); now fetched bytes are loaded first, then `open-once/` is spent exactly once |
| View-once shot | `POST .../shot/` | rendered, not posted | The server mark (`payload.shot_at`) is rendered as the mobile shot line. A browser cannot detect a screenshot, so the web does not fabricate one and does not POST it. |
| Start direct | `POST /chat/threads/` `{user}` | `NewConvoPanel` | MATCH |
| Vault | `GET /chat/vault/`, `/unlock/`, `/reset/` | `ConvoPage`, `VaultModal` | MATCH |
| Thread flags/skin/clear/vanish | `/threads/{id}/flags|skin|clear|vanish/` | `ConvoSheet` | MATCH |
| Members / leave / invite | `/threads/{id}/members/...` | `ConvoSheet` | PARTIAL |
| Channels | `/threads/{id}/channels/` | `ChatPage` room bar | PARTIAL |
| Search | `GET /chat/search/?q=` | `ConvoPage` search field | MATCH (added) |
| Durable sync | `GET /chat/sync/?cursor=` | not used | MISSING (web) |

The direct-chat start route is `POST /chat/threads/` with `{user}`; it returns
`{thread, gate}` and may return `thread: null` when the gate is not open.

## Serializer shapes relied on

`Message` (verified in `chat/serializers.py`):

```
id, thread, channel, ordinal, kind, body, sender (UserCard), mine,
reply_to {id,kind,body,sender{id,name},deleted_for_all}, asset, payload,
poll, reactions [{emoji,count,users}], my_reaction, can_copy, held,
deleted_for_all, client_id, revision, edited_at, expires_at,
created_at, updated_at
```

`ThreadCard` (verified): `id, kind, title, avatar, other, preview {kind,text,at,
mine,held}, status, unread_count, unread_other_count, pinned, muted, vaulted,
spark_off, vanish_mode/at, wallpaper, tint, last_message_at, channels, locked,
invites_on, my_role, state_versions, member_count, self, sparks_count`.

Web type gaps found and addressed:

- `Message.pending` / `Message.failed` existed in `types/api.ts` but nothing
  ever set them. Goal 4.2 now uses them for optimistic sends.
- `client_id` is now used to reconcile the optimistic row with the server row
  (the backend deduplicates by `(sender, client_id)` and returns the same row).

`status` is authoritative: `Waiting | Sent | Delivered | Opened`, produced by
`services.outgoing_status`. The web previously defaulted to "Delivered" when
the field was absent, which was a fabricated receipt. Goal 4.3 fixes this.

## Socket events

Verified in `chat/events.py`, `chat/consumers.py`, `chat/services.py`:

| Event | Payload | Web handling |
| --- | --- | --- |
| `message.new` | `{thread_id, message}` | insert/dedupe by id; reconcile pending |
| `message.edit` | `{thread_id, message}` | replace |
| `message.gone` | `{thread_id, message_ids[]}` | remove |
| `message.react` | `{thread_id, message_id, emoji, reactions, user_id}` | patch |
| `message.poll` | `{thread_id, message_id, poll}` | patch |
| `thread.typing` | `{thread_id, user_id, typing, ttl}` | indicator |
| `thread.read` | seat watermarks | receipt word |
| `thread.update` | `{thread_id, unread, unread_other_count, preview?, at, notice?}` | **patched live (goal 4.7)**; `notice` feeds the in-app strip (goal 6.2) |
| `thread.members` / `thread.channels` | change notice | refetch detail |
| `alert.new` | `{alert: Alert}` | list cache patched; a hidden tab gets a system row (goal 6.3) |
| `alert.read` | `{unread}` | list cache patched |
| `presence` | `{user_id, online}` | header dot |

The `thread.update` notice is verified in `apps/chat/notices.py`: `thread,
title, group, room, from {id, username, name, verified, avatar, character,
theme, dp}, preview, row, kind, card, media {kind, thumb, content, ratio,
duration_ms, name, asset}, mention, by, ordinal, at, muted`. It is built for
every member except the sender, and is absent for a system note. The web reads
those fields and nothing else — there is no `link` or `account` on the socket
road, so the strip does not draw one.

**Push is not used by this build, and cannot be.** `apps/accounts/push.py` sends
through Firebase v1 to `Device.push_token`, and `POST /auth/devices/` accepts a
token — but registering one requires a Firebase web app config and a service
worker, neither of which exists here, and the backend is read-only. Goal 6.6 is
therefore recorded as BLOCKED rather than implemented behind a switch.

Client actions verified: `ping`, `presence`, `subscribe`, `unsubscribe`,
`away`, `typing`, `focus`, `read`, `delivered`, `send`, `react`.

The web uses HTTP for sending and the socket for receipt/typing/presence
acceleration. This is supported: `POST .../send/` returns the canonical
`Message`, and the socket echo is deduplicated by id.

## Endpoints used elsewhere (spot-checked)

Auth (`/auth/qr/*`, `/auth/me/*`, `/auth/devices/*`, `/auth/token/refresh/`,
`/auth/logout/`, `/auth/deactivate/`), social (`/social/*`), drops
(`/drops/*`), moments (`/moments/*`), audio (`/audio/*`), spaces (`/spaces/*`),
alerts (`/alerts/*`), sparks (`/sparks/*`), verify (`/verify/*`).

### Marketplace (route-by-route, checked 2026-11-01)

The marketplace is the one place where the web calls six endpoints that nothing
else on the web called before, so each is confirmed against the read-only
backend rather than assumed. Mounting prefixes are from `config/urls.py`:

| Web call | Backend route | Source |
| --- | --- | --- |
| `GET /catalogue/` | `path("api/v1/catalogue/", include("apps.studio.urls"))` → `path("", CatalogueView.as_view())` | `config/urls.py:198`, `apps/studio/urls.py:15` |
| `POST /catalogue/figure-pick/` | `path("figure-pick/", FigurePickView.as_view())` | `apps/studio/urls.py:16` |
| `GET /drip/`, `POST /drip/buy/`, `POST /drip/wear/`, `POST /drip/profile/` | `path("api/v1/drip/", include("apps.drip.urls"))` + the four routes | `config/urls.py:194`, `apps/drip/urls.py:8-11` |
| `POST /sparks/wallet/buy/` | `path("wallet/buy/", BuyThemeView.as_view())` | `apps/sparks/urls.py:16` |
| `POST /sparks/wallet/buy-logo/` | `path("wallet/buy-logo/", BuyLogoView.as_view())` | `apps/sparks/urls.py:17` |
| `PATCH /auth/me/logo/` | `path("me/logo/", me.LogoView.as_view())` | `apps/accounts/urls.py:68` |

`GET /sparks/wallet/` and `PATCH /auth/me/theme/` were already in use by the
Sparks page and the theme provider. **No endpoint was added, renamed or
extended for the marketplace, and no backend file was modified.** Every write is
followed by a read of the shelf (the purchase answers with a price and a
balance, never with the new shelf), so nothing is optimistic and nothing is
claimed before the server agrees.

### Moments (route-by-route, checked 2026-11-01)

Moments is the second place where the web calls routes nothing else called, so
each is confirmed against the read-only backend. Everything is under
`path("api/v1/moments/", include("apps.moments.urls"))`
(`config/urls.py:175`), so the paths below are relative to
`backend/apps/moments/urls.py`.

| Web call | Backend route | Source |
| --- | --- | --- |
| `GET /moments/tray/` | `path("tray/", TrayView)` | `urls.py:8`, `views.py:140` |
| `GET /moments/mine/` | `path("mine/", MomentListView)` | `urls.py:12`, `views.py:283` |
| `GET /moments/users/{username}/` | `path("users/<str:username>/", UserMomentsView)` | `urls.py:13`, `views.py:249` |
| `POST /moments/silence/` | `path("silence/", MomentSilenceView)` | `urls.py:11`, `views.py:485` |
| `POST /moments/` (post a day) | `path("", MomentListView)` | `urls.py:40`, `views.py:283` |
| `GET /moments/{id}/` | `path("<uuid:pk>/", MomentDetailView)` | `urls.py:41`, `views.py:457` |
| `DELETE /moments/{id}/` (Take down) | same route, `delete` | `urls.py:41`, `views.py:457` |
| `POST /moments/{id}/seen/` | `path("<uuid:pk>/seen/", MomentSeenView)` | `urls.py:42`, `views.py:476` |
| `POST /moments/items/{id}/seen/` | `path("items/<uuid:pk>/seen/", MomentItemSeenView)` | `urls.py:70`, `views.py:511` |
| `GET /moments/{id}/viewers/` | `path("<uuid:pk>/viewers/", MomentViewersView)` | `urls.py:43`, `views.py:531` |
| `POST /moments/{id}/reply/` | `path("<uuid:pk>/reply/", MomentReplyView)` | `urls.py:44`, `views.py:558` |
| `POST /moments/{id}/react/` | `path("<uuid:pk>/react/", MomentReactView)` | `urls.py:50`, `views.py:571` |
| `GET /moments/{id}/reactors/` | `path("<uuid:pk>/reactors/", MomentReactorsView)` | `urls.py:51`, `views.py:595` |
| `POST /moments/{id}/share/` (gate, then deed) | `path("<uuid:pk>/share/", MomentShareView)` | `urls.py:53`, `views.py:631` |
| `POST /moments/{id}/carry/` | `path("<uuid:pk>/carry/", MomentCarryView)` | `urls.py:55`, `views.py:652` |
| `POST /moments/items/{id}/vote/` | `path("items/<uuid:pk>/vote/", MomentItemVoteView)` | `urls.py:75`, `views.py:717` |
| `GET /moments/items/{id}/voters/` | `path("items/<uuid:pk>/voters/", MomentItemVotersView)` | `urls.py:79`, `views.py:738` |
| `GET /moments/awaiting/` | `path("awaiting/", AwaitingView)` | `urls.py:28`, `views.py:862` |
| `GET /moments/memories/` | `path("memories/", MemoryListView)` | `urls.py:15`, `views.py:835` |
| `POST /moments/memories/` | same route, `post` | `urls.py:15`, `views.py:835` |
| `PATCH /moments/memories/{id}/` | `path("memories/<uuid:pk>/", MemoryDetailView)` | `urls.py:16`, `views.py:889` |
| `DELETE /moments/memories/{id}/` (Remove) | same route, `delete` | `urls.py:16`, `views.py:889` |
| `GET /moments/memories/users/{username}/` | `path("memories/users/<str:username>/", UserMemoryView)` | `urls.py:29`, `views.py:1049` |
| `POST /moments/memories/{id}/reply/` | `path("memories/<uuid:pk>/reply/", MemoryReplyView)` | `urls.py:31`, `views.py:963` |
| `POST /moments/memories/{id}/react/` | `path("memories/<uuid:pk>/react/", MemoryReactView)` | `urls.py:33`, `views.py:983` |
| `GET /moments/memories/{id}/reactors/` | `path("memories/<uuid:pk>/reactors/", MemoryReactorsView)` | `urls.py:35`, `views.py:1001` |
| `POST /moments/memories/{id}/share/` (gate, then deed) | `path("memories/<uuid:pk>/share/", MemoryShareView)` | `urls.py:37`, `views.py:1032` |

Three contract points were checked rather than assumed, because each one is a
rule the viewer would otherwise get wrong:

1. **The tally is the author's.** `services._reactions` sends a non-owner
   `{count: 0, counts: {}, mine}`. The web therefore draws the answers row and
   opens every sheet behind it (viewers, reactors, voters) on my own day only —
   it does not invent a number for somebody else's story, and it does not draw
   the "Who chose what" section to a reader the server refuses to name them for.
2. **Share is a question and then a deed.** `POST /moments/{id}/share/` with no
   body returns whether the account may share it at all; `{thread}` is the send.
   A private account's refusal arrives as the server's own refusal, so the web
   never opens a picker whose Send would fail.
3. **Marking watched is per item, and the day is marked on its last one.**
   `items/{id}/seen/` is called as each item comes up (which is what lets the
   next open of the same person resume), and `{id}/seen/` on the item that ends
   the day.

**No endpoint was added, renamed or extended for this pass, and no backend file
was modified.** Reads performed: `apps/moments/urls.py`, `apps/moments/views.py`,
`apps/moments/services.py`, `config/urls.py`.

Routes that exist and the web still does not call (recorded, not used):
`items/{id}/content/` + `thumbnail/` + `sound/` (the web plays moment media
through the media pipeline it already has), `options/{id}/content/` +
`thumbnail/` (a poll option's picture), and `memories/{id}/cover/` +
`cover/thumbnail/` (the Memory serializer already sends absolute signed
`content_url` / `thumbnail_url` on `cover_upload`, so the web draws the cover
straight from the payload and never asks for the bytes separately).

The Memory write contract was read rather than assumed: `MemoryEditSerializer`
takes `title`, `items` (the ones to **add**, not the whole list), `cover` and
`cover_upload`, every key optional, and absent means "leave it". The web's
`editMemory(id, patch)` builds its body key by key for exactly that reason, and
`AddToMemories` with `into` set sends only `{items}`.

### Circles (route-by-route, checked 2026-11-01)

Circles is the third place where the web calls routes nothing else called.
Everything is under `path("api/v1/circles/", include("apps.circles.urls"))`
(`config/urls.py:191`), so the paths below are relative to
`backend/apps/circles/urls.py`.

| Web call | Backend route | Source |
| --- | --- | --- |
| `GET /circles/fields/` | `path("fields/", FieldsView)` | `urls.py:15`, `views.py:96` |
| `POST /circles/pick/` | `path("pick/", PickView)` | `urls.py:16`, `views.py:113` |
| `GET /circles/mine/` | `path("mine/", MineView)` | `urls.py:21`, `views.py:131` |
| `GET /circles/{id}/` | `path("<uuid:pk>/", CircleView)` | `urls.py:23`, `views.py:142` |
| `POST /circles/{id}/` (a take) | same route, `post` | `urls.py:23`, `views.py:149` |

Three contract points were checked rather than assumed:

1. **A take is an ordinary drop.** `CircleView.post` (`views.py:149-160`) runs
   `apps.drops.views.write_fields` on the body and then `services.post`, so the
   web sends its normal drop payload and nothing circles-only. The one line in
   that mapping that is a permission — which upload may be named — is the
   server's, and `services/circles.service.ts` deliberately does not restate it.
2. **The board is the feed's card.** `_day` (`views.py:56-88`) serialises
   `services.board(...)` through the feed's own `DropSerializer` and already
   ranked (likes, then whoever got there first), so `CirclePage` draws
   `DropCard` and does not re-sort. `read={false}` follows the app's own
   `DropCard(read: false)` — a board nobody opened counts no looks.
3. **A sealed day has no task, and `open` cannot say why.** `task` is null until
   `opens_in` reaches zero (`views.py:85-86`), and `open` is false both before
   the window and after it; the web reads `opens_in` to tell the two apart
   rather than guessing from `open` alone (`parts.tsx` — `StatusLine`,
   `opensAt`).

**No endpoint was added, renamed or extended for this pass, and no backend file
was modified.** Reads performed: `apps/circles/urls.py`,
`apps/circles/views.py`, `apps/circles/serializers.py`, `apps/circles/services.py`,
`apps/drops/views.py` (`write_fields`), `config/urls.py`.

## Audio shelves, the studio and rooms (route-by-route, checked 2026-11-01)

The Audio and Live pass added calls to routes nothing else on the web called, so
each is confirmed against the read-only backend. Mounting prefixes are from
`config/urls.py:181-182`: `api/v1/audio/` → `apps.audio.urls`, `api/v1/spaces/`
→ `apps.spaces.urls`.

| Web call | Backend route | Source |
| --- | --- | --- |
| `GET /audio/board/` | `path("board/", BoardView)` | `apps/audio/urls.py:10`, `views.py:185` |
| `GET /audio/categories/<key>/` | `path("categories/<str:key>/", CategoryShelfView)` | `urls.py:18`, `views.py:889` |
| `GET /audio/feed/` | `path("feed/", AudioFeedView)` | `urls.py:22`, `views.py:858` |
| `GET /audio/studio/` | `path("studio/", StudioListView)` | `urls.py:24`, `views.py:1001` |
| `GET /audio/studio/<uuid>/` | `path("studio/<uuid:pk>/", StudioDetailView)` | `urls.py:25`, `views.py:1011` |
| `GET /audio/studio/<uuid>/audience/?days=` | `path("studio/<uuid:pk>/audience/", StudioAudienceView)` | `urls.py:27`, `views.py:1024` |
| `GET /spaces/?shelf=kept` | `path("", RoomListView)`; the shelf map names `live`, `kept`, `upcoming`, `mine` | `apps/spaces/urls.py:13`, `views.py:29-55` |
| `POST /spaces/` (open or announce) | same route, `post` | `urls.py:13` |
| `POST /spaces/<id>/start|end|leave|hand|stage|dismiss|mute|camera/` | the named act routes | `urls.py:21-30` |
| `POST /spaces/<id>/share/` `{thread}` | `path("<uuid:pk>/share/", RoomShareView)` | `urls.py:31` |
| `POST /spaces/<id>/game/{open,join,play,again,close}/` | the five board routes | `urls.py:32-40` |
| `GET /spaces/games/` | `path("games/", GamesView)` | `urls.py:17` |

Studio shapes relied on (`apps/audio/studio.py`): sums over
`impressions, starts, qualified, completes, skips, replays, saves, shares, uses,
listen_ms`; every rate is `null` when its denominator was zero; `used_by.countries`
is `null` for an uploaded sound (not recorded) and `[]` when the read found none;
rights are `{playable, promotable, savable, shareable}`; somebody else's id is a
404. The web draws each of those as absence — "Not measured", "Not recorded." —
and never as a zero or an empty list.

**No endpoint was added, renamed or extended for this pass, and no backend file
was modified.** Reads performed: `apps/audio/urls.py`, `apps/audio/views.py`,
`apps/audio/studio.py`, `apps/spaces/urls.py`, `apps/spaces/views.py`,
`config/urls.py`.

## Known backend capabilities the web does not use yet

These are real server features without a web caller. They are **not** contract
mismatches; they are implementation gaps tracked in the parity matrix.

- `/chat/sync/?cursor=` — durable replay after a long disconnect.
- `/chat/sparked/`, `/threads/{id}/sparks/` — Spark runs.
- Group invites preview/join by code.
- `/audio/trending/` and `/audio/tracks/` are called, but the app's full-screen
  swipe deck over the reco rows and its downloads door are not drawn here.
- Room media: the app's stage audio and video travel over the `call.signal`
  relay (`stage.dart`). The web now has a WebRTC client — the one the calls are
  drawn on (2026-11-06) — but the room page is not wired to it, so this build
  still uses everything on the room except the media itself.
- `call.add` and `DELETE /calls/<id>/`: both are real and both are unused here.
  A call the web joins can be drawn with more than two seats (the server's own
  party frame is followed as it arrives), but nothing on this client starts a
  group call or adds a third person, and the history rows have no "remove".
- `POST /drops/<id>/play/` — the play signal the phone sends
  (`app/lib/audio.dart:1975`). Nothing under `src/` calls it (2026-11-06), so a
  sound played in the browser does not advance `plays` and the poster's own
  numbers do not include it. `NOT IMPLEMENTED`, and a silent omission rather than
  a claim on screen.
- `GET /drops/mine/` and `GET /drops/interests/` — an own-posts shelf and the
  interests a post carries. Neither is called (2026-11-06), so there is no "my own
  posts" shelf and a post made here carries no interests and cannot be filed.
  `NOT IMPLEMENTED`.
- A Vibe's `recipe` and `clip_urls` — the edit document (the clips it names, the
  voiceover and music lanes, each clip's trim and speed, the overlays, the filter
  and the frame shape) and the addresses of the uploads it names. Both are sent by
  the server and read by **nothing** here (2026-11-06), so a Vibe edited on the
  phone plays on the web as its first clip alone. `NOT IMPLEMENTED`, and recorded
  in `XELVIC_FEATURE_PARITY_MATRIX.md` rather than left implied.
- Deals, collabs modules. (Circles and the marketplace's routes are now used —
  see the tables above.)

## Contract mismatches fixed in this pass

1. `POST /messages/{id}/open/` → `POST /messages/{id}/open-once/`.
2. Conversation rows discarded the last-message preview and rendered
   "Nothing new"; now render the real preview and unread count.
3. Receipt label defaulted to "Delivered" without server evidence; now uses
   `thread.status` / member watermarks, otherwise "Sent".
4. `thread.update` frames triggered a full list refetch and lost the carried
   preview; now the card is patched and re-sorted in place.
5. Spark send used `kind: "spark"`, which the backend does not define; now an
   ordinary `image`/`video` send with `payload.view_once: true`.
6. Spark detection read invented payload flags and browser-local opened state;
   now reads `payload.view_once` (the server's flag) and `payload.opened_at`
   (the server's mark) only. `Spark · sent / opened / gone` and the shot line
   come from those two fields.

## Contract mismatch fixed on 2026-11-06 (drops round)

1. `POST /reco/signals/` was told `kind: "vibe"` for **every** row a walk drew.
   The app writes `'kind': row.isVibe ? 'vibe' : 'drop'` (`lib/reco.dart`, both
   for `served` and for a view), and the server resolves an id against the table
   its `kind` names: `_KINDS = {"drop": Drop, "vibe": Vibe, "track": Track}` in
   `apps/reco/services.py`, with `_existing` dropping any id that table does not
   hold. Nothing noticed while only a shelf was reported — every row a shelf
   holds *is* a Vibe. It became reachable when a plain video in the feed began
   opening in the walk, which is a `Drop` and not a `Vibe`: sent as a `vibe` its
   impression and its view would have been dropped in silence, and the creator's
   studio would have drawn a clip that was watched as never watched. `reco.ts`
   now sends each row's own `kind`. No backend change: the contract was always
   this, and the client was the half that was wrong.

## Contract mismatches fixed on 2026-11-02 (fifth round)

1. `Sticker.keywords` was typed `string[]`. The column is a `CharField` and
   `StickerSerializer` sends it as the comma-separated string it is stored as, so
   the type described something this server never sends. It is `string` now.
   Nothing read it until the sticker shelf's own search did.
2. The editor's audio sheet asked `/audio/tracks/` for `limit=100&page_size=100`
   and then walked `count` / `next` / `next_page`. `TrackListView`
   (`apps/audio/views.py:503`) has no cursor: it answers `{tracks, query}` and
   slices to `min(limit, 500)`, default 200. The walk therefore stopped after one
   page and the picker held 100 songs where the phone's holds 200. One ask for
   the server's own ceiling, and no paging.
3. `payload.sticker` was read as a string and drawn as text, so a real sticker
   from the phone rendered `"[object Object]"`. The phone sends an ordinary
   `text` line whose payload carries `{id, url, name}` (`_sendSticker`,
   `chat.dart`), and that is what this client now sends and draws. The invented
   `kind === "sticker"` was dropped: the app never sends that kind, and the web
   was using it to mark a row bare and then draw nothing in it.

## A third-party host this client now reads

`https://sticker.gaongram.in/api/stickers` is the shelf `app/lib/editor/stickers.dart`
reads first, before our own `/api/v1/stickers/`. It is **not** a Xelvic backend
route and it is not reached through our API:

- Public and token-free by design — no `Authorization` header is sent, and
  nothing of the session goes with the request.
- It answers `access-control-allow-origin: *` (measured 2026-11-02), so a browser
  can call it directly without a proxy, and its pictures are Cloudinary URLs that
  answer the same header, so the editor's canvas stays untainted.
- It is the *fallback* that matters if it ever goes away: a refusal is remembered
  for the session and every picker then reads our own `/api/v1/stickers/`, which
  is what the phone does too.

## Verification limits

No authenticated session against a running backend was executed in this
environment (no credentials and no local Postgres/Redis stack started). All
shapes above were verified statically against the read-only backend source;
runtime behaviour is marked unverified where applicable in
`XELVIC_TESTING_REPORT.md`.
## Contract mismatches fixed on 2026-11-02 (sixth round)

1. **The editor's sound sheet asked the wrong shelf.** It called
   `GET /audio/tracks/` with no `source`, and `TrackListView.get` keeps the
   catalogue on that path — its own docstring says so: "Omitting it keeps the
   catalogue, which is what this route has always answered." The catalogue is the
   songs and episodes the app shipped with; the sheet is for sounds somebody
   posted, which is the `source=drop` branch above it. Then, when that read came
   back empty, the sheet fell back to the Audio tab's `recent`/`podcasts`/`hero`,
   which is a third list again. The catalogue is small — `seed_audio.py` ships
   four songs and two episodes — so that path draws a short list of exactly the
   shape that was reported; which of the two lists a given short list came from
   cannot be told without the live database, but neither is the uploads shelf.
   The
   sheet now asks `source=drop`, in `src/features/audio/audioShelf.ts` (it was
   `src/features/camera/audioShelf.ts` until the sound code was lifted out of the
   camera on 2026-11-05), with
   `limit=60` — the phone's own `kPickerRows`
   (`app/lib/screens/audio_picker.dart`) — and there is no fallback.

   The two branches do not even cap the same way, which is the other half of why
   the lists differed in length:

   ```text
   source=drop      limit = max(1, min(<limit> or 60,  100))   sound_row(drop)
   no source        limit = max(1, min(<limit> or 200, 500))   services.rows(...)
   ```

2. **The bookmark on a sound posted to a route that does not exist.**
   `PhotoEditor.tsx` filed an uploaded sound with
   `POST /api/v1/drops/{id}/save/`, and there is **no `save` route anywhere under
   `apps/drops/`** — `apps/drops/urls.py` has none, and neither has any other
   urlconf. Every Save on an upload was a 404 wearing a success toast. The one
   write that puts anything on the shelf is `POST /saved/` with `{kind, id, on}`
   (`apps/saved/views.py`, id parsed as a UUID), which the web already had a store
   for — `src/store/saved.ts` and `hooks/useSaved.ts` — and which this file simply
   was not using. It uses it now. The catalogue-row path went to
   `/audio/tracks/{id}/like/`, which is the *heart* and not the shelf, and that
   whole dance (`likeCandidates`, `streamTrackId`, `streamDropId`, the candidate
   404-walking) is gone. So is `dropsService.save` itself, and the
   `DropSaveResponse` type it answered, with a comment left in their place: the
   editor was the last caller, and a `save` shaped exactly like `like` and `hide`
   is how the wrong address gets written twice.

3. **`Track` was missing three fields every row carries.** `TrackListView` and
   the weekly board put `source`, `artist_id` and `artist_avatar` on every row
   (`services.sound_row`, `services.rows`), and `src/types/api.ts` declared none of
   them. Without `source` the client cannot tell an upload from a catalogue track,
   which is exactly the question the bookmark has to answer: the app's
   `AudioTrack.savedKind` is `fromDrop ? 'drop' : 'track'`, and a row filed under
   the wrong one is a row the shelf's own read never finds.

**No endpoint was added, renamed or extended for this pass, and no backend file
was modified.** Reads performed: `apps/audio/urls.py`, `apps/audio/views.py`
(`TrackListView`, `AudioHomeView`, `TrendingView`, `BoardView`),
`apps/audio/services.py` (`sound_row`, `_board_row`, `uploads`, `catalogue`,
`home`, `trending`), `apps/saved/views.py`, `apps/drops/urls.py`.

## No contract change on 2026-11-02 (eighth round)

The eighth round fixed two client-side faults — the drops feed's two query
options objects drifting apart (the prefetcher's copy had no
`getNextPageParam`), and four overlays save/restoring `body.style.overflow`
instead of holding one counted lock. Neither touches an address, a field or a
response shape: the round read no backend file, added no endpoint and changed no
type in `src/types/api.ts`. The endpoint this pass does lean on —
`/drops/?seen=strict`, whose `next` cursor the page rule turns back into a
path — is the one recorded above.

## No contract change on 2026-11-02 (ninth round)

The ninth round repainted the camera's editor: every tool panel, every control on
one and the sticker sheet now draw on the theme's card and ink instead of a
hardcoded charcoal (`PANEL`/`CHIP`/`CHIP_OFF`/`CHIP_ON` in
`src/features/camera/PhotoEditor.tsx`), and `inkOn()` in `editorTypes.ts` picks
the ink for the pills painted in the colour they choose.

No address, field or response shape moved. The round **read no backend file**,
added no endpoint, and changed no type in `src/types/api.ts`. It did read one
mobile file for the comparison — `app/lib/screens/editor/image_editor.dart`, whose
`_chrome` makes every tool's sheet charcoal in every theme — and wrote nothing to
it. The divergence that comparison exposes is recorded in
`XELVIC_FEATURE_PARITY_MATRIX.md` and not here, because it is a design difference
between the two clients and not a difference in what either asks the server for.

## No contract change on 2026-11-03 (tenth round) — three routes newly read

The tenth round rebuilt the convo row's line, its unread count and the Spark a row
opens. No address, field or response shape moved: the backend is read-only and
was **written to nowhere**.

What the web began reading, all of it pre-existing and in use by the phone:

| Route | Used for | Shape taken |
| --- | --- | --- |
| `GET /api/v1/sparks/threads/<id>/` | the Spark sheet's fresh read | `spark` |
| `POST /api/v1/sparks/threads/<id>/off/` | the hide switch | `{off}` → `{spark_off, spark}` |
| `POST /api/v1/sparks/threads/<id>/restore/` | buying a broken run back | → `{spark, wallet: {balance, earned, spent, owned}}`; a 400 carries the server's own sentence |

Confirmed in `backend/apps/sparks/urls.py` and matched against the phone's own
requests in `app/lib/sparks.dart`. The client's axios `baseURL` is `/api/v1`, so
the paths above are the ones on the wire.

Two card fields the web already typed but had not used are now read, and one that
it did not type was added:

- `ThreadCard.unread_other_count` — the part of the count that is not an unread
  Spark; the Unread lane's membership reads it (`inUnreadLane`). Confirmed in
  `ThreadCardSerializer`'s `fields`.
- `ThreadCard.pinned` — the row's pin mark.
- `UserCard.birthday` — `MM-DD` on **every** user card, not only the convo row,
  from `UserCardSerializer.get_birthday` (which routes through
  `services.birthday_month_day`, and therefore through the owner's `show_dob`).
  The type in `src/types/api.ts` was missing it; nothing about the server
  changed.

`Spark`'s type gained the fields the sheet reads (`broken`, `offer`, `ladder`,
`hold_until`, `mine_last`, `theirs_last`, `mine_left`, `theirs_left`,
`timer_mine`, `timer_theirs`). Each is on the payload the phone already consumes
in `app/lib/sparks.dart`; none was invented here, and a payload without any of
them draws from what it does carry rather than guessing.

## No contract change on 2026-11-04 (eleventh round) — `POST /moments/` newly used by this path

The eleventh round drew the Spark sheet's "Add to Moments" pill and the composer
behind it. No address, field or response shape moved: the backend is read-only
and was **written to nowhere**.

The composer ends at two routes that both already existed and are both in use by
the phone's `postMomentNow`:

| Route | Used for | Shape taken |
| --- | --- | --- |
| `POST /api/v1/chat/assets/` (multipart) | the painted card, uploaded as an image asset | `{asset: {id, …}}`; the client sends `file`, `upload_id`, `kind`, and for an image the `width`/`height`/`thumb` it measured — `uploadAsset` in `utils/upload.ts`, unchanged by this round |
| `POST /api/v1/moments/` | the moment itself | `{items, audience, audience_users?}` — one item `{kind: "image", asset, mentions?: [id]}`, with `mentions` present only when the phone's two-step rule names somebody (the run's own `other`, else the one live run's `other`; nobody when two are alive, when the only run is hidden, or when the answer would be me) |

`PostItemSerializer` in `backend/apps/moments/serializers.py` also accepts
`sound`, `sound_start_ms` and `sound_end_ms` on an item — the three fields the
phone's sound row fills. **As of 2026-11-05 this client sends all three**, on the
same rules the phone's own write uses: `sound` is the asset id of the chosen
sound (a shelf row already carries one, and a row off the person's own device is
uploaded with `POST /api/v1/chat/assets/` first, exactly as `CameraCapture.postMoment`
does), `sound_start_ms` is where the part begins and `sound_end_ms` where it ends.
The two integers are computed by `features/audio/audioWindow.ts` and every path
out of the part chooser holds them inside the file's measured length — the
server bounds the start at `MAX_SOUND_START_MS` but does not check it against the
track's own length, on its own stated reasoning that a position is not a
duration, so keeping the window inside the file is this side's job. An item with
no sound chosen sends none of the three, which is the shape the phone sends when
no sound was chosen.

Nothing else was read from the backend this round: `serializers.py` was read for
those confirmations and written to nowhere.

## No contract change on 2026-11-04 (twelfth round) — and no request changed either

The twelfth round fixed the composer's card not being drawn: it awaited the app's
font and the two faces with no bound, so a media read that never answered held the
paint for ever. Both waits are now bounded (`FACE_PATIENCE_MS`, the phone's
`Faces.patience`; `FONT_PATIENCE_MS`).

The bound is on **waiting**, never on the request. The shared read is left
running — `utils/mediaCache.ts` keeps fetching for every other avatar on the
screen — so this round added no request, removed none, cancelled none, and
changed no header, timeout or body. `within()` is deliberately not
`AbortSignal.timeout`: aborting one card's read would have failed the same avatar
everywhere else in the app, and the whole point of the media cache is that one
tab asks once.

## No contract change on 2026-11-04 (thirteenth round) — and one request gained a header

The thirteenth round fixed what the twelfth left: the page said it could not draw
the card. A public avatar address comes back from `mediaCache.loadMedia`
**untouched** (it is not a path this API serves), so the painter drew a
cross-origin picture into its canvas without `crossOrigin`, the canvas was
tainted, and `toBlob` threw `SecurityError`.

The only request this changes is the browser's own `<img>` fetch for a face:
`faceImage` now sets `crossOrigin = "anonymous"` on any `http(s)` address. That
is an attribute on the element, not a change to a client request — no address,
body, response shape, timeout or header set by this code moved, and nothing was
written to the backend.

It does have a server-side consequence worth recording honestly: a host that
serves a picture **without** `access-control-allow-origin` will now fail to load
it as a face, where before it loaded and poisoned the canvas. The card treats
that as a face that did not come and draws initials, which is the only outcome
that still posts. Measured on a browser here: plain draw → tainted, `toBlob`
throws; the same URL with the attribute at a host sending
`access-control-allow-origin: *` → 588 clean bytes. Whether this API's avatar
hosts send the header could not be checked from here, and is the one open
question this round leaves — see the testing report's runtime status.

The one HTTP fact worth recording from it is not a change but a bound that
already existed and was relied on: a stalled media read in the app ends on the
axios client's own 120-second timeout (`REQUEST_TIMEOUT_MS`), doubled once by the
401 renewal in `config/axios.ts` — a minute-long window in which the card used to
show nothing at all.

## No contract change on 2026-11-05 (fourteenth round) — the four card looks

The fourteenth round redrew the four alternate Spark card styles to a design
sheet. It touched one file, `src/features/sparks/card.ts`, and its test.

**No request, address, body, header, timeout or response shape moved.** The card
is painted locally into a canvas and encoded to a `File`; the only network the
path touches is the same one it touched before — the media cache's own reads for
the two faces, and `uploadAsset` → `POST /moments/` when the composer posts. The
four looks change what is drawn into the canvas and nothing about how the bytes
leave it.

Four looks the phone does not have is a **client-side divergence, not a contract
divergence**: the backend has no notion of a card style, and nothing in this
round asks it to. `POST /moments/` receives the same PNG it always did.

## Calls on 2026-11-06 — three routes and seven socket actions newly used

The round that drew real audio and video calling on the web. No address, field
or response shape moved: the backend is read-only and was **written to nowhere**.

The relay's own address and the two call reads, all pre-existing and all in use
by the phone (`app/lib/calls.dart`, the state machine this port follows):

| Web call | Backend route | Source | Shape taken |
| --- | --- | --- | --- |
| `GET /api/v1/calls/ice/` | `path("ice/", IceConfigView)` | `apps/calls/urls.py:10`, `views.py:21` | `{iceServers: [...]}` — handed to `RTCPeerConnection` as it arrives. A missing or non-array value reads as `[]` rather than throwing: the browser's own default is then used, which is a call that may fail to connect, not a call that throws on the way in |
| `GET /api/v1/calls/history/` | `path("history/", CallHistoryView)` | `urls.py:12`, `views.py:64` | `CursorPage` of `services.log_row` rows — the convo tab's call lanes, unchanged by this round |
| `GET /api/v1/calls/<uuid>/` | `path("<uuid:pk>/", CallDetailView)` | `urls.py:13`, `views.py:37` | `{call: party, me: id}` — asked when a live call's socket comes back, so a page that slept through `call.joined` finds out who is here instead of guessing |

Confirmed against the consumer's own branches (`apps/chat/consumers.py:887-939`),
which is where a call actually lives. Every action the web sends is one of them,
and each takes exactly the keys the web sends:

| Socket action the web sends | Keys | Why |
| --- | --- | --- |
| `call.ring` | `{user, kind}` | a fresh call, or `kind: "video"` for one that starts with cameras on |
| `call.accept` | `{call}` | picking up |
| `call.decline` | `{call}` | turning a ring down |
| `call.leave` | `{call}` | hanging up, and the goodbye after a call ends elsewhere |
| `call.video` | `{call}` | the first camera goes on, which makes the call a video call |
| `call.signal` | `{call, to, data}` | every offer, answer and candidate |
| `call.pending` | — | asked the moment the socket comes up and on every return to the front |

`call.signal` is the one that matters most and the one with a bound worth
recording: `_call_relay` is fire-and-forget by the consumer's own comment — no
`call.ok`, because an offer is already on its way to the other phone — so the
web sends it with a bare `send` and **never waits for an ack it will not get**.
The only other thing that travels this way is `call.pending`, which is answered
by the ring frame itself or by silence, and is likewise sent without a `ref`.

Confirmations on the shapes the engine leans on:

- The refusal shape is the socket's ordinary one — `{"event": "error",
  "data": {"code", "message", "ref"}}` — and the web matches it by `ref` and
  turns `message` into the line under the title, so a refusal from the server is
  what the person reads rather than an invented one.
- `ring_seconds` rides on the party frame (`services.party`), and the web times
  the ring from it rather than from a constant of its own: both ends then give
  up on the same clock, which is the only way "No answer" can be true on both
  phones at once. `DEFAULT_RING_SECONDS = 45` is used only when the field is
  absent.
- `party.members[].name` / `.username` / `.avatar` are always present —
  `seat.user.name or seat.user.username` on the server — so the web types them
  as required and never draws a seat from a guessed name.
- `call.incoming` carries `from` and `added`, and both are read: `added` is what
  tells a fresh ring apart from a person being pulled into a call already
  running, which is drawn as a different line.

**Not used by this client:** `call.add` (nothing here starts a group call or
adds a third person) and `DELETE /calls/<id>/` (the history rows have no
remove). Both are recorded in the gaps list above rather than left implied.

**No endpoint was added, renamed or extended for this pass, and no backend file
was modified.** Reads performed: `apps/calls/urls.py`, `apps/calls/views.py`,
`apps/calls/services.py`, `apps/chat/consumers.py` (`call.*` branches),
`apps/chat/events.py` (`CALL_*`), `config/urls.py`.

## No contract change on 2026-11-06 (Round 18) — one server constant newly read

The round that added a ring, a call notice, camera quality, a new call layout and a
live room's sound. **No request, address, body, header, timeout or response shape
moved, and no endpoint was added, renamed or extended.** The backend is read-only
and was written to nowhere.

Four of the five additions never touch the network at all. The ring
(`src/features/calls/ring.ts`) plays a recording this build serves itself and, when
that will not play, writes a tone through the Web Audio API — no request. The
notice (`src/features/calls/notice.ts`, `public/call-sw.js`) uses the browser's own
`Notification` surface and a service worker that deliberately has no fetch handler
— no request. Camera quality (`src/features/calls/quality.ts`) reaches only
`getUserMedia`, `RTCPeerConnection.getStats` and `enumerateDevices` — no request.
The layout is `CallOverlay.tsx` alone — no request.

The room's sound is the one that could have been a contract change, and is not. A
room's stage is a `calls.Call` on the server, so it travels over the same relay an
ordinary call uses: the same socket actions, the same `call.signal` carry and the
same `GET /calls/ice/` for the relay's address. No room-specific route was needed,
and `spaces/urls.py` did not grow one.

One server constant is now relied on from the client rather than read:

| Client | Value | Source read | Note |
| --- | --- | --- | --- |
| `src/features/rooms/RoomSoundView.tsx` | `MEDIA_LISTENERS = 8` | `backend/apps/spaces/services.py` | the number of listeners the relay carries beside the stage. No route reports it, so this is a **client-side copy of a server constant** and will drift silently if the server's value moves — recorded here rather than left implied |

Confirmed by reading `backend/apps/spaces/services.py`, and nothing else: the
`room_row(..., media=True)` shape is the row the room page already asks for and
carries the stage's call; `_hears` is the membership rule the page's own limit line
mirrors; `_go_live` and `_sync_call` are the two writes that put the stage on the
relay. **Reads performed: `backend/apps/spaces/services.py`.** No backend file was
modified.

## No contract change on 2026-11-06 (Round 19) — one feed field newly read, two Vibe fields known but unread

The round that added a mirror control to a call's picture and a room's tile, made
a card's picture fit the screen, and wove Vibes into the feed. **No request,
address, body, header, timeout or response shape moved, and no endpoint was added,
renamed or extended.** The backend is read-only and was written to nowhere.

One field this client now reads that it did not before:

| Field | Where | What the web does with it |
| --- | --- | --- |
| `vibe_share` | the `GET /drops/` page (`apps/drops/services.py:feed_vibe_share`; 0.20 for a reader it knows, 0.40 for a cold start) | the share of a page of ten that the client weaves a Vibe into (`src/features/drops/mix.ts`, `src/pages/DropsPage.tsx`). Until this round the field was sent and ignored, so the feed never carried a Vibe. The client falls back to the app's 0.20 only until the first page carrying the field arrives |

Two fields a Vibe's own payload carries and this client still does **not** read,
both `NOT IMPLEMENTED` and both recorded under "Known backend capabilities the web
does not use yet" above:

- `recipe` — the edit document: the clips the Vibe names, the voiceover and music
  lanes, each clip's trim and speed, the overlays, the filter and the chosen frame
  shape. Sent by the server, read by nothing here, so a Vibe edited on the phone
  plays on the web as its **first clip alone**.
- `clip_urls` — the addresses of the uploads the `recipe` names. Sent and unread
  for the same reason: the walk draws the Vibe's own `asset` and nothing else.

The composer's own body is unchanged and still sends `{asset, caption, music,
mentions, sensitive}` to `POST /drops/vibes/`; `recipe`, `category`, `interests`
and `track_id` are accepted by the server and are never sent.

**Reads performed: `apps/drops/services.py` (`feed_vibe_share`).** No backend file
was modified.

## No contract change on 2026-11-06 (Round 20) — the Mirror button moved, and it touches no frame

The round that turned the Mirror button round — it now flips the pictures
*arriving* rather than this tab's own (`CallEngine.toggleRemoteMirror()`,
`Stage.toggleRemoteMirror()`), so `mirrored()` is the lens's answer alone.
**No request, address, body, header, timeout or response shape moved, and no
endpoint was added, renamed or extended.** The backend is read-only and was written
to nowhere, and nothing in the round reads a field it did not read before.

Worth stating in this report because it is the reason the button is safe to add:
the mirror is applied by `src/features/media/surfaces.tsx`'s `VideoSurface` as the
`-scale-x-100` class on a `<video>` element. **No `MediaStreamTrack` is ever
transformed and nothing is sent differently** — the SDP, the ICE traffic and the
media frames are exactly what they were. A mirror, therefore, is a per-tab display
choice with no protocol surface at all, which is also why one end cannot see
another end's setting and why the far end's camera-versus-screen distinction (a word
the call frames do not carry) is the one thing the button cannot respect.

**Reads performed: none beyond the round's own client code.** No backend file was
modified.

## No contract change on 2026-11-06 (Round 21) — a picture is measured on this side, not asked for

The round that fixed a shared screen cropped to its middle on a phone viewer and a
call with no way back from chat. **No request, address, body, header, timeout or
response shape moved, and no endpoint was added, renamed or extended.** The backend
is read-only and was written to nowhere.

It is worth recording *why* the client measures rather than asks. The clean answer
to "is this arriving stream a camera or a screen?" is a word in the call frame, and
there is none to read: `apps/calls/services.py`'s `check_signal` accepts only
`SIGNAL_TYPES` — `offer`, `answer` and `candidate` — so anything else is refused by
the relay, and no `calls/` route exposes a stream's kind either (`urls.py` carries
only `ice/`, `history/` and `<uuid:pk>/`). The fix therefore infers, in
`src/features/calls/model.ts`'s `sourceChanged(before, after)`: the video element's
own `resize` event reports the picture's height over width, and a shift of more
than 12 % is treated as a new source and returns the view to **Fit**. A camera and a
screen that are both 16:9 look identical to this rule, which is named where the rule
lives and again in `XELVIC_FEATURE_PARITY_MATRIX.md`.

The **Minimize** bar is likewise local: it renders the streams the engine already
holds and sends nothing. A reload still loses a live call, because rejoining would
need a route that lists an account's running calls and `call.pending` answers only
for rings; that is `NOT IMPLEMENTED`, not a protocol gap this round invented.

**Reads performed:** none beyond the round's own client code. No backend file was
modified.

### Round 22, same day — still nothing on the wire

The follow-up that let the minimized call window be dragged and docked
(`src/features/calls/minibar.ts`, `CallOverlay.tsx`) **moved no request, address,
body, header, timeout or response shape, and added, renamed and extended no
endpoint.** Where somebody parks a small window is a fact about one person's page:
it is sent nowhere, it reaches no server, and no other participant can observe it —
which is also why it is held in the component rather than in the engine.

**Reads performed:** none. No backend file was read or modified this round.

### Round 23, same day — nothing new on the wire, and a field that was already there

The voice note and the emoji work **moved no request, address, body, header, timeout or
response shape, and added, renamed and extended no endpoint.**

- A voice note goes out through the door a picture already uses: `POST /api/v1/chat/assets/`
  multipart, documented at the top of this report since it was written. The client adds
  `kind: "voice"` — a value the endpoint has always accepted, because the phone's own voice
  notes arrive that way — and then sends the message with the asset's id, which is the same
  two-step a picture takes.
- `duration_ms` and `waveform` are **fields this report already listed, not fields this round
  added**: `WaveformField` in `apps/chat/serializers.py` has accepted the waveform for as long
  as the phone has sent one, and `apps/chat/services.py` clamps each of at most 120 readings to
  −128…127 (`WaveformField`'s own docstring exists because a `ListField` under multipart
  arrives as a single JSON string, so this client sends the JSON form the same way). The web
  sends the same shape the phone does: `duration_ms` as the recording's own clock, and
  `waveform` as 0–100 integers, which is what `recording_controller.dart`'s `_appendAmplitude`
  produces on the phone (clamped reading × 100). Nothing about that range, count or meaning was
  negotiated here; it was read and followed.
- The emoji side touches the network only in the reader's browser: `fonts.gstatic.com` for a
  still or an animation, and nothing at all to this API. The picker's one round trip is the
  asset upload above; the table it draws from ships with the page. The last change of the round
  — one emoji drawn once, with the machine's own character faded out under Google's artwork —
  is a CSS opacity on a layer inside the component and **cannot reach the wire at all**: the
  same stills and the same animations are fetched from the same addresses as before it.
- The alternative resting sets that were built and then removed this round were, at every
  point, third-party artwork fetched by URL from the reader's browser. No endpoint, no proxy
  and no server-side fetch was ever added for them, which is why removing them left nothing
  behind on this side.

**Reads performed:** `backend/apps/chat/services.py`, `backend/apps/chat/serializers.py` and
`backend/apps/chat/models.py` were read to confirm the asset contract and the waveform's range
and ceiling. No backend file was modified. Nothing outside `xelvic-web/` was created, edited or
deleted.

### Round 24, same day — a kind that was already there, sent for the first time

The six-row composer menu **moved no request, address, body, header, timeout or response shape,
and added, renamed and extended no endpoint.** One row of it puts something new on the wire, and
that something is a message kind this API has always had:

- **`kind: "location"` goes out through the same door every other send uses** —
  `POST /api/v1/chat/threads/{id}/messages/send/`, documented at the top of this report — and is
  the phone's own kind: `Message.Kind.LOCATION` at `backend/apps/chat/models.py:562`, a member of
  `EMBED_KINDS` at `services.py:67` and **not** of `MEDIA_KINDS` at `services.py:65`. That is why
  no asset is uploaded and no `POST /chat/assets/` happens on this path: `services.py:1993` asks
  for an asset only for a media kind, and `services.py:1998` would refuse one for any other, so a
  location message must carry its content in `payload`. The web sends exactly that.
- **The payload's three keys are the phone's own spelling, not this round's invention.**
  `app/lib/place_probe.dart`'s `postOrigin()` builds `{'lat': …, 'lng': …, 'accuracy_m': …}` — one
  map, built in one place so *"no store learns what a coordinate is"* — and returns null, so no
  keys at all, when there is no fix. The web sends the same three names and omits `accuracy_m`
  when the browser promised no accuracy, which is the same shape by the same reasoning. What
  differs is the envelope, and honestly so: the phone spreads that map into a **post's** `origin`,
  because the phone's chat has no location row, while the web puts it in a **message's**
  `payload`, because the phone's chat has rendered that kind all along (`chatQuoteLocation`).
  `payload` is a free-form JSON field; nothing about it was renegotiated here.
- **The measured bodies**, recorded verbatim by the probe's stub before it answered, are in
  `XELVIC_TESTING_REPORT.md`, Round 24 — including the searched place, which carries **no
  `accuracy_m`** at all rather than a zero.
- **The other five rows touch the network in no new way.** *Photos and videos* and *File* open the
  two file pickers whose accept lists are the old single list cut in two, and reach
  `POST /chat/assets/` exactly as the composer always did; *Spark*, *Sticker* and *Emoji* are the
  camera, the shelf and the panel, all unchanged.
- **The place lookups are not this API and were not before this round.** Naming a position asks
  OpenStreetMap (Nominatim, with a BigDataCloud fallback) from the reader's browser, with no app
  token and no API base — the same calls `src/features/camera/CameraCapture.tsx` has made since it
  was written, moved into `src/utils/place.ts` and imported by both. No endpoint, proxy or
  server-side fetch was added for them.
- **`src/utils/place.ts` is a move**, so the camera's addresses, parameters and timeouts are the
  ones this round's sheet uses: nothing about the wire changed by that file being shared.

**Reads performed:** `backend/apps/chat/models.py` (the `LOCATION` kind) and
`backend/apps/chat/services.py` (`MEDIA_KINDS`, `EMBED_KINDS`, `send_message`'s asset rules) were
read to confirm that a location needs no asset and that its content travels in `payload`; and
`app/lib/place_probe.dart` for the phone's own key names. No backend file was modified. Nothing
outside `xelvic-web/` was created, edited or deleted.

### Round 25, same day — no new address, and four writes already known

**Nothing new on the wire.** The convo header's Vibes panel was rebuilt on the Drops walk's own
clip, and the walk's clip already spoke to every address it needs. Measured, not assumed: the
stub recorded these from the running page — every one of them a route this report has carried
since the Drops pass, and every one except the share row read off the wire rather than off the
source.

| Method and path | Body actually sent | Where it was already documented |
| --- | --- | --- |
| `GET /api/v1/drops/vibes/?limit=8` | — | The Vibes shelf, the same hand the Drops page walks. `dropsVibesQuery` → `dropsService.vibesFeed` → `VIBES_FEED_FIRST`. **No author, no following flag, no filter of any kind** |
| `POST /api/v1/drops/vibes/<id>/like/` | `{"on": true}` | The felt write, shared by the walk |
| `GET`/`POST /api/v1/drops/vibes/<id>/comments/` | `{"body": "from the vibes panel"}` | A post's own responds: read and write at the post's address. `commentTable` (`/drops/vibe-comments`) is only for editing, removing and liking a comment, and was not touched this round |
| `POST /api/v1/saved/` | `{"kind": "vibe", "id": "<id>", "on": true}` | The bookmark write, which answers `{saved}` — and the answer is what the client believes, which is why the stub's first `{ok: true}` rolled the glyph back and the stub, not the app, was wrong |
| `POST /api/v1/drops/vibes/<id>/share/` | — (none sent) | The share route, read from `drops.service.ts`. **Not measured this round**: the panel's Share opened the sheet and drew its rows, but nothing was picked inside it, so no body was posted |
| `POST /api/v1/reco/signals/` | `{"surface": "vibes", …}` with each clip and its position | The impressions report, sent once per opening, as the walk sends it once per hand |

**A read, and only a read, of the filter that answers the owner's third ask.** The complaint —
*"abhi usme kewal followers ka hi videos aa raha hai jabki sabhi ka aana chahiye"* — was checked
against the backend's own code rather than inferred from the screen. `visible_vibes` in
`backend/apps/drops/` is `Q(author=me) | Q(author__is_private=False) |
Q(author_id__in=following_ids(me))` plus the block, mute, hidden, age, country and language
filters, and the reco lanes sit behind switches that are off by default. **There is no
followers-only clause on the server and no author filter on the client.** No file in
`backend/` was created, edited or deleted, and no migration, setting or contract change was
made — the backend is read-only this round, as it has been throughout.

**Also confirmed by reading, not by guessing.** `Message.Kind.LOCATION`'s placement in
`EMBED_KINDS` and the comment route's split between a post's own address and
`commentTable` were re-read while wiring the panel; both were already documented in Round 24 and
in the Drops pass respectively, and neither changed.

**No contract change on 2026-11-12 (Round 25).** Nothing new was asked of the API, nothing that
was being sent stopped being sent, and no response shape was reinterpreted. The one thing this
round could have got wrong — believing a local toggle instead of the write's own answer — is the
thing the probe was built to catch, and it caught it in the probe.

### Round 26, same day — a third-party catalogue read for measurement, and no backend call at all

**Nothing on the wire from this client.** Round 26 changed two boxes and one drawing; it asked the
backend for nothing new and sent nothing different. The only network traffic it added was to a
**third-party service this report has carried since the sticker shelf was built**, and only to
measure it:

| Method and path | What it is | Where it was already documented |
| --- | --- | --- |
| `GET https://sticker.gaongram.in/api/stickers?limit=1000` | The sticker catalogue. Public, **no token**, `Access-Control-Allow-Origin: *` | The shelf in `src/services/stickers.service.ts`, and the composer's Sticker row |
| `GET <res.cloudinary.com>/.../f_auto,q_auto,w_512,c_limit/...` | A sticker's picture. Answers `content-type: image/png`, `cache-control: private, no-transform, immutable, max-age=2592000`, `access-control-allow-origin: *` | The same rows' `url` field, drawn unchanged |

**Read, and only read, and not by the client.** Ninety pictures were fetched **by the measuring
script** (`ink.mjs`, outside the repository) to read their alpha channels and find out where the
uneven sizes came from — not by the app, and not to change anything. The `access-control-allow-origin:
*` header is what makes that read possible at all; it is also why `StickerArt` can measure the ink
from the page, with a retry without `crossorigin` for any host that refuses.

**Nothing was sent, so nothing could be reinterpreted.** The URL stored on a row — including its
Cloudinary transform — is the URL that travels to the backend when a sticker is picked, which is why
Round 27 refused to ask for a smaller file: a cheaper download would have been a **different message**
on the backend's own field, not a different download.

**No contract change on 2026-11-12 (Round 26).** No backend address was added, removed or reshaped;
`backend/` was not read for this round beyond what earlier rounds had already established, and no
file in it was created, edited or deleted.

### Round 27, same day — the catalogue counted, and the same URL sent as before

**Nothing new on the wire, and one number confirmed.** Round 27 changed *when* the app asks for a
sticker's picture, not *what* it asks for. The catalogue and the pictures are the same third-party
addresses Round 26's section lists above; the difference is that the shelf now asks for **all 602** of
them a beat after it opens instead of only the sixteen the window can reach.

| | Round 26 and before | Round 27 |
| --- | --- | --- |
| Requests to the catalogue | 7 (`limit=100`, paged) | 7 — unchanged |
| Picture requests, first open | 76 | **602** (one per cell, measured: `asked` 602, `files` 602) |
| Bytes, cold cache | not measured | **26 MB**, `immutable, max-age=2592000` |
| What is sent to the backend when a sticker is picked | the row's own `url` | **the row's own `url`** — unchanged, transform and all |

**The count that settled the GIF question, read and not inferred.** `GET
https://sticker.gaongram.in/api/stickers?limit=100&offset=N` was paged through seven times and the
rows counted: **602 rows, 602 unique ids**, every row carrying `id, packId, url, tags, animated, pack,
match`, and **`animated: true` 0 of 602**. That is a fact about a third-party catalogue, recorded
here because a feature was declined on the strength of it — **no GIF section was built**, per the
owner's own *"agar nahi hai to leave it"*.

**Also confirmed, not assumed.** One picture was fetched directly for its headers
(`content-type: image/png`, `content-length: 52764`, `cache-control: private, no-transform,
immutable, max-age=2592000`, `access-control-allow-origin: *`), which is what makes a warm re-open
nearly free — measured at `files: 0, mb: 0`.

**No contract change on 2026-11-12 (Round 27).** Nothing that was being sent stopped being sent,
nothing new was asked of the backend, and no response shape was reinterpreted. `backend/` was not
read for this round, and no file in it was created, edited or deleted.

### Round 28, same day — one field that was always on the wire, read for the first time

**No new address, no new frame, and nothing newly asked of the backend.** Round 28 draws the
character that comes up over the composer while the other person writes. Both halves of that were
already on the wire, and the round changed neither:

| what | where it already was | changed this round |
| --- | --- | --- |
| The client saying it is writing | `{"action":"typing","thread":<id>,"typing":true\|false}` up the socket, `false` 2400 ms after the last keystroke | **No** |
| The server saying somebody else is | `{"event":"thread.typing","data":{"thread_id","user_id","typing","ttl"}}` down the socket — `services.typing`, with `ttl` from `RULES["TYPING_TTL_SECONDS"]` (**6** in `config/settings.py`, and the same number rides the `ready` frame as `typing_ttl`) | **No** |

**The one field this round began reading: `character` on the other participant's card.**
`UserCardSerializer` (`backend/apps/accounts/serializers.py`) has carried the Drip key on every card
all along — it is what the phone's `_peek` reads to decide **whose** figure to draw. The web's
`UserCard` type simply had not declared it, so nothing could read it. Declaring it is a type
correction against a response that was already arriving; **no request changed, and no response was
reinterpreted.** The value is resolved against the same `GET /catalogue/` the shop already reads, so
the figure's pictures come from the catalogue's own URLs rather than from a new endpoint.

**Read for this round and not changed.** `backend/apps/chat/consumers.py` (`action == "typing"`,
line 860; the `ready` frame's `typing_ttl`, line 667), `backend/apps/chat/services.py` (`def typing`
and the frame it group-sends, line 3148), `backend/apps/accounts/serializers.py`
(`UserCardSerializer`, `character` at line 216-218) and `backend/config/settings.py`
(`TYPING_TTL_SECONDS` at line 1458).

**No contract change on 2026-11-12 (Round 28).** No endpoint added, renamed, extended or removed; no
migration; no setting changed; no request body, header, timeout or response shape touched. Nothing
under `backend/` was created, edited or deleted.

**What is not verified on this wire.** The typing frames this round was measured against came from a
**loopback stub** that speaks the frame shape read out of the files above, not from the running
backend. So the shape is read and the drawing is measured, and a note typed by a **real** second
account has never been watched arriving.

### Round 29, same day — a whole frame family the web was not speaking

**Still no contract change, and this time the web is the thing that moved.** Round 29 stands the
phone's **second** character over the composer — `wait`, for somebody who is on one of my places and
not writing. That character is not fed by the typing mechanism: it is fed by **`focus`**, the gaze
family, which the web had no code for at all. The backend has had it throughout; the web simply never
said or read a word of it. So this is a **new frame family on the web's side of an unchanged
contract**.

| what | where it already was | changed |
| --- | --- | --- |
| The client saying where it is | `{"action":"focus","user":<id>,"kind":"chat"\|"profile","phase":"idle"}` up the socket — `ChatConsumer.receive_json`, `action == "focus"` → `_focus_said` | **Web now sends it** |
| The client asking who is looking at me | `{"action":"focus","users":[<id>,…]}` up the socket | **Web now sends it** |
| The client saying it is looking at nothing | `{"action":"focus","kind":"none"}` up the socket | **Web now sends it** |
| The server saying somebody else is | `{"event":"focus","data":{"user_id","kind","phase","direction"}}` down the socket — `events.FOCUS` (`apps/chat/events.py:560`), sent by `_focus_asked` (`consumers.py:737-752`) and `_focus_said` (`consumers.py:733-735`) | **Web now reads it** |
| The TTL | `focus_ttl` on the `ready` frame, from `RULES["FOCUS_TTL_SECONDS"]` — **30** (`config/settings.py:1553`, `consumers.py:668`) | Read as the same 30 on both sides; the web does not parse the frame for it |

**The ask is told apart by a key, not a flag, and the web had to match that exactly.** The backend's
own dispatch is `if "users" in content: _focus_asked(...) else: _focus_said(...)`
(`consumers.py:862-866`). An ask that carried no list would therefore be read as a **statement** about
a person, so `focusAskFrame` always builds the key even for an empty list, and the provider does not
send one at all when nobody is watched.

**The negative half is the half that matters, and the web reads it rather than assuming.** `focus_of`
(`apps/chat/services.py:1572`) answers **both ways round**: a partner with no live entry is reported as
`kind: "none"` rather than left out of the answer. The backend's own comment says why — a missing
answer was read as a reason to keep the last character, which is a character that never leaves the
screen after the other phone is killed (the 2026-10-11 report). The web's `lookOf` returns `null` for
`none`, **and for any `kind` this build does not know**, so a newer server naming a third place leaves
the screen quiet instead of inventing a character for it. Both cases are pinned in
`src/features/presence/looking.test.ts`.

**Two fields arrive that the web deliberately ignores.** `phase` is `"idle"` or `"moving"` and
`direction` is `"up"`, `"down"` or `null` (`consumers.py:490-496`). The web reads **`kind` only**. The
reason is that the web's character has two states and a rise and fall — a fact about a screen being
open — and the phone has never sent `moving` either: `focusSayFrame` writes `phase: "idle"` and no
`direction`, which is the phone's own sentence written out unchanged. Reading a field neither client
sends would be inventing behaviour, so it is named here as unread rather than drawn.

**Who may hear it is the backend's rule and not the web's.** `focus_of` returns entries only for
**direct partners** of the person asking, and only about them looking at something of *yours* — "a
frame that said X is on Y's profile would be a way of following a stranger around the app". The web
side has nothing to enforce here and does not pretend to; it asks about exactly the ids whose page it
has open, and draws only what comes back.

**The expiry is the server's thirty, held on both sides on purpose.** `services.focus_of`'s stored
entry "expires on its own, so a socket that goes away quietly stops being reported after
`FOCUS_TTL_SECONDS`". The web therefore refreshes its own word every 15 s
(`GAZE_REFRESH_MS`) and asks again every 15 s (`GAZE_RECHECK_MS`), and believes a fact for 30 s
(`GAZE_STALE_MS`, the same 30). The 15/30 ratio is asserted in a test: a genuine gaze is renewed by
every poll, so only two missed polls in a row can lose it. The phone reads `focus_ttl` from the
`ready` frame no more than the web does — the number is a constant on both sides — which is noted above
as a place where a backend change would not be followed.

**Read for this round and not changed.** `backend/apps/chat/consumers.py` (`receive_json`'s `focus`
branch at 862-866, `_focus_said` at 733-735, `_focus_asked` at 737-752, the module-level
`_focus_said` at 464-499, the `ready` frame's `focus_ttl` at 668), `backend/apps/chat/services.py`
(`focus_of` at 1572), `backend/apps/chat/events.py` (`FOCUS` at 560, `PRESENCE` at 555) and
`backend/config/settings.py` (`FOCUS_TTL_SECONDS` 30 at 1553, `TYPING_TTL_SECONDS` 6 at 1458,
`PRESENCE_TTL_SECONDS` 45 at 1457).

**No contract change on 2026-11-12 (Round 29).** No endpoint added, renamed, extended or removed; no
migration; no setting changed; no request body, header, timeout or response shape touched. The frames
the web now speaks are frames the backend **already had**. Nothing under `backend/` was created,
edited or deleted.

**What is not verified on this wire.** Every `focus` frame this round was measured against came from a
**loopback stub** that speaks the shape read out of the files above, not from the running backend. Two
live accounts looking at each other has **not** been watched, and the server's own 30-second lapse of a
peer who vanished without saying goodbye is exercised through unit tests and never through a real
vanished peer.

## A payload shape the client had wrong on 2026-11-12 (Round 30) — no contract change, but a bug worth recording here

**No request, address, body, header, timeout or response shape moved, and no endpoint was added,
renamed, extended or removed.** The backend is read-only and was written to nowhere. What belongs in
*this* report is a client-side misreading of a payload the backend has always sent, because the
misreading looked exactly like a contract question and was not one.

**The fact, read off the backend.** `_write_log` (`apps/calls/services.py`) closes a finished call with

```python
chat.system_note(thread, call.caller, body, {
    "call": str(call.pk), "media": call.kind, "outcome": outcome, "seconds": seconds,
})
```

and `chat.system_note` (`apps/chat/services.py`) writes a `Message.Kind.SYSTEM` row with
`payload=dict(payload, actor=…)`. So the payload on the wire is **one flat dictionary**:

```json
{"call": "<uuid string>", "media": "audio", "outcome": "ended", "seconds": 134, "actor": "…"}
```

`call` is a **string** uuid and `media`, `outcome` and `seconds` are its **siblings**. The bodies are
whole sentences already — `"Audio call · 2:14"`, `"Audio call declined"`, `"Missed audio call"`.

**What the web did with it.** `callNote()` read `message.payload.call` as an **object** and looked for
`media` inside it:

```ts
const raw = message.payload?.call;          // a string on every real payload
if (!raw || typeof raw !== "object") return null;
```

No server has ever sent that shape, so the guard never passed and **every call in every thread drew as
an ordinary bubble** — from the day the code was written until this round. It was proven, not reasoned:
a CDP dump of the message list printed `Missed audio call` and `Video call · 12:31` wearing the
bubble's own classes. The fix reads the payload flat, exactly as `callNoteOf`
(`app/lib/calls.dart:3758`) does: a Map check, `payload['call'] != null`, and `payload['media']` in
`{audio, video}` — all siblings. The dispatcher's order was already right and stayed right:
`chat.dart:8012-8030` checks `callNoteOf` **before** `kind == 'system'`, and so does the web.

**Two other fields of this contract, recorded because they were read and are easy to get wrong.**
`Message.Kind.SYSTEM` is what `system_note` writes — a call note is **not** `kind: "text"` — and the
asset serializer's field for a document's type is **`mime`**, not `mime_type`. Both were miswritten in
this round's own probe stub and both were caught by dumping the DOM rather than by reading the page,
which is the only reason they are written down here.

**What was read for this round and not changed.** `apps/calls/services.py` (`_write_log`, `_outcome`,
`_talked`, `_clock`), `apps/chat/services.py` (`system_note`), `apps/chat/serializers.py` (the asset
field at 39). Nothing under `backend/` was modified.

**No contract change on 2026-11-12 (Rounds 30 and 31).** No endpoint added, renamed, extended or
removed; no migration; no setting changed; no request body, header, timeout or response shape touched.
Round 31 sent nothing new at all: where a message's time is *read* is a question about a screen, and
the only clock involved is `created_at`, which every message response has always carried and which the
web formats with the viewer's own locale.

**What is not verified on this wire.** The call note's shape was verified against a **loopback stub**
and against the backend's source; a real call was neither placed nor received against a running server,
so a call note produced by the live backend has **not** been watched arriving. The asset field names
were likewise read from `serializers.py` and replayed through a stub.

### Round 32, same day — two asset fields that were always on the wire and had never been read

**No new address, no new frame, and nothing newly asked of the backend.** Round 32 draws the phone's
own voice-note bubble, and everything that bubble needs was already in the message the thread already
fetches:

- **`asset.waveform`** — the samples the phone's `AudioWaveform` shapes its bars from. The web carried
  the field in [api.ts](src/types/api.ts) and never drew it; the bubble now reads it through
  `boundedWaveform(asset.waveform, 56)`.
- **`asset.duration_ms`** — the length the readout shows before the file's metadata has landed, and
  the length a seek is measured against.

Neither is invented and neither is requested twice: a voice note arrives inside
`GET /chat/threads/{id}/messages/` exactly as it always did, and the player then fetches the bytes from
the `content_url` that message already named, through the same authenticated media door every other
attachment uses. `asset.available === false` and `asset.purged_at` are read for the expired line —
both were already on the serializer.

**What was read for this round and not changed.** `apps/chat/serializers.py` (the asset fields
`kind`, `mime`, `size`, `original_name`, `duration_ms`, `waveform`, `available`, `purged_at`,
`content_url`). Nothing under `backend/` was modified.

**No contract change on 2026-11-12 (Round 32).** No endpoint added, renamed, extended or removed; no
migration; no setting changed; no request body, header, timeout or response shape touched. The round is
a drawing change over fields the client was already being sent.

### Round 33, same day — one field decides which of two objects is drawn, and it was already there

**Still no contract change, and the interesting part is that none was needed.** The phone draws a
voice note and a sound file as two different things, and the fact that separates them is the message's
own `kind` — `voice` or `audio` — with `asset.kind` behind it as a fallback for a line that says
nothing useful. Both have always been in the payload. The web's `soundKind`
([sound.ts](src/features/convo/sound.ts)) is that read and nothing more:

```ts
if (message.kind === "voice" || message.kind === "audio") return message.kind;
const kind = message.asset?.kind;
return kind === "voice" || kind === "audio" ? kind : null;
```

A shared song is a third case and needs **no** field at all: it is an ordinary `kind: "text"` message
whose `payload.track` carries the track, which is what the phone reads (`chat.dart:8325`) and what the
web's `sharedTrack` reads. So the whole of Round 33 is a reading of fields that were already arriving —
`payload.track` (title, byline, `seed`, `seconds`, `cover`, `id`), `message.kind`, `asset.kind`,
`asset.original_name`, `asset.size` and `asset.mime` for the file card's details line.

**What the round did *not* do, and it is worth naming here because it is a wire question.** The
phone's file row is a `_MediaFrame` with transfer states (Pending, Uploading, Retry, Discard) driven by
the client's own upload queue. The web draws none of them; nothing on the wire was added to make them
possible, and nothing pretends they exist.

**What was read for this round and not changed.** `apps/chat/serializers.py` (the asset fields) and
`apps/chat/models.py` — `Attachment.waveform` is a `JSONField(default=list, blank=True)`, and
`Message.Kind` carries `VOICE = "voice"` and `AUDIO = "audio"` beside each other. Nothing under
`backend/` was modified.

**No contract change on 2026-11-12 (Round 33).** No endpoint added, renamed, extended or removed; no
migration; no setting changed; no request body, header, timeout or response shape touched. Round 33
sent nothing new on the wire at all.

**What is not verified on this wire.** Both rounds were read against a **loopback stub** with fixtures
built by hand; no voice note, sound file or song share was sent or received against a running backend,
so a real server's `waveform` (its length, its 0–100 scale, and whether a recording ever arrives with
it empty — the field is a `JSONField(default=list)`, so **empty and absent are not the same thing** on
this wire) has **not** been watched arriving. The `voice`/`audio` values of `message.kind` were read
from `Message.Kind` and replayed through a stub.

### Round 34, 2026-11-13 — a dozen group endpoints the web had never called

Nothing new was added to the contract. These were already registered in `apps/chat/urls.py` and are
what `app/lib/screens/group.dart` has been calling all along; the web simply had no surface that
reached them. Each was read in `views_groups.py`, `views_threads.py` and `services.py` before being
wired:

| Method and path | Body / query | Answers |
| --- | --- | --- |
| `PATCH /chat/threads/<pk>/group/` | `{title}` | `{thread}` |
| `POST /chat/threads/<pk>/avatar/` | multipart field `avatar` | `{thread}` |
| `DELETE /chat/threads/<pk>/avatar/` | — | `{thread}` |
| `GET/PATCH /chat/threads/<pk>/room/` | `{locked?, invites_on?}` | `{thread_id, locked, invites_on, channels}` |
| `GET/POST /chat/threads/<pk>/channels/` | `{name}` | `{channels}` / `{channel}` |
| `PATCH/DELETE /chat/threads/<pk>/channels/<cid>/` | `{name?, post?, media?}` | `{channel}` |
| `GET/POST /chat/threads/<pk>/invites/` | — | `{invites}` / an invite |
| `DELETE /chat/threads/<pk>/invites/<iid>/` | — | the invite, now off |
| `GET/POST /chat/threads/<pk>/members/` | `?q=` / `{users}` | `{members, shown, total, everyone, capped}` |
| `PATCH/DELETE /chat/threads/<pk>/members/<user_id>/` | `{role}` | `{thread}` |
| `POST /chat/threads/<pk>/leave/` | — | — |
| `POST /chat/threads/<pk>/delete/` | — | — |

**Two shapes the client had to be corrected to.** `Invite` was `{id, code, url}` in `types/api.ts` and
is really `{id, code, url, active, joined_count, revoked_at, created_at}` — `active` is the only honest
way to draw "this link still works", and a revoked link stays in the list. `Channel` was `{id, name,
position}` and also carries `post` (`everyone` | `admins`) and `media` (`any` | `photos` | `words`);
a rule write sends **both**, because sending one leaves the other where it was.

**One field the web had never read.** `UserCard.can_open` decides whether a roster row may open a
profile; absent means it may. Without it the panel would offer a profile link to a deactivated or
blocking account.

**Round 34 sent nothing new on the wire** — every one of these was already being sent by the phone.

### Round 35, 2026-11-13 — one boolean that turns a dead control into no control

`GET /chat/threads/<pk>/` returns a `gate`, and `chat_gate` in `apps/social/services.py` has put
`blocked_by_me` on it since the phone needed to tell the two sides of a block apart. The web read only
`gate.mode`, so a convo blocked **by the other person** drew the same "Unblock" as a convo blocked by
me. `blocked_by_me` is now read, and that row is not drawn when it is false.

**No request shape changed, and the alias is not on the wire at all** — it is `localStorage`, exactly as
it is shared_preferences on the phone. Nothing here was watched arriving from a live server.

## Round 36 — zero API surface change (2026-11-14)

No endpoint was added, changed, called differently or removed. The response interceptor, the refresh
road and the session store were read this round and left exactly as they were; the two `401`s on
`/api/v1/spaces/?shelf=live` that appeared alongside the crash are the `401`-then-refresh-then-retried
`401` shape the interceptor already documents, and they are **not** the crash: React's message is
`TypeError: Cannot read properties of null (reading 'useContext')`, which no HTTP status can produce.

The backend remains untouched — no endpoint, migration, setting or contract change — and
`git -C ../xelvic status` shows no `backend/` change from this round.

## Round 37 — zero API surface change (2026-11-14)

No endpoint was added, changed, called differently or removed, and no request or response shape moved.
This round rewrote CSS classes in the components that render them; nothing in `src/services/`, the
interceptors, the socket layer or the session store was touched, and no file under `src/api/` or
`src/constants/` was edited.

The backend remains untouched — no endpoint, migration, setting or contract change — and nothing under
`../xelvic/` was read or written this round.

## Round 38 — the skin PATCH, unchanged (2026-11-14)

No endpoint, request field, response field, header or error path changed. `chatService.skin(threadId,
patch)` still calls `PATCH /api/v1/chat/threads/{pk}/skin/` with `{wallpaper?, tint?}` and reads
`{wallpaper, tint}`; the sheet still sends one key at a time, and the tint keys are the server's
(`default`, `cyan`, `mint`, `amber`, `rose`, `magenta`).

Two things moved on the client side of that contract, both towards the phone's behaviour:

- **Order.** A chosen photo is saved locally first; `PATCH {wallpaper: "default"}` runs afterwards, and a
  failure is tolerant, because the server has no key for somebody's own picture and the picture is what
  the person asked for. This is `_chooseOwn` in `app/lib/screens/convo.dart`, followed as written.
- **The fallback catalogue's keys.** `FALLBACK_WALLS` used `xellom`, a key the server's `WALL_KEYS` does
  not have, so a thread whose catalogue had not arrived would have shown a swatch that the server refuses
  with a 400. It now carries `xelvic` and the phone's labels (`kWallNames`), so a fallback is always a key
  the server accepts.

No migration, model, setting or contract was touched, nothing under `backend/` was read or written, and
no request shape was invented to carry a photo — the photo stays in the browser, as it stays on the phone.

## Round 39 — zero API surface change (2026-11-14)

No endpoint, request field, response field, header or error path is involved. The emoji in a bubble are the
message's own text: an emoji is sent as an ordinary character, arrives as one, and the space this round adds
is drawn by the client and travels nowhere. No migration, model, setting or contract was touched and nothing
under `backend/` was read or written.

The phone's side is unchanged too: `app/lib/screens/chat.dart` was read for its sizing and counting rules
(`messageFontSize`, `emojiCount`, `_isEmojiCluster`) and for the `Text` that draws a body, and nothing in it
was modified.
