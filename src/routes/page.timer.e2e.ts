import { expect, test, type Page } from '@playwright/test';

async function addTask(page: Page, title: string, estimate = 1) {
	const before = await page.locator('[data-task-row]').count();
	await page.getByPlaceholder('Add a task…').fill(title);
	const estimateInput = page.locator('input[name="estimate"]').first();
	await estimateInput.fill(String(estimate));
	await page.getByRole('button', { name: 'Add' }).click();
	await expect(page.locator('[data-task-row]')).toHaveCount(before + 1);
}

test.beforeEach(async ({ request }) => {
	await request.post('/__test__/reset');
});

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1', { hasText: 'Pomodoro' })).toBeVisible();
});

test('timer section renders with Idle state on first paint', async ({ page }) => {
	await expect(page.locator('[data-timer]')).toBeVisible();
	await expect(page.locator('[data-phase-label]')).toHaveText('Idle');
	await expect(page.locator('[data-timer-time]')).toHaveText(/^\d{2}:\d{2}$/);
});

test('start focus selects the first non-archived task and shows the countdown ring', async ({
	page
}) => {
	await addTask(page, 'Focus me', 5);
	await expect(page.locator('[data-start-focus]')).toBeEnabled();

	await page.click('[data-start-focus]');

	await expect(page.locator('[data-timer][data-state="focus-running"]')).toBeVisible();
	await expect(page.locator('[data-phase-label]')).toHaveText('Focus');
	await expect(page.locator('[data-focusing-on]')).toContainText('Focus me');
	await expect(page.locator('[data-timer-time]')).toHaveText(/^25:00$/);
	await expect(page.locator('[data-timer-ring]')).toBeVisible();
	await expect(page.locator('[data-stop]')).toBeVisible();
});

test('stop mid-focus writes a focus_session row and increments actuals', async ({ page }) => {
	await addTask(page, 'Pomodoro me', 3);

	await page.clock.install({ time: new Date('2026-08-17T10:00:00-04:00') });
	await page.goto('/');
	await expect(page.locator('h1', { hasText: 'Pomodoro' })).toBeVisible();

	await page.click('[data-start-focus]');
	await expect(page.locator('[data-timer][data-state="focus-running"]')).toBeVisible();

	// Advance 5 minutes (well short of 25:00) and click Stop.
	await page.clock.runFor(5 * 60 * 1000);
	await page.click('[data-stop]');

	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();
	await expect(page.locator('[data-transitioning-prompt]')).toBeVisible();

	// Reload the page so the new actuals value is rendered via fresh loader.
	await page.reload();
	await expect(page.locator('[data-task-row]')).toHaveCount(1);
	await expect(page.locator('[data-act-est]').first()).toHaveText('1/3');
});

test('ring (natural 25:00) writes a focus_session row with end_cause=ring and routes to transitioning', async ({
	page
}) => {
	await addTask(page, 'Pomodoro ring', 2);
	await page.clock.install({ time: new Date('2026-08-17T10:00:00-04:00') });
	await page.goto('/');
	await expect(page.locator('h1', { hasText: 'Pomodoro' })).toBeVisible();

	await page.click('[data-start-focus]');
	await expect(page.locator('[data-timer][data-state="focus-running"]')).toBeVisible();

	// Advance the fake clock past 25:00 to fire ring().
	await page.clock.runFor(25 * 60 * 1000);

	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();
	await expect(page.locator('[data-transitioning-prompt]')).toHaveAttribute('data-prompt', 'break');

	// Reload to confirm the row was persisted with end_cause=ring and actuals=1.
	await page.reload();
	await expect(page.locator('[data-act-est]').first()).toHaveText('1/2');
});

test('refreshing mid-focus returns to idle with no in-flight focus recorded', async ({ page }) => {
	await addTask(page, 'Lost focus', 1);
	await page.clock.install({ time: new Date('2026-08-17T10:00:00-04:00') });
	await page.goto('/');
	await expect(page.locator('h1', { hasText: 'Pomodoro' })).toBeVisible();

	await page.click('[data-start-focus]');
	await expect(page.locator('[data-timer][data-state="focus-running"]')).toBeVisible();
	await page.clock.runFor(10 * 60 * 1000);

	// Reload — the in-flight focus should be lost (no row written).
	await page.reload();
	await expect(page.locator('[data-timer][data-state="idle"]')).toBeVisible();
	await expect(page.locator('[data-act-est]').first()).toHaveText('0/1');
});

test('over-estimate error tone shows when actuals exceed estimate', async ({ page }) => {
	test.setTimeout(120_000);
	await addTask(page, 'Overdo me', 2);

	await page.clock.install({ time: new Date('2026-08-17T10:00:00-04:00') });
	await page.goto('/');

	// Three full pomodoros against the same task; abort the prompt each
	// time so we return to idle quickly and can loop.
	for (let i = 0; i < 3; i++) {
		await page.click('[data-start-focus]');
		await expect(page.locator('[data-timer][data-state="focus-running"]')).toBeVisible();
		await page.clock.runFor(25 * 60 * 1000);
		await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();
		await page.click('[data-stop-prompt]');
		await expect(page.locator('[data-timer][data-state="idle"]')).toBeVisible();
	}

	// Refresh to pick up the persisted actuals (3 > estimate 2 → error tone).
	await page.reload();
	await expect(page.locator('[data-act-est]').first()).toHaveText('3/2');
	const classes = await page.locator('[data-act-est]').first().getAttribute('class');
	expect(classes ?? '').toContain('text-[var(--error)]');
});

test('cross-midnight attribution: started 11:30pm Monday writes the row under Monday', async ({
	browser
}) => {
	// The user must be on a TZ where "11:30pm Monday" maps to local Monday;
	// America/New_York in August is EDT (UTC-4). Bring up a fresh context
	// with that timezone; the default Linux TZ is UTC, which would map the
	// fake-clock UTC instant to Tuesday and defeat the attribution test.
	const ctx = await browser.newContext({ timezoneId: 'America/New_York' });
	const tzPage = await ctx.newPage();

	await tzPage.goto('/');
	await expect(tzPage.locator('h1', { hasText: 'Pomodoro' })).toBeVisible();
	await addTask(tzPage, 'Late shift', 1);

	// 23:30 EDT on Monday Aug 17, 2026 → 03:30 UTC Tue Aug 18.
	await tzPage.clock.install({ time: new Date('2026-08-17T23:30:00-04:00') });
	await tzPage.goto('/');
	await tzPage.click('[data-start-focus]');

	// Drive past midnight local (and into Tuesday UTC by some hours).
	await tzPage.clock.runFor(45 * 60 * 1000);

	// The row's local_day should be Monday (started_day).
	const localDays = await tzPage.evaluate(async () => {
		const res = await fetch('/__test__/focus-day');
		return res.json();
	});
	expect(localDays).toMatchObject([{ day: '2026-08-17' }]);

	await ctx.close();
});
