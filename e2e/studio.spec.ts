import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { unzipSync, strFromU8 } from 'fflate';

const nav = (page: import('@playwright/test').Page, label: string) =>
  page.locator('.main-navigation').getByRole('button', { name: label });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Frozen Light', exact: true })).toBeVisible();
});

test('both complete samples are immediately playable', async ({ page }) => {
  await expect(page.locator('.visual-clip')).toHaveCount(12);
  await expect(page.locator('.studio-summary')).toContainText('45.0s');
  await expect(page.locator('.preview-image')).toBeVisible();
  await page.getByRole('button', { name: 'Play timeline preview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause timeline', exact: true })).toBeVisible();
  await expect
    .poll(async () => (await page.locator('.transport-time').textContent())?.startsWith('00:00:00'))
    .toBe(false);
  await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
  await page.getByRole('button', { name: 'Switch project' }).click();
  await page
    .locator('.project-menu')
    .getByRole('button', { name: /Flagship Product/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Flagship Product', exact: true })).toBeVisible();
  await expect(page.locator('.visual-clip')).toHaveCount(8);
  await expect(page.locator('.studio-summary')).toContainText('15.0s');
  await expect(page.getByRole('spinbutton', { name: 'Duration in seconds' })).toHaveValue('0.7');
  await page.getByRole('button', { name: 'Play timeline preview', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Frame title', exact: true })).toHaveValue(
    'Meet ARC One',
    { timeout: 4000 },
  );
  await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
});

test('scene edits drive live subtitles, ducking, timing, undo, and autosave', async ({ page }) => {
  await page.getByRole('button', { name: 'Select frame 3: First contact', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Narration text', exact: true })).toHaveValue('');
  await expect(page.locator('.preview-meter')).toContainText('0 dB');
  await page
    .getByRole('textbox', { name: 'Narration text', exact: true })
    .fill('A quiet discovery.');
  await expect(page.locator('.subtitle')).toHaveText('A quiet discovery.');
  await expect(page.locator('.preview-meter')).toContainText('−12 dB');
  const duration = page.getByRole('spinbutton', { name: 'Duration in seconds' });
  await duration.fill('3.5');
  await duration.press('Tab');
  await expect(page.locator('.studio-summary')).toContainText('46.5s');
  await expect(page.getByRole('spinbutton', { name: 'End in seconds' })).toHaveValue('12.5');
  await page.getByRole('button', { name: 'Undo last change' }).click();
  await expect(page.locator('.studio-summary')).toContainText('45.0s');
  await page.getByRole('button', { name: 'Redo last change' }).click();
  await expect(page.locator('.studio-summary')).toContainText('46.5s');
  await expect(page.locator('.save-indicator')).toHaveText('All changes saved');
  await page.reload();
  await page.getByRole('button', { name: 'Select frame 3: First contact', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Narration text', exact: true })).toHaveValue(
    'A quiet discovery.',
  );
  await expect(page.getByRole('spinbutton', { name: 'Duration in seconds' })).toHaveValue('3.5');
});

test('add, duplicate, remove, reorder, resize, and vertical timeline work', async ({ page }) => {
  await page.getByRole('button', { name: 'Add beat', exact: true }).click();
  await expect(page.locator('.visual-clip')).toHaveCount(13);
  await expect(page.getByRole('textbox', { name: 'Frame title', exact: true })).toHaveValue(
    'A new moment',
  );
  await page.getByRole('button', { name: 'Duplicate selected frame' }).click();
  await expect(page.locator('.visual-clip')).toHaveCount(14);
  await page.getByRole('button', { name: 'Delete selected frame' }).click();
  await page.getByRole('button', { name: 'Remove frame', exact: true }).click();
  await expect(page.locator('.visual-clip')).toHaveCount(13);
  await page.getByRole('button', { name: 'Undo last change' }).click();
  await expect(page.locator('.visual-clip')).toHaveCount(14);
  await page.locator('.visual-clip').first().dragTo(page.locator('.visual-clip').nth(3));
  await expect(page.getByRole('textbox', { name: 'Frame title', exact: true })).toHaveValue(
    'The quiet frontier',
  );
  await expect(page.locator('.frame-number')).toHaveText('04');
  const fitWidth = await page.locator('.timeline-content').evaluate((e) => e.clientWidth);
  await page.getByRole('button', { name: 'Zoom in timeline' }).click();
  expect(await page.locator('.timeline-content').evaluate((e) => e.clientWidth)).toBeGreaterThan(
    fitWidth,
  );
  await page.getByRole('button', { name: 'Reset timeline zoom' }).click();
  const before = await page.locator('.studio-summary').textContent();
  const handle = page.getByRole('separator', { name: 'Resize frame 4', exact: true });
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + 27, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.studio-summary')).not.toHaveText(before!);
  await page.getByRole('button', { name: 'Switch to vertical timeline' }).click();
  await expect(page.locator('.vertical-beat')).toHaveCount(14);
  await page.locator('.vertical-beat').nth(5).click();
  await expect(page.locator('.frame-number')).toHaveText('06');
});

test('continuity lock and per-shot overrides compile from current edits', async ({ page }) => {
  await nav(page, 'Continuity bible').click();
  await page.getByRole('textbox', { name: 'Project title', exact: true }).fill('Wrath of Fire');
  await page
    .getByRole('textbox', { name: 'Default camera lens rig' })
    .fill('ARRI Alexa 35, 75mm, f/2');
  await page.getByRole('button', { name: '9:16 Vertical' }).click();
  await nav(page, 'Timeline studio').click();
  await page.getByRole('tab', { name: 'Visual optics' }).click();
  expect(
    await page.locator('.cinema-frame').evaluate((e) => e.clientWidth / e.clientHeight),
  ).toBeCloseTo(9 / 16, 2);
  await expect(page.getByRole('textbox', { name: 'Per-shot camera rig' })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Visual prompt', exact: true })).toHaveValue(
    /ARRI Alexa 35/,
  );
  await nav(page, 'Continuity bible').click();
  await page.getByRole('switch', { name: 'Global continuity lock' }).click();
  await nav(page, 'Timeline studio').click();
  await page.getByRole('tab', { name: 'Visual optics' }).click();
  await page.getByRole('textbox', { name: 'Per-shot camera rig' }).fill('Hasselblad, 35mm');
  await page
    .getByRole('textbox', { name: 'Lighting and atmosphere' })
    .fill('Golden light over volcanic ash');
  await expect(page.locator('.prompt-strip')).toContainText('Hasselblad, 35mm');
  await nav(page, 'Export compiler').click();
  await expect(page.locator('.code-view')).toContainText('Wrath of Fire');
  await expect(page.locator('.code-view')).toContainText('Hasselblad, 35mm');
  await page.getByRole('tab', { name: 'Remotion props' }).click();
  await expect(page.locator('.code-view')).toContainText('"width": 1080');
});

test('voice JSON validates before applying and reassigns missing speakers', async ({ page }) => {
  await nav(page, 'Voice profiles').click();
  await expect(page.locator('.voice-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'JSON editor', exact: true }).click();
  await page.getByRole('textbox', { name: 'Voice profiles JSON editor' }).fill('{bad json');
  await page.getByRole('button', { name: 'Apply voice map' }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid JSON');
  await page.getByRole('textbox', { name: 'Voice profiles JSON editor' }).fill(
    JSON.stringify({
      Narrator: {
        voice_seed_id: 'consistent_42',
        speaking_rate_wpm: 120,
        timbre_notes: 'Warm, intimate, measured',
      },
    }),
  );
  await page.getByRole('button', { name: 'Apply voice map' }).click();
  await expect(page.locator('.validation-error')).toHaveCount(0);
  await nav(page, 'Timeline studio').click();
  await expect(
    page.getByRole('combobox', { name: 'Character speaker' }).locator('option'),
  ).toHaveCount(1);
  await expect(page.locator('.speech-estimate')).toContainText('120 wpm');
  await page.getByRole('button', { name: 'Select frame 4: Something below' }).click();
  await expect(page.getByRole('combobox', { name: 'Character speaker' })).toHaveValue('Narrator');
  await nav(page, 'Voice profiles').click();
  await page.getByRole('button', { name: 'Add voice', exact: true }).click();
  await page.getByRole('textbox', { name: 'New voice name' }).fill('Mara');
  await page.getByRole('dialog').getByRole('button', { name: 'Add voice', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mara', exact: true })).toBeVisible();
});

test('script generation replaces beats only after confirmation and can be undone', async ({
  page,
}) => {
  await nav(page, 'Script & beats').click();
  await page
    .getByRole('textbox', { name: 'Script text' })
    .fill(
      'Narrator: A new signal crosses the darkness.\n\nCharacter A: We should follow it.\n\n[Visual: A door opens in the ice]',
    );
  const target = page.getByRole('spinbutton', { name: 'Target duration', exact: true });
  await target.fill('90');
  await target.press('Tab');
  await expect(target).toHaveValue('90');
  await page.getByRole('button', { name: 'Generate beat timeline' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Generate timeline', exact: true }).click();
  await expect(page.locator('.visual-clip')).toHaveCount(3);
  await expect(page.locator('.studio-summary')).toContainText('90.0s');
  await page.getByRole('button', { name: 'Undo last change' }).click();
  await expect(page.locator('.visual-clip')).toHaveCount(12);
});

test('all exports download valid live data, including a ZIP bundle', async ({ page }) => {
  await nav(page, 'Export compiler').click();
  for (const [tab, name] of [
    ['Beat-split JSON', 'timeline_manifest.json'],
    ['FFMPEG pipeline', 'render_pipeline.sh'],
    ['Remotion props', 'remotion_props.json'],
  ]) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    const file = await pending;
    expect(file.suggestedFilename()).toBe(name);
    const path = await file.path();
    expect(path).toBeTruthy();
    const text = readFileSync(path!, 'utf8');
    if (name.endsWith('.json')) expect(() => JSON.parse(text)).not.toThrow();
    else expect(() => execFileSync('bash', ['-n', path!])).not.toThrow();
  }
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download bundle', exact: true }).click();
  const bundle = await pending;
  expect(bundle.suggestedFilename()).toBe('frozen-light-production-bundle.zip');
  const unpacked = unzipSync(readFileSync((await bundle.path())!));
  expect(Object.keys(unpacked)).toEqual([
    'timeline_manifest.json',
    'render_pipeline.sh',
    'remotion_props.json',
    'README.txt',
  ]);
  expect(JSON.parse(strFromU8(unpacked['timeline_manifest.json'])).total_duration_sec).toBe(45);
});

test('copy exports uses the currently selected compiler', async ({ page }) => {
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as any).__copiedExport = text;
        },
      },
    }),
  );
  await nav(page, 'Export compiler').click();
  await page.getByRole('tab', { name: 'FFMPEG pipeline' }).click();
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__copiedExport)).toMatch(
    /^#!\/usr\/bin\/env bash/,
  );
});

test('a blank project becomes a commercial timeline without losing samples', async ({ page }) => {
  await page.locator('.creative-card').getByRole('button', { name: 'New project' }).click();
  await page.getByRole('textbox', { name: 'New project title' }).fill('A better kind of quiet');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(
    page.getByRole('heading', { name: 'A better kind of quiet', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Script text' })
    .fill(
      '[Visual: A product in darkness]\nNarrator: Meet your tomorrow.\nNarrator: Built around you.\nNarrator: Find your quiet.',
    );
  await page.getByRole('button', { name: /Commercial beat mode/ }).click();
  await page.getByRole('button', { name: '15s', exact: true }).click();
  await page.getByRole('button', { name: 'Generate beat timeline' }).click();
  await expect(page.locator('.visual-clip')).toHaveCount(4);
  await expect(page.locator('.studio-summary')).toContainText('15.0s');
  await expect(page.getByRole('spinbutton', { name: 'Duration in seconds' })).toHaveValue('0.7');
  await page.getByRole('button', { name: 'Switch project' }).click();
  await expect(
    page.locator('.project-menu').getByRole('button', { name: /Frozen Light/ }),
  ).toBeVisible();
  await expect(
    page.locator('.project-menu').getByRole('button', { name: /Flagship Product/ }),
  ).toBeVisible();
});

test('mobile navigation, editing pages, and modals are usable without page overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const overflow = async () =>
    page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(await overflow()).toBe(false);
  await page.getByRole('button', { name: 'Open workspace navigation' }).click();
  await nav(page, 'Script & beats').click();
  await expect(page.getByRole('textbox', { name: 'Script text' })).toBeVisible();
  expect(await overflow()).toBe(false);
  await page.getByRole('button', { name: 'Open workspace navigation' }).click();
  await nav(page, 'Continuity bible').click();
  await expect(page.getByRole('textbox', { name: 'Project title', exact: true })).toBeVisible();
  expect(await overflow()).toBe(false);
  await page.getByRole('button', { name: 'Open workspace navigation' }).click();
  await nav(page, 'Voice profiles').click();
  await expect(page.locator('.voice-card')).toHaveCount(2);
  expect(await overflow()).toBe(false);
  await page.getByRole('button', { name: 'Open workspace navigation' }).click();
  await nav(page, 'Export compiler').click();
  await expect(page.locator('.code-view')).toBeVisible();
  expect(await overflow()).toBe(false);
  await page.getByRole('button', { name: 'Quick guide' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('all editing views stay within a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.reload();
  for (const label of [
    'Timeline studio',
    'Script & beats',
    'Continuity bible',
    'Voice profiles',
    'Export compiler',
  ]) {
    await page.getByRole('button', { name: 'Open workspace navigation' }).click();
    await nav(page, label).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      label,
    ).toBeLessThanOrEqual(320);
  }
});

test('all five main views pass automated WCAG accessibility checks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const label of [
    'Timeline studio',
    'Script & beats',
    'Continuity bible',
    'Voice profiles',
    'Export compiler',
  ]) {
    await nav(page, label).click();
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(audit.violations, label).toEqual([]);
  }
});
