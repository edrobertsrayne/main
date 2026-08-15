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
 * Install a Notification spy that captures every `new Notification(...)`
 * call into `window.__notifications`. The spy replaces the global
 * `Notification` constructor — the SessionSignals module reads
 * `Notification.permission` and calls `new Notification(...)`, so the spy
 * sees every construction. Installed via `addInitScript` so it runs
 * before the home route mounts its SessionSignals instance.
 *
 * Pass `granted: true` to also override `Notification.permission` to
 * "granted" (and short-circuit `requestPermission` to resolve to
 * "granted"). Headless Chromium's default permission is "denied", so
 * tests that need the Notification channel must opt in.
 */
async function installNotificationSpy(
	page: Page,
	opts: { granted?: boolean; initialPermission?: NotificationPermission } = {}
) {
	const { granted = false, initialPermission = null } = opts;
	await page.addInitScript(
		({ grant, init }) => {
			const w = window as unknown as {
				Notification: typeof Notification;
				__notifications: Array<{ title: string; options?: NotificationOptions }>;
			};
			w.__notifications = [];
			const Real = w.Notification;
			const Spy = function (this: unknown, title: string, options?: NotificationOptions) {
				w.__notifications.push({ title, options });
				return { title, options, close() {}, addEventListener() {} } as unknown as Notification;
			} as unknown as typeof Notification;
			(Spy as unknown as { permission: NotificationPermission }).permission = init
				? (init as NotificationPermission)
				: grant
					? 'granted'
					: (Real.permission as NotificationPermission);
			(
				Spy as unknown as { requestPermission: () => Promise<NotificationPermission> }
			).requestPermission = function () {
				// Always resolve to 'granted' when the spy is installed
				// — the spy is the test's stand-in for the browser's
				// permission UI, and the test treats any successful
				// click as the user granting. (If a test needs the
				// "denied" path, install a fresh spy that doesn't
				// resolve to granted.)
				if (grant || init) return Promise.resolve('granted' as NotificationPermission);
				return Promise.resolve(Real.requestPermission.call(Real));
			};
			Object.defineProperty(window, 'Notification', { value: Spy, configurable: true });
		},
		{ grant: granted, init: initialPermission }
	);
}

/**
 * Install an AudioContext spy that counts `createOscillator` calls
 * (the chime's only side-effect we can observe without audio capture).
 * The spy installs on `window.AudioContext` before the page loads so
 * the SessionSignals module — which reads `AudioContext` at construction
 * — sees the spy and creates a real context with a wrapped
 * `createOscillator`.
 */
async function installAudioContextSpy(page: Page) {
	await page.addInitScript(() => {
		const w = window as unknown as { AudioContext: typeof AudioContext };
		const Real = w.AudioContext;
		const counter = { osc: 0 };
		(window as unknown as { __audioCount: typeof counter }).__audioCount = counter;
		const Spy = function (this: unknown) {
			const ctx = new Real();
			const origCreateOsc = ctx.createOscillator.bind(ctx);
			ctx.createOscillator = function () {
				counter.osc++;
				return origCreateOsc();
			};
			return ctx;
		} as unknown as typeof AudioContext;
		Object.defineProperty(window, 'AudioContext', { value: Spy, configurable: true });
	});
}

async function readNotifications(
	page: Page
): Promise<Array<{ title: string; options?: NotificationOptions }>> {
	return page.evaluate(
		() =>
			(
				window as unknown as {
					__notifications: Array<{ title: string; options?: NotificationOptions }>;
				}
			).__notifications
	);
}

test.beforeEach(async ({ request }) => {
	await request.post('/__test__/reset');
});

test('settings route renders with the locked palette and a permission status', async ({ page }) => {
	await page.goto('/settings');
	await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible();
	await expect(page.locator('[data-notifications-section]')).toBeVisible();
	await expect(page.locator('[data-sound-section]')).toBeVisible();

	// In a default Chromium context the permission is "default" and the
	// "Enable desktop notifications" button is rendered. Playwright's
	// headless Chromium sometimes reports "denied" by default for
	// privacy; both are acceptable starting states — the route must
	// reflect whichever one the browser exposes.
	const permission = await page.evaluate(() => Notification.permission);
	if (permission === 'default') {
		await expect(page.locator('[data-enable-notifications]')).toBeVisible();
	} else {
		await expect(page.locator(`[data-permission="${permission}"]`)).toBeVisible();
	}
});

