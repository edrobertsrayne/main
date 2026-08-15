import { expect, test, type Page, type BrowserContext } from '@playwright/test';

async function addTask(page: Page, title: string, estimate = 1) {
	const before = await page.locator('[data-task-row]').count();
	await page.getByPlaceholder('Add a task…').fill(title);
	const estimateInput = page.locator('input[name="estimate"]').first();
	await estimateInput.fill(String(estimate));
	await page.getByRole('button', { name: 'Add' }).click();
	await expect(page.locator('[data-task-row]')).toHaveCount(before + 1);
}

/**
 * Install the fake clock + reload the page so the timer controller is
 * constructed against the fake clock. The order matters: install before
 * navigation, otherwise the controller captures the real clock.
 */
async function installClockAndReload(page: Page, time: Date, firstTaskTitle: string, estimate = 1) {
	await addTask(page, firstTaskTitle, estimate);
	await page.clock.install({ time });
	await page.goto('/');
	await expect(page.locator('[data-timer][data-state="idle"]')).toBeVisible();
}

test.beforeEach(async ({ request }) => {
	await request.post('/__test__/reset');
});

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1', { hasText: 'Pomodoro' })).toBeVisible();
});

// -- Single-ring UI tests ---------------------------------------------------
// Each of these drives at most one focus + one break. FSM transitions are
// exhaustively covered by timer-controller.spec.ts; the e2e seam proves the
// UI wiring (copy, layout, controls, palette) reads the controller state
// correctly. Keeping these single-iteration keeps the suite fast.

test('ring routes into the transitioning prompt that renders overlay-centered over the hero ring', async ({
	page
}) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Ring me', 2);

	await page.click('[data-start-focus]');
	await expect(page.locator('[data-timer][data-state="focus-running"]')).toBeVisible();

	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();

	// The prompt overlay sits inside the hero-ring container.
	const ring = page.locator('[data-timer-ring]');
	const prompt = page.locator('[data-transitioning-prompt]');
	await expect(prompt).toBeVisible();

	const ringBox = await ring.boundingBox();
	const promptBox = await prompt.boundingBox();
	expect(ringBox).not.toBeNull();
	expect(promptBox).not.toBeNull();
	if (ringBox && promptBox) {
		const ringCx = ringBox.x + ringBox.width / 2;
		const ringCy = ringBox.y + ringBox.height / 2;
		const promptCx = promptBox.x + promptBox.width / 2;
		const promptCy = promptBox.y + promptBox.height / 2;
		// The prompt's centre is roughly inside the ring (within 8px for
		// sub-pixel rounding).
		expect(Math.abs(promptCx - ringCx)).toBeLessThan(8);
		expect(Math.abs(promptCy - ringCy)).toBeLessThan(8);
	}
});

test('short-break prompt carries the correct copy and a "Long break" eyebrow is absent', async ({
	page
}) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Short', 1);

	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);

	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();
	await expect(page.locator('[data-transitioning-prompt]')).toHaveAttribute('data-prompt', 'break');
	await expect(page.locator('[data-prompt-question]')).toHaveText('Take a 5-minute break?');
	await expect(page.locator('[data-long-break-eyebrow]')).toHaveCount(0);
});

test('prompt has a depleting progress bar (width = remaining/30s) and an auto-confirm caption', async ({
	page
}) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Prompt bar', 1);

	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();

	const progress = page.locator('[data-prompt-progress]');
	const caption = page.locator('[data-prompt-auto-confirm]');

	const progressPct = () =>
		progress.evaluate((el) => {
			const inner = el as HTMLElement;
			const outer = inner.parentElement as HTMLElement;
			return (
				(parseFloat(getComputedStyle(inner).width) / parseFloat(getComputedStyle(outer).width)) *
				100
			);
		});

	const initialWidthPct = await progressPct();
	expect(initialWidthPct).toBeGreaterThan(95);
	expect(initialWidthPct).toBeLessThanOrEqual(100);
	await expect(caption).toHaveText(/^Auto-confirm in 0:\d{2}$/);
	await expect(caption).toHaveText('Auto-confirm in 0:30');

	// After 10s of fake-clock advance: progress ≈ 2/3, caption "0:20".
	await page.clock.runFor(10 * 1000);
	const midWidthPct = await progressPct();
	expect(midWidthPct).toBeGreaterThan(60);
	expect(midWidthPct).toBeLessThan(70);
	await expect(caption).toHaveText('Auto-confirm in 0:20');
});

test('Skip / Confirm pills are present on the prompt', async ({ page }) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Pills', 1);

	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();

	await expect(page.locator('[data-skip]')).toBeVisible();
	await expect(page.locator('[data-confirm]')).toBeVisible();
});

