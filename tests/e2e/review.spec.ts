import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { openDemo, drawRegion } from './helpers';

test.describe('review', () => {
  test('loads under the production base path and shows the landing', async ({ page }) => {
    const failures: string[] = [];
    page.on('response', (r) => {
      if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
    });
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 2, name: /review a slide deck/i })).toBeVisible();
    expect(failures).toEqual([]);
  });

  test('a drag stores the exact percentages, also at 244% zoom', async ({ page }) => {
    await openDemo(page);
    await drawRegion(page, [0.25, 0.25], [0.5, 0.5], 'first');
    const rects = page.locator('.frame rect.markrect');
    await expect(rects).toHaveCount(1);
    const r = await rects.first().evaluate((el) => ({
      x: +el.getAttribute('x')!, y: +el.getAttribute('y')!, w: +el.getAttribute('width')!, h: +el.getAttribute('height')!,
    }));
    expect(r.x).toBeCloseTo(25, 0);
    expect(r.y).toBeCloseTo(25, 0);
    expect(r.w).toBeCloseTo(25, 0);
    expect(r.h).toBeCloseTo(25, 0);

    // Zoom to about 244% with the buttons, then draw at a known fraction of the visible slide.
    const stage = page.getByTestId('stage');
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByTestId('zoom-pct')).toHaveText('244%');
    await stage.evaluate((el) => {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    });
    const frame = page.getByTestId('frame');
    const box = (await frame.boundingBox())!;
    // Only the top-left part of the frame is on screen; pick points inside the viewport.
    const vp = page.viewportSize()!;
    const fx0 = 0.05, fy0 = 0.05, fx1 = 0.15, fy1 = 0.12;
    expect(box.x + box.width * fx1).toBeLessThan(vp.width);
    expect(box.y + box.height * fy1).toBeLessThan(vp.height);
    await page.mouse.move(box.x + box.width * fx0, box.y + box.height * fy0);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * fx1, box.y + box.height * fy1, { steps: 5 });
    await page.mouse.up();
    await page.getByRole('textbox', { name: /new comment on region/i }).fill('zoomed');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(rects).toHaveCount(2);
    const r2 = await rects.first().evaluate((el) => ({ x: +el.getAttribute('x')!, y: +el.getAttribute('y')!, w: +el.getAttribute('width')!, h: +el.getAttribute('height')! }));
    expect(r2.x).toBeCloseTo(5, 0);
    expect(r2.y).toBeCloseTo(5, 0);
    expect(r2.w).toBeCloseTo(10, 0);
    expect(r2.h).toBeCloseTo(7, 0);
  });

  test('zoom produces a real scroll area and anchors under the cursor', async ({ page }) => {
    await openDemo(page);
    const stage = page.getByTestId('stage');
    const frame = page.getByTestId('frame');
    let box = (await frame.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    // One mouse notch with ctrl held: about 15%, never 3x.
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    const pct = Number((await page.getByTestId('zoom-pct').textContent())!.replace('%', ''));
    expect(pct).toBeGreaterThanOrEqual(110);
    expect(pct).toBeLessThanOrEqual(120);

    // Zoomed in: the stage gains a real scrollable area, so panning is possible at all.
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
    const dims = await stage.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight }));
    expect(dims.sw).toBeGreaterThan(dims.cw);
    expect(dims.sh).toBeGreaterThan(dims.ch);

    // Scroll to the middle so the correction is never clamped, then zoom one notch under the cursor.
    await stage.evaluate((el) => {
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
    });
    const sb = (await stage.boundingBox())!;
    const ax = sb.x + sb.width * 0.5;
    const ay = sb.y + sb.height * 0.5;
    box = (await frame.boundingBox())!;
    const fx0 = (ax - box.x) / box.width;
    const fy0 = (ay - box.y) / box.height;
    await page.mouse.move(ax, ay);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    const after = (await frame.boundingBox())!;
    const fx = (ax - after.x) / after.width;
    const fy = (ay - after.y) / after.height;
    expect(Math.abs(fx - fx0)).toBeLessThan(0.01);
    expect(Math.abs(fy - fy0)).toBeLessThan(0.01);
  });

  test('badges are circles and stay inside the frame for a region at 0,0', async ({ page }) => {
    await openDemo(page);
    await drawRegion(page, [0.01, 0.01], [0.2, 0.2], 'corner');
    const pin = page.locator('.frame .pin').first();
    const pb = (await pin.boundingBox())!;
    expect(pb.width / pb.height).toBeCloseTo(1, 1);
    const fb = (await page.getByTestId('frame').boundingBox())!;
    expect(pb.x).toBeGreaterThanOrEqual(fb.x);
    expect(pb.y).toBeGreaterThanOrEqual(fb.y);
    expect(pb.x + pb.width).toBeLessThanOrEqual(fb.x + fb.width);
    expect(pb.y + pb.height).toBeLessThanOrEqual(fb.y + fb.height);
  });

  test('middle-click and space-drag pan without drawing; left drag draws', async ({ page }) => {
    await openDemo(page);
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
    const stage = page.getByTestId('stage');
    await stage.evaluate((el) => { el.scrollLeft = 200; el.scrollTop = 100; });
    const frame = page.getByTestId('frame');
    const box = (await frame.boundingBox())!;
    const vp = page.viewportSize()!;
    const px = Math.min(box.x + 200, vp.width - 200);
    const py = Math.min(box.y + 150, vp.height - 150);

    await page.mouse.move(px, py);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(px - 80, py - 60, { steps: 4 });
    await page.mouse.up({ button: 'middle' });
    let s = await stage.evaluate((el) => ({ l: el.scrollLeft, t: el.scrollTop }));
    expect(s.l).toBeGreaterThan(200);
    expect(s.t).toBeGreaterThan(100);
    await expect(page.locator('.frame rect.markrect')).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveCount(0);

    await page.getByTestId('frame').focus();
    await page.keyboard.down('Space');
    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.mouse.move(px + 50, py + 40, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    const s2 = await stage.evaluate((el) => ({ l: el.scrollLeft, t: el.scrollTop }));
    expect(s2.l).toBeLessThan(s.l);
    await expect(page.locator('.frame rect.markrect')).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveCount(0);

    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.mouse.move(px + 60, py + 50, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByRole('textbox', { name: /new comment on region/i })).toBeVisible();
  });

  test('N opens a general note; R does nothing', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('frame').focus();
    await page.keyboard.press('r');
    await expect(page.locator('.frame rect.markrect')).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await page.keyboard.press('n');
    const ta = page.getByRole('textbox', { name: /new general note/i });
    await expect(ta).toBeFocused();
    await ta.fill('note via N');
    await page.keyboard.press('Control+Enter');
    await expect(page.getByText('note via N')).toBeVisible();
  });

  test('a region moves when dragged directly, resizes by a handle, and nudges by keyboard', async ({ page }) => {
    await openDemo(page);
    await drawRegion(page, [0.2, 0.2], [0.4, 0.4], 'movable');
    const frame = page.getByTestId('frame');
    const box = (await frame.boundingBox())!;
    // Pressing inside the region grabs it without selecting first: +10% x, +5% y.
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.35, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('.handle')).toHaveCount(8);
    let r = await page.locator('.frame rect.markrect').first().evaluate((el) => ({ x: +el.getAttribute('x')!, y: +el.getAttribute('y')!, w: +el.getAttribute('width')!, h: +el.getAttribute('height')! }));
    expect(r.x).toBeCloseTo(30, 0);
    expect(r.y).toBeCloseTo(25, 0);
    expect(r.w).toBeCloseTo(20, 0);
    // Drag the south-east handle to 60%, 60%.
    const se = page.locator('.handle.se');
    const sb = (await se.boundingBox())!;
    await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 6 });
    await page.mouse.up();
    r = await page.locator('.frame rect.markrect').first().evaluate((el) => ({ x: +el.getAttribute('x')!, y: +el.getAttribute('y')!, w: +el.getAttribute('width')!, h: +el.getAttribute('height')! }));
    expect(r.w).toBeCloseTo(30, 0);
    expect(r.h).toBeCloseTo(35, 0);
    // Keyboard: still selected, arrows move it.
    await page.keyboard.press('Shift+ArrowRight');
    r = await page.locator('.frame rect.markrect').first().evaluate((el) => ({ x: +el.getAttribute('x')!, w: +el.getAttribute('width')! }));
    expect(r.x).toBeCloseTo(35, 0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.handle')).toHaveCount(0);
    // Pressing on empty slide while nothing is selected still draws a new region.
    await drawRegion(page, [0.6, 0.6], [0.8, 0.8], 'second');
    await expect(page.locator('.frame rect.markrect')).toHaveCount(2);
  });

  test('panel dividers resize with the keyboard and persist', async ({ page }) => {
    await openDemo(page);
    const sep = page.getByRole('separator', { name: 'Resize the comment panel' });
    const before = Number(await sep.getAttribute('aria-valuenow'));
    await sep.focus();
    await page.keyboard.press('Shift+ArrowLeft');
    const after = Number(await sep.getAttribute('aria-valuenow'));
    expect(after).toBe(before + 64);
    const panelW = await page.locator('.panel').evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.round(panelW)).toBe(after);
    await page.reload();
    await page.getByTestId('frame').waitFor();
    expect(Number(await page.getByRole('separator', { name: 'Resize the comment panel' }).getAttribute('aria-valuenow'))).toBe(after);
  });

  test('fit uses both axes: a wide window does not clamp the slide to 920px', async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 1000 });
    await openDemo(page);
    const w = await page.getByTestId('frame').evaluate((el) => el.getBoundingClientRect().width);
    expect(w).toBeGreaterThan(1000);
    const stage = page.getByTestId('stage');
    const dims = await stage.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
    expect(dims.sh).toBeLessThanOrEqual(dims.ch + 1);
  });

  test('the sheet renders one block per commented slide with translucent markers', async ({ page }) => {
    await openDemo(page);
    await drawRegion(page, [0.1, 0.1], [0.3, 0.3], 'one');
    await page.getByRole('button', { name: 'General note' }).click();
    await page.getByRole('textbox', { name: /new general note/i }).fill('general');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByTestId('frame').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Slide 2 / 8')).toBeVisible();
    await drawRegion(page, [0.2, 0.2], [0.4, 0.5], 'two, 日本語のコメント');
    await page.getByRole('button', { name: 'Comment sheet' }).click();
    const blocks = page.getByTestId('sheet-block');
    await expect(blocks).toHaveCount(2);
    const fill = await page.locator('.sheet-frame rect.markrect').first().evaluate((el) => getComputedStyle(el).fill);
    expect(fill).not.toBe('rgb(0, 0, 0)');
    // Chromium reports color-mix results as color(srgb r g b / a); rgba(...) is also fine.
    const m = fill.match(/\/\s*([\d.]+)\s*\)$/) ?? fill.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
    expect(m, `fill was ${fill}`).not.toBeNull();
    expect(Number(m![1])).toBeLessThan(0.5);
    expect(Number(m![1])).toBeGreaterThan(0);
    await expect(page.getByText('General notes')).toBeVisible();
  });

  test('exports produce files: PDF with pages, HTML, Markdown bundle, project zip', async ({ page }) => {
    await openDemo(page);
    await drawRegion(page, [0.1, 0.1], [0.3, 0.3], '日本語のコメント and Latin');
    await page.getByRole('button', { name: 'Comment sheet' }).click();

    const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()]);
    const pdfPath = await pdf.path();
    const { readFileSync } = await import('node:fs');
    const bytes = readFileSync(pdfPath!);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    const pageCount = (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pageCount).toBe(1);
    // Non-Latin text goes in as an image, so at least one image object exists.
    expect(bytes.toString('latin1')).toMatch(/\/Subtype\s*\/Image/);

    const [html] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download HTML' }).click()]);
    const htmlText = readFileSync((await html.path())!, 'utf8');
    expect(htmlText).toContain('<meta charset="utf-8">');
    expect(htmlText).toContain('日本語のコメント');
    expect(htmlText).toMatch(/data:image\/png;base64,/);

    const [md] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Markdown bundle' }).click()]);
    expect(md.suggestedFilename()).toMatch(/review-notes\.zip$/);

    const [proj] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save project' }).first().click()]);
    expect(proj.suggestedFilename()).toMatch(/\.slidenotes\.zip$/);
  });

  test('a project file round-trips back into the tool', async ({ page }) => {
    await openDemo(page);
    await drawRegion(page, [0.1, 0.1], [0.3, 0.3], 'round trip');
    const [proj] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save project' }).click()]);
    const path = (await proj.path())!;
    // Wipe storage and reopen the project.
    await page.evaluate(() => indexedDB.deleteDatabase('slidenotes'));
    await page.goto('./');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open a project file' }).click()]);
    const { readFileSync: read } = await import('node:fs');
    await chooser.setFiles({ name: 'demo.slidenotes.zip', mimeType: 'application/zip', buffer: read(path) });
    await page.getByTestId('frame').waitFor();
    await expect(page.locator('.frame rect.markrect')).toHaveCount(1);
    await expect(page.getByText('round trip')).toBeVisible();
  });
});

