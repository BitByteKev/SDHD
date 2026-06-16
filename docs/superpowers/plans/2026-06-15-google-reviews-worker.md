# Google Reviews via Cloudflare Worker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `grwapi.net` review widget with live Google reviews pulled through a Cloudflare Worker (API key hidden server-side), rendered as on-page cards on the home, Spanish, and reviews pages.

**Architecture:** A Cloudflare Worker calls the Google Places API (New) once daily via a Cron Trigger, caches the normalized result in Workers KV, and serves it as CORS-locked JSON. A small `reviews.js` on three pages fetches that JSON and renders a rating header + up to five review cards, falling back to a "See us on Google" CTA on any error.

**Tech Stack:** Vanilla JS (no framework/build), Cloudflare Workers + KV (deployed via dashboard, no CLI), Google Places API (New).

**Testing reality:** This repo has **no unit-test runner**. Verification uses the project's established sanity checks — `node --check` for JS, `python3 -m http.server 8765` for local preview, and `curl` against the deployed Worker. Steps below reflect that; there are no `pytest`/`jest` invocations.

**Reference spec:** `docs/superpowers/specs/2026-06-15-google-reviews-worker-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `worker/reviews-proxy.js` | Worker source (version-controlled copy of what gets pasted into the CF dashboard) | Create |
| `reviews.js` | Browser renderer: fetch JSON, build rating header + cards, fallback on error | Create |
| `reviews.min.js` | Minified renderer (what pages load) | Create |
| `styles.css` | Add `.gr-*` review styles using existing tokens | Modify |
| `styles.min.css` | Re-minified styles (what pages load) | Modify |
| `index.html` | Swap widget → `#google-reviews`, drop grwapi script, add reviews.min.js | Modify |
| `es/index.html` | Same swap (sub-page relative paths) | Modify |
| `reviews/index.html` | Same swap (sub-page relative paths) | Modify |

**Design note (why `.gr-card` is self-contained):** `script.js`'s IntersectionObserver and 3D-tilt only attach to elements present at DOM load. Our cards are injected after `fetch()`, so they will not receive the `.fade-in` hide class or tilt handlers. We therefore reuse `.review-card` for the base look (safe — it has no hidden state) and add an independent CSS entrance animation on `.gr-card`.

---

## Task 1: Look up and confirm the Google Place ID

**Files:** none (produces a value used in Task 3).

- [ ] **Step 1: Find the Place ID**

The business is "San Diego Hauling & Demo", sdhaulinganddemo.com, San Diego, CA 92115, phone (619) 841-4193. Find its Google Place ID using either:
- Google's Place ID Finder: `https://developers.google.com/maps/documentation/places/web-service/place-id` (search the business name on the embedded map), **or**
- A Places API Text Search once the key from Task 2 exists:
  ```bash
  curl -s -X POST 'https://places.googleapis.com/v1/places:searchText' \
    -H 'Content-Type: application/json' \
    -H 'X-Goog-Api-Key: YOUR_KEY' \
    -H 'X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress' \
    -d '{"textQuery":"San Diego Hauling & Demo San Diego CA"}'
  ```
  Expected: a JSON array; the matching `places[].id` (a string like `ChIJ...`) is the Place ID.

- [ ] **Step 2: Confirm with the user**

Show the matched name + address to the user and confirm it is the correct listing before using the ID. Record the confirmed Place ID for Task 2/3.

---

## Task 2: User sets up Google Cloud (guided)

**Files:** none (external, performed by the user with these instructions).

- [ ] **Step 1: Provide the click-by-click Google Cloud steps to the user**

