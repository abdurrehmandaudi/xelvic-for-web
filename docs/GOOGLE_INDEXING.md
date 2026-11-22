# Getting Xelvic into Google (and rich share cards)

This is the operational half of
[`PUBLIC_CONTENT_AND_SEO.md`](PUBLIC_CONTENT_AND_SEO.md). That document defines
what the pages and the API must provide; this one is the checklist for handing
the result to Google, Bing and the social crawlers.

The short version:

1. the public pages must actually render content for a signed-out visitor;
2. a sitemap must list the public URLs;
3. Search Console must be verified and the sitemap submitted;
4. social crawlers need **server-sent HTML**, not the React app.

## 0. Before anything is submitted

- [ ] The new build is deployed at `https://web.xelvic.com` (the currently live
      deployment is an older UI).
- [ ] The API serves anonymous GETs for public profiles, drops and vibes
      (`docs/PUBLIC_CONTENT_AND_SEO.md` §2). Until then every public page is a
      gate marked `noindex`, and Google will correctly decline to index it.
- [ ] `https://web.xelvic.com/robots.txt` is reachable and points at the
      sitemap.
- [ ] `https://web.xelvic.com/sitemap.xml` is reachable.
- [ ] A public profile, drop and vibe each render real content in a private
      browser window (not a lock), with the right `<title>`, description and
      canonical in the page source after rendering.

## 1. Google Search Console

### 1.1 Add the property

Use a **Domain property** for `xelvic.com` — it covers every subdomain and both
protocols.

1. [search.google.com/search-console](https://search.google.com/search-console)
2. Add property → **Domain** → `xelvic.com`
3. Google gives a DNS `TXT` record, e.g.
   `google-site-verification=…`
4. Add it at the DNS provider for `xelvic.com` and verify.

A **URL-prefix** property for `https://web.xelvic.com` also works if DNS access
is awkward. That method offers an HTML file; drop it into `public/` (it will be
served from the site root) and deploy.

### 1.2 Submit the sitemap

Search Console → **Sitemaps** → enter:

```
sitemap.xml
```

and submit. The full URL is
`https://web.xelvic.com/sitemap.xml`.

### 1.3 Ask for the first pages to be crawled

URL Inspection → paste one profile, one drop and one vibe → **Test live URL** →
**Request indexing**. This is rate-limited; do not paste hundreds by hand. The
sitemap is what covers the rest.

## 2. Building the sitemap

`public/sitemap.xml` is a static landing-page sitemap until the API can list
public content. The generator is ready:

```sh
# after the API exposes GET /api/v1/public/sitemap
SITEMAP_API="https://api.xelvic.com/api/v1/public/sitemap" npm run sitemap
```

or simply:

```sh
npm run sitemap
```

What it does (`scripts/generate-sitemap.mjs`):

- follows the contract `{ urls: [{ loc, lastmod }], next }` until `next` is
  null;
- keeps only `/u/…`, `/d/…`, `/v/…` and `/s/…` on the configured origin;
- drops app routes, query strings, fragments and foreign hosts;
- deduplicates and keeps the newest `lastmod`;
- writes `public/sitemap.xml`, or a sitemap **index** plus numbered files when
  there are more than 50,000 URLs (Google's limit);
- fails loudly instead of publishing a half-built sitemap.

Run it:

- after a deploy, from CI, or once a day by cron;
- **or** have the backend serve `/sitemap.xml` dynamically from the same public
  list — that is the better long-term answer for user-generated content.

Never put private, deleted, blocked or app-only URLs in a sitemap.

### 2.1 What makes a URL eligible

- it is publicly readable with no account;
- it answers `200`, not a redirect to the gate;
- its canonical is itself (not `/` and not `/app/...`);
- it is not `noindex`;
- its content is worth indexing (a post with words, a picture or a clip — not
  an empty shell).

## 3. Bing and IndexNow (optional, cheap)

Bing usually follows the same sitemap. IndexNow lets the server push changed
URLs immediately:

1. generate a key (a random hex string) and serve it at
   `https://web.xelvic.com/<key>.txt`;
2. `POST https://api.indexnow.org/indexnow` with `{host, key, keyLocation,
   urlList}` when public posts change.

This does not affect Google, but it gets new public posts into Bing/Yandex
faster.

## 4. Social shares are a different crawler

Facebook, WhatsApp, X, LinkedIn, Slack and iMessage do **not** run JavaScript.
They read the HTML the server sends. Adding tags from React does not reach them.

The fix is the small HTML injector in
[`PUBLIC_CONTENT_AND_SEO.md`](PUBLIC_CONTENT_AND_SEO.md) §3. Until it exists:

- a shared profile/post previews as the generic Xelvic card;
- Google may still work because it renders JavaScript, but slower and less
  reliably than with server-sent tags.

Check a link after the injector ships:

| Tool | What it shows |
| --- | --- |
| [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) | the card Facebook will render |
| [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) | the card LinkedIn will render |
| [X Card Validator](https://cards-dev.twitter.com/validator) | the card X will render |
| [Google Rich Results Test](https://search.google.com/test/rich-results) | JSON-LD the page exposes |

## 5. Reading the result

Search Console:

- **Pages** — why a URL is indexed or not. Common answers:
  - *Excluded by `noindex`* — the gate or `/app/` (correct);
  - *Blocked by robots.txt* — check the public prefix is allowed;
  - *Duplicate, Google chose a different canonical* — check the canonical tag;
  - *Crawled, currently not indexed* — thin or low-value content; add words,
    links and real media;
  - *Discovered, currently not indexed* — crawl budget; internal links and the
    sitemap help.
- **Sitemaps** — "Success" and the number of discovered URLs.
- **Enhancements / Rich results** — Person, VideoObject and SocialMediaPosting
  problems.
- **Performance** — the queries a name or product actually appears for.

Expect **days to weeks** for new user-generated pages. Nothing here guarantees
a ranking; public + crawlable + linked + useful is the whole recipe.

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Sitemap "couldn't fetch" | not deployed, or `robots.txt` blocks it | curl the URL; check the host |
| Public page says "login" to Google | API still 401 anonymously | §2 of the contract |
| Page indexed as `/app/...` | the app page won | share the public URL; canonical `/d/...` |
| Share card is the generic Xelvic mark | no server-side injector | §4 |
| `noindex` on a public profile | account `is_private: true` | expected |
| Sitemap lists old deleted posts | generator not rerun | cron/CI or dynamic endpoint |
| Google sees a skeleton | API slow / JS-only page | server-rendered meta + fast public reads |

## 7. Definition of done

- [ ] `npm run sitemap` produces a file with every public URL and no others.
- [ ] Search Console verified; sitemap submitted and "Success".
- [ ] A public profile, drop and vibe are **Indexed** with the public canonical.
- [ ] A private profile is **not** indexed and shows a lock.
- [ ] Facebook/LinkedIn/X debuggers show the real name, words and picture.
- [ ] `/app/*` and `/signin` never appear in the index.
