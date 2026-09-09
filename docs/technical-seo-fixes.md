# Technical SEO fixes — September 8, 2026

Original design restored by reverting the two redesign commits. All 48 page bodies and the original shared CSS/JS match commit 5949934 exactly.

## Corrections

- Removed 18 city-consolidation rules from vercel.json. These contradicted existing self-canonical city pages, internal links, and sitemap entries. Live Alpine currently returns 200; removing the stale rules preserves the existing page architecture when this branch is deployed. The www-to-apex redirect remains.
- Converted the unsupported IndexNow-Key robots.txt directive into a comment. The verification key file remains intact; this change does not submit URLs to IndexNow.
- Removed self-business aggregateRating markup from the English and Spanish homepage schemas. Visible customer reviews and ratings remain unchanged. Such markup is ineligible for Google's LocalBusiness review snippets; its presence was not a JSON syntax error.
- Corrected logo dimensions in social metadata and ImageObject structured data from 512×512 to the actual 612×408. Ten pages affected.
- Updated sitemap lastmod only for the ten pages with metadata/structured-data corrections.

## Verification

All 48 local pages checked: one title, description, H1, and self-canonical per page; no duplicate titles; no broken internal targets or anchors; no missing image alt attributes; all JSON-LD parses; all 48 pages appear in the sitemap. Original body markup and shared CSS/JS match the pre-redesign commit. Git whitespace checks passed.

Live HTTP checks: Alpine 200; www homepage 308 to apex; nonexistent URL 404. No Search Console access or field Core Web Vitals measurements were used. These fixes are local and committed on fix/technical-seo, not deployed. Indexing status and ranking changes are not verified.

## References

- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/appearance/structured-data/review-snippet
- https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec
