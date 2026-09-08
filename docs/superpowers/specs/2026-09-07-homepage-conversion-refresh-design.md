# Homepage conversion refresh

## Purpose

Improve the home page's ability to turn San Diego junk-removal and demolition visitors into phone, text, or quote-form leads. The change must preserve the present static-site architecture, search metadata and schema, Formspree submission flow, analytics, and existing brand colors.

## Audience and primary action

Visitors commonly need a removal estimate quickly and may have a photo of the material. The primary above-the-fold action will be texting that photo to the business. Calling remains the alternate action for immediate help; the form remains the detailed quote path.

## Visual system

The existing brand palette remains the source of truth: charcoal `#141414`, purple `#6200E0`, violet `#9933FF`, lime `#75FF33`, white, and neutral grey. Rubik remains the display face and Heebo the reading face, avoiding a new font request and its performance cost.

The hero will move from a centered single column to a desktop split composition: copy, actions, and light proof in the left column; a compact assurance panel in the right column. The truck photography remains the environmental evidence behind both. At tablet and mobile widths it becomes one centered column, with the proof panel beneath the actions and full-width tap targets.

The distinctive device is a compact proof panel with three concrete commitments: licensed contractor, price approved before work begins, and same-day availability subject to schedule. It is structural content—not decoration—and will use the site's existing sharp lime rule language.

## Content and interaction changes

1. Revise the hero headline and supporting copy to name both junk removal and demolition, give a clearer service promise, and explain that a photo can produce the fastest estimate.
2. Change the first hero CTA to a prefilled SMS link. Its label will say "Text a photo for a fast quote." Keep call as the second action and retain accessible link semantics.
3. Add a short response-time note directly beneath the hero actions, conditioned as "during business hours" rather than making an unsupported guarantee.
4. Add the desktop proof panel and retain the existing job count, rating, and licensing evidence below the hero copy.
5. Add an immediate three-step quote strip after the hero: text/call, approve the upfront price, then the crew lifts and hauls. It will link the final step into the form and avoid duplicating a full service catalog.
6. Update the quote-form introduction and microcopy so visitors understand that photos make estimates faster. Keep all current inputs, client-side checks, multipart upload limits, Formspree endpoint, and success handling unchanged.
7. Add CSS only for these new structural elements, including keyboard focus visibility, responsive layouts, and a reduced-motion-safe entrance treatment. Do not alter global CTA behavior on city or service pages.

## Files and boundaries

- `index.html`: home-only copy, semantic hero proof markup, quote strip markup, and form-supporting copy.
- `styles.css`: scoped desktop/mobile styling for the hero refresh, proof panel, quote strip, and form cue.
- `styles.min.css`: regenerated from `styles.css`, as it is the production stylesheet loaded by the pages.

`script.js`, `script.min.js`, JSON-LD, sitemap, robots, analytics, form fields, and all non-home pages are out of scope.

## Failure handling and accessibility

The text CTA is an ordinary `sms:` link and naturally falls back to a device's configured handler. The call CTA is an ordinary `tel:` link. The existing form remains the fallback if either action is unavailable. New panels will use semantic text, decorative icons will be hidden from assistive technology where appropriate, and buttons/links will retain visible focus states. No content will depend on motion.

## Verification

1. Regenerate `styles.min.css` after the CSS edit.
2. Confirm the home page still references `styles.min.css` and `script.min.js`.
3. Run `node --check script.js` and `node --check script.min.js` to confirm unchanged shared scripts remain valid.
4. Preview locally at desktop and narrow mobile widths; verify the CTA links, hero readability over each background photo, proof panel wrapping, and quote form layout.
5. Search the changed home page for the business phone number and confirm links use the existing canonical number.
