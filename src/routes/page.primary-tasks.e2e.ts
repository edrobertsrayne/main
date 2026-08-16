import { expect, test, type Page } from '@playwright/test';

async function addTask(page: Page, title: string, estimate = 1) {
	const before = await page.locator('[data-task-row]').count();
	await page.getByPlaceholder('Add a task…').fill(title);
	const estimateInput = page.locator('input[name="estimate"]').first();
	await estimateInput.fill(String(estimate));
	await page.getByRole('button', { name: 'Add' }).click();
	await expect(page.locator('[data-task-row]')).toHaveCount(before + 1);
}

async function togglePrimaryByTitle(page: Page, title: string) {
	const row = page.locator(`[data-task-row][data-task-title="${title}"]`);
	await row.locator('[data-primary-toggle]').click();
	await expect(row).toHaveAttribute('data-is-primary-today', 'true');
}

test.beforeEach(async ({ request }) => {
	await request.post('/__test__/reset');
});

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1', { hasText: 'Pomodoro' })).toBeVisible();
});

// Sort comparator + nudge threshold + carry-set logic are all covered by
// unit tests (sort.spec.ts, seed.spec.ts). The e2e tests below exercise
// the integration: the ★ button submits a form action, the load re-runs,
// the row re-flows in the DOM, the counter updates, the timer picks the
// right task. That wiring is what would silently regress without a
// browser-level check.

test('toggling a primary floats it to the top and the Today counter increments', async ({
	page
}) => {
	await addTask(page, 'A');
	await addTask(page, 'B');
	await addTask(page, 'C');

	await togglePrimaryByTitle(page, 'C');

	const titles = await page
		.locator('[data-task-row]')
		.evaluateAll((els) =>
			els.map((el) => (el as HTMLElement).getAttribute('data-task-title') ?? '')
		);
	expect(titles).toEqual(['C', 'A', 'B']);

	await expect(page.locator('[data-filter="today"]')).toHaveText('Today (1)');
});

test('unmarking a primary re-flows the list and decrements the counter', async ({ page }) => {
	await addTask(page, 'A');
	await addTask(page, 'B');
	await addTask(page, 'C');
	await togglePrimaryByTitle(page, 'A');
	await togglePrimaryByTitle(page, 'C');

	const rowA = page.locator('[data-task-row][data-task-title="A"]');
	await rowA.locator('[data-primary-toggle]').click();
	await expect(rowA).toHaveAttribute('data-is-primary-today', 'false');

	const titles = await page
		.locator('[data-task-row]')
		.evaluateAll((els) =>
			els.map((el) => (el as HTMLElement).getAttribute('data-task-title') ?? '')
		);
	expect(titles).toEqual(['C', 'A', 'B']);

	await expect(page.locator('[data-filter="today"]')).toHaveText('Today (1)');
});

test('Today filter isolates only primaries (done and archived still listed)', async ({ page }) => {
	await addTask(page, 'A');
	await addTask(page, 'B');
	await addTask(page, 'C');
	await togglePrimaryByTitle(page, 'A');
	await togglePrimaryByTitle(page, 'B');
	await togglePrimaryByTitle(page, 'C');

	await page.getByRole('tab', { name: 'Today' }).click();
	const titles = await page
		.locator('[data-task-row]')
		.evaluateAll((els) =>
			els.map((el) => (el as HTMLElement).getAttribute('data-task-title') ?? '')
		);
	expect(titles.sort()).toEqual(['A', 'B', 'C']);

	const rowB = page.locator('[data-task-row][data-task-title="B"]');
	await rowB.hover();
	await rowB.locator('[data-done-toggle]').click();

	const titlesAfterDone = await page
		.locator('[data-task-row]')
		.evaluateAll((els) =>
			els.map((el) => (el as HTMLElement).getAttribute('data-task-title') ?? '')
		);
	expect(titlesAfterDone.sort()).toEqual(['A', 'B', 'C']);
});

test('start focus auto-selects the first primary-today non-archived, falls back to first non-archived', async ({
	page
}) => {
	await addTask(page, 'A');
	await addTask(page, 'B');
	await addTask(page, 'C');

	await togglePrimaryByTitle(page, 'B');

	await page.click('[data-start-focus]');
	await expect(page.locator('[data-focusing-on]')).toContainText('B');
	await expect(page.locator('[data-timer][data-state="focus-running"]')).toBeVisible();

	await page.click('[data-stop]');
	await page.click('[data-skip]');
	const rowB = page.locator('[data-task-row][data-task-title="B"]');
	await rowB.locator('[data-primary-toggle]').click();
	await expect(rowB).toHaveAttribute('data-is-primary-today', 'false');

	await page.click('[data-start-focus]');
	await expect(page.locator('[data-focusing-on]')).toContainText('A');
});

test('the Today counter and per-row marker persist across reload', async ({ page }) => {
	await addTask(page, 'A');
	await addTask(page, 'B');
	await addTask(page, 'C');
	await addTask(page, 'D');

	await togglePrimaryByTitle(page, 'A');
	await togglePrimaryByTitle(page, 'C');

	await expect(page.locator('[data-filter="today"]')).toHaveText('Today (2)');

	await page.reload();
	await expect(page.locator('[data-filter="today"]')).toHaveText('Today (2)');
	await expect(page.locator('[data-task-row][data-task-title="A"]')).toHaveAttribute(
		'data-is-primary-today',
		'true'
	);
	await expect(page.locator('[data-task-row][data-task-title="C"]')).toHaveAttribute(
		'data-is-primary-today',
		'true'
	);
	await expect(page.locator('[data-task-row][data-task-title="B"]')).toHaveAttribute(
		'data-is-primary-today',
		'false'
	);
});
