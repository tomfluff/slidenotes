# Accessibility

Slide Review is built for reviewing presentation decks with collaborators, by a researcher
in accessibility and HCI. This file is the ledger of what the tool actually does and what
it does not do yet. Target: WCAG 2.2 AA. Last updated 2026-09-23. Checked against the
accessibility tree and by keyboard simulation in Playwright; not yet tested with real
screen-reader users, which is the most valuable next step.

## What works today

### Keyboard
- Slides step with the arrow keys. `N` opens a general note. `Ctrl` + `Enter` saves, `Esc`
  cancels and returns focus to what opened the composer.
- Existing regions are keyboard-editable: a region's badge (a button) selects it, then the
  arrow keys move it and `Alt` + arrows resize it, with the position announced in words; with
  a mouse, drag the region itself or one of eight handles (24px hit areas).
- Panel dividers are focusable separators: arrows resize in 16px steps, `Shift` for 64px,
  `Home` and `End` for the limits, `Enter` resets.
- Zoom: `+`, `-`, `0`, plus the toolbar. Panning: `Space` + drag, or the scroll container's
  native scrolling and scrollbars.
- Every focusable control has a visible focus ring (accent colour with a gap, so it stays
  visible on any ground, including over the slide).
- No focus traps. The settings dialog is a native `<dialog>`, so the browser handles the trap
  and restores focus to the opener. The deck menu closes on `Esc` and returns focus.

### Screen readers
- Each marked region is a button over the slide with an accessible name that ties it to its
  comment: "Region 2 on slide 3 of 8, a small area in the upper left: <comment text>".
  Activating it once selects the region for the arrow keys; activating it again moves focus
  to the comment. The status bar that appears on selection has an "Open comment" button too.
- Region positions are announced in words ("about a quarter of the slide in the upper left"),
  never as raw numbers, through a polite live region. Saving, deleting, resolving, importing
  and exporting also announce.
- The comment list is a real list; badge numbers are exposed in text, not only as colour.
  The slide image has alternative text naming the slide and its source page, and for PDF
  decks the page's text is attached as the slide description, so the slide content itself
  can be read.
- The frame states which keys work while it has focus. Once a region is selected, its
  arrow keys work from anywhere outside a text field or dialog, and `Esc` always deselects.
- Errors are announced assertively, other status messages politely. A message never
  disappears while it is hovered or holds focus.

### Vision
- Text sizes are relative (rem), so browser zoom scales the whole tool. A comment text
  setting (100 to 200%) grows the comments on top of that without shrinking the slide.
- Fonts: Atkinson Hyperlegible by default (self-hosted, works offline), system font, or
  OpenDyslexic.
- Light and dark themes, both first class. Muted text meets 4.5:1 against its background in
  both. The purple accent is `#7b2cbf` on light surfaces (about 6.4:1 on white) and `#d27cf7`
  on dark surfaces with dark text; `#d27cf7` is never used on white for anything that carries
  meaning.
- Increased contrast setting (also honours `prefers-contrast: more`): stronger borders and
  muted text pulled to the ink colour.
- Marker colour, style (solid, outline, corners), a subtle or contrastive outline
  (the contrastive one adds a white halo), line weight and badge size are user settings,
  because markers are drawn over arbitrary slide content and no single look works on every
  slide. The number badge is always present, and every export uses the colour and style you
  chose. The settings dialog previews the marker live.
- The only single-character shortcut, `N` (new general note), is inactive in text fields,
  dialogs and the comment list (WCAG 2.1.4); every other action is a button or uses modifier keys.
- The first-run hint above the slide can be dismissed; every shortcut is listed in Help.
- Region comments and general notes differ by number versus bullet and by label text, never by
  colour alone. Resolved comments are struck through and labelled, not only dimmed.

### Motion
- Transitions are 160 ms and functional only, and `prefers-reduced-motion` removes them.
  One deliberate exception: hovering a comment pulses its region on the slide three times,
  by 15 percent (a location cue the owner relies on). It is a setting, on by default, and it ignores the OS
  reduced-motion preference on purpose; turn it off in Settings if it bothers you.

### Privacy
Nothing is uploaded. There is no account. The only cross-origin traffic is Google Analytics
for page-view counts and the optional, one-time download of the PowerPoint conversion engine.
The deck, its images and the comments are never sent anywhere, so no assistive-technology
workaround is forced through someone else's server.

## What does not work yet

1. **Creating a new region needs a pointer.** The keyboard placement mode was removed at the
   owner's request (it made the mouse flow confusing). Moving and resizing an existing region
   is keyboard-operable, creating one is not; a general note (`N`) is the keyboard fallback
   for commenting on a slide. This is a known WCAG 2.1.1 gap.
2. **Screen-reader support is wired but unproven.** Verified against the accessibility tree
   and by keyboard simulation only. If you use NVDA, JAWS or VoiceOver, please open an issue.
3. **The filmstrip thumbnails** are buttons with names, but their comment count badges are
   visual; the count is in the button name instead.
4. **Touch**: drawing works with a single finger, but pinch zoom on the slide is not handled;
   use the zoom buttons.
5. **The PDF export** renders Japanese and other non-Latin text as images, line by line, so
   it is legible but not selectable or searchable, and it depends on the exporting machine
   having a font for that script. Embedding a subsetted font is on the roadmap.
6. **Image decks have no slide description.** Only PDF pages carry extracted text; a deck
   loaded from PNG or JPG files exposes the slide number and file name only.

If something here is wrong or missing, say so: the useful list is the one not yet found.
