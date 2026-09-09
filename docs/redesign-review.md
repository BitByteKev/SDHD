# Website visual refresh

Branch: `redesign/professional-site-refresh`

The redesign updates all 48 public pages using a shared `redesign.css` stylesheet, preserving the existing static architecture. The homepage pairs its original introduction with a fleet photograph and existing pricing assurances. Navigation, typography, buttons, service cards, pricing, reviews, forms, galleries, and editorial layouts share a consistent presentation.

The original purple (#6200E0), lime (#75FF33), charcoal (#141414), and white palette is preserved. Existing visible text, page routes, metadata, structured data, phone links, and form integration are retained. Existing production CSS and JavaScript are unchanged; the new stylesheet loads after the existing stylesheet.

## Verification

- All 48 pages checked at 390px and 1440px: no horizontal overflow, missing redesign stylesheets, or broken loaded images.
- No JavaScript page errors during the browser checks.
- Exact visible-text comparison passed for all 48 pages against the pre-edit snapshot.
- Mobile menu open and Escape close tested.
- Quote success flow tested using an intercepted, simulated Formspree response; no real inquiry sent.
- JavaScript syntax and git whitespace checks passed.

## Preview

A local comparison with desktop, mobile, and full-page screenshots is saved in the sibling `Website Redesign Review` directory. While preview servers are running:

- Comparison: http://127.0.0.1:8778/
- Original: http://localhost:8776/
- Redesign: http://localhost:8777/

No merge to main or remote push is included. Unrelated pre-existing working-tree deletions and untracked files are excluded from the redesign commit.
