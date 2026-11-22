# Public content, search and share cards

The goal is the Instagram/Facebook behaviour: a profile, a drop or a vibe has a
link that opens without an account; a search engine or a chat app can describe
that link; a private account keeps its name and picture visible but hides its
shelf; and any write — like, comment, follow — sends the visitor to sign-in and
returns them to the same address afterwards.

This document is the contract between three pieces:

1. the **frontend** in this repository (implemented now);
2. the **Django API** (must change — §2);
3. the **HTML a crawler receives** (must change — §3).

The first and third are deliberately separate. A social crawler does not run
JavaScript; adding `<meta>` tags from React only helps a browser that has
already run the app. Facebook, WhatsApp, X, LinkedIn and iMessage read the HTML
the server sends.

## 1. The public addresses

| Content | Public address | Canonical | App address |
| --- | --- | --- | --- |
| Profile | `/u/:username` | same | `/app/u/:username` |
| Drop (text, photo, video, audio, poll) | `/d/:dropId` | same | `/app/drops/:dropId` |
| Vibe (short clip) | `/v/:vibeId` | same | — (feed opens it) |
| Shared playlist | `/s/:token` | same | — |

Rules:

- `/u/...`, `/d/...` and `/v/...` are outside the protected `/app` tree. They
  render for a signed-out visitor.
- A signed-in visitor opening `/d/...` is redirected into `/app/drops/...`; a
  profile goes to `/app/u/...`. A vibe has no single app route yet, so it is
  drawn publicly for both.
- Every write on a public page points at `/signin?next=<current address>`.
  `useQrSignIn` already validates `next` (must start with `/`, not `//`) and
  navigates there after the phone approves.
- `/app/*` is `noindex, nofollow` (set in `AppShell`). The public pages set
  `index` only when the server says the content is public.

## 2. The API contract

### 2.1 What exists today

All of these answer **401** without a token:

```
GET /api/v1/auth/users/{username}/
GET /api/v1/drops/users/{username}/
GET /api/v1/moments/users/{username}/
GET /api/v1/drops/{id}/
GET /api/v1/drops/vibes/{id}/
```

The only anonymous public read today is the shared-playlist token
(`/s/:token`). Until the endpoints above answer anonymous requests, the public
pages can only draw their sign-in gate; the frontend is ready for the data.

### 2.2 Anonymous GET

For an account, a drop and a vibe that may be public:

| Route | Anonymous answer |
| --- | --- |
| `GET /auth/users/{username}/` | `200` with `UserCard`/`Profile` minus private fields. A private account returns its name, avatar, bio and `is_private: true`; posts/counts and `can_view` stay hidden. Blocked/deactivated accounts answer `404`/`410`. |
| `GET /drops/users/{username}/` | `200` with only **public** drops. A private account answers `403` (or an empty page with `gate.view === false`), never a partial leak. |
| `GET /drops/{id}/` | `200` only when the drop is public **and** its author is public (or the drop has been explicitly made shareable). Otherwise `404` — not `403` — so a private id is not confirmed. |
| `GET /drops/vibes/{id}/` | same rule. |
| `GET /moments/users/{username}/` | **Not public by default.** Moments are ephemeral; open them only if the product decides so. |

Anonymous responses must not include:

- phone, email, date of birth, contacts, devices, insights;
- `following_count` (the current serializer already nulls it for other users);
- likes/comments/saves made by the viewer (there is no viewer);
- asset URLs that still require the account's Authorization header.

### 2.3 Visibility model

- Account: `is_private` (existing).
- Drop/Vibe: add an explicit `visibility` — `public`, `followers`, `private`.
  Default for new posts should be a product decision; the frontend reads the
  server's answer and never guesses.
- A public link to a `followers`/`private` post answers `404` anonymously.
- The mobile app's create/edit screen must offer the switch; otherwise the web
  cannot honestly promise "public".
- Blocked, deactivated and deleted accounts close their whole surface
  (`404`/`410`), which the frontend already treats as "not here".

### 2.4 Public media bytes

A crawler and a signed-out browser fetch `<img src>` and `<video src>` with no
`Authorization` header. For public posts:

- serve the bytes from a URL that needs no account (`/media/public/...` or a
  long-lived signed storage URL), with the same redirect behaviour;
- do not put a private file behind a public page's `og:image`;
- keep `Cache-Control` public and bounded; private media keeps `private,
  no-store`;
- keep CORS off the critical path for `<img>`; the app already fetches private
  media through its own origin.

### 2.5 Caching and abuse

- Anonymous GETs: `Cache-Control: public, max-age=60, stale-while-revalidate=300`
  on public pages' data, `private` on anything with a viewer.
- Rate-limit anonymous GETs per IP and per route; return `429` with
  `Retry-After` (the client already reads it).
- Do not let anonymous enumeration page through the whole corpus faster than a
  crawler should.

### 2.6 SEO fields the server may send

The frontend builders in `src/seo/pageMeta.ts` derive title, description, image,
robots and JSON-LD from the payload. They prefer, when present:

