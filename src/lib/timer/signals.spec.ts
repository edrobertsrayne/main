import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionSignals } from './signals.svelte';

type IntervalCallback = () => void;
type IntervalHandle = number;

type FakeTimer = {
	setInterval: typeof setInterval;
	clearInterval: typeof clearInterval;
	setTimeout: typeof setTimeout;
	clearTimeout: typeof clearTimeout;
	advance: (ms: number) => void;
};

function makeFakeTimers(): FakeTimer {
	type IntervalRecord = { cb: IntervalCallback; period: number };
	const intervalHandles = new Map<IntervalHandle, IntervalRecord>();
	const timeoutHandles = new Map<IntervalHandle, { cb: IntervalCallback; at: number }>();
	let nextIntervalId = 1;
	let nextTimeoutId = 1;
	let now = 0;
	const intervalAt = new Map<IntervalHandle, number>();

	const fakeSetInterval: typeof setInterval = ((cb: IntervalCallback, ms: number) => {
		const id = nextIntervalId++;
		intervalHandles.set(id, { cb, period: ms });
		intervalAt.set(id, now + ms);
		return id as unknown as ReturnType<typeof setInterval>;
	}) as typeof setInterval;

	const fakeClearInterval: typeof clearInterval = ((handle: unknown) => {
		intervalHandles.delete(handle as IntervalHandle);
		intervalAt.delete(handle as IntervalHandle);
	}) as typeof clearInterval;

	const fakeSetTimeout: typeof setTimeout = ((cb: IntervalCallback, ms: number) => {
		const id = nextTimeoutId++;
		timeoutHandles.set(id, { cb, at: now + ms });
		return id as unknown as ReturnType<typeof setTimeout>;
	}) as typeof setTimeout;

	const fakeClearTimeout: typeof clearTimeout = ((handle: unknown) => {
		timeoutHandles.delete(handle as IntervalHandle);
	}) as typeof clearTimeout;

	const advance = (ms: number) => {
		const target = now + ms;
		// Drain intervals and timeouts whose absolute time has been
		// reached by the advance, in time order. The order matters
		// when a fired timer schedules another timer.
		let progressed = true;
		while (progressed) {
			progressed = false;
			// Find the earliest scheduled timer at-or-before `target`.
			let earliest = target;
			let hasReady = false;
			for (const at of intervalAt.values()) {
				if (at <= earliest) {
					earliest = at;
					hasReady = true;
				}
			}
			for (const t of timeoutHandles.values()) {
				if (t.at <= earliest) {
					earliest = t.at;
					hasReady = true;
				}
			}
			if (!hasReady) break;
			now = earliest;

			const readyIntervals: IntervalHandle[] = [];
			for (const [id, at] of intervalAt) {
				if (at === earliest) readyIntervals.push(id);
			}
			for (const id of readyIntervals) {
				const rec = intervalHandles.get(id);
				if (!rec) {
					intervalAt.delete(id);
					continue;
				}
				intervalAt.set(id, now + rec.period);
				rec.cb();
				progressed = true;
			}
			const readyTimeouts: IntervalHandle[] = [];
			for (const [id, t] of timeoutHandles) {
				if (t.at === earliest) readyTimeouts.push(id);
			}
			for (const id of readyTimeouts) {
				const t = timeoutHandles.get(id);
				timeoutHandles.delete(id);
				if (t) {
					t.cb();
					progressed = true;
				}
			}
		}
		now = target;
	};

	return {
		setInterval: fakeSetInterval,
		clearInterval: fakeClearInterval,
		setTimeout: fakeSetTimeout,
		clearTimeout: fakeClearTimeout,
		advance
	};
}

type FakeDocument = {
	title: string;
	head: {
		querySelector: (sel: string) => HTMLLinkElement | null;
	};
	documentElement: {
		dataset: Record<string, string | undefined>;
	};
};

type FakeLink = { href: string };

