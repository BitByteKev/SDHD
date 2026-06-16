# Google Reviews via Cloudflare Worker — Design

**Date:** 2026-06-15
**Status:** Approved (pending spec review)

## Goal

Replace the third-party `grwapi.net` (reviews-widgets.net) review widget with a
self-hosted solution that pulls live Google reviews through the Google Places API,
proxied by a Cloudflare Worker so the API key never reaches the browser. Reviews
render as on-page cards styled to match the site's dark purple/lime theme.

## Context

- Plain static site (hand-authored HTML/CSS/JS, no build pipeline). Pages load
  `script.min.js` / `styles.min.css`; sub-pages reference them with `../` paths.
- The widget currently appears on **three** pages, inside a styled
  "What Our Customers Are Saying" section (`section section-alt`):
  - `index.html`
  - `es/index.html`
  - `reviews/index.html`
- Current markup to replace:
  ```html
  <div class="review-widget_net" data-uuid="c63328f9-2ce0-4d7f-b2ac-f16d7ff619ef"
       data-template="16" data-lang="en" data-theme="light" data-filter="4"></div>
  ```
  plus the loader `<script src="https://grwapi.net/widget.min.js" async></script>`.
- User has a Cloudflare account. No Google Cloud project yet; Place ID unknown
  (will be looked up and confirmed during implementation).

## Constraints / known limitations (accepted)

- Google Places API (New) "Place Details" returns **at most 5 reviews**, and the
  caller **cannot choose which** — Google serves its "most relevant" set.
- Google's terms restrict how long review content may be cached → refresh **daily**.
- Ratings/reviews from Places API must **not** be injected into the site's own
  `LocalBusiness` / `AggregateRating` JSON-LD (violates Google structured-data
  policy; not eligible for star rich results; manual-action risk). Reviews are
  on-page social proof only. **Existing schema is left untouched.**
- Deployment is via the **Cloudflare dashboard (no CLI / no wrangler)**.

## Architecture

```
Google Places API ──(daily cron, server-side)──► Worker ──► Workers KV (JSON)
                                                    │
   Browser (3 pages) ──fetch()──► Worker URL ──► cached JSON ──► rendered cards
```

### Component 1 — Cloudflare Worker (`reviews-proxy`)

Single Worker with two entry points.

- **Scheduled handler (Cron Trigger, daily):**
  - Calls Places API (New) Place Details endpoint
    `https://places.googleapis.com/v1/places/{PLACE_ID}` with header
    `X-Goog-FieldMask: rating,userRatingCount,reviews,googleMapsUri`.
  - Normalizes into a compact payload (see Data shape) and writes it to KV under a
    fixed key (e.g. `reviews:latest`).
- **Fetch handler (on request):**
  - Reads `reviews:latest` from KV and returns it as JSON.
  - Sets `Access-Control-Allow-Origin: https://sdhaulinganddemo.com` (CORS lock).
  - Sets `Cache-Control: public, max-age=21600` (~6h) so edge/browser cache absorbs
    most traffic and Worker invocations stay minimal.
  - If KV is empty (e.g. before first cron run), it performs a one-time live fetch,
    populates KV, then returns it (self-healing first load).

**Bindings / config (set in dashboard):**
- KV namespace binding: `REVIEWS_KV`.
- Encrypted secret: `GOOGLE_PLACES_API_KEY`.
- Plain var: `PLACE_ID`.
- Cron Trigger: once daily.

**Data shape returned to the browser:**
```json
{
  "rating": 4.9,
  "total": 127,
  "mapsUri": "https://maps.google.com/...",
  "updated": "2026-06-15T09:00:00Z",
  "reviews": [
    { "name": "Jordan D.", "initials": "JD", "rating": 5,
      "text": "Fast, fair priced...", "time": "2026-03-02" }
  ]
}
```
(Author photo URLs are intentionally dropped — they expire and break.)

### Component 2 — Frontend renderer (`reviews.js` + `reviews.min.js`)

- New, self-contained file loaded **only on the 3 pages** (not added to the global
  `script.js`, to avoid running fetch on all ~30 pages). Root page uses
  `reviews.min.js`; sub-pages use `../reviews.min.js`.
- On load: find `#google-reviews`, read its `data-worker` URL, `fetch()` the JSON.
- Render:
  - **Rating header:** filled/empty stars for the average + count linked to the
    Google profile (`{total} Google reviews →`).
  - **Cards (≤5):** initials-avatar chip (lime/purple), reviewer name, star row,
    review text clamped to ~4 lines with a fade, relative date, small Google "G".
  - Reuse the `.review-card` class so the existing IntersectionObserver fade-in in
    `script.js` animates them natively.
- **Graceful degradation:** on fetch error or empty payload, replace the container
  contents with the existing "See our reviews on Google" CTA button. Mirrors the
  site's `if (el)` no-op convention.
- **No CLS:** container reserves a min-height while loading.
- Must be re-minified to `reviews.min.js` after edits (manual, per project convention).

### Component 3 — HTML edits (3 pages)

On `index.html`, `es/index.html`, `reviews/index.html`:
- Replace the `.review-widget_net` div with:
  ```html
  <div id="google-reviews" data-worker="https://reviews-proxy.<subdomain>.workers.dev"
       class="reviews-grid" aria-live="polite">
    <!-- populated by reviews.min.js; falls back to Google CTA on failure -->
  </div>
  ```
- Remove the `grwapi.net/widget.min.js` script tag.
- Add the `reviews.min.js` script tag (correct relative path per page).
- (Optional, deferred) `es/index.html` could request `languageCode=es` for
  translated reviews — out of scope for v1; same payload used everywhere.

### Component 4 — Styles

- Add review-card / rating-header / initials-avatar rules to `styles.css` using
  existing CSS custom properties only (no new colors).
- Re-minify to `styles.min.css` (per project convention).

## User-performed setup (documented in implementation plan)

1. **Google Cloud:** create project → enable **Places API (New)** → enable billing →
   create API key → restrict key to Places API.
2. **Place ID:** assistant looks it up from business name/site; user confirms.
3. **Cloudflare dashboard:** create Worker, paste code, create+bind KV namespace,
   add `GOOGLE_PLACES_API_KEY` secret + `PLACE_ID` var, set daily Cron Trigger,
   copy the `*.workers.dev` URL into the HTML `data-worker` attribute.

## Out of scope (YAGNI)

- Injecting ratings into JSON-LD schema (policy risk — explicitly excluded).
- Author profile photos.
- Spanish-translated reviews on `/es/`.
- Yelp / multi-source aggregation (Places API = Google only).
- Carousel/slider UI.

## Testing / verification

- Worker: hit the `*.workers.dev` URL directly → returns valid JSON with CORS header.
- Cron: trigger manually once in dashboard → confirm KV key populated.
- Pages: `python3 -m http.server 8765` local preview → cards render; simulate
  fetch failure (bad URL) → CTA fallback appears; check no layout shift.
- `node --check reviews.js reviews.min.js`.
