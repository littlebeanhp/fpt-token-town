import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';

const output = process.env.FORCE_WEBGL ? 'test-results/webgl' : 'test-results';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: !process.env.HEADED,
  args: [
    '--no-sandbox',
    '--enable-unsafe-webgpu',
    '--enable-unsafe-swiftshader',
    '--enable-features=Vulkan',
    '--use-angle=vulkan',
    '--use-vulkan=swiftshader',
    '--use-webgpu-adapter=swiftshader',
    '--disable-vulkan-surface',
    '--ignore-gpu-blocklist',
  ],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
page.setDefaultTimeout(60000);
if (process.env.FORCE_WEBGL)
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
const settled = async () => {
  await page.waitForFunction(
    () => document.querySelector('canvas')?.dataset.transition === 'idle',
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(700);
};
const errors = [];
page.on('pageerror', (error) => {
  errors.push(error.message);
  console.log('PAGE ERROR', error.stack);
});
page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type()))
    console.log(message.type(), message.text().slice(0, 500));
});
try {
  await page.goto(process.env.TEST_URL ?? 'http://localhost:3000', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.locator('.model-nav').first().waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.model-nav').disabled, {
    timeout: 60000,
  });
  await page.waitForTimeout(1500);
  console.log('Renderer:', await page.locator('canvas').getAttribute('data-backend'));
  await page.screenshot({ path: `${output}/desktop-day.png`, fullPage: true });
  const first = await page.locator('canvas').screenshot();
  const pixels = PNG.sync.read(first).data;
  let colored = 0;
  for (let i = 0; i < pixels.length; i += 4)
    if (
      Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) -
        Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) >
      35
    )
      colored++;
  assert.ok(colored > 5000, `Canvas has visible geometry: ${colored} colorful pixels`);
  await page.waitForTimeout(800);
  const second = await page.locator('canvas').screenshot();
  assert.notDeepEqual(first, second, 'Animated scene changes over time');
  await page.locator('.model-nav').nth(1).click();
  await settled();
  await page.screenshot({ path: `${output}/desktop-focused.png`, fullPage: true });
  assert.match(await page.locator('.model-panel h2').innerText(), /GLM/);
  await page.getByRole('button', { name: 'Night mode', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.lighting === 'night');
  await page.screenshot({ path: `${output}/desktop-night-focused.png`, fullPage: true });
  await page.getByRole('button', { name: 'All factories', exact: true }).click();
  await settled();
  await page.screenshot({ path: `${output}/desktop-night.png`, fullPage: true });
  await page.getByRole('button', { name: 'Get API access' }).click();
  assert.equal(await page.locator('dialog').isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog').count(), 0);
  await page.getByRole('button', { name: 'Day mode', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.lighting === 'day');
  await page.setViewportSize({ width: 390, height: 844 });
  await settled();
  await page.screenshot({ path: `${output}/mobile-day.png`, fullPage: true });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    'No horizontal page overflow',
  );
  await page.locator('.model-nav').first().click();
  await settled();
  await page.screenshot({ path: `${output}/mobile-focused.png`, fullPage: true });
  await page.getByRole('button', { name: 'All factories', exact: true }).click();
  await settled();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await settled();
  // Use the projected label as a reference, then hit actual building geometry beneath it.
  const label = await page.locator('[data-model="deepseek"]').boundingBox();
  await page.mouse.click(label.x + label.width / 2, label.y + label.height + 45);
  await settled();
  assert.match(await page.locator('.model-panel h2').innerText(), /DeepSeek/);
  await page.mouse.click(1380, 185);
  await settled();
  assert.equal(await page.locator('.model-panel').count(), 0, 'Background returns to overview');
  for (let i = 0; i < 6; i++) await page.locator('.model-nav').nth(i).click();
  await settled();
  assert.equal(
    await page.locator('.model-panel h2').innerText(),
    'GPT-OSS',
    'Rapid selection resolves to latest factory',
  );
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(
    'PASS: rendered pixels, animation, raycast selection, background reset, rapid selection, focus, day/night, API dialog, mobile overflow.',
  );
} finally {
  await browser.close();
}