test('settings: clicking "Enable desktop notifications" requests Notification permission', async ({
	browser
}) => {
	// The browser must allow Notification.requestPermission to resolve
	// to "granted" without an interactive prompt — headless Chromium
	// exposes this via the Notification-spy override below. Headless
	// Chromium's default permission is "denied", so the test installs
	// a spy that starts at "default" so the explicit-gesture button
	// is the surface that's actually exercised.
	const ctx: BrowserContext = await browser.newContext();
	const page = await ctx.newPage();
	await installNotificationSpy(page, { granted: false, initialPermission: 'default' });

	await page.goto('/settings');
	await expect(page.locator('[data-enable-notifications]')).toBeVisible();

	await page.click('[data-enable-notifications]');
	// After the explicit click, Notification.requestPermission()
	// resolves (the spy is wired to do so) and the page reflects it.
	await expect(page.locator('[data-permission="granted"]')).toBeVisible();

	await ctx.close();
});

test('settings: a button on the explicit gesture surface calls Notification.requestPermission', async ({
	browser
}) => {
	// Start from "default" permission via a Notification spy installed
	// before the page loads. The spy preserves `permission` as "default"
	// (overriding Playwright headless Chromium's "denied" default),
	// and `requestPermission` resolves to "granted" on click — simulating
	// the user's grant gesture without the native prompt.
	const ctx: BrowserContext = await browser.newContext();
	const page = await ctx.newPage();
	await page.addInitScript(() => {
		const w = window as unknown as {
			Notification: typeof Notification;
			__notifications: Array<{ title: string; options?: NotificationOptions }>;
		};
		w.__notifications = [];
		const Spy = function (this: unknown, title: string, options?: NotificationOptions) {
			w.__notifications.push({ title, options });
			return { title, options, close() {}, addEventListener() {} } as unknown as Notification;
		} as unknown as typeof Notification;
		(Spy as unknown as { permission: NotificationPermission }).permission = 'default';
		(
			Spy as unknown as { requestPermission: () => Promise<NotificationPermission> }
		).requestPermission = function () {
			return Promise.resolve('granted' as NotificationPermission);
		};
		Object.defineProperty(window, 'Notification', { value: Spy, configurable: true });
	});

	await page.goto('/settings');
	await expect(page.locator('[data-enable-notifications]')).toBeVisible();

	await page.click('[data-enable-notifications]');

	// The click is the explicit user gesture; requestPermission
	// resolves to "granted" via the spy, and the page reflects it.
	await expect(page.locator('[data-permission="granted"]')).toBeVisible();

	await ctx.close();
});

test('settings: home route links to /settings', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('[data-settings-link]')).toBeVisible();
	await page.click('[data-settings-link]');
	await expect(page).toHaveURL(/\/settings/);
	await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible();
});

test('focus-end fires an OS notification when permission is granted', async ({ browser }) => {
	const ctx: BrowserContext = await browser.newContext();
	const page = await ctx.newPage();
	await installNotificationSpy(page, { granted: true });
	await page.goto('/');
	await addTask(page, 'Notify me', 1);

	// Drive a natural ring so the controller fires `onFocusEnd` (which
	// also fires `signals.notifyFocusEnd()`).
	await page.clock.install({ time: new Date('2026-08-17T10:00:00-04:00') });
	await page.goto('/');
	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();

	const notifications = await readNotifications(page);
	expect(notifications).toHaveLength(1);
	expect(notifications[0]?.title).toBe('Focus session ended');
	expect(notifications[0]?.options?.body).toBe('Time to take a break.');
	expect(notifications[0]?.options?.tag).toBe('focus-end');
	// `silent: true` so the OS doesn't double up on audio — the app's
	// chime is the audio channel.
	expect(notifications[0]?.options?.silent).toBe(true);

	await ctx.close();
});

test('focus-end does NOT fire a Notification when permission is default', async ({ page }) => {
	await installNotificationSpy(page);
	await page.goto('/');
	await addTask(page, 'No notify', 1);

	await page.clock.install({ time: new Date('2026-08-17T10:00:00-04:00') });
	await page.goto('/');
	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();

	const notifications = await readNotifications(page);
	expect(notifications).toHaveLength(0);
});