function makeDocument(initialTitle = 'Pomodoro'): FakeDocument {
	const dataset: Record<string, string | undefined> = {};
	let link: FakeLink = { href: '' };
	const doc: FakeDocument = {
		title: initialTitle,
		head: {
			querySelector: (sel: string) => {
				if (sel === 'link[rel="icon"]') return link as unknown as HTMLLinkElement;
				return null;
			}
		},
		documentElement: {
			dataset
		}
	};
	// Allow tests to swap the link.
	(doc as unknown as { __setLink: (l: FakeLink) => void }).__setLink = (l) => {
		link = l;
	};
	return doc;
}

type FakeAudioContext = {
	createOscillator: () => unknown;
	createGain: () => unknown;
	currentTime: number;
	resume: () => Promise<void>;
	close: () => Promise<void>;
	destination: unknown;
};

function makeAudioContext(): { ctx: FakeAudioContext; calls: { osc: number; gain: number } } {
	const calls = { osc: 0, gain: 0 };
	const resumeFn = vi.fn(function () {
		return Promise.resolve();
	});
	const closeFn = vi.fn(function () {
		return Promise.resolve();
	});
	const ctx: FakeAudioContext = {
		currentTime: 0,
		resume: resumeFn,
		close: closeFn,
		destination: 'destination',
		createOscillator: function () {
			calls.osc++;
			const osc = {
				frequency: { value: 0 },
				type: '',
				connect: vi.fn(),
				start: vi.fn(),
				stop: vi.fn()
			};
			osc.connect.mockReturnValue(osc);
			return osc;
		},
		createGain: function () {
			calls.gain++;
			const gain = {
				gain: {
					setValueAtTime: vi.fn(),
					linearRampToValueAtTime: vi.fn(),
					exponentialRampToValueAtTime: vi.fn()
				},
				connect: vi.fn()
			};
			gain.connect.mockReturnValue({});
			return gain;
		}
	};
	return { ctx, calls };
}

type PermissionState = 'default' | 'granted' | 'denied';

type FakeNotificationCtor = {
	permission: PermissionState;
	requestPermission: () => Promise<PermissionState>;
	new (...args: unknown[]): unknown;
};

function makeNotificationCtor(initial: PermissionState): {
	ctor: FakeNotificationCtor;
	instances: unknown[];
} {
	const instances: unknown[] = [];
	const ctor: FakeNotificationCtor = function (this: unknown, title: string, options?: unknown) {
		instances.push({ title, options });
		return { title, options };
	} as unknown as FakeNotificationCtor;
	ctor.permission = initial;
	ctor.requestPermission = vi.fn(async function () {
		ctor.permission = 'granted';
		return 'granted' as PermissionState;
	});
	return { ctor: ctor as unknown as FakeNotificationCtor, instances };
}

let timers: FakeTimer;
let doc: FakeDocument;
let audio: ReturnType<typeof makeAudioContext>;
let audioCtor: ReturnType<typeof vi.fn>;
let notif: ReturnType<typeof makeNotificationCtor>;
type MatchMediaStub = {
	matches: boolean;
	listeners: Array<() => void>;
	addEventListener: (kind: string, cb: () => void) => void;
	removeEventListener: () => void;
};

let mqStub: MatchMediaStub;
let signals: SessionSignals;

function makeSignals(overrides: Partial<ConstructorParameters<typeof SessionSignals>[0]> = {}) {
	return new SessionSignals({
		faviconRestingHref: '/favicon.svg',
		faviconEndedHref: '/favicon-ended.svg',
		AudioContextCtor: audioCtor as unknown as typeof AudioContext,
		NotificationCtor: notif.ctor as unknown as typeof Notification,
		doc: doc as unknown as Document,
		win: { matchMedia: () => mqStub } as unknown as Window,
		deps: {
			setInterval: timers.setInterval,
			clearInterval: timers.clearInterval,
			setTimeout: timers.setTimeout,
			clearTimeout: timers.clearTimeout
		},
		...overrides
	});
}