test('Confirm on a short-break prompt enters break-running (5-min timer)', async ({ page }) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Confirm me', 1);

	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-transitioning-prompt]')).toHaveAttribute('data-prompt', 'break');

	await page.click('[data-confirm]');
	await expect(page.locator('[data-timer][data-state="break-running"]')).toBeVisible();
	await expect(page.locator('[data-phase-label]')).toHaveText('Short break');
	await expect(page.locator('[data-timer-time]')).toHaveText(/^05:00$/);
});

test('30-second auto-confirm enters break-running without user input', async ({ page }) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Auto-confirm me', 1);

	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();

	await page.clock.runFor(30 * 1000);
	await expect(page.locator('[data-timer][data-state="break-running"]')).toBeVisible();
});

test('Skip returns to idle without starting a break', async ({ page }) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Skip me', 1);

	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();

	await page.click('[data-skip]');
	await expect(page.locator('[data-timer][data-state="idle"]')).toBeVisible();
});

test('break-running countdown runs to completion → idle', async ({ page }) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Break complete', 1);

	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await page.click('[data-confirm]');
	await expect(page.locator('[data-timer][data-state="break-running"]')).toBeVisible();

	await page.clock.runFor(5 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="idle"]')).toBeVisible();
});

test('stop from a break returns to idle (and a break ending does NOT auto-start focus)', async ({
	page
}) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Stop the break', 1);

	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await page.click('[data-confirm]');
	await expect(page.locator('[data-timer][data-state="break-running"]')).toBeVisible();

	await expect(page.locator('[data-break-controls] [data-stop]')).toBeVisible();
	await page.click('[data-break-controls] [data-stop]');

	await expect(page.locator('[data-timer][data-state="idle"]')).toBeVisible();
	await expect(page.locator('[data-start-focus]')).toBeVisible();

	// A fresh focus did NOT auto-start.
	await page.clock.runFor(60 * 1000);
	await expect(page.locator('[data-timer][data-state="idle"]')).toBeVisible();
});

test('fast-forward to focus from a break enters focus-running without a break row or prompt', async ({
	page
}) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Fast-forward', 1);

	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await page.click('[data-confirm]');
	await expect(page.locator('[data-timer][data-state="break-running"]')).toBeVisible();

	await page.click('[data-fast-forward-to-focus]');
	await expect(page.locator('[data-timer][data-state="focus-running"]')).toBeVisible();
	await expect(page.locator('[data-transitioning-prompt]')).toHaveCount(0);

	// No break-session row was written — actuals remain 1 (from the prior
	// focus's ring). Reload to fetch the persisted value.
	await page.reload();
	await expect(page.locator('[data-act-est]').first()).toHaveText('1/1');
});

test('stop from a focus offers the short-break prompt with no eyebrow', async ({ page }) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Stop focus', 1);

	await page.click('[data-start-focus]');
	await page.click('[data-stop]');

	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();
	await expect(page.locator('[data-transitioning-prompt]')).toHaveAttribute('data-prompt', 'break');
	await expect(page.locator('[data-long-break-eyebrow]')).toHaveCount(0);
	await expect(page.locator('[data-prompt-question]')).toHaveText('Take a 5-minute break?');
});

test('calm pill controls are visible only in their allowed phase', async ({ page }) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Pill', 1);

	// Idle: Start focus visible; Stop, Fast-forward-to-focus not visible.
	await expect(page.locator('[data-start-focus]')).toBeVisible();
	await expect(page.locator('[data-stop]')).toHaveCount(0);
	await expect(page.locator('[data-fast-forward-to-focus]')).toHaveCount(0);

	// Focus-running: Stop visible; Start focus / Fast-forward not.
	await page.click('[data-start-focus]');
	await expect(page.locator('[data-timer][data-state="focus-running"]')).toBeVisible();
	await expect(page.locator('[data-stop]')).toBeVisible();
	await expect(page.locator('[data-start-focus]')).toHaveCount(0);
	await expect(page.locator('[data-fast-forward-to-focus]')).toHaveCount(0);

	// Transitioning: prompt's Skip/Confirm visible; Stop not visible in
	// the controls row (the prompt has its own UI).
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();
	await expect(page.locator('[data-skip]')).toBeVisible();
	await expect(page.locator('[data-confirm]')).toBeVisible();
	await expect(page.locator('[data-stop]')).toHaveCount(0);

	// Break-running: Stop and Fast-forward-to-focus visible; Start focus not.
	await page.click('[data-confirm]');
	await expect(page.locator('[data-timer][data-state="break-running"]')).toBeVisible();
	await expect(page.locator('[data-break-controls] [data-stop]')).toBeVisible();
	await expect(page.locator('[data-fast-forward-to-focus]')).toBeVisible();
	await expect(page.locator('[data-start-focus]')).toHaveCount(0);
});