test.describe('import', () => {
  test('a PDF renders through the bundled worker under the production base path', async ({ page }) => {
    const failures: string[] = [];
    page.on('response', (r) => {
      if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('./');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose PDF, PowerPoint or images' }).click()]);
    await chooser.setFiles('tests/e2e/fixtures/two-slides.pdf');
    await page.getByTestId('frame').waitFor();
    await expect(page.getByRole('navigation', { name: 'Slides' }).getByRole('button')).toHaveCount(2);
    await expect(page.getByText('Slide 1 / 2')).toBeVisible();
    // The page text became the slide description for screen readers.
    await expect(page.locator('#slide-description')).toContainText('Fixture slide one');
    expect(failures).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('a PowerPoint file opens the convert-or-export dialog', async ({ page }) => {
    await page.goto('./');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose PDF, PowerPoint or images' }).click()]);
    await chooser.setFiles({ name: 'deck.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: Buffer.from('PK') });
    const dialog = page.getByRole('dialog', { name: 'PowerPoint file' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('deck.pptx');
    await expect(dialog.getByRole('button', { name: 'Convert in this browser' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  // Downloads the 52 MB LibreOffice engine from ZetaOffice's CDN: opt in with
  // SLIDENOTES_E2E_PPTX=1 (pnpm test:e2e:pptx). Exercises the service-worker reload path.
  test('PowerPoint conversion in the browser via the isolation service worker', async ({ page }) => {
    test.skip(!process.env.SLIDENOTES_E2E_PPTX, 'set SLIDENOTES_E2E_PPTX=1 to run the 52 MB engine test');
    test.setTimeout(10 * 60_000);
    await page.goto('./');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose PDF, PowerPoint or images' }).click()]);
    await chooser.setFiles('tests/e2e/fixtures/two-slides.pptx');
    await page.getByRole('button', { name: 'Convert in this browser' }).click();
    // The page reloads once with the service worker, resumes the parked file, converts it.
    await page.getByTestId('frame').waitFor({ timeout: 9 * 60_000 });
    expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
    await expect(page.getByRole('navigation', { name: 'Slides' }).getByRole('button')).toHaveCount(2);
    await expect(page.locator('#slide-description')).toContainText('Fixture slide one');
    await expect(page.getByRole('button', { name: /two-slides/ })).toBeVisible();
  });

  test('reopening a project replaces the stored copy instead of merging', async ({ page }) => {
    await openDemo(page);
    await drawRegion(page, [0.1, 0.1], [0.3, 0.3], 'kept');
    const [proj] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save project' }).click()]);
    const { readFileSync } = await import('node:fs');
    const buffer = readFileSync((await proj.path())!);
    // Add a second comment after saving, then reopen the older file.
    await drawRegion(page, [0.5, 0.5], [0.7, 0.7], 'newer local');
    await expect(page.locator('.frame rect.markrect')).toHaveCount(2);
    await page.getByRole('button', { name: /Demo deck/ }).first().click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open a project file' }).click()]);
    await chooser.setFiles({ name: 'demo.slidenotes.zip', mimeType: 'application/zip', buffer });
    await expect(page.getByText('kept')).toBeVisible();
    await expect(page.locator('.frame rect.markrect')).toHaveCount(1);
    await expect(page.getByText('newer local')).toHaveCount(0);
  });
});

test.describe('region controls', () => {
  test('middle-click and space-drag still pan through a selected region, and handles show resize cursors', async ({ page }) => {
    await openDemo(page);
    await drawRegion(page, [0.2, 0.2], [0.6, 0.6], 'big');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
    const stage = page.getByTestId('stage');
    await stage.evaluate((el) => { el.scrollLeft = 150; el.scrollTop = 100; });
    const frame = page.getByTestId('frame');
    // Select by pressing inside the region (no move), then verify cursors and panning.
    const box = (await frame.boundingBox())!;
    const vp = page.viewportSize()!;
    const px = Math.min(box.x + box.width * 0.4, vp.width - 100);
    const py = Math.min(box.y + box.height * 0.4, vp.height - 100);
    await page.mouse.click(px, py);
    await expect(page.locator('.handle')).toHaveCount(8);
    const cursor = await page.locator('.handle.se').evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe('nwse-resize');
    const frameCursor = await frame.evaluate((el) => getComputedStyle(el).cursor);
    expect(frameCursor).toBe('crosshair');

    await page.mouse.move(px, py);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(px - 60, py - 40, { steps: 4 });
    await page.mouse.up({ button: 'middle' });
    const s1 = await stage.evaluate((el) => ({ l: el.scrollLeft, t: el.scrollTop }));
    expect(s1.l).toBeGreaterThan(150);
    expect(s1.t).toBeGreaterThan(100);

    await page.keyboard.down('Space');
    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.mouse.move(px + 50, py + 30, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    const s2 = await stage.evaluate((el) => ({ l: el.scrollLeft, t: el.scrollTop }));
    expect(s2.l).toBeLessThan(s1.l);
    // The region itself did not move during either pan.
    const r = await page.locator('.frame rect.markrect').first().evaluate((el) => ({ x: +el.getAttribute('x')! }));
    expect(r.x).toBeCloseTo(20, 0);
  });
});
