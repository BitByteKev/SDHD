# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Marketing website for **San Diego Hauling & Demo** (sdhaulinganddemo.com) — a junk removal / demolition business. It is a **plain static site**: hand-authored HTML/CSS/JS, no framework, no package.json, no build pipeline. There is nothing to "install" — files are edited directly and deployed as-is.

## Build / dev commands

There is no `npm run` or build script. Treat asset rebuilds as one-off shell commands. `.claude/settings.local.json` shows the workflow that has been used:

```bash
# Local preview
python3 -m http.server 8765

# Re-minify CSS after editing styles.css (production references the .min version)
npx --yes clean-css-cli -o styles.min.css styles.css

# Sanity-check JS files (no bundler — script.min.js is hand-maintained alongside script.js)
node --check script.js
node --check script.min.js

# Image pipeline used for the gallery / hero
sips -Z 1600 source.jpeg --out source-1600.jpg     # downscale
cwebp -q 78 source-1600.jpg -o source.webp         # convert to webp
```

**`styles.min.css` and `script.min.js` are what every page actually loads.** If you edit `styles.css` or `script.js`, you must regenerate the corresponding `.min` file — there is no watcher. Both `.min` files are committed to git.

## High-level architecture

### Page model: folder-per-route with `index.html`

Every URL maps to a folder containing a single `index.html`. The home page (`/`) is the root `index.html`. There are ~30 sub-routes; they fall into four groups:

- **Service hub pages** — `furniture-removal/`, `demolition-services/`, `estate-cleanout/`, `yard-waste-removal/`, `commercial-junk-removal/`, `graffiti-removal/`, `maintenance-services/`.
- **City landing pages** — `junk-removal-{city}/` for ~25 San Diego County cities (Chula Vista, El Cajon, La Mesa, Escondido, Oceanside, etc.). These are templated near-duplicates differing in city name, neighborhood list, schema `areaServed`, and intro copy.
- **Spanish mirror** — `es/index.html` is a Spanish-language copy of the home page. The English home links to it via `hreflang` and a `/es/` nav entry.
- **Content / utility** — `blog/` (one `index.html` index plus per-post folders), `gallery/`, `reviews/`, `privacy-policy/`.

There is no templating engine, so the navbar, footer, schema blocks, Google Analytics snippet, font preloads, and floating-CTA markup are **duplicated by hand on every page**. When making site-wide changes (e.g., adding a nav link, updating the phone number, changing the GTM ID, or editing the LocalBusiness schema), expect to touch every `index.html`. Use `grep -rl` to find all occurrences before editing.

### Shared assets

All sub-pages reference shared CSS/JS from the root with a relative path (`../styles.min.css`, `../script.min.js`). The root page uses bare paths (`styles.min.css`, `script.min.js`). Don't break this convention when adding new sub-folders — copy from an existing city page rather than the root.

`script.js` is one IIFE-free flat file. It assumes-and-no-ops-gracefully for elements that don't exist on a given page (every block does `if (el)` checks), which is what lets the same minified script run on city pages, the blog index, the gallery, etc. Preserve that pattern when adding new behavior.

Sections wired up in `script.js` that callers depend on:
- Navbar scroll state, hamburger menu, smooth-scroll anchors
- Hero parallax (skipped under `prefers-reduced-motion`)
- IntersectionObserver-driven fade-in animations on `.service-card`, `.step`, `.pricing-card`, `.review-card`, `.guarantee-item`, `.area-tags span`, `.contact-item`, `.section-header`
- Quote form (`#quoteForm`) → Formspree (`mkoperpg`), with multipart upload supporting up to 5 photos / 10 MB each
- Floating mobile CTA (hides when hero or contact section is in view; dismiss state in `sessionStorage`)
- 3D card tilt on hover-capable devices only
- `trackEvent()` helper that fires both `gtag` and `dataLayer` for GA events

### SEO is load-bearing

This site exists to rank locally, so SEO scaffolding is part of the product, not an afterthought:

- **JSON-LD schema** is extensive: every page has `LocalBusiness`/`HomeAndConstructionBusiness` plus page-specific schema (`Service`, `BreadcrumbList`, `FAQPage`, `HowTo`, etc.). The canonical business `@id` is `https://sdhaulinganddemo.com/#business` and is reused across pages — don't break that ID.
- **`sitemap.xml`** is hand-maintained at the repo root with explicit `<lastmod>`, `<priority>`, and `<xhtml:link hreflang>` blocks. Update it when adding or renaming pages.
- **`robots.txt`** declares the sitemap and an **IndexNow** key (`bb5e4485812c226eceafb4f4b74f1286.txt` lives at the root and must match — Bing/Yandex validate it).
- **Canonicals and hreflang** are set per page. City pages canonicalize to themselves; the home and `/es/` are alternates of each other.
- The keyword/description meta tags and the city schema lists are not boilerplate filler — they're the SEO payload. Don't trim them as "noise."

### External services baked in

- **Google Analytics / GTM**: `GT-5MX8PLLG` and `G-K7CZWNVKXW` (gtag config in `<head>` of every page).
- **Formspree** form endpoint ID `mkoperpg` is hardcoded in `script.js`.
- **grwapi.net** review widget loaded via `<script>` on pages with `.review-widget_net` (uuid `c63328f9-2ce0-4d7f-b2ac-f16d7ff619ef`).
- **Google Fonts** (Rubik + Heebo) preloaded; do not switch font loading strategy without testing CLS.

### Design tokens

CSS custom properties at the top of `styles.css` define the brand palette — primary purple `#6200E0`, neon-lime accent `#75FF33`, dark `#141414`. The vibe is "dark, bold, neon lime + purple" (see file header). Stay inside these tokens rather than introducing new colors.

## Conventions worth knowing

- **Phone number `(619) 841-4193`** is repeated in many places — copy, schema, `tel:` and `sms:` links. Search-and-replace carefully if it ever changes.
- **Business address / license** (`San Diego, CA 92115`, `CA Contractor #1135398`, `D-63`) is in the footer and the schema of every page.
- **City-page parity**: when adding a new city, copy the closest existing `junk-removal-{city}/index.html` and update (a) the canonical URL, (b) the city name in `<title>`/meta/headings, (c) the `Service.areaServed` and `geo` in JSON-LD, (d) the neighborhood list, (e) the sitemap.
- **Don't introduce a build system or framework** unless asked. The point of the current setup is that any change is one or two HTML edits and a `clean-css-cli` invocation.

## Frontend aesthetics

<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:

Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.

Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.

Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.

Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>
