# Slide Review

Review a slide deck in the browser: mark regions on slides, write comments tied to those
exact regions, and export a comment sheet that co-authors or an AI agent can act on.

**Live:** https://tomfluff.github.io/slidenotes/

Everything runs in your browser. There is no server, no account and no upload. Slides are
rendered locally and stored in your browser's IndexedDB, so decks under submission embargo
never leave your machine. Save a project file to keep a review beyond one browser. The page
loads Google Analytics for anonymous page-view counts; no deck, image or comment is ever sent.

## What it does

- **Load a deck** as a PDF (rendered per page with pdf.js, with the page text kept as the
  slide's description for screen readers), as PNG/JPG images, one per slide, or as a
  PowerPoint file, which is converted to PDF inside the browser (see below).
- **Mark a region** by dragging over anything on a slide. Each region gets a number that
  matches the comment list. Drag a region to move it, drag its handles to resize it, or
  select it by its badge and use the arrow keys.
- **General notes** for comments that are not about one spot.
- **Zoom and pan** for typography and spacing: `Ctrl` + scroll, hold `Space` to drag, or
  middle-click drag. Regions are stored as percentages, so they survive any zoom level.
- **Comment sheet**: one block per commented slide, with the slide, its numbered regions and
  the numbered comments side by side.
- **Exports**
  - **PDF** (A4, image plus comments per slide; Japanese and other non-Latin text is rendered
    through a canvas so it stays legible).
  - **Standalone HTML** (one file, images inlined, prints cleanly).
  - **Markdown bundle** (zip): `review.md` with each comment, its coordinates in percent and
    pixels and a crop of the region, plus `comments.json` and the slide images. This is the
    format to hand to an AI agent or a co-author who will make the fixes.
  - **Project file** (`.slidenotes.zip`): the deck, its images and all comments. Reopens in the
    tool, so this is the durable artefact; the browser copy is the working copy.
- **Edit, resolve and delete** comments. Resolved comments can be hidden from the sheet.
- **Several decks** can live in one browser, each with its own comments.

## PowerPoint files

Dropping a `.pptx` offers two paths: convert it in the browser, or load a PDF exported from
PowerPoint. The in-browser conversion runs LibreOffice compiled to WebAssembly (the
ZetaOffice build, driven by the MIT-licensed [zetajs](https://github.com/allotropia/zetajs)
wrapper vendored in `public/vendor/zetajs`). Facts worth knowing:

- The engine is about 52 MB on the wire and is downloaded once from `cdn.zetaoffice.net`.
  The deck itself is never uploaded; conversion happens in the page.
- LibreOffice WASM needs cross-origin isolation, which GitHub Pages cannot provide through
  headers. `public/coi-serviceworker.js` (MIT, Guido Zuidhof) adds the headers from a
  service worker; the page reloads once the first time someone converts a file. Ordinary
  visitors who never drop a PowerPoint file never trigger it. Clearing site data removes it.
- Fidelity equals desktop LibreOffice: layout, images, tables and shapes match, but fonts
  the engine lacks (Segoe UI, Calibri) are substituted, so line breaks can differ. A PDF
  exported from PowerPoint stays the most faithful input. Two JavaScript renderers were
  evaluated first on a real conference deck and broke on theme colours, pictures and
  callouts, which is why the full engine is used.
- Needs a desktop browser and about 1 GB of free memory. The dev server sets the isolation
  headers itself, so `pnpm dev` converts without the service worker.
- `pnpm test:e2e:pptx` runs the real conversion end to end (downloads the engine); it is
  skipped in the normal suite and in CI.

## Accessibility

Built by an accessibility researcher, so the tool itself is held to the standard it helps
you review against. Regions have accessible names tied to their comments, existing regions
can be moved and resized from the keyboard, focus is managed around the composer, and colour
never carries meaning alone. One known exception: drawing a new region needs a pointer; the
keyboard fallback is a general note on the slide (`N`). Settings cover reviewer name, theme, comment text size, font (Atkinson Hyperlegible, system,
OpenDyslexic), contrast, slide frame, marker colour and style (solid, outline, corners),
subtle or contrastive outline, line weight, badge size and the hover pulse. Panels are resizable
with the mouse or the keyboard. See
[ACCESSIBILITY.md](ACCESSIBILITY.md) for the honest ledger of what works and what does not yet.

## Keyboard reference

| Keys | Action |
| --- | --- |
| `←` `→`, `PageUp` `PageDown`, `Home` `End` | Previous or next slide, first or last |
| `N` | New general note on the slide |
| Drag inside a region / drag a handle | Move / resize it |
| Click a region's badge, or `Enter` on it | Select the region for the keyboard |
| Arrow keys / `Shift` + arrows | Move the selected region, in 1% or 5% steps |
| `Alt` + arrows | Resize it |
| `Esc` | Deselect, or cancel a comment |
| `Ctrl` + `Enter` | Save the comment being written |
| `Ctrl` + scroll, `+` `-` `0` | Zoom in, out, fit |
| `Space` + drag, middle-click drag | Pan |

## Development

```sh
pnpm install
pnpm dev            # http://localhost:5173/slidenotes/
pnpm test           # unit tests (vitest)
pnpm test:e2e       # Playwright, builds and serves the production bundle first
pnpm build          # typecheck + production build into dist/
pnpm sample-deck    # regenerate the synthetic demo deck in public/sample-deck
pnpm fixtures       # regenerate the PDF and PowerPoint test fixtures
pnpm test:e2e:pptx  # opt-in: real PowerPoint conversion through the 52 MB engine
```

The Vite `base` is `/slidenotes/` for the GitHub project page. Set `VITE_BASE=/` to build
for a user page or a custom domain. CI fails the build if `dist/index.html` does not reference
that base, which is the most common GitHub Pages failure.

### Layout

```
src/
  app/          shell, header, settings, stores
  features/
    deck/       import (PDF, images, project files), landing, demo deck
    review/     stage with zoom, pan and region drawing; filmstrip; comment panel
    sheet/      comment sheet view
    export/     pdf, standalone html, markdown bundle, project zip
  lib/          geometry, sorting, IndexedDB wrapper, formatting
tests/unit      vitest
tests/e2e       Playwright, asserting the measurable invariants from docs/HANDOFF.md
docs/           handoff document and the original prototype
public/         synthetic demo deck, favicon, .nojekyll, the isolation service worker,
                the vendored zetajs wrapper and the LibreOffice worker-thread script
```

### Data model

Comments key to a stable slide id, never to an index. Rectangles are percentages of slide
width and height. The project file carries a `schemaVersion`; `migrateProject` in
`src/features/export/project.ts` is the only place allowed to interpret an older one.

## Roadmap

- PPTX analysis: parse the `.pptx` for text runs, font sizes, shape geometry and missing
  alt text, and offer detected issues as draft comments pre-attached to the offending region.
- Let the user add font files so PowerPoint conversion wraps text exactly as PowerPoint does.
- Merge project files from several reviewers into one sheet, filter by author.
- Embed a subsetted Noto Sans JP in the PDF so Japanese text is selectable.

## License

AGPL-3.0-only. See [LICENSE](LICENSE). Third-party code shipped under `public/`
(coi-serviceworker and zetajs, both MIT) is listed with its licence text in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
