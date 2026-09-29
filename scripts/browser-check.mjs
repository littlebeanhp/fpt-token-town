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
  deviceScaleFactor: Number(process.env.TEST_DPR ?? 1),
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
  await page.getByRole('button', { name: 'Next stop', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.backend);
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

  // A full-screen scene replaces the header and model dock.
  assert.equal(await page.locator('.topbar, .model-dock, footer').count(), 0);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight),
    true,
  );
  await page.getByRole('button', { name: 'Return to FPT Core' }).click();
  await settled();
  const dragBox = await page.locator('canvas').boundingBox();
  const dragX = dragBox.x + dragBox.width * 0.65;
  const dragY = dragBox.y + dragBox.height * 0.48;
  await page.mouse.move(dragX, dragY);
  await page.mouse.down();
  await page.mouse.move(dragX - 300, dragY, { steps: 12 });
  await page.mouse.up();
  const orbit = Number(await canvasData('orbit'));
  assert.ok(orbit > 0 && orbit <= Math.PI / 12 + 1e-8);
  await expectStop('core', 'Dragging orbits without switching buildings');
  await page.getByRole('button', { name: 'Next stop' }).click();
  await settled();
  assert.equal(Number(await canvasData('orbit')), 0, 'New stops reset the orbit');
  await page.keyboard.press('Home');
  await settled();

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
  await page.getByRole('button', { name: 'Return to FPT Core', exact: true }).click();
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
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Next stop' }).click();
  await settled();
  assert.equal(
    await page.locator('.model-panel h2').innerText(),
    'GPT-OSS',
    'Rapid selection resolves to latest stop',
  );
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(
    'PASS: rendered pixels, animation, core default, wrapping Next/Previous, keyboard, locked background clicks, bounded drag orbit, full-screen layout, time-lapse pause/play/speed/presets, day/dusk/night, API dialog, mobile overflow, rapid selection.',
  );
} finally {
  await browser.close();
}
