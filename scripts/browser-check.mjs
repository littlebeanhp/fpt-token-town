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
// Software-rendered CI runs near one frame per second, and GSAP lag smoothing then advances
// animations by about 33 ms per frame, so generous waits are needed there.
page.setDefaultTimeout(180000);
if (process.env.FORCE_WEBGL)
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
const canvasData = (key) =>
  page.evaluate((name) => document.querySelector('canvas')?.dataset[name], key);
const settled = async () => {
  await page.waitForFunction(
    () => document.querySelector('canvas')?.dataset.transition === 'idle',
    null,
    { timeout: 180000 },
  );
  await page.waitForTimeout(700);
};
const tourCount = () => page.locator('.tour-count').getAttribute('aria-label');
const expectStop = async (id, message) => assert.equal(await canvasData('selected'), id, message);
const lighting = (phase) =>
  page.waitForFunction(
    (value) => document.querySelector('canvas')?.dataset.lighting === value,
    phase,
    { timeout: 180000 },
  );
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
  await settled();
  await page.waitForTimeout(800);
  console.log('Renderer:', await canvasData('backend'));

  // The view opens locked on the FPT Core, with no overview mode to fall back to.
  await expectStop('core', 'The FPT Core is the default selection');
  assert.equal(await tourCount(), 'Stop 1 of 7');
  assert.equal(await page.getByRole('button', { name: 'Return to FPT Core' }).isDisabled(), true);
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

  // Next and Previous walk the tour and wrap at both ends.
  await page.getByRole('button', { name: 'Next stop' }).click();
  await settled();
  await expectStop('deepseek');
  assert.match(await page.locator('.model-panel h2').innerText(), /DeepSeek/);
  await page.getByRole('button', { name: 'Previous stop' }).click();
  await settled();
  await expectStop('core', 'Previous returns to the core');
  await page.getByRole('button', { name: 'Previous stop' }).click();
  await settled();
  await expectStop('gpt-oss', 'Previous wraps from the core to the last district');
  assert.equal(await tourCount(), 'Stop 7 of 7');
  await page.keyboard.press('ArrowRight');
  await settled();
  await expectStop('core', 'ArrowRight wraps from the last district to the core');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await settled();
  await expectStop('glm', 'Keyboard navigation is interruptible');
  await page.screenshot({ path: `${output}/desktop-focused.png`, fullPage: true });
  assert.match(await page.locator('.model-panel h2').innerText(), /GLM/);

  // Clicking empty city never drops the lock.
  const stage = await page.locator('canvas').boundingBox();
  await page.mouse.click(stage.x + stage.width * 0.97, stage.y + stage.height * 0.35);
  await settled();
  await expectStop('glm', 'Background clicks keep the current stop');

  // Neighbours are clickable through their floating tags and through the 3D scene.
  await page.locator('[data-stop="core"]').click();
  await settled();
  await expectStop('core', 'The core tag seen from GLM focuses the core');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await settled();
  await expectStop('glm');
  const neighbour = page.locator('[data-stop="deepseek"]');
  assert.equal(await neighbour.isVisible(), true, 'DeepSeek tag is visible from GLM');
  const tag = await neighbour.boundingBox();
  await page.mouse.click(tag.x + tag.width / 2, tag.y + tag.height + 45);
  await settled();
  await expectStop('deepseek', 'Raycast click focuses the neighbouring building');
  await page.getByRole('button', { name: 'Return to FPT Core' }).click();
  await settled();
  await expectStop('core', 'The home button returns to the core');
  await page.keyboard.press('ArrowRight');
  await settled();
  await page.keyboard.press('Home');
  await settled();
  await expectStop('core', 'Home returns to the core');

  // Milestone 2: the time-lapse clock pauses, resumes, changes speed, and jumps to presets.
  await page.getByRole('button', { name: 'Pause time-lapse' }).click();
  const held = await canvasData('clock');
  await page.waitForTimeout(1500);
  assert.equal(await canvasData('clock'), held, 'Paused clock holds its time');
  await page.getByRole('button', { name: 'Play time-lapse' }).click();
  await page.waitForFunction(
    (time) => document.querySelector('canvas')?.dataset.clock !== time,
    held,
  );
  await page.getByRole('button', { name: 'Time-lapse speed 4x' }).click();
  await page.getByRole('button', { name: 'Time-lapse speed 12x' }).waitFor();
  await page.getByRole('button', { name: 'Night mode', exact: true }).click();
  await lighting('night');
  assert.equal(await page.getByRole('button', { name: 'Play time-lapse' }).isVisible(), true);
  await page.getByRole('button', { name: 'Next stop' }).click();
  await settled();
  await page.screenshot({ path: `${output}/desktop-night-focused.png`, fullPage: true });
  await page.getByRole('button', { name: 'FPT Core', exact: true }).click();
  await settled();
  await expectStop('core', 'The panel back button returns to the core');
  await page.screenshot({ path: `${output}/desktop-night.png`, fullPage: true });
  await page.getByRole('button', { name: 'Dusk mode', exact: true }).click();
  await lighting('dusk');
  await page.screenshot({ path: `${output}/desktop-dusk.png`, fullPage: true });
  await page.getByRole('button', { name: 'Get API access' }).click();
  assert.equal(await page.locator('dialog').isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog').count(), 0);
  await page.getByRole('button', { name: 'Day mode', exact: true }).click();
  await lighting('day');

  await page.setViewportSize({ width: 390, height: 844 });
  await settled();
  await page.screenshot({ path: `${output}/mobile-day.png`, fullPage: true });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    'No horizontal page overflow',
  );
  await page.getByRole('button', { name: 'Next stop' }).click();
  await settled();
  await page.screenshot({ path: `${output}/mobile-focused.png`, fullPage: true });
  await expectStop('deepseek');
  await page.keyboard.press('Escape');
  await settled();
  await expectStop('core', 'Escape returns to the core');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await settled();
  for (let i = 0; i < 7; i++) await page.locator('.model-nav').nth(i).click();
  await settled();
  assert.equal(
    await page.locator('.model-panel h2').innerText(),
    'GPT-OSS',
    'Rapid selection resolves to latest stop',
  );
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(
    'PASS: rendered pixels, animation, core default, wrapping Next/Previous, keyboard, locked background clicks, raycast and tag selection, time-lapse pause/play/speed/presets, day/dusk/night, API dialog, mobile overflow, rapid selection.',
  );
} finally {
  await browser.close();
}