Give the user exactly this checklist:
1. Go to `https://console.cloud.google.com/` → create a new project (e.g. "sdhaul-reviews").
2. APIs & Services → **Library** → search "Places API (New)" → **Enable**.
3. Billing → link a billing account (card required; usage stays within Google's free monthly credit at ~30 calls/month).
4. APIs & Services → **Credentials** → Create credentials → **API key**. Copy it.
5. Edit the key → **API restrictions** → restrict to "Places API (New)". Save.
   (Leave application restrictions unset for now — the key is only ever used server-side from the Worker, never exposed.)

- [ ] **Step 2: Collect the API key**

Have the user paste the key back (or hold it for the dashboard step in Task 6). Do **not** write the key into any committed file.

---

## Task 3: Write the Worker source

**Files:**
- Create: `worker/reviews-proxy.js`

- [ ] **Step 1: Create the Worker file**

Create `worker/reviews-proxy.js` with the complete implementation:

```js
// reviews-proxy — fetches Google Places reviews server-side, caches in KV,
// serves CORS-locked JSON to sdhaulinganddemo.com.
// Bindings (set in Cloudflare dashboard):
//   KV namespace: REVIEWS_KV
//   Secret:       GOOGLE_PLACES_API_KEY
//   Var:          PLACE_ID
// Cron Trigger: once daily.

const KV_KEY = 'reviews:latest';
const ALLOWED_ORIGIN = 'https://sdhaulinganddemo.com';

function initials(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(function (w) { return w[0].toUpperCase(); })
    .join('');
}

function normalize(data) {
  const reviews = (data.reviews || []).slice(0, 5).map(function (r) {
    const name =
      (r.authorAttribution && r.authorAttribution.displayName) || 'Google user';
    const text =
      (r.text && r.text.text) ||
      (r.originalText && r.originalText.text) ||
      '';
    return {
      name: name,
      initials: initials(name),
      rating: r.rating || 0,
      text: text,
      time: r.publishTime || '',
    };
  });
  return {
    rating: data.rating || 0,
    total: data.userRatingCount || 0,
    mapsUri: data.googleMapsUri || '',
    updated: new Date().toISOString(),
    reviews: reviews,
  };
}

async function fetchFromGoogle(env) {
  const url = 'https://places.googleapis.com/v1/places/' + env.PLACE_ID;
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'rating,userRatingCount,reviews,googleMapsUri',
    },
  });
  if (!res.ok) throw new Error('Places API ' + res.status);
  return normalize(await res.json());
}

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Cache-Control': 'public, max-age=21600',
      'Content-Type': 'application/json',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    let payload = await env.REVIEWS_KV.get(KV_KEY);
    if (!payload) {
      try {
        payload = JSON.stringify(await fetchFromGoogle(env));
        await env.REVIEWS_KV.put(KV_KEY, payload);
      } catch (e) {
        return new Response(JSON.stringify({ error: 'unavailable' }), {
          status: 502,
          headers: cors,
        });
      }
    }
    return new Response(payload, { headers: cors });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async function () {
        const data = await fetchFromGoogle(env);
        await env.REVIEWS_KV.put(KV_KEY, JSON.stringify(data));
      })()
    );
  },
};
```

- [ ] **Step 2: Syntax-check the Worker source**

Run: `node --check worker/reviews-proxy.js`
Expected: no output, exit 0. (Note: `node --check` validates syntax; `export default` parses fine as an ES module.)

- [ ] **Step 3: Commit**

```bash
git add worker/reviews-proxy.js
git commit -m "feat: add Cloudflare Worker source for Google reviews proxy"
```

---

## Task 4: Write the browser renderer (`reviews.js`)

**Files:**
- Create: `reviews.js`

- [ ] **Step 1: Create `reviews.js`**

```js
(function () {
  var el = document.getElementById('google-reviews');
  if (!el) return;

  var workerUrl = el.getAttribute('data-worker');
  var googleUrl = 'http://google.com/localservices/review/sandiego619';

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function stars(n) {
    var full = Math.round(n || 0);
    var out = '';
    for (var i = 1; i <= 5; i++) {
      out += '<span class="gr-star' + (i <= full ? ' gr-star-on' : '') + '">★</span>';
    }
    return out;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  function fallback() {
    el.innerHTML =
      '<div class="gr-fallback"><a class="btn btn-primary btn-lg" target="_blank" ' +
      'rel="noopener" href="' + googleUrl + '">★ See our reviews on Google</a></div>';
  }

  if (!workerUrl) { fallback(); return; }

  fetch(workerUrl)
    .then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); })
    .then(function (data) {
      if (!data || !data.reviews || !data.reviews.length) { fallback(); return; }
      var maps = data.mapsUri || googleUrl;

      var header =
        '<div class="gr-header">' +
        '<span class="gr-avg">' + (data.rating || 0).toFixed(1) + '</span>' +
        '<span class="gr-stars">' + stars(data.rating) + '</span>' +
        '<a class="gr-count" href="' + escapeHtml(maps) + '" target="_blank" ' +
        'rel="noopener">' + (data.total || 0) + ' Google reviews →</a>' +
        '</div>';

      var cards = data.reviews.map(function (rev, i) {
        return '<article class="review-card gr-card" style="animation-delay:' +
          (i * 0.08) + 's">' +
          '<div class="gr-card-top">' +
          '<span class="gr-avatar">' + escapeHtml(rev.initials || '?') + '</span>' +
          '<div class="gr-meta">' +
          '<span class="gr-name">' + escapeHtml(rev.name) + '</span>' +
          '<span class="gr-stars gr-stars-sm">' + stars(rev.rating) + '</span>' +
          '</div>' +
          '<span class="gr-g" title="Google review">G</span>' +
          '</div>' +
          '<p class="gr-text">' + escapeHtml(rev.text) + '</p>' +
          '<span class="gr-date">' + escapeHtml(fmtDate(rev.time)) + '</span>' +
          '</article>';
      }).join('');

      el.innerHTML = header + '<div class="gr-grid">' + cards + '</div>';
    })
    .catch(fallback);
})();
```

- [ ] **Step 2: Syntax-check**

Run: `node --check reviews.js`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add reviews.js
git commit -m "feat: add Google reviews renderer (reviews.js)"
```

---

## Task 5: Add styles and minify both JS + CSS

**Files:**
- Modify: `styles.css` (append a new block)
- Create: `reviews.min.js`
- Modify: `styles.min.css`

- [ ] **Step 1: Append review styles to `styles.css`**

Add at the end of `styles.css`:

```css
/* ---- Google reviews (Worker-fed) ---- */
#google-reviews { min-height: 320px; }

.gr-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 32px;
}
.gr-avg {
  font-family: var(--font-heading);
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1;
}
.gr-stars { letter-spacing: 2px; color: var(--color-border); }
.gr-star-on { color: var(--color-accent); }
.gr-stars-sm { font-size: 0.9rem; }
.gr-count {
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
  border-bottom: 2px solid var(--color-accent);
}
.gr-count:hover { color: var(--color-primary); }

