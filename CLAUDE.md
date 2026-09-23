# Slide Review

Static React + TypeScript + Vite app deployed to GitHub Pages at `/slidenotes/`. Fully client
side: no server, no API keys. Read `docs/HANDOFF.md` before changing the stage, zoom, marker
or export code; section 7 lists the interaction maths that each fixed a real bug, and
`tests/e2e/review.spec.ts` asserts them.

## Commands

- `pnpm dev`, `pnpm build` (typecheck + build), `pnpm test` (vitest), `pnpm test:e2e` (Playwright
  against the production preview at the real base path).
- `pnpm sample-deck` regenerates `public/sample-deck` with Playwright's Chromium. The demo deck
  is synthetic; never commit real or unpublished slides.

## PowerPoint conversion

`src/features/deck/pptx.ts` drives LibreOffice WASM (ZetaOffice CDN) through the vendored
`public/vendor/zetajs` wrapper and `public/office_thread.js`. It needs cross-origin isolation:
`public/coi-serviceworker.js` is registered on demand and reloads the page once; the dropped
file is parked in IndexedDB (`meta.pendingPptx`) across the reload and resumed in `App`. Keep
those three public files static (never bundled). The real conversion test is opt-in
(`pnpm test:e2e:pptx`); do not add it to CI.

## Conventions

- Comments key to `slide.id`, never to an index. Rectangles are percentages.
- `schemaVersion` in project files is load-bearing; only `migrateProject` interprets old files.
- Zoom changes layout width, never a CSS transform. Anchor by measuring, not predicting.
- Marker rectangles are styled by `.markrect`, badges are HTML (`.pin`), never SVG circles.
- Design tokens live in `src/styles/tokens.css`. Sizes are rem. Light and dark are both first
  class; `#d27cf7` is the dark-theme accent only, light uses `#7b2cbf`.
- Every interactive element needs an accessible name; announce state changes through the store's
  `announce` action. Keep `ACCESSIBILITY.md` honest when behaviour changes.