beforeEach(() => {
	timers = makeFakeTimers();
	doc = makeDocument();
	(doc as unknown as { __setLink: (l: FakeLink) => void }).__setLink({ href: '/favicon.svg' });

	audio = makeAudioContext();
	// Use a `function` so the mock is constructable via `new` (the SessionSignals
	// module calls `new AudioContextCtor()` to construct the AudioContext).
	audioCtor = vi.fn(function () {
		return audio.ctx;
	});

	notif = makeNotificationCtor('default');

	mqStub = {
		matches: false,
		listeners: [],
		addEventListener: function (_kind: string, cb: () => void) {
			mqStub.listeners.push(cb);
		},
		removeEventListener: function () {
			/* no-op */
		}
	};

	signals = makeSignals();
});

afterEach(() => {
	vi.restoreAllMocks();
	signals.dispose();
});

describe('initial state', () => {
	it('reads Notification.permission at construction', () => {
		expect(signals.permission).toBe('default');
	});

	it('captures the resting document title at construction', () => {
		expect(doc.title).toBe('Pomodoro');
	});

	it('starts with no audio context, no title pulse, no chime, no favicon-swap', () => {
		expect(signals.titlePulseMode).toBe('off');
		expect(signals.lastChime).toBeNull();
		expect(signals.faviconEnded).toBe(false);
		expect(audioCtor).not.toHaveBeenCalled();
	});
});

describe('requestPermission', () => {
	it('calls Notification.requestPermission and updates the reactive permission', async () => {
		expect(notif.ctor.permission).toBe('default');
		const result = await signals.requestPermission();
		expect(result).toBe('granted');
		expect(signals.permission).toBe('granted');
	});

	it('re-reads Notification.permission when requestPermission is missing', async () => {
		const fallback = makeNotificationCtor('denied');
		delete (fallback.ctor as unknown as { requestPermission?: unknown }).requestPermission;
		const s = makeSignals({
			AudioContextCtor: audioCtor as unknown as typeof AudioContext,
			NotificationCtor: fallback.ctor as unknown as typeof Notification,
			doc: doc as unknown as Document,
			win: { matchMedia: () => mqStub } as unknown as Window,
			deps: {
				setInterval: timers.setInterval,
				clearInterval: timers.clearInterval,
				setTimeout: timers.setTimeout,
				clearTimeout: timers.clearTimeout
			}
		});
		const result = await s.requestPermission();
		expect(result).toBe('denied');
		expect(s.permission).toBe('denied');
		s.dispose();
	});

	it('returns "denied" when no Notification API is available', async () => {
		const s = makeSignals({
			AudioContextCtor: audioCtor as unknown as typeof AudioContext,
			NotificationCtor: null,
			doc: doc as unknown as Document,
			win: { matchMedia: () => mqStub } as unknown as Window,
			deps: {
				setInterval: timers.setInterval,
				clearInterval: timers.clearInterval,
				setTimeout: timers.setTimeout,
				clearTimeout: timers.clearTimeout
			}
		});
		const result = await s.requestPermission();
		expect(result).toBe('denied');
		s.dispose();
	});
});

describe('unlockAudio', () => {
	it('creates the AudioContext on the first call (the user gesture)', () => {
		signals.unlockAudio();
		expect(audioCtor).toHaveBeenCalledTimes(1);
		expect(audio.ctx.resume).toHaveBeenCalled();
	});

	it('does not re-create on subsequent calls', () => {
		signals.unlockAudio();
		signals.unlockAudio();
		signals.unlockAudio();
		expect(audioCtor).toHaveBeenCalledTimes(1);
	});

	it('swallows AudioContext construction errors (no user gesture yet)', () => {
		const throwing = vi.fn(function () {
			throw new Error('not activated');
		});
		const s = makeSignals({
			AudioContextCtor: throwing as unknown as typeof AudioContext,
			NotificationCtor: notif.ctor as unknown as typeof Notification,
			doc: doc as unknown as Document,
			win: { matchMedia: () => mqStub } as unknown as Window,
			deps: {
				setInterval: timers.setInterval,
				clearInterval: timers.clearInterval,
				setTimeout: timers.setTimeout,
				clearTimeout: timers.clearTimeout
			}
		});
		expect(() => s.unlockAudio()).not.toThrow();
		expect(throwing).toHaveBeenCalled();
		s.dispose();
	});

	it('swallows resume() rejection', () => {
		audio.ctx.resume = vi.fn(function () {
			return Promise.reject(new Error('blocked'));
		});
		const s = makeSignals({
			AudioContextCtor: audioCtor as unknown as typeof AudioContext,
			NotificationCtor: notif.ctor as unknown as typeof Notification,
			doc: doc as unknown as Document,
			win: { matchMedia: () => mqStub } as unknown as Window,
			deps: {
				setInterval: timers.setInterval,
				clearInterval: timers.clearInterval,
				setTimeout: timers.setTimeout,
				clearTimeout: timers.clearTimeout
			}
		});
		expect(() => s.unlockAudio()).not.toThrow();
		s.dispose();
	});
});

