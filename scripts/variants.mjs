// Screenshots the slide frame styles and marker styles for comparison, into .impeccable/review.
// Needs the production preview running on :4173.
import { chromium } from '@playwright/test';
const out = '.impeccable/review';
const browser = await chromium.launch();
async function shot(name, settings, scheme = 'light') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  await ctx.addInitScript((s) => {
    localStorage.setItem('slidenotes-settings', JSON.stringify({ state: s, version: 2 }));
  }, settings);
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/slidenotes/');
  await page.getByRole('button', { name: 'Try the demo deck' }).click();
  await page.locator('.frame img').first().waitFor({ state: 'visible' });
  const frame = page.getByTestId('frame');
  const draw = async (a, b, text) => {
    const box = await frame.boundingBox();
    await page.mouse.move(box.x + box.width * a[0], box.y + box.height * a[1]);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * b[0], box.y + box.height * b[1], { steps: 5 });
    await page.mouse.up();
    await page.getByRole('textbox').fill(text);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
  };
  await draw([0.08, 0.16], [0.7, 0.36], 'Title wraps to two lines.');
  await draw([0.08, 0.52], [0.5, 0.6], 'Subtitle contrast is low.');
  await page.getByRole('button', { name: 'Dismiss hint' }).click().catch(() => {});
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/${name}.png` });
  await ctx.close();
}
for (const frame of ['mat', 'thin', 'none']) await shot(`frame-${frame}`, { frame, hintDismissed: true });
for (const markerStyle of ['solid', 'outline', 'corners', 'edge']) await shot(`marker-${markerStyle}`, { markerStyle, frame: 'thin', hintDismissed: true });
await shot('dark-thin-outline', { frame: 'thin', markerStyle: 'outline', hintDismissed: true }, 'dark');
// Settings dialog and a selected region with handles
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/slidenotes/');
  await page.getByRole('button', { name: 'Try the demo deck' }).click();
  await page.locator('.frame img').first().waitFor({ state: 'visible' });
  const frame = page.getByTestId('frame');
  const box = await frame.boundingBox();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('textbox').fill('Selected region');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: /^Region 1 on slide 1/ }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/selected-region.png` });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/settings-v2.png` });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Help and keyboard shortcuts' }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/help.png` });
  await ctx.close();
}
await browser.close();
