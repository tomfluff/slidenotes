import type { Page } from '@playwright/test';

/** Loads the demo deck and waits for the stage to appear. */
export async function openDemo(page: Page): Promise<void> {
  await page.goto('./');
  await page.getByRole('button', { name: 'Try the demo deck' }).click();
  await page.getByTestId('frame').waitFor();
  await page.locator('.frame img').first().waitFor({ state: 'visible' });
}

/** Drags on the frame from one fraction to another and returns the stored rect after saving. */
export async function drawRegion(page: Page, from: [number, number], to: [number, number], text: string): Promise<void> {
  const frame = page.getByTestId('frame');
  const box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 6 });
  await page.mouse.up();
  const ta = page.getByRole('textbox', { name: /new comment on region/i });
  await ta.fill(text);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}
