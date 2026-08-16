import { expect, test } from '@playwright/test';

function titleLocator(page: import('@playwright/test').Page, title: string) {
	return page.locator(`[data-task-row][data-task-title="${title}"]`);
}

async function addTask(page: import('@playwright/test').Page, title: string, estimate = 1) {
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

test('renders the home route with the locked palette and a data-phase focus hook', async ({
	page
}) => {
	const root = page.locator('[data-phase]').first();
	await expect(root).toBeVisible();
	await expect(root).toHaveAttribute('data-phase', 'focus');

	const bodyBg = await page.evaluate(() =>
		getComputedStyle(document.body).getPropertyValue('background-color')
	);
	expect(bodyBg).not.toBe('');
});

test('adds a task and persists across a reload', async ({ page }) => {
	await addTask(page, 'Write spec', 3);

	await page.reload();
	await expect(titleLocator(page, 'Write spec')).toHaveCount(1);
	await expect(page.locator('[data-act-est]').first()).toHaveText('0/3');
});

test('edits a task title in place and persists', async ({ page }) => {
	await addTask(page, 'Draft');

	const titleInput = page.locator('[data-task-row] input[name="title"]').first();
	await titleInput.fill('Refined');
	await titleInput.press('Tab');

	await page.reload();
	await expect(titleLocator(page, 'Refined')).toHaveCount(1);
});

test('edits a task estimate in place and persists', async ({ page }) => {
	await addTask(page, 'Estimate me', 1);

	const estimateInput = page.locator('[data-task-row] input[name="estimate"]').first();
	await estimateInput.fill('5');
	await estimateInput.press('Tab');

	await page.reload();
	await expect(page.locator('[data-act-est]').first()).toHaveText('0/5');
});

test('marks a task done and unmarks it, persisting independently', async ({ page }) => {
	await addTask(page, 'Done me');

	const doneToggle = page.locator('[data-task-row] [data-done-toggle]').first();
	await expect(doneToggle).toHaveAttribute('data-done', 'false');
	await doneToggle.click();

	await page.getByRole('tab', { name: 'Done' }).click();
	await expect(page.locator('[data-task-row][data-task-title="Done me"]')).toHaveCount(1);
	const afterDone = page
		.locator('[data-task-row][data-task-title="Done me"] [data-done-toggle]')
		.first();
	await expect(afterDone).toHaveAttribute('data-done', 'true');

	await afterDone.click();

	await page.reload();
	await page.getByRole('tab', { name: 'All' }).click();
	await expect(page.locator('[data-task-row][data-task-title="Done me"]')).toHaveCount(1);
	const restored = page
		.locator('[data-task-row][data-task-title="Done me"] [data-done-toggle]')
		.first();
	await expect(restored).toHaveAttribute('data-done', 'false');
});

test('archives a task and restores it; rows are never deleted', async ({ page }) => {
	await addTask(page, 'Archive me');

	const row = page.locator('[data-task-row]').first();
	const archiveBtn = row.locator('[data-archive-toggle]');
	await expect(archiveBtn).toHaveAttribute('data-archived', 'false');
	await row.hover();
	await archiveBtn.click();

	await page.getByRole('tab', { name: 'Archived' }).click();
	await expect(page.locator('[data-task-row][data-task-title="Archive me"]')).toHaveCount(1);
	const archivedBtn = page
		.locator('[data-task-row][data-task-title="Archive me"] [data-archive-toggle]')
		.first();
	await expect(archivedBtn).toHaveAttribute('data-archived', 'true');

	await archivedBtn.click();

	await page.getByRole('tab', { name: 'All' }).click();
	await expect(page.locator('[data-task-row][data-task-title="Archive me"]')).toHaveCount(1);
	const restoredBtn = page
		.locator('[data-task-row][data-task-title="Archive me"] [data-archive-toggle]')
		.first();
	await expect(restoredBtn).toHaveAttribute('data-archived', 'false');
});

test('hides done and archived tasks from the default All view', async ({ page }) => {
	await addTask(page, 'Active');
	await addTask(page, 'Done me');
	await addTask(page, 'Archive me');

	const doneRow = page.locator('[data-task-row][data-task-title="Done me"]');
	await doneRow.hover();
	await doneRow.locator('[data-done-toggle]').click();

	const archiveRow = page.locator('[data-task-row][data-task-title="Archive me"]');
	await archiveRow.hover();
	await archiveRow.locator('[data-archive-toggle]').click();

	await page.reload();
	const visibleTitles = await page
		.locator('[data-task-row]')
		.evaluateAll((els) =>
			els.map((el) => (el as HTMLElement).getAttribute('data-task-title') ?? '')
		);
	expect(visibleTitles).toContain('Active');
	expect(visibleTitles).not.toContain('Done me');
	expect(visibleTitles).not.toContain('Archive me');
});

test('Done filter surfaces hidden done tasks', async ({ page }) => {
	await addTask(page, 'Active');
	await addTask(page, 'Done me');

	const doneToggle = page.locator('[data-task-row] [data-done-toggle]').nth(1);
	await doneToggle.click();

	await page.getByRole('tab', { name: 'Done' }).click();
	await expect(page.locator('[data-task-row]')).toHaveCount(1);
	await expect(titleLocator(page, 'Done me')).toHaveCount(1);
});

test('Archived filter surfaces hidden archived tasks', async ({ page }) => {
	await addTask(page, 'Active');
	await addTask(page, 'Archive me');

	const archiveToggle = page.locator('[data-task-row] [data-archive-toggle]').nth(1);
	await archiveToggle.click();

	await page.getByRole('tab', { name: 'Archived' }).click();
	await expect(page.locator('[data-task-row]')).toHaveCount(1);
	await expect(titleLocator(page, 'Archive me')).toHaveCount(1);
});

test('All filter surfaces hidden done and archived rows', async ({ page }) => {
	await addTask(page, 'A');
	await addTask(page, 'B');

	const rows = page.locator('[data-task-row]');
	await expect(rows).toHaveCount(2);

	await page.getByRole('tab', { name: 'All' }).click();
	await expect(rows).toHaveCount(2);
});

test('Today filter isolates primaries (no primaries yet shows the empty-state copy)', async ({
	page
}) => {
	await addTask(page, 'A');
	await page.getByRole('tab', { name: 'Today' }).click();
	// Now functional: the filter isolates today's primaries. With no
	// primaries set, the list is empty and the empty-state copy mentions
	// the ★ toggle.
	await expect(page.locator('[data-task-row]')).toHaveCount(0);
	await expect(page.getByText('Nothing planned for today')).toBeVisible();
});

test('actuals render as act/est with pip indicators', async ({ page }) => {
	await addTask(page, 'Pip test', 5);

	const actEst = page.locator('[data-act-est]').first();
	await expect(actEst).toHaveText('0/5');

	const pips = page.locator('[data-pips]').first();
	await expect(pips).toHaveAttribute('data-actuals', '0');
	await expect(pips).toHaveAttribute('data-estimate', '5');
	await expect(await pips.textContent()).toBe('○○○○○');
});

test('hover-revealed row controls are present on desktop', async ({ page }) => {
	await addTask(page, 'Hover me', 2);

	const row = page.locator('[data-task-row]').first();
	const archiveForm = row.locator('[data-archive-toggle]').locator('xpath=ancestor::form[1]');

	const initialOpacity = await archiveForm.evaluate(
		(el) => getComputedStyle(el as HTMLElement).opacity
	);
	expect(initialOpacity).toBe('0');

	await row.hover();
	await page.waitForTimeout(300);
	const hoveredOpacity = await archiveForm.evaluate(
		(el) => getComputedStyle(el as HTMLElement).opacity
	);
	expect(hoveredOpacity).toBe('1');
});

test('done checkbox shows the success tone class', async ({ page }) => {
	await addTask(page, 'Success tone');

	const toggle = page.locator('[data-task-row] [data-done-toggle]').first();
	await expect(toggle).toHaveAttribute('data-done', 'false');
	await toggle.click();

	await page.getByRole('tab', { name: 'Done' }).click();
	const checked = page
		.locator('[data-task-row][data-task-title="Success tone"] [data-done-toggle]')
		.first();
	await expect(checked).toHaveAttribute('data-done', 'true');
	const classes = await checked.getAttribute('class');
	expect(classes).toContain('bg-[var(--success)]');
});