describe('notifyFocusEnd — Notification', () => {
	it('does NOT fire Notification when permission is "default"', () => {
		signals.notifyFocusEnd();
		expect(notif.instances).toHaveLength(0);
	});

	it('does NOT fire Notification when permission is "denied"', () => {
		notif.ctor.permission = 'denied';
		signals = makeSignals({
			faviconRestingHref: '/favicon.svg',
			faviconEndedHref: '/favicon-ended.svg',
			AudioContextCtor: audioCtor as unknown as typeof AudioContext,
			NotificationCtor: notif.ctor as unknown as typeof Notification,
			doc: doc as unknown as Document,
			win: { matchMedia: () => mqStub } as unknown as Window,
			deps: {
				setInterval: timers.setInterval,
				clearInterval: timers.clearInterval,
				setTimeout: timers.setTimeout,
				clearTimeout: timers.clearTimeout
			}
		});
		signals.unlockAudio();
		signals.notifyFocusEnd();
		expect(notif.instances).toHaveLength(0);
	});

	it('fires new Notification(title, {body, tag, silent}) when permission is "granted"', async () => {
		await signals.requestPermission();
		expect(signals.permission).toBe('granted');
		signals.unlockAudio();
		signals.notifyFocusEnd();
		expect(notif.instances).toHaveLength(1);
		const n = notif.instances[0] as {
			title: string;
			options: { body: string; tag: string; silent: boolean };
		};
		expect(n.title).toBe('Focus session ended');
		expect(n.options.body).toBe('Time to take a break.');
		expect(n.options.tag).toBe('focus-end');
		expect(n.options.silent).toBe(true);
	});

	it('accepts custom title/body overrides', async () => {
		await signals.requestPermission();
		signals.unlockAudio();
		signals.notifyFocusEnd({
			title: 'Pomodoro complete',
			body: 'Take 5.',
			tag: 'focus-end'
		});
		const n = notif.instances[0] as { title: string; options: { body: string } };
		expect(n.title).toBe('Pomodoro complete');
		expect(n.options.body).toBe('Take 5.');
	});
});

describe('notifyFocusEnd — chime', () => {
	beforeEach(() => {
		signals.unlockAudio();
	});

	it('plays the focus-end chime (three oscillators) at focus-end', () => {
		signals.notifyFocusEnd();
		expect(signals.lastChime).toBe('focus');
		// 3 notes × 1 oscillator + 3 × 1 gain = 3 osc, 3 gain.
		expect(audio.calls.osc).toBe(3);
		expect(audio.calls.gain).toBe(3);
	});

	it('plays UNCONDITIONALLY — there is no on/off setting', () => {
		signals.notifyFocusEnd();
		signals.notifyFocusEnd();
		expect(signals.lastChime).toBe('focus');
		// Chime should fire on every call regardless of any state.
		expect(audio.calls.osc).toBe(6);
	});

	it('records lastChime so the e2e seam can observe it', () => {
		expect(signals.lastChime).toBeNull();
		signals.notifyFocusEnd();
		expect(signals.lastChime).toBe('focus');
	});
});