.gr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}

.gr-card {
  display: flex;
  flex-direction: column;
  opacity: 0;
  animation: gr-rise 0.5s ease forwards;
}
@keyframes gr-rise {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .gr-card { opacity: 1; animation: none; }
}

.gr-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.gr-avatar {
  display: grid;
  place-items: center;
  width: 44px; height: 44px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-family: var(--font-heading);
  font-weight: 700;
  flex-shrink: 0;
}
.gr-meta { display: flex; flex-direction: column; gap: 2px; }
.gr-name { font-weight: 700; color: var(--color-text); }
.gr-g {
  margin-left: auto;
  display: grid;
  place-items: center;
  width: 26px; height: 26px;
  border-radius: 50%;
  background: var(--color-bg-alt);
  font-family: var(--font-heading);
  font-weight: 700;
  color: var(--color-primary);
  flex-shrink: 0;
}
.gr-text {
  color: var(--color-text-muted);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0 0 14px;
}
.gr-date { font-size: 0.85rem; color: var(--color-text-muted); margin-top: auto; }

.gr-fallback { text-align: center; padding: 24px 0; }
```

- [ ] **Step 2: Re-minify CSS**

Run: `npx --yes clean-css-cli -o styles.min.css styles.css`
Expected: `styles.min.css` regenerated, exit 0. Confirm with `grep -c "gr-card" styles.min.css` → returns ≥ 1.

- [ ] **Step 3: Create `reviews.min.js`**

Minify `reviews.js`. Use terser:
Run: `npx --yes terser reviews.js -c -m -o reviews.min.js`
Expected: `reviews.min.js` created.
Then verify: `node --check reviews.min.js` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add styles.css styles.min.css reviews.min.js
git commit -m "feat: add Google reviews styles and minified renderer"
```

---

## Task 6: User deploys the Worker via Cloudflare dashboard (guided)

**Files:** none (external, performed by the user).

- [ ] **Step 1: Provide the dashboard checklist to the user**

Give the user exactly this:
1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Create Worker**. Name it `reviews-proxy`. Deploy the placeholder, then **Edit code**.
2. Paste the entire contents of `worker/reviews-proxy.js`, then **Deploy**.
3. **Storage & Databases → KV** → **Create namespace** named `reviews-kv`.
4. Back in the Worker → **Settings → Bindings → Add → KV namespace**: Variable name `REVIEWS_KV`, select `reviews-kv`. Save.
5. Worker → **Settings → Variables and Secrets**:
   - Add **Secret** `GOOGLE_PLACES_API_KEY` = the Google key from Task 2.
   - Add **Text** variable `PLACE_ID` = the confirmed Place ID from Task 1.
6. Worker → **Settings → Triggers → Cron Triggers → Add**: schedule `0 9 * * *` (daily 09:00 UTC).
7. Copy the Worker URL (e.g. `https://reviews-proxy.<your-subdomain>.workers.dev`).

