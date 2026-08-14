# AutoSEO Blog Webhook — Design Spec

## Goal

Give AutoSEO (https://getautoseo.com) a webhook to push blog articles into this project. Articles render live at `https://sdhaulinganddemo.com/blog/{slug}/` on this same domain, replacing the recently-added `blog.sdhaulinganddemo.com` external-subdomain plan (which is being reverted as part of this work).

## Context / decisions already made

- Blog moves back onto this domain: `sdhaulinganddemo.com/blog/{slug}/`, served by this project.
- Site is live on **Vercel** (`vercel.json` is the real, committed deploy config; the root `wrangler.jsonc` is an untracked, unused leftover — out of scope, not touched).
- New backend: **Vercel Postgres** for data, **Vercel Blob** for re-hosted images. Both are native Vercel integrations the user will provision from their Vercel dashboard (I cannot create cloud accounts/resources myself).
- The 5 previously hand-written blog posts (deleted in the prior session) are **not** migrated into the new system. AutoSEO becomes the sole source of blog content going forward.
- Everything outside `/api/*` stays exactly as it is: hand-authored static HTML, no build step, no framework. This is a scoped, additive capability, not a platform migration.

## Architecture

Dynamic server-render per request, not static-file generation. `vercel.json` `rewrites` map clean `/blog/...` URLs to serverless functions under `/api/`, which query Postgres and return HTML/XML directly (template strings, no framework). This was chosen over having the webhook commit generated `.html` files via the GitHub API and trigger a redeploy — that alternative avoids needing a database at all, but requires storing a repo-write GitHub token in the function, has commit-race risk on rapid updates, and adds a 30-60s deploy lag before a post goes live. Direct DB-backed rendering is simpler and instant.

```
AutoSEO ──POST──▶ /api/autoseo-webhook.js ──▶ Vercel Postgres (blog_posts)
                                          └──▶ Vercel Blob (hero/infographic images)

Visitor ──GET /blog/──────────▶ rewrite ──▶ /api/blog-index.js    ──▶ reads blog_posts
Visitor ──GET /blog/{slug}/───▶ rewrite ──▶ /api/blog-post.js     ──▶ reads blog_posts
Google  ──GET /blog-sitemap.xml▶ rewrite ──▶ /api/blog-sitemap.js ──▶ reads blog_posts
```

## Data model

One new table, additive only. No existing table, column, row, or policy is touched.

```sql
CREATE TABLE IF NOT EXISTS blog_posts (
  id                      SERIAL PRIMARY KEY,
  autoseo_id              BIGINT UNIQUE NOT NULL,
  slug                    TEXT UNIQUE NOT NULL,
  title                   TEXT NOT NULL,
  meta_description        TEXT,
  meta_keywords           TEXT,
  keywords                TEXT[],
  content_html            TEXT NOT NULL,
  content_markdown        TEXT,
  hero_image_url          TEXT,              -- our re-hosted Vercel Blob URL
  hero_image_source_url   TEXT,              -- original AutoSEO URL, for audit/debug
  hero_image_alt          TEXT,
  infographic_image_url   TEXT,              -- our re-hosted Vercel Blob URL
  infographic_image_source_url TEXT,
  faq_schema              JSONB,
  language_code           TEXT NOT NULL DEFAULT 'en',
  source_article_id       BIGINT,            -- original article id, for translations
  status                  TEXT NOT NULL DEFAULT 'published',
  published_url_reported  TEXT,              -- published_url as AutoSEO sent it, informational only
  published_at            TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ,
  inserted_at              TIMESTAMPTZ NOT NULL DEFAULT now(),  -- first time we saw this article
  last_synced_at           TIMESTAMPTZ NOT NULL DEFAULT now()   -- bumped on every webhook delivery
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published ON blog_posts(status, published_at DESC);
```

`autoseo_id` is the upsert key (`ON CONFLICT (autoseo_id) DO UPDATE ...`) so both `article.published` and `article.updated` hit the same code path.

## `/api/autoseo-webhook.js`

1. Reject non-POST with 405.
2. Read the **raw request body bytes** (disable Vercel's automatic body parsing via `export const config = { api: { bodyParser: false } }`, collect the stream into a `Buffer` manually). This is required both for HMAC verification and to avoid re-serialization drift.
3. **Auth**: compare the `Authorization` header to `` `Bearer ${process.env.AUTOSEO_WEBHOOK_TOKEN}` `` using `crypto.timingSafeEqual` (length-check first so mismatched lengths don't throw). Missing/wrong → **401** `{"error":"unauthorized"}`. The token itself lives only in a Vercel environment variable, never in the repo.
4. **Optional HMAC check**: if `X-AutoSEO-Signature` is present, compute `HMAC-SHA256(rawBodyBuffer, AUTOSEO_WEBHOOK_TOKEN)` as hex and compare (constant-time) to the header. Present-but-wrong → **401**. Absent → skip (per spec, this check is optional).
5. `JSON.parse` the raw body. Parse failure → **400**.
6. Branch on `event`:
   - `"test"` → **200** `{"url": "https://sdhaulinganddemo.com/test"}`, no DB writes.
   - `"article.published"` / `"article.updated"` → proceed to step 7.
   - anything else/missing → **400** `{"error":"unknown event"}`.
7. For each of `heroImageUrl` / `infographicImageUrl` that's non-null: `fetch()` the source URL, and `put()` the bytes into Vercel Blob under `blog/{autoseo_id}/hero.<ext>` / `blog/{autoseo_id}/infographic.<ext>` (content-type from the response, extension inferred from it). Store the resulting Blob URL. **If a download/upload fails, the whole request fails → 500** (so AutoSEO retries the full delivery) rather than silently publishing without the image. This is a deliberate v1 simplification — a flaky image host blocks publish; revisit with a best-effort/placeholder fallback later if that turns out to matter in practice.
8. `UPSERT` all fields into `blog_posts` keyed on `autoseo_id`, setting `last_synced_at = now()`.
9. Build `publicUrl = https://sdhaulinganddemo.com/blog/${slug}/`.
10. **200** `{"url": publicUrl}`.
11. Steps 7-9 wrapped in try/catch → any exception logs server-side and returns **500** `{"error":"internal error"}`, satisfying the "return 500 so AutoSEO retries" requirement.

## `/api/blog-index.js`

`SELECT slug, title, meta_description, hero_image_url, hero_image_alt, published_at FROM blog_posts WHERE status='published' ORDER BY published_at DESC`. Renders a card grid matching the site's existing look (same nav/footer markup and dark-purple/lime theme the old hand-written `blog/index.html` used — pulled from git history as a styling reference, not restored as content). Each card links to `/blog/{slug}/`.

## `/api/blog-post.js`

Reads `slug` from the rewrite's query param. No match → **404** with a simple on-brand "not found" page (nav/footer intact), not a crash. On match, renders:
- `<title>`, meta description, canonical `https://sdhaulinganddemo.com/blog/{slug}/`, OG/Twitter tags (using the hero image).
- `BlogPosting` JSON-LD: headline, image, datePublished, dateModified, `author`/`publisher` referencing the existing canonical `https://sdhaulinganddemo.com/#business` `@id` (same reuse pattern as the rest of the site).
- `FAQPage` JSON-LD when `faq_schema` is present and non-empty — same shape used for the homepage/demolition FAQ schema added earlier this project.
- Breadcrumb: Home › Blog › {title}.
- Hero image up top with the real `hero_image_alt`; infographic image inline if present.
- `content_html` injected as the article body (trusted — authenticated, single-source content from AutoSEO; text fields we interpolate into attributes, like title/alt/description, are still HTML-escaped defensively).

## `/api/blog-sitemap.js`

Queries all `status='published'` posts and returns a `<urlset>` XML document with `<loc>`/`<lastmod>` per post. The hand-maintained root `sitemap.xml` cannot track DB-driven content, so blog URLs live in this separate, always-current sitemap instead.

## Config changes

**`vercel.json`**
- Remove the `/blog/:path*` → `blog.sdhaulinganddemo.com` redirect added in the prior session.
- Add `rewrites` (new top-level key, coexists with the existing `redirects`/`headers`):
  ```json
  "rewrites": [
    { "source": "/blog", "destination": "/api/blog-index" },
    { "source": "/blog/", "destination": "/api/blog-index" },
    { "source": "/blog-sitemap.xml", "destination": "/api/blog-sitemap" },
    { "source": "/blog/:slug", "destination": "/api/blog-post?slug=:slug" },
    { "source": "/blog/:slug/", "destination": "/api/blog-post?slug=:slug" }
  ]
  ```
  Exact routes listed before the `:slug` catch-all.

**`robots.txt`** — the `Sitemap: https://blog.sdhaulinganddemo.com/sitemap.xml` line added last session repoints to `Sitemap: https://sdhaulinganddemo.com/blog-sitemap.xml`.

**`package.json` (new, scoped to `/api`)** — `@vercel/postgres`, `@vercel/blob`. No bundler, no build config; Vercel installs and runs these as-is. Static pages are completely unaffected.

**Environment variables (set in Vercel dashboard, never committed)**:
- `AUTOSEO_WEBHOOK_TOKEN` = `aseo_wh_135ab3c0c44de996163b5bcc4d9a54b9`
- `POSTGRES_URL` / related — auto-injected by the Vercel Postgres integration
- `BLOB_READ_WRITE_TOKEN` — auto-injected by the Vercel Blob integration

## Reverting the subdomain move (38 pages + homepage schema)

- Global revert: `href="https://blog.sdhaulinganddemo.com/` → `href="/blog/` across every page (mirrors the forward migration done last session, in reverse).
- Homepage `SiteNavigationElement` JSON-LD `url` reverts to `https://sdhaulinganddemo.com/blog/`.
- **Two pages have deep links to specific posts that are not being migrated and would otherwise revert to dead URLs:**
  - `adu-demolition/index.html`: the sentence linking to "garage demolition for an ADU" and "ADU site prep checklist" (two specific ex-posts) is rewritten to link generically to `/blog/` instead of resurrecting those exact slugs.
  - `es/index.html`: the featured-posts teaser section names and links two specific ex-posts (with Spanish teaser copy written around their exact titles). That subsection is replaced with a simple generic "visit our blog" callout linking to `/blog/`, rather than keeping copy that promises specific articles that no longer exist.

## Testing

- Send a `"test"` event payload with a valid Bearer token → expect 200 and `{"url":".../test"}`, confirm no DB row created.
- Send a full `"article.published"` payload (including `faqSchema`, both image URLs) → expect 200 with the real slug URL; verify the row exists, images landed in Blob (not hotlinked), `/blog/{slug}/` renders with correct title/FAQ schema/images.
- Re-send the same payload as `"article.updated"` with changed `title` → expect the same row updated in place (row count unchanged), not a duplicate.
- Missing/wrong Bearer token → 401.
- Malformed JSON body → 400.
- Simulate an image-fetch failure (bad `heroImageUrl`) → 500, confirm no partial row was written (the upsert only happens after image handling succeeds).
- `/blog/` renders the index with all published posts; `/blog/some-nonexistent-slug/` renders 404, not a crash.
- `/blog-sitemap.xml` returns valid XML listing published posts; `robots.txt` points at it.

## Out of scope for this pass

- Migrating the 5 previously-deleted hand-written posts into the new table.
- Admin UI for editing/unpublishing posts (direct DB access only, for now).
- Non-English rendering/routing — `language_code` is stored but everything renders under `/blog/{slug}/` regardless of language until there's a concrete need to split it out.
- Sanitizing `content_html` beyond trusting it as authenticated AutoSEO output.