describe('notifyBreakEnd — chime', () => {
	beforeEach(() => {
		signals.unlockAudio();
	});

	it('plays a single quieter chime (one oscillator) at break-end', () => {
		signals.notifyBreakEnd();
		expect(signals.lastChime).toBe('break');
		expect(audio.calls.osc).toBe(1);
		expect(audio.calls.gain).toBe(1);
	});

	it('does NOT fire a Notification at break-end', () => {
		signals.notifyBreakEnd();
		expect(notif.instances).toHaveLength(0);
	});

	it('does NOT change the favicon at break-end (favicon only resets on the next start focus)', () => {
		signals.notifyFocusEnd();
		expect(signals.faviconEnded).toBe(true);
		const link = doc.head.querySelector('link[rel="icon"]') as unknown as FakeLink;
		expect(link.href).toBe('/favicon-ended.svg');
		signals.notifyBreakEnd();
		expect(signals.faviconEnded).toBe(true);
		expect((doc.head.querySelector('link[rel="icon"]') as unknown as FakeLink).href).toBe(
			'/favicon-ended.svg'
		);
	});

	it('does NOT pulse the title at break-end (title pulse is focus-end only)', () => {
		expect(signals.titlePulseMode).toBe('off');
		signals.notifyBreakEnd();
		expect(signals.titlePulseMode).toBe('off');
		expect(signals.titlePulseMode).toBe('off');
	});
});

describe('focus-end chime is louder than break-end chime', () => {
	beforeEach(() => {
		signals.unlockAudio();
	});

	it('schedules a higher peak gain on focus-end notes than on the break-end note', () => {
		function capturePeaks() {
			const captured: number[] = [];
			const audioCtx = makeAudioContext();
			const spyCtor = vi.fn(function () {
				return audioCtx.ctx;
			});
			const origCreateGain = audioCtx.ctx.createGain.bind(audioCtx.ctx);
			type Gain = { gain: { linearRampToValueAtTime: (v: number, t: number) => unknown } };
			audioCtx.ctx.createGain = function () {
				const gain = origCreateGain() as unknown as Gain;
				const origLinear = gain.gain.linearRampToValueAtTime.bind(gain.gain);
				gain.gain.linearRampToValueAtTime = (v: number, t: number) => {
					captured.push(v);
					return origLinear(v, t);
				};
				return gain;
			};
			const s = makeSignals({
				AudioContextCtor: spyCtor as unknown as typeof AudioContext,
				NotificationCtor: notif.ctor as unknown as typeof Notification,
				doc: doc as unknown as Document,
				win: { matchMedia: () => mqStub } as unknown as Window,
				deps: {
					setInterval: timers.setInterval,
					clearInterval: timers.clearInterval,
					setTimeout: timers.setTimeout,
					clearTimeout: timers.clearTimeout
				}
			});
			s.unlockAudio();
			return { s, captured };
		}

		const focus = capturePeaks();
		focus.s.notifyFocusEnd();
		focus.s.dispose();

		const breakEnd = capturePeaks();
		breakEnd.s.notifyBreakEnd();
		breakEnd.s.dispose();

		expect(focus.captured.length).toBeGreaterThan(0);
		expect(breakEnd.captured.length).toBeGreaterThan(0);
		const maxFocus = Math.max(...focus.captured);
		const maxBreak = Math.max(...breakEnd.captured);
		expect(maxFocus).toBeGreaterThan(maxBreak);
	});
});

describe('title pulse — kinetic mode', () => {
	it('oscillates the title while pulse mode is on', () => {
		expect(signals.titlePulseMode).toBe('off');
		signals.notifyFocusEnd();
		expect(signals.titlePulseMode).toBe('pulse');
		expect(signals.titlePulseMode).toBe('pulse');
		expect(doc.title).toBe('Focus ended · Pomodoro');

		// Advance 800ms (one oscillation).
		timers.advance(800);
		expect(doc.title).toBe('Pomodoro');

		// Advance another 800ms.
		timers.advance(800);
		expect(doc.title).toBe('Focus ended · Pomodoro');
	});

	it('stops oscillating and restores the resting title after 5 seconds', () => {
		signals.notifyFocusEnd();
		expect(signals.titlePulseMode).toBe('pulse');
		timers.advance(5000);
		expect(signals.titlePulseMode).toBe('off');
		expect(doc.title).toBe('Pomodoro');
		expect(signals.titlePulseMode).toBe('off');
	});

	it('clears the title-pulse dataset attribute on stop', () => {
		signals.notifyFocusEnd();
		expect(signals.titlePulseMode).toBe('pulse');
		signals.resetOnNextStartFocus();
		expect(signals.titlePulseMode).toBe('off');
	});
});