- `meta.title`, `meta.description`, `meta.image` — entity-authored overrides;
- `visibility`, `is_private`, `can_view` — to choose index vs noindex;
- `place`, `place_region`, `place_latitude`, `place_longitude` — geo meta;
- asset `thumbnail_url`/`content_url`, `width`, `height`, `duration_ms`.

If the backend sends an override object, both the client and the server-side
injector must use it, or the two will describe one page two ways.

## 3. The HTML a crawler sees

### 3.1 Why the SPA is not enough

`index.html` describes Xelvic, not the drop in the link. React replaces
`document.title` and the `<meta>` tags after the bundle runs. Google may run
that bundle; **the share sheets do not**, so a shared drop would always preview
as the generic Xelvic card.

### 3.2 What to deploy

A small server (Node/Express, Cloudflare Worker, or a Vercel/Netlify edge
function) in front of `dist/` that:

1. serves the static assets exactly as today;
2. for an HTML navigation to `/u/...`, `/d/...`, `/v/...`, `/s/...`:
   - calls the public API with a short timeout (300–500 ms);
   - builds the same `PageMeta` the frontend builds (title, description,
     canonical, robots, OG/Twitter, geo, JSON-LD);
   - injects those tags into the server-sent `index.html` before the bundle;
   - falls back to the gate metadata (`noindex, follow`) on 401/404/timeout;
3. sends `Vary: User-Agent` only if it serves different **body** to bots; the
   same HTML for everyone is simpler and safer (no cloaking);
4. caches the injected HTML for ~60 s keyed by path, with stale-while-revalidate;
5. optionally offers a `/og/:type/:id` image endpoint that renders a 1200×630
   card (the post's thumbnail plus the author's name), used as `og:image`.

The injector must **not** invent facts: if the API will not confirm a profile,
the page it sends is the gate, marked `noindex, follow`.

### 3.3 Crawler checks

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [X Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- Google Search Console → URL Inspection (live rendered HTML)

A card that shows the generic Xelvic image means the injector is not in front of
the HTML, or the API refused the anonymous read.

## 4. Sitemaps and search discovery

A browser cannot enumerate public content. Generate the sitemap where the data
lives:

```
GET /public/sitemap?cursor=...   →  { urls: [{ loc, lastmod }], next }
```

- include only public profiles, drops and vibes that the anonymous read would
  serve;
- `lastmod` from the entity's update time; cap each page (e.g. 50k URLs) and
  use a sitemap index;
- serve it at `/sitemap.xml` (or a sitemap index) and keep `robots.txt` pointing
  at it;
- ping Search Console/IndexNow when large batches change;
- do not include `/app/*`, `/signin`, API or media URLs.

Search-result pages (`/app/search`) stay `noindex`; public landing pages for a
tag or a product need a server-rendered page of their own, built from the
public search endpoint below.

### 4.1 Public search (product-by-name)

To make "search a product/name and see the post" work, the server needs a read
that does not require a viewer:

```
GET /public/search?q=<query>&type=profiles|posts|all&cursor=...
```

- returns only public profiles/posts; no private counts;
- rate-limited and cached (search answers are reused by many visitors);
- the web can render a public search landing page at `/search/:q` (server-side
  meta + a short list), while the app's own search stays private.

Google will not call this API. Discovery comes from the sitemap and from links
that public posts already have; the endpoint exists so a landing page can exist.

## 5. Privacy and safety rules

- Private accounts: name/avatar/bio may be shown, the shelf may not; the page
  is `noindex` and the server answers no posts. The frontend draws the lock.
- Exact coordinates are never published. A place name may be; coordinates only
  when the author chose to publish them.
- Blocked/deactivated/deleted accounts answer `404`/`410`; a gate must not
  confirm that a private id exists.
- Do not serve a private thing to a crawler while showing a lock to a person —
  that is both a leak and cloaking.
- Tokens stay out of URLs (`/u/...`, `/d/...`); the share token route `/s/...`
  is the one exception and is already designed for it.
- Logs must not contain private media URLs with credentials.

## 6. What is implemented in this repository

- `src/seo/` — `PageMeta` builders for sign-in, profiles, drops, vibes and gates;
  schema.org `Person`, `ProfilePage`, `SocialMediaPosting`, `VideoObject`,
  `BreadcrumbList`, `Organization`, `WebSite`; canonical URLs; OG/Twitter/geo
  tags; a hook that applies and replaces them per page.
- `index.html` — a complete default card for the landing page and a static
  Organization/WebSite graph.
- Public routes `/u/:username`, `/d/:dropId`, `/v/:vibeId`; signed-out visitors
  get the gate (or the content once the API allows anonymous reads), and every
  write points at `/signin?next=...`.
- `AppShell` marks the entire signed-in workspace `noindex, nofollow`.
- `robots.txt` and the static sitemap; the dynamic sitemap is §4.
- Tests for the metadata builders in `src/seo/pageMeta.test.ts`.

Not implemented here, because it belongs to the API and the deployment:

- anonymous public reads, visibility fields and public media URLs (§2);
- the HTML injector that social crawlers receive (§3);
- the dynamic sitemap and public search endpoint (§4);
- indexing itself — that is Google's decision after the above ships.