// -- Palette tests ----------------------------------------------------------
// Palette is a UI concern — single-ring drives are enough to verify the
// data-phase attribute flips and the CSS cascade swaps the tokens.

test('held palette swap: coral → sage at focus-end, observable via data-phase and the sage accent token', async ({
	page
}) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Palette', 1);

	const root = page.locator('[data-phase]').first();

	await expect(root).toHaveAttribute('data-phase', 'focus');
	// `--accent` is the cascade-resolved value seen by the data-phase
	// element — read it from that element (where the override actually
	// applies), not from documentElement (where the focus default holds).
	const focusAccent = await root.evaluate((el) =>
		getComputedStyle(el as HTMLElement)
			.getPropertyValue('--accent')
			.trim()
	);
	expect(focusAccent).toBe('#d9685a');

	await page.click('[data-start-focus]');
	await expect(page.locator('[data-timer][data-state="focus-running"]')).toBeVisible();
	await expect(root).toHaveAttribute('data-phase', 'focus');

	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();
	await expect(root).toHaveAttribute('data-phase', 'break');
	const breakAccent = await root.evaluate((el) =>
		getComputedStyle(el as HTMLElement)
			.getPropertyValue('--accent')
			.trim()
	);
	expect(breakAccent).toBe('#6b8a55');
});

test('palette swap: sage → coral at break-end, observable via data-phase', async ({ page }) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Palette swap back', 1);

	const root = page.locator('[data-phase]').first();

	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await page.click('[data-confirm]');
	await expect(page.locator('[data-timer][data-state="break-running"]')).toBeVisible();
	await expect(root).toHaveAttribute('data-phase', 'break');

	await page.clock.runFor(5 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="idle"]')).toBeVisible();
	await expect(root).toHaveAttribute('data-phase', 'focus');
});

test('palette transition uses 200ms cross-fade on palette-sensitive properties', async ({
	page
}) => {
	await page.goto('/');

	const transitionDuration = await page.evaluate(() => {
		return getComputedStyle(document.body).transitionDuration;
	});
	const durations = transitionDuration.split(',').map((s) => parseFloat(s) * 1000);
	expect(durations.some((d) => d >= 200 && d <= 210)).toBe(true);
});

test('under prefers-reduced-motion the palette cross-fade does not apply (no motion)', async ({
	browser
}) => {
	// Build a fresh context with reducedMotion=reduce. The Playwright
	// default test fixture doesn't expose reducedMotion, so we mint a
	// context manually for this assertion.
	const ctx: BrowserContext = await browser.newContext({ reducedMotion: 'reduce' });
	const page = await ctx.newPage();

	await page.goto('/');
	await expect(page.locator('h1', { hasText: 'Pomodoro' })).toBeVisible();

	const transitionDuration = await page.evaluate(() => {
		return getComputedStyle(document.body).transitionDuration;
	});
	const durations = transitionDuration.split(',').map((s) => parseFloat(s) * 1000);
	for (const d of durations) {
		expect(d).toBe(0);
	}

	await ctx.close();
});

test('content-semantic tokens (--error, --success) stay coral on both phases', async ({ page }) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Semantic tokens', 1);

	const focusSuccess = await page.evaluate(() =>
		getComputedStyle(document.documentElement).getPropertyValue('--success').trim()
	);
	const focusError = await page.evaluate(() =>
		getComputedStyle(document.documentElement).getPropertyValue('--error').trim()
	);

	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();

	const breakSuccess = await page.evaluate(() =>
		getComputedStyle(document.documentElement).getPropertyValue('--success').trim()
	);
	const breakError = await page.evaluate(() =>
		getComputedStyle(document.documentElement).getPropertyValue('--error').trim()
	);

	expect(breakSuccess).toBe(focusSuccess);
	expect(breakError).toBe(focusError);
	expect(focusSuccess).toBe('#6f8a4a');
	expect(focusError).toBe('#b8454a');
});

test('the prompt renders on sage (palette swap fires at focus-end before the prompt paints)', async ({
	page
}) => {
	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Prompt on sage', 1);

	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();

	// The prompt card is inside the data-phase=break subtree, so its
	// background-color must reflect var(--surface), which is now
	// --surface-break (sage). Read the resolved value directly off the
	// prompt card — that's the canonical "what color does this element
	// actually paint" question.
	const promptSurface = await page.evaluate(() => {
		const el = document.querySelector('[data-transitioning-prompt] > div');
		return el ? getComputedStyle(el as HTMLElement).backgroundColor : '';
	});
	// Sage --surface-break is #eff5e9 → rgb(239, 245, 233).
	expect(promptSurface).toBe('rgb(239, 245, 233)');
});