test('focus-end plays the chime and pulses the document title', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Pulse me', 1);

	await page.clock.install({ time: new Date('2026-08-17T10:00:00-04:00') });
	await page.goto('/');
	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();

	// Title pulse is in the "pulse" mode. The attribute lives on the
	// timer section (per the CSS scoping in layout.css).
	const titlePulse = await page.evaluate(() => {
		const timer = document.querySelector('[data-timer]');
		return timer?.getAttribute('data-title-pulse');
	});
	expect(titlePulse).toBe('pulse');

	// Title text is the "Focus ended · …" variant.
	const title = await page.title();
	expect(title.startsWith('Focus ended')).toBe(true);
});

test('focus-end swaps the favicon to the "ended" variant', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Favicon me', 1);

	await page.clock.install({ time: new Date('2026-08-17T10:00:00-04:00') });
	await page.goto('/');
	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();

	const faviconHref = await page.evaluate(() => {
		const link = document.head.querySelector('link[rel="icon"]');
		return link?.getAttribute('href') ?? '';
	});
	expect(faviconHref).toBe('/favicon-ended.svg');

	const dataFavicon = await page.evaluate(() => document.documentElement.dataset.favicon);
	expect(dataFavicon).toBe('ended');
});

test('favicon swaps back to the resting variant on the next start focus', async ({ page }) => {
	await page.goto('/');
	await addTask(page, 'Swap back', 1);

	await page.clock.install({ time: new Date('2026-08-17T10:00:00-04:00') });
	await page.goto('/');
	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();

	// Skip the prompt to get back to idle quickly.
	await page.click('[data-skip]');
	await expect(page.locator('[data-timer][data-state="idle"]')).toBeVisible();

	// Sanity: still on the "ended" favicon at idle.
	const endedHref = await page.evaluate(() => {
		const link = document.head.querySelector('link[rel="icon"]');
		return link?.getAttribute('href') ?? '';
	});
	expect(endedHref).toBe('/favicon-ended.svg');

	// The next start focus is the spec-chosen edge for the favicon
	// swap-back. Click it.
	await page.click('[data-start-focus]');

	const restingHref = await page.evaluate(() => {
		const link = document.head.querySelector('link[rel="icon"]');
		return link?.getAttribute('href') ?? '';
	});
	expect(restingHref).toBe('/favicon.svg');

	const dataFavicon = await page.evaluate(() => document.documentElement.dataset.favicon);
	expect(dataFavicon).toBeUndefined();
});

test('break-end plays the quieter chime (no title pulse, no favicon change)', async ({ page }) => {
	await installAudioContextSpy(page);

	await page.goto('/');
	await addTask(page, 'Quiet break', 1);

	await page.clock.install({ time: new Date('2026-08-17T10:00:00-04:00') });
	await page.goto('/');

	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();
	const focusEndOscCount = await page.evaluate(
		() => (window as unknown as { __audioCount: { osc: number } }).__audioCount.osc
	);
	// Focus-end chime plays 3 oscillators.
	expect(focusEndOscCount).toBe(3);

	await page.click('[data-confirm]');
	await expect(page.locator('[data-timer][data-state="break-running"]')).toBeVisible();

	// Advance past the title pulse's 5-second auto-stop so the title
	// has settled to the resting state before the break completes.
	await page.clock.runFor(6 * 1000);
	const titleBeforeBreakEnd = await page.title();
	const titlePulseBeforeBreakEnd = await page.evaluate(() => {
		const timer = document.querySelector('[data-timer]');
		return timer?.getAttribute('data-title-pulse');
	});
	expect(titlePulseBeforeBreakEnd).toBeNull();

	// Drive the break to natural completion.
	await page.clock.runFor(5 * 60 * 1000 - 6 * 1000);
	await expect(page.locator('[data-timer][data-state="idle"]')).toBeVisible();

	// The break-end chime fires (1 additional oscillator) but does
	// NOT change the title or favicon.
	const breakEndOscCount = await page.evaluate(
		() => (window as unknown as { __audioCount: { osc: number } }).__audioCount.osc
	);
	expect(breakEndOscCount).toBe(4); // +1 quieter oscillator

	const titleAfterBreakEnd = await page.title();
	expect(titleAfterBreakEnd).toBe(titleBeforeBreakEnd);

	const titlePulseAfterBreakEnd = await page.evaluate(() => {
		const timer = document.querySelector('[data-timer]');
		return timer?.getAttribute('data-title-pulse');
	});
	expect(titlePulseAfterBreakEnd).toBeNull();

	const faviconHref = await page.evaluate(() => {
		const link = document.head.querySelector('link[rel="icon"]');
		return link?.getAttribute('href') ?? '';
	});
	// Favicon stayed in the "ended" state — the spec picks next start
	// focus as the swap-back edge, not break-end.
	expect(faviconHref).toBe('/favicon-ended.svg');

	const dataFavicon = await page.evaluate(() => document.documentElement.dataset.favicon);
	expect(dataFavicon).toBe('ended');
});

