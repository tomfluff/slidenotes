# SlideNotes

Static React + TypeScript + Vite app deployed to GitHub Pages at `/slidenotes/`. Fully client
side: no server, no API keys. Before changing the stage, zoom, marker or export code, read
the interaction rules below; each one fixed a real bug in the prototype this was ported from,
and `tests/e2e/review.spec.ts` asserts them.

## Interaction rules that each fixed a real bug

- Zoom sets an explicit pixel width on the slide container (`fitWidth() * zoom`); a CSS
  transform would not grow the scroll area and most of the slide became unreachable.
- Anchor zoom by measuring the slide's bounding box before and after the change and
  correcting the scroll by the difference. Predicting the offset arithmetically drifted
  about 20 percent per step.
- Normalise wheel deltas by `deltaMode`, clamp to about 40, then apply
  `Math.exp(-d * 0.0035)`. Raw `deltaY` made one mouse notch zoom 3x.
- Drawing only starts on `button === 0` with Space not held; middle click and space-drag pan.
  `preventDefault` on middle-button `mousedown` suppresses the browser autoscroll widget.
- The overlay SVG is `viewBox="0 0 100 100"` with `preserveAspectRatio="none"`, so
  percentage rectangles map onto the slide but circles would render as ellipses. Badges
  and handles are HTML sized in rem or px and clamped inside the frame.
- Every scrolling grid child has `min-height: 0; min-width: 0`, or the shell grows past
  the viewport. Overlay controls (zoom toolbar, selection bar) sit outside the scroller.
- Marker rectangles are styled by their own class (`.markrect`) so the sheet and every
  export get the same translucent fill, never the SVG default black.

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
(`pnpm test:e2e:pptx`); do not add it to CI. Once a visitor has registered the service
worker, every later page load is cross-origin isolated (COEP require-corp): any new
cross-origin resource must be served with CORP or CORS headers or it will be blocked for
those visitors. Everything today is same-origin except cdn.zetaoffice.net and Google
Analytics, both of which send the headers.

## Conventions

- Comments key to `slide.id`, never to an index. Rectangles are percentages.
- `schemaVersion` in project files is load-bearing; only `migrateProject` interprets old files.
- Zoom changes layout width, never a CSS transform. Anchor by measuring, not predicting.
- Marker rectangles are styled by `.markrect`, badges are HTML (`.pin`), never SVG circles.
- Design tokens live in `src/styles/tokens.css`. Sizes are rem. Light and dark are both first
  class; `#d27cf7` is the dark-theme accent only, light uses `#7b2cbf`.
- Every interactive element needs an accessible name; announce state changes through the store's
  `announce` action. Keep `ACCESSIBILITY.md` honest when behaviour changes.
