/**
 * Session-end signals.
 *
 * Owns the four channels the timer FSM fires at focus-end and break-end:
 *
 * - **OS notification** — constructed only when `Notification.permission ===
 *   "granted"`. The settings route owns the permission gesture; this module
 *   just reads the resolved state and fires when ready.
 * - **Web-Audio chime** — synthesised in-process (no asset files). The
 *   focus-end chime is louder; the break-end chime is quieter. Audio
 *   autoplay unlocks on the first `start focus` (the user gesture
 *   browsers gate AudioContext creation behind), and the same context
 *   serves break-end without a second gesture.
 * - **Title-bar pulse** — oscillates `document.title` briefly at focus-end
 *   to draw the eye on a muted or backgrounded tab. Under
 *   `prefers-reduced-motion`, the kinetic pulse is replaced by a one-shot
 *   CSS opacity fade on the timer region (the signal still arrives, just
 *   less kinetic — the spec's #6 + #36 contract).
 * - **Favicon swap** — alternates `<link rel="icon">` between the resting
 *   and "session ended" variants at focus-end. The favicon swaps back on
 *   the next user action (next `start focus` — we hook that single edge).
 *
 * The chime plays **unconditionally** — no on/off toggle, no settings
 * row, no `localStorage` key (spec #18). The only quiet path is OS mute.
 * The user can quiet the app by muting their device; the app adds no UI
 * surface for it.
 */

export type NotificationPermissionValue = 'default' | 'granted' | 'denied';

export type TitlePulseMode = 'off' | 'pulse' | 'fade';
export type ChimeKind = 'focus' | 'break';

type Deps = {
	now: () => number;
	setInterval: typeof setInterval;
	clearInterval: typeof clearInterval;
	setTimeout: typeof setTimeout;
	clearTimeout: typeof clearTimeout;
};

export type SessionSignalsOptions = {
	/** Override the resting favicon href. Default `/favicon.svg`. */
	faviconRestingHref?: string;
	/** Override the ended favicon href. Default `/favicon-ended.svg`. */
	faviconEndedHref?: string;
	/** Override the AudioContext constructor (test seam). */
	AudioContextCtor?: typeof AudioContext | null;
	/** Override the Notification constructor (test seam). */
	NotificationCtor?: typeof Notification | null;
	/** Override the document (test seam — for title + favicon + matchMedia). */
	doc?: Document | null;
	/** Override the window (test seam — for matchMedia). */
	win?: Window | null;
	/** Override `setInterval` / `clearInterval` / `setTimeout` / `clearTimeout`
	 * (test seam — keeps the unit tests deterministic). */
	deps?: Partial<Deps>;
};

/**
 * Construct with no arguments in production; the constructor reads from
 * the live browser globals (`window.AudioContext`, `window.Notification`,
 * `document`). Tests pass overrides via `SessionSignalsOptions` and never
 * touch the globals.
 */
export class SessionSignals {
	/** Live permission state. `null` only when no Notification API is
	 * available (e.g. Node test env without a polyfill). Updated by
	 * `requestPermission()`. */
	permission = $state<NotificationPermissionValue | null>(null);

	/** Current title-pulse mode. Reactive: the e2e suite asserts on it
	 * directly, and any consumer that wants to reflect the state (e.g.
	 * styling, debugging) can subscribe. */
	titlePulseMode = $state<TitlePulseMode>('off');

	/** Last chime that fired. Reactive: same observability purpose as
	 * `titlePulseMode`. */
	lastChime = $state<ChimeKind | null>(null);

	/** Whether the favicon is currently in the "ended" variant. Reactive
	 * for the same reason. */
	faviconEnded = $state(false);

	#audioContext: AudioContext | null = null;
	#audioUnlocked = false;
	#restingTitle = '';
	#faviconRestingHref: string;
	#faviconEndedHref: string;
	#AudioContextCtor: typeof AudioContext | null;
	#NotificationCtor: typeof Notification | null;
	#doc: Document | null;
	#win: Window | null;
	#deps: Deps;
	#titlePulseTimer: ReturnType<typeof setInterval> | null = null;
	#titlePulseTimeout: ReturnType<typeof setTimeout> | null = null;
	#reducedMotionQuery: MediaQueryList | null = null;

	constructor(opts: SessionSignalsOptions = {}) {
		this.#faviconRestingHref = opts.faviconRestingHref ?? '/favicon.svg';
		this.#faviconEndedHref = opts.faviconEndedHref ?? '/favicon-ended.svg';
		this.#AudioContextCtor =
			opts.AudioContextCtor ??
			(typeof window !== 'undefined'
				? ((globalThis as { AudioContext?: typeof AudioContext }).AudioContext ?? null)
				: null);
		this.#NotificationCtor =
			opts.NotificationCtor ??
			(typeof window !== 'undefined'
				? ((globalThis as { Notification?: typeof Notification }).Notification ?? null)
				: null);
		this.#doc = opts.doc ?? (typeof document !== 'undefined' ? document : null);
		this.#win = opts.win ?? (typeof window !== 'undefined' ? (window as Window) : null);
		this.#deps = {
			now: opts.deps?.now ?? (() => Date.now()),
			setInterval: opts.deps?.setInterval ?? setInterval,
			clearInterval: opts.deps?.clearInterval ?? clearInterval,
			setTimeout: opts.deps?.setTimeout ?? setTimeout,
			clearTimeout: opts.deps?.clearTimeout ?? clearTimeout
		};