- [ ] **Step 2: Verify the Worker responds**

Run (substituting the real URL):
```bash
curl -s https://reviews-proxy.<subdomain>.workers.dev | head -c 400
```
Expected: JSON containing `"rating"`, `"total"`, and a `"reviews"` array (first request self-populates KV from Google). If it returns `{"error":"unavailable"}`, the API key/Place ID/billing is wrong — recheck Task 2.

- [ ] **Step 3: Record the Worker URL**

Note the confirmed URL for Task 7's `data-worker` attribute.

---

## Task 7: Wire the three pages

**Files:**
- Modify: `index.html`
- Modify: `es/index.html`
- Modify: `reviews/index.html`

For each file, the widget div looks like:
```html
<div class="review-widget_net" data-uuid="c63328f9-2ce0-4d7f-b2ac-f16d7ff619ef" data-template="16" data-lang="en" data-theme="light" data-filter="4"></div>
```

- [ ] **Step 1: Replace the widget div in `index.html`**

Replace the `.review-widget_net` div with (root page → bare worker URL is fine; use the real URL from Task 6):
```html
<div id="google-reviews" data-worker="https://reviews-proxy.SUBDOMAIN.workers.dev" aria-live="polite">
  <noscript><a class="btn btn-primary btn-lg" target="_blank" rel="noopener" href="http://google.com/localservices/review/sandiego619">★ See our reviews on Google</a></noscript>
</div>
```

- [ ] **Step 2: Remove the grwapi loader and add the renderer in `index.html`**

Remove:
```html
<script type="text/javascript" src="https://grwapi.net/widget.min.js" async></script>
```
Add near the existing `script.min.js` tag (root page uses bare path):
```html
<script src="reviews.min.js" defer></script>
```

- [ ] **Step 3: Repeat for `es/index.html`** — same div replacement (Step 1), and the script uses the sub-page relative path:
```html
<script src="../reviews.min.js" defer></script>
```
Remove the grwapi loader there too.

- [ ] **Step 4: Repeat for `reviews/index.html`** — same div replacement (Step 1), sub-page script path:
```html
<script src="../reviews.min.js" defer></script>
```
Remove the grwapi loader there too.

- [ ] **Step 5: Confirm no stale references remain**

Run: `grep -rn "grwapi\|review-widget_net" index.html es/index.html reviews/index.html`
Expected: no output (all three cleaned). (The `.audit/` and `.claude/worktrees/` copies are intentionally left alone.)

- [ ] **Step 6: Commit**

```bash
git add index.html es/index.html reviews/index.html
git commit -m "feat: replace grwapi widget with Worker-fed Google reviews on home, es, reviews pages"
```

---

## Task 8: Verify end-to-end locally

**Files:** none.

- [ ] **Step 1: Serve the site**

Run: `python3 -m http.server 8765`

- [ ] **Step 2: Check each page in a browser**

Visit `http://localhost:8765/`, `http://localhost:8765/es/`, `http://localhost:8765/reviews/`. On each, confirm:
- The rating header (average + stars + count link) appears.
- Up to 5 cards render with initials avatar, name, stars, text, date, and stagger in.
- No console errors; no visible layout jump as cards load (the `min-height` reserves space).

- [ ] **Step 3: Verify graceful fallback**

Temporarily edit `data-worker` in `reviews/index.html` to a bad URL, reload `/reviews/`, and confirm the "See our reviews on Google" CTA button appears instead of an empty/broken block. Then restore the correct URL.

- [ ] **Step 4: Final syntax pass**

Run: `node --check reviews.js && node --check reviews.min.js && node --check script.js`
Expected: all exit 0.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address review-section verification findings"
```
(Skip if nothing changed.)

---

## Self-review notes

- **Spec coverage:** Worker (Task 3) + cron/KV/CORS/cache (Tasks 3, 6); daily refresh (Task 6 cron); rendering header+cards+initials (Tasks 4, 5); graceful fallback + CLS min-height (Tasks 4, 5, 8); no-JSON-LD-injection (honored — no schema task exists); 3-page wiring + grwapi removal (Task 7); Google Cloud + Place ID + dashboard deploy (Tasks 1, 2, 6).
- **No schema task** is intentional, per the spec's policy constraint.
- **`.gr-card` is self-animated** (CSS keyframe + reduced-motion guard) rather than relying on `script.js`'s load-time observer, because cards are injected post-fetch.