// -- Multi-iteration FSM tests ---------------------------------------------
// These two tests are the only places in the e2e suite that drive more than
// one focus ring. FSM transitions are otherwise covered at the unit-test
// seam (timer-controller.spec.ts has every ADR-0001 transition including
// the 4-rings long-break routing, the stop-resets-counter rule, and the
// gap-reset threshold). At the e2e seam we just need to verify the UI
// reads those rules correctly.

test('canonical cycle: 4 rings route to long-break, complete, and reset the cycle counter', async ({
	page
}) => {
	// This test exercises the full ADR-0001 cycle once and verifies every
	// UI signal the spec names at the e2e seam: long-break routing on the
	// 4th ring with eyebrow + 20-min copy; confirm → long-break-running;
	// the held palette swap coral→sage; long-break completion → idle;
	// the palette swap back sage→coral; the cycle-counter reset reflected
	// in the next ring (short-break prompt, no eyebrow).
	test.setTimeout(120_000);

	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Cycle', 5);

	const root = page.locator('[data-phase]').first();
	await expect(root).toHaveAttribute('data-phase', 'focus');

	await page.click('[data-start-focus]');
	// Three short cycles: ring, confirm short break, fast-forward.
	for (let i = 0; i < 3; i++) {
		await page.clock.runFor(25 * 60 * 1000);
		await expect(page.locator('[data-transitioning-prompt]')).toHaveAttribute(
			'data-prompt',
			'break'
		);
		await page.click('[data-confirm]');
		await expect(page.locator('[data-timer][data-state="break-running"]')).toBeVisible();
		await page.click('[data-fast-forward-to-focus]');
	}

	// 4th ring → long-break prompt with eyebrow + 20-min copy. Palette
	// swaps to sage.
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-transitioning-prompt]')).toHaveAttribute(
		'data-prompt',
		'long-break'
	);
	await expect(page.locator('[data-long-break-eyebrow]')).toHaveText('Long break');
	await expect(page.locator('[data-prompt-question]')).toHaveText('Take a 20-minute long break?');
	await expect(root).toHaveAttribute('data-phase', 'break');

	// Confirm → long-break-running (20-min timer).
	await page.click('[data-confirm]');
	await expect(page.locator('[data-timer][data-state="long-break-running"]')).toBeVisible();
	await expect(page.locator('[data-phase-label]')).toHaveText('Long break');
	await expect(page.locator('[data-timer-time]')).toHaveText(/^20:00$/);

	// Drive the long break to completion. Counter resets and palette
	// swaps back to coral.
	await page.clock.runFor(20 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="idle"]')).toBeVisible();
	await expect(root).toHaveAttribute('data-phase', 'focus');

	// Fresh cycle: the next ring should be counter=1 → short-break prompt.
	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-transitioning-prompt]')).toHaveAttribute('data-prompt', 'break');
	await expect(page.locator('[data-long-break-eyebrow]')).toHaveCount(0);
});

test('gap-reset: an idle gap longer than the long-break length between rings resets the counter', async ({
	page
}) => {
	// The minimum e2e coverage of the gap-reset rule: drive three
	// completed rings (counter=3), return to idle, advance past the
	// long-break length, ring again, and confirm the prompt is the
	// short-break one (the counter was reset by the gap, not just by a
	// stop). The full rule (gap threshold pinned to the long-break length,
	// measured from last_focus_end_at) is covered in
	// timer-controller.spec.ts.
	test.setTimeout(120_000);

	await installClockAndReload(page, new Date('2026-08-17T10:00:00-04:00'), 'Gap reset', 5);

	// Three rings → counter=3. Fast-forward between rings so we don't
	// have to wait for short breaks to complete.
	await page.click('[data-start-focus]');
	for (let i = 0; i < 3; i++) {
		await page.clock.runFor(25 * 60 * 1000);
		await page.click('[data-confirm]');
		if (i < 2) {
			await page.click('[data-fast-forward-to-focus]');
		}
	}
	// The 3rd short break is running; let it complete to idle with
	// counter=3 and a freshly-stamped lastFocusEndAt.
	await page.clock.runFor(5 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="idle"]')).toBeVisible();

	// Advance the fake clock past 20 min (long-break length + 1) so the
	// next start focus hits the gap-reset branch.
	await page.clock.runFor(20 * 60 * 1000 + 60 * 1000);

	// A fresh focus then ring: counter was reset to 0 on start, so the
	// ring lands on counter=1 → short-break prompt (no eyebrow).
	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-transitioning-prompt]')).toHaveAttribute('data-prompt', 'break');
	await expect(page.locator('[data-long-break-eyebrow]')).toHaveCount(0);
});