		if (this.#NotificationCtor && typeof this.#NotificationCtor.permission === 'string') {
			this.permission = this.#NotificationCtor.permission as NotificationPermissionValue;
		}

		this.#restingTitle = this.#doc?.title ?? '';

		// Track prefers-reduced-motion reactively so a settings change
		// during a running pulse flips mode correctly. The listener is
		// cleared by `dispose()`.
		if (this.#win && typeof this.#win.matchMedia === 'function') {
			this.#reducedMotionQuery = this.#win.matchMedia('(prefers-reduced-motion: reduce)');
			this.#reducedMotionQuery.addEventListener('change', this.#onReducedMotionChange);
		}
	}

	/**
	 * Must be called from a user-gesture handler (e.g. the `start focus`
	 * click). Browsers gate AudioContext creation/resume behind user
	 * activation; the first `start focus` is the activation gesture, and
	 * the same context serves focus-end and break-end thereafter (no
	 * second gesture required).
	 */
	unlockAudio(): void {
		if (this.#audioUnlocked) return;
		if (!this.#AudioContextCtor) return;
		if (!this.#audioContext) {
			try {
				this.#audioContext = new this.#AudioContextCtor();
			} catch {
				// AudioContext can throw if there's no user activation yet,
				// or in non-browser envs. Swallow — we just don't get
				// audio; the visual + OS notification channels remain.
				return;
			}
		}
		// resume() returns a Promise; we don't need to await — the spec is
		// satisfied by the call (and any rejection is silently dropped:
		// the visual channel covers it).
		try {
			void this.#audioContext.resume?.();
		} catch {
			// ignore
		}
		this.#audioUnlocked = true;
	}

	/**
	 * Click handler for the settings-page permission gesture. Calls
	 * `Notification.requestPermission()` and reflects the resolved value
	 * in `permission`. Idempotent: if permission is already `granted` or
	 * `denied`, the browser's API is a no-op and we re-read `permission`.
	 */
	async requestPermission(): Promise<NotificationPermissionValue> {
		if (!this.#NotificationCtor) {
			this.permission = 'denied';
			return 'denied';
		}
		let resolved: NotificationPermissionValue;
		if (typeof this.#NotificationCtor.requestPermission === 'function') {
			const raw = await this.#NotificationCtor.requestPermission();
			resolved = normalisePermission(raw);
		} else {
			resolved = normalisePermission(this.#NotificationCtor.permission);
		}
		this.permission = resolved;
		return resolved;
	}

	/**
	 * Fire every focus-end signal. Always: loud chime + favicon swap +
	 * title pulse (or opacity fade under reduced motion). Conditionally:
	 * OS notification (only if `permission === "granted"`).
	 */
	notifyFocusEnd(opts: { title?: string; body?: string; tag?: string } = {}): void {
		this.#fireNotification(
			opts.title ?? 'Focus session ended',
			opts.body ?? 'Time to take a break.',
			opts.tag ?? 'focus-end'
		);
		this.#playChime('focus');
		this.#startTitlePulse();
		this.#setFaviconEnded(true);
	}

	/**
	 * Fire the break-end signal. Per spec, only the chime fires at
	 * break-end — quieter than the focus-end chime. The favicon stays in
	 * whatever state it's in (we only swap-back on the next user action
	 * from idle / break-running).
	 */
	notifyBreakEnd(): void {
		this.#playChime('break');
	}

	/**
	 * Hook the next `start focus` click. Spec choice: the favicon swaps
	 * back to the resting variant on the next user action from idle /
	 * break-running; we pick "next `start focus`" as the single clean
	 * edge (one hook, one decision). This also stops any running title
	 * pulse and clears the `data-title-pulse` attribute.
	 */
	resetOnNextStartFocus(): void {
		this.#stopTitlePulse();
		this.#setFaviconEnded(false);
	}

	/** Stop everything: clear timers, restore title, restore favicon. */
	dispose(): void {
		this.#stopTitlePulse();
		this.#setFaviconEnded(false);
		if (this.#audioContext) {
			try {
				void this.#audioContext.close();
			} catch {
				// ignore
			}
			this.#audioContext = null;
		}
		this.#audioUnlocked = false;
		if (this.#reducedMotionQuery) {
			this.#reducedMotionQuery.removeEventListener('change', this.#onReducedMotionChange);
			this.#reducedMotionQuery = null;
		}
	}

	// -- Internals ------------------------------------------------------------

	#fireNotification(title: string, body: string, tag: string): void {
		if (!this.#NotificationCtor) return;
		if (this.permission !== 'granted') return;
		try {
			new this.#NotificationCtor(title, {
				body,
				tag,
				// `silent: true` prevents the OS from playing its own
				// notification sound — our chime is the audio channel.
				silent: true
			});
		} catch {
			// Some browsers throw when called from a non-secure context
			// or after prolonged backgrounding. Swallow; the in-app
			// channels still fired.
		}
	}

	#playChime(kind: ChimeKind): void {
		this.lastChime = kind;
		if (!this.#audioContext) return;
		const ctx = this.#audioContext;
		const t0 = ctx.currentTime;

		if (kind === 'focus') {
			// Louder three-note ascending bell: C5 → E5 → G5. Each note
			// gets a fast attack (~10ms) and a soft exponential decay so
			// the chord reads as "warm chime", not "alarm".
			const notes = [
				{ freq: 523.25, start: 0.0, peak: 0.4, dur: 0.55 },
				{ freq: 659.25, start: 0.18, peak: 0.36, dur: 0.55 },
				{ freq: 783.99, start: 0.36, peak: 0.32, dur: 0.55 }
			];
			for (const n of notes) {
				this.#note(ctx, t0 + n.start, n.freq, n.peak, n.dur);
			}
		} else {
			// Quieter single tone: just C5, lower gain, a bit longer
			// decay. Reads as "back to work", not "alarm".
			this.#note(ctx, t0, 523.25, 0.15, 0.6);
		}
	}

	#note(
		ctx: AudioContext,
		startAt: number,
		freq: number,
		peakGain: number,
		duration: number
	): void {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.frequency.value = freq;
		osc.type = 'sine';
		gain.gain.setValueAtTime(0, startAt);
		gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.01);
		// Exponential decay to ~0.0001 (can't reach 0 via exponentialRamp).
		gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
		osc.connect(gain).connect(ctx.destination);
		osc.start(startAt);
		osc.stop(startAt + duration + 0.05);
	}

	#startTitlePulse(): void {
		this.#stopTitlePulse();
		if (!this.#doc) return;

		const reduced = this.#isReducedMotion();

		if (reduced) {
			// Opacity-fade fallback (spec #6 + #36): the kinetic pulse
			// becomes a one-shot CSS animation on the timer section, and
			// the title changes once and stays for the duration. Both
			// signals arrive; neither is kinetic. The CSS rule lives in
			// layout.css and is scoped to `[data-timer][data-title-pulse]`
			// — the fade only animates the timer region, not the page
			// root.
			this.titlePulseMode = 'fade';
			this.#doc.title = `Focus ended · ${this.#restingTitle}`;
			this.#titlePulseTimeout = this.#deps.setTimeout(() => {
				this.#titlePulseTimeout = null;
				if (this.#doc) this.#doc.title = this.#restingTitle;
				this.titlePulseMode = 'off';
			}, 2000);
		} else {
			// Kinetic pulse: oscillate the title between
			// "Focus ended · X" and the resting title for 5 seconds.
			// The pulse mode is exposed reactively so the home route
			// applies `data-title-pulse="pulse"` to the timer section
			// (a hook for any future kinetic styling). The kinetic
			// signal lives entirely in `document.title` — no DOM
			// animation.
			this.titlePulseMode = 'pulse';
			const doc = this.#doc;
			let on = true;
			doc.title = `Focus ended · ${this.#restingTitle}`;
			this.#titlePulseTimer = this.#deps.setInterval(() => {
				on = !on;
				doc.title = on ? `Focus ended · ${this.#restingTitle}` : this.#restingTitle;
			}, 800);
			this.#titlePulseTimeout = this.#deps.setTimeout(() => {
				this.#stopTitlePulse();
			}, 5000);
		}
	}

	#stopTitlePulse(): void {
		if (this.#titlePulseTimer !== null) {
			this.#deps.clearInterval(this.#titlePulseTimer);
			this.#titlePulseTimer = null;
		}
		if (this.#titlePulseTimeout !== null) {
			this.#deps.clearTimeout(this.#titlePulseTimeout);
			this.#titlePulseTimeout = null;
		}
		if (this.#doc) this.#doc.title = this.#restingTitle;
		this.titlePulseMode = 'off';
	}

	#setFaviconEnded(ended: boolean): void {
		this.faviconEnded = ended;
		if (!this.#doc) return;
		const link = this.#doc.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
		if (!link) return;
		link.href = ended ? this.#faviconEndedHref : this.#faviconRestingHref;
		if (ended) {
			this.#doc.documentElement.dataset.favicon = 'ended';
		} else {
			delete this.#doc.documentElement.dataset.favicon;
		}
	}

	#isReducedMotion(): boolean {
		return this.#reducedMotionQuery?.matches ?? false;
	}

	#onReducedMotionChange = (): void => {
		// No-op today (the pulse is short-lived and we re-check on the
		// next `notifyFocusEnd`). Hooked so the listener reference is
		// stable for `removeEventListener`.
	};
}

function normalisePermission(value: unknown): NotificationPermissionValue {
	if (value === 'granted' || value === 'denied' || value === 'default') return value;
	return 'default';
}