test('first start focus unlocks the audio context (no second user gesture required)', async ({
	page
}) => {
	// The SessionSignals module reads `AudioContext` at construction
	// time, so the spy must be on the window before page load.
	await installAudioContextSpy(page);

	await page.goto('/');
	await addTask(page, 'Unlock audio', 1);

	await page.clock.install({ time: new Date('2026-08-17T10:00:00-04:00') });
	await page.goto('/');

	await page.click('[data-start-focus]');
	// Drive the focus to a ring so the chime plays (focus-end).
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();

	const focusEndOscCount = await page.evaluate(
		() => (window as unknown as { __audioCount: { osc: number } }).__audioCount.osc
	);
	// Focus-end plays 3 notes → 3 oscillators.
	expect(focusEndOscCount).toBe(3);

	// Drive through to break-end (5-min break) — this is the case the
	// spec calls out: break-end chime without a second user gesture.
	await page.click('[data-confirm]');
	await page.clock.runFor(5 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="idle"]')).toBeVisible();

	const breakEndOscCount = await page.evaluate(
		() => (window as unknown as { __audioCount: { osc: number } }).__audioCount.osc
	);
	// Break-end added 1 oscillator (quieter single-tone chime).
	expect(breakEndOscCount).toBe(4);
});

test('under prefers-reduced-motion: focus-end uses the opacity-fade fallback', async ({
	browser
}) => {
	const ctx: BrowserContext = await browser.newContext({ reducedMotion: 'reduce' });
	const page = await ctx.newPage();

	await page.goto('/');
	await addTask(page, 'Reduced motion', 1);

	await page.clock.install({ time: new Date('2026-08-17T10:00:00-04:00') });
	await page.goto('/');
	await page.click('[data-start-focus]');
	await page.clock.runFor(25 * 60 * 1000);
	await expect(page.locator('[data-timer][data-state="transitioning"]')).toBeVisible();

	// The reduced-motion media query must be active in this context.
	const reducedMotion = await page.evaluate(() => {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	});
	expect(reducedMotion).toBe(true);

	// The SessionSignals picked the fade mode (not the kinetic pulse).
	// The data-title-pulse attribute lives on the timer section (per the
	// CSS scoping in layout.css) — not on the page root, so the fade
	// only animates the timer region.
	const titlePulse = await page.evaluate(() => {
		const timer = document.querySelector('[data-timer]');
		return timer?.getAttribute('data-title-pulse');
	});
	expect(titlePulse).toBe('fade');

	// The CSS animation rule is actually applied to the timer section
	// (the spec's #6 + #36 contract — the signal still arrives, just
	// via opacity rather than via kinetic title oscillation).
	const animationName = await page.evaluate(() => {
		const timer = document.querySelector('[data-timer]') as HTMLElement | null;
		return timer ? getComputedStyle(timer).animationName : '';
	});
	expect(animationName).toBe('focus-end-fade');

	// Title changed once (to the "Focus ended · …" form) — the signal
	// still arrives, just less kinetic.
	const title = await page.title();
	expect(title.startsWith('Focus ended')).toBe(true);

	await ctx.close();
});

test('chime plays unconditionally — no settings toggle, no localStorage key', async ({ page }) => {
	// Per spec #18, the chime plays unconditionally. The only quiet
	// path is OS mute. There is no settings row or localStorage key
	// for sound. This test asserts the settings route does NOT
	// expose a sound on/off control.
	await page.goto('/settings');
	await expect(page.locator('[data-sound-section]')).toBeVisible();
	// No checkbox, toggle, or on/off button for sound.
	const soundControls = page.locator('[data-sound-section] input, [data-sound-section] button');
	await expect(soundControls).toHaveCount(0);

	// localStorage should hold no sound-related keys.
	const storageKeys = await page.evaluate(() => Object.keys(localStorage));
	const hasSoundKey = storageKeys.some((k) => /sound|chime|mute|audio/i.test(k));
	expect(hasSoundKey).toBe(false);
});
