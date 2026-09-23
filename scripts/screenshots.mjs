// Captures desktop, dark and phone screenshots of every view into .impeccable/review.
// Needs the production preview running: pnpm build && pnpm preview --port 4173
import { chromium } from '@playwright/test';
const out = '.impeccable/review';
const browser = await chromium.launch();
async function session(name, opts) {
  const ctx = await browser.newContext({ viewport: opts.viewport, colorScheme: opts.scheme ?? 'light', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/slidenotes/');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}-landing.png`, fullPage: true });
  await page.getByRole('button', { name: 'Try the demo deck' }).click();
  await page.locator('.frame img').first().waitFor({ state: 'visible' });
  const frame = page.getByTestId('frame');
  const box = await frame.boundingBox();
  const draw = async (a, b, text) => {
    await page.mouse.move(box.x + box.width * a[0], box.y + box.height * a[1]);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * b[0], box.y + box.height * b[1], { steps: 5 });
    await page.mouse.up();
    await page.getByRole('textbox').fill(text);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
  };
  await draw([0.08, 0.16], [0.7, 0.36], 'Title wraps to two lines; consider a shorter title or smaller size.');
  await draw([0.08, 0.52], [0.5, 0.6], 'Subtitle is muted grey on white, contrast is about 3.9:1.');
  await page.getByRole('button', { name: 'General note' }).click();
  await page.getByRole('textbox').fill('Add the venue and date to the title slide.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('ArrowRight');
  const box2 = await frame.boundingBox();
  await page.mouse.move(box2.x + box2.width * 0.1, box2.y + box2.height * 0.78);
  await page.mouse.down();
  await page.mouse.move(box2.x + box2.width * 0.7, box2.y + box2.height * 0.86, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('textbox').fill('フォントサイズが他の箇条書きと違います。');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}-review.png` });
  await page.locator('.card').first().hover();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/${name}-review-hover.png` });
  await page.getByRole('button', { name: 'Comment sheet' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}-sheet.png`, fullPage: true });
  await page.getByRole('button', { name: 'Back to review' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}-settings.png` });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /demo deck/i }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}-deckmenu.png` });
  await ctx.close();
}
await session('desktop', { viewport: { width: 1440, height: 900 } });
await session('dark', { viewport: { width: 1440, height: 900 }, scheme: 'dark' });
await session('mobile', { viewport: { width: 390, height: 844 } });
await browser.close();
