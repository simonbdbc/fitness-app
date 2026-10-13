# Design QA - Pulse Arena landing

## Comparison target

- Source visual truth: `/Users/simon/.codex/generated_images/019f483f-f0df-7573-b19a-5eb596d9c2fa/exec-064975e8-5f03-4e39-8ee1-a81f54deb88a.png`
- Implementation URL: `http://localhost:4321/`
- Primary desktop viewport: 1440 x 1024
- Responsive viewports: 768 x 1024, 390 x 844 and 320 x 800
- State: production Astro build, default `pulse-dark` theme, menu closed unless stated otherwise
- Browser: Codex in-app Browser

## Evidence

The in-app Browser full-page capture became unreliable after successive viewport overrides, so the final full-page review uses contiguous browser-rendered section captures rather than a stitched or code-generated image.

- Desktop hero: `/tmp/acrea-landing-qa-final-1440-hero.png`
- Desktop method/pillars: `/tmp/acrea-landing-qa-final-1440-method.png`
- Desktop guided features: `/tmp/acrea-landing-qa-final-1440-features.png`
- Desktop steps: `/tmp/acrea-landing-qa-final-1440-steps.png`
- Desktop final CTA/footer: `/tmp/acrea-landing-qa-final-1440-cta.png`
- Tablet hero: `/tmp/acrea-landing-qa-final-768-hero.png`
- Mobile hero: `/tmp/acrea-landing-qa-final-390-hero.png`
- Mobile menu open: `/tmp/acrea-landing-qa-final-390-menu.png`

The source board and the desktop hero were opened in the same comparison pass. The method, feature and final CTA captures were then inspected as focused evidence because those details are too small to judge reliably in the complete source board.

## Required fidelity surfaces

### Fonts and typography

- `Barlow Condensed` 700/800 reproduces the condensed athletic hierarchy of the source.
- `Inter` 400/600/700 keeps body and control text neutral and legible.
- Heading weight, capitalization and line-height match the reference's dense sports campaign treatment.
- No negative tracking or viewport-proportional font scaling is used.
- Desktop, tablet and mobile line breaks remain contained without clipping.

### Spacing and layout rhythm

- The 1220 px desktop shell, compact 72 px header and near-viewport hero match the source proportions.
- The hero leaves the next section edge visible at 1440 x 1024.
- Pillars and guided features use open ruled columns rather than nested cards.
- Weekly programming uses one purposeful framed tool surface.
- Tablet and mobile separate copy from photography to avoid overlap; mobile CTAs become full width.
- No horizontal overflow was found at 1440, 768, 390 or 320 px.

### Colors and visual tokens

- Background `#090d10`, surfaces `#111820` / `#18212a`, accent `#2ee68d`, text `#f4f8fb` and border `#30404a` match `pulse-dark`.
- The hero and final photographs preserve neutral black/charcoal lighting with restrained green rim light.
- CTA, icon and focus colors remain consistent throughout the page.
- Contrast passed the Lighthouse accessibility category at 100 in all six final audit runs.

### Image quality and asset fidelity

- Hero: generated production photograph of a male athlete in a push-up, right-weighted with clean left negative space.
- Final CTA: generated production photograph of a female athlete in a plank, right-weighted with matching lighting.
- Responsive AVIF/WebP variants are sharp, correctly cropped and dimensioned.
- The hero is prioritized; the final image lazy-loads and was verified complete after scrolling.
- Standard UI icons use `@lucide/astro`; no placeholder, emoji, CSS drawing or fake phone is present.

### Copy and content

- Navigation and CTA labels match the approved plan.
- Section order matches the approved plan.
- Product claims were corrected for truthfulness, especially offline availability and personalization.
- No testimonial, price, performance result, contact address, legal page or metric was invented.
- Footer year is 2026 and links only target existing anchors/routes.

## Interaction and responsive checks

- Native mobile `<details>` menu opens and exposes four expected links.
- Menu stays within the 390 px viewport.
- Internal anchors resolve to existing section IDs.
- Primary and final CTAs resolve to `/login`; secondary CTA resolves to `/home` on the application origin.
- Focus style is a 3 px `#2ee68d` outline with 4 px offset.
- Mobile CTA heights are 52 px; 320 px viewport buttons remain fully contained.
- No console warning or error was recorded on desktop, tablet or mobile.
- The DOM contains one H1 and no application script outside JSON-LD.

## Comparison history

### Iteration 1

- Earlier finding [P1]: hero and final raster media used a negative stacking level and could render behind the section background.
- Fix: media moved to stacking level 0; content wrappers moved to level 1.
- Post-fix evidence: `/tmp/acrea-landing-pulse-arena-1440x1024-hero-v4.png` shows the complete full-bleed hero.

### Iteration 2

- Earlier finding [P2]: green hero word, neutral secondary border and left-aligned pillar/feature structures drifted from the selected source.
- Earlier finding [P2]: at 768 px, the athlete could sit behind supporting copy.
- Fix: white hero lockup, green secondary border, centered three/four-column desktop sections, larger icons and separated tablet media composition.
- Post-fix evidence: `/tmp/acrea-landing-qa-final-1440-hero.png`, `/tmp/acrea-landing-qa-final-1440-method.png`, `/tmp/acrea-landing-qa-final-1440-features.png` and `/tmp/acrea-landing-qa-final-768-hero.png`.

## Findings

No actionable P0, P1 or P2 mismatch remains.

## Lighthouse final gate

- Mobile: three runs, each scoring 100 in Performance, Accessibility, Best Practices and SEO.
- Desktop: three runs, each scoring 100 in Performance, Accessibility, Best Practices and SEO.
- Assertion aggregation: `pessimistic`, so every individual run must meet `minScore: 1`.
- Mobile FCP range: 1,208-1,218 ms; mobile LCP range: 1,658-1,677 ms; CLS: 0.
- Desktop FCP range: 289-294 ms; desktop LCP range: 417-453 ms; CLS: 0.

## Accepted intentional deviations

- The generated athletes differ from the exact people in the concept while preserving exercise, composition, crop, lighting and campaign art direction.
- Source copy implying stronger personalization/offline guarantees was replaced with implementation-supported wording.
- Dead legal/contact links and the source's 2025 footer were not reproduced.
- Step numbers remain code-native type rather than decorative hexagonal emblems.

## Follow-up polish

- [P3] A dedicated mobile concept could refine below-the-fold spacing further, but current responsive behavior is complete and coherent.
- [P3] A future brand asset pass could provide a dedicated horizontal wordmark instead of composing the existing mark with code-native text.

final result: passed