describe('title pulse — reduced-motion (opacity-fade fallback)', () => {
	beforeEach(() => {
		mqStub.matches = true;
	});

	it('uses the fade mode and the data-title-pulse="fade" attribute', () => {
		signals.notifyFocusEnd();
		expect(signals.titlePulseMode).toBe('fade');
		expect(signals.titlePulseMode).toBe('fade');
		expect(doc.title).toBe('Focus ended · Pomodoro');
	});

	it('does not oscillate (only changes once and stays)', () => {
		signals.notifyFocusEnd();
		expect(doc.title).toBe('Focus ended · Pomodoro');
		timers.advance(800);
		expect(doc.title).toBe('Focus ended · Pomodoro');
		timers.advance(800);
		expect(doc.title).toBe('Focus ended · Pomodoro');
	});

	it('restores the resting title after 2 seconds', () => {
		signals.notifyFocusEnd();
		timers.advance(2000);
		expect(doc.title).toBe('Pomodoro');
		expect(signals.titlePulseMode).toBe('off');
		expect(signals.titlePulseMode).toBe('off');
	});
});

describe('favicon swap', () => {
	beforeEach(() => {
		(doc as unknown as { __setLink: (l: FakeLink) => void }).__setLink({ href: '/favicon.svg' });
	});

	it('swaps to the ended href on focus-end', () => {
		signals.notifyFocusEnd();
		const link = doc.head.querySelector('link[rel="icon"]') as unknown as FakeLink;
		expect(link.href).toBe('/favicon-ended.svg');
		expect(signals.faviconEnded).toBe(true);
		expect(doc.documentElement.dataset.favicon).toBe('ended');
	});

	it('swaps back to the resting href on resetOnNextStartFocus', () => {
		signals.notifyFocusEnd();
		expect(signals.faviconEnded).toBe(true);
		signals.resetOnNextStartFocus();
		const link = doc.head.querySelector('link[rel="icon"]') as unknown as FakeLink;
		expect(link.href).toBe('/favicon.svg');
		expect(signals.faviconEnded).toBe(false);
		expect(doc.documentElement.dataset.favicon).toBeUndefined();
	});

	it('does nothing if there is no <link rel="icon"> in the document head', () => {
		const doc2 = makeDocument();
		(doc2.head as unknown as { querySelector: (s: string) => null }).querySelector = () => null;
		const s = makeSignals({
			AudioContextCtor: audioCtor as unknown as typeof AudioContext,
			NotificationCtor: notif.ctor as unknown as typeof Notification,
			doc: doc2 as unknown as Document,
			win: { matchMedia: () => mqStub } as unknown as Window,
			deps: {
				setInterval: timers.setInterval,
				clearInterval: timers.clearInterval,
				setTimeout: timers.setTimeout,
				clearTimeout: timers.clearTimeout
			}
		});
		expect(() => s.notifyFocusEnd()).not.toThrow();
		expect(s.faviconEnded).toBe(true);
		s.dispose();
	});
});

describe('dispose', () => {
	it('stops the title pulse, restores the favicon, closes the audio context', async () => {
		await signals.requestPermission();
		signals.unlockAudio();
		signals.notifyFocusEnd();
		expect(signals.titlePulseMode).toBe('pulse');
		expect(signals.faviconEnded).toBe(true);

		signals.dispose();

		expect(signals.titlePulseMode).toBe('off');
		expect(signals.faviconEnded).toBe(false);
		expect(doc.title).toBe('Pomodoro');
		expect(audio.ctx.close).toHaveBeenCalled();
	});
});

describe('test seam sanity', () => {
	it('does not touch the live window.Notification when overrides are passed', () => {
		// Constructor was called with overrides; no spy on the live
		// global was installed. The point: tests don't read or mutate
		// production globals.
		expect(notif.ctor.permission).toBe('default');
	});

	it('uses the override AudioContext (does not construct twice)', () => {
		signals.unlockAudio();
		signals.unlockAudio();
		expect(audioCtor).toHaveBeenCalledTimes(1);
	});
});
