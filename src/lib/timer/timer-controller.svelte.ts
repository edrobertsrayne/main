/**
 * Timer FSM controller.
 *
 * Implements ADR 0001 end-to-end: 5 states (idle, focus-running, transitioning,
 * break-running, long-break-running), clocked by setInterval + Date.now (no
 * requestAnimationFrame, no performance.now — a fake clock drives it the same
 * way the real wall clock does). No `paused` state exists structurally; pausing
 * is impossible by design. The gap-reset threshold and the long-break length
 * are one shared variable (LONG_BREAK_MS) so the drift that reopened #13
 * cannot recur.
 *
 * The class is a Svelte-5 runes class: fields marked `$state(...)` are
 * reactive. Reads of those fields inside computed values, effects, or other
 * $state reads create automatic dependencies. The `nowTick` field exists so
 * the page can derive `remainingMs` (which is a function of `Date.now`) by
 * binding to a single reactive value — the interval increments `nowTick`.
 */

export type TimerState =
	'idle' | 'focus-running' | 'transitioning' | 'break-running' | 'long-break-running';

import type { EndCause } from './types';

export type TransitioningPrompt = 'break' | 'long-break';
export type { EndCause };

const FOCUS_MS = 25 * 60 * 1000;
const SHORT_BREAK_MS = 5 * 60 * 1000;
/**
 * One shared variable: long-break length and gap-reset threshold.
 * Per ADR 0001, retied to one value after #13 to retire the standalone
 * 15-min constant. Changing this number retunes both at once.
 */
const LONG_BREAK_MS = 20 * 60 * 1000;
const TRANSITIONING_AUTO_CONFIRM_MS = 30 * 1000;
const TICK_MS = 1000;

type FocusEndInput = {
	taskId: string;
	startedAt: number;
	stoppedAt: number;
	durationSeconds: number;
	endCause: EndCause;
};

type Deps = {
	now: () => number;
	setInterval: typeof setInterval;
	clearInterval: typeof clearInterval;
};

export type TimerControllerOptions = {
	/**
	 * Called exactly once per focus end (ring OR stop). The handler is
	 * responsible for persisting the focus_session row. The server data-layer
	 * derives `local_day` from `startedAt`; the controller does no time-zone
	 * arithmetic of its own.
	 */
	onFocusEnd?: (input: FocusEndInput) => void;
	deps?: Partial<Deps>;
};

const defaultNow = () => Date.now();
const defaultSetInterval: typeof setInterval = (() => {
	if (typeof window !== 'undefined') return window.setInterval.bind(window);
	return globalThis.setInterval;
})();
const defaultClearInterval: typeof clearInterval = (() => {
	if (typeof window !== 'undefined') return window.clearInterval.bind(window);
	return globalThis.clearInterval;
})();

export class TimerController {
	state = $state<TimerState>('idle');
	taskId = $state<string | null>(null);
	/**
	 * `startedAt` of the in-flight focus session. Null when not in focus-running.
	 * Drives the focus_session row's `started_at` and (via the data layer) its
	 * `local_day`.
	 */
	startedAt = $state<number | null>(null);
	/**
	 * Wall-clock end timestamp for the current phase (focus / short-break /
	 * long-break) or the transitioning auto-confirm deadline. Null when idle.
	 */
	endAt = $state<number | null>(null);
	/**
	 * Consecutive-completed pomodoros rung in the current cycle. Ticks on
	 * `ring`, resets to 0 on `stop` (an interruption breaks the chain per ADR
	 * #12) and after a long break ends. Also reset on start focus if the gap
	 * from the last focus end exceeds LONG_BREAK_MS (the shared variable).
	 */
	counter = $state(0);
	/**
	 * Wall-clock `stoppedAt` of the most recent focus session that ended by
	 * `ring`. Used to measure the gap-reset threshold at the next start focus.
	 */
	lastFocusEndAt = $state<number | null>(null);
	/**
	 * What break (if any) the prompt is offering during the transitioning
	 * state. `long-break` is offered iff post-increment `counter` is a positive
	 * multiple of 4 — never on stop. Cleared on confirm/skip.
	 */
	transitioningPrompt = $state<TransitioningPrompt | null>(null);

	/**
	 * Bumped on every tick. UI consumers bind to this to recompute
	 * `remainingMs`. Has no public meaning beyond reactivity.
	 */
	nowTick = $state(0);

	#now: () => number;
	#setInterval: typeof setInterval;
	#clearInterval: typeof clearInterval;
	#intervalId: ReturnType<typeof setInterval> | null = null;
	#transitioningStartedAt: number | null = null;
	#onFocusEnd: ((input: FocusEndInput) => void) | null = null;

	constructor(options: TimerControllerOptions = {}) {
		this.#now = options.deps?.now ?? defaultNow;
		this.#setInterval = options.deps?.setInterval ?? defaultSetInterval;
		this.#clearInterval = options.deps?.clearInterval ?? defaultClearInterval;
		this.#onFocusEnd = options.onFocusEnd ?? null;
	}

	// -- Public read-only getters (UI binds to these) -------------------------

	get remainingMs(): number {
		// Read `nowTick` first so the binding fires on every interval tick.
		void this.nowTick;
		if (this.endAt === null) return 0;
		return Math.max(0, this.endAt - this.#now());
	}

	get totalMs(): number {
		switch (this.state) {
			case 'focus-running':
				return FOCUS_MS;
			case 'break-running':
				return SHORT_BREAK_MS;
			case 'long-break-running':
				return LONG_BREAK_MS;
			default:
				return 0;
		}
	}

	get phaseLabel(): string {
		switch (this.state) {
			case 'idle':
				return 'Idle';
			case 'focus-running':
				return 'Focus';
			case 'transitioning':
				return 'Transitioning';
			case 'break-running':
				return 'Short break';
			case 'long-break-running':
				return 'Long break';
		}
	}

	/** Prompt copy used while in `transitioning` (the controller owns the durations). */
	get transitioningLabel(): string {
		return this.transitioningPrompt === 'long-break'
			? 'Take a 20-minute long break?'
			: 'Take a 5-minute break?';
	}

	get transitioningRemainingMs(): number {
		void this.nowTick;
		if (this.state !== 'transitioning' || this.#transitioningStartedAt === null) return 0;
		return Math.max(
			0,
			TRANSITIONING_AUTO_CONFIRM_MS - (this.#now() - this.#transitioningStartedAt)
		);
	}

	// -- Actions -------------------------------------------------------------

	/** idle → focus-running. Capture taskId + startedAt, apply gap-reset. */
	startFocus(taskId: string): void {
		if (this.state !== 'idle') return;
		const now = this.#now();
		if (this.lastFocusEndAt !== null && now - this.lastFocusEndAt > LONG_BREAK_MS) {
			this.counter = 0;
		}
		this.taskId = taskId;
		this.startedAt = now;
		this.endAt = now + FOCUS_MS;
		this.state = 'focus-running';
		this.#startTicking();
	}

	/**
	 * Universal stop. In focus-running: ends the focus (writes a row with
	 * end_cause='stop', resets counter, routes to transitioning). In break or
	 * long-break-running: ends the break, returns to idle. In transitioning:
	 * skips the prompt, returns to idle.
	 */
	stop(): void {
		switch (this.state) {
			case 'focus-running': {
				this.#endFocus('stop');
				this.counter = 0;
				// Stop never earns a long break (#12): short break only.
				this.transitioningPrompt = 'break';
				this.state = 'transitioning';
				this.#transitioningStartedAt = this.#now();
				this.endAt = this.#transitioningStartedAt + TRANSITIONING_AUTO_CONFIRM_MS;
				// Restart ticking so the 30s auto-confirm fires.
				this.#startTicking();
				break;
			}
			case 'break-running':
			case 'long-break-running': {
				this.#endBreak();
				this.state = 'idle';
				break;
			}
			case 'transitioning': {
				this.#stopTicking();
				this.#transitioningStartedAt = null;
				this.endAt = null;
				this.transitioningPrompt = null;
				this.state = 'idle';
				break;
			}
			case 'idle':
				return;
		}
	}

	/**
	 * focus-running → transitioning(ring). Increments counter; writes a
	 * focus_session row with end_cause='ring'; the prompt offers long-break
	 * iff post-increment counter is a positive multiple of 4.
	 */
	ring(): void {
		if (this.state !== 'focus-running') return;
		this.#endFocus('ring');
		this.counter = this.counter + 1;
		this.transitioningPrompt = this.counter > 0 && this.counter % 4 === 0 ? 'long-break' : 'break';
		this.state = 'transitioning';
		const now = this.#now();
		this.#transitioningStartedAt = now;
		this.endAt = now + TRANSITIONING_AUTO_CONFIRM_MS;
		// The interval was stopped by `#endFocus`; restart it so the 30s
		// auto-confirm fires.
		this.#startTicking();
	}

	/** transitioning → break-running | long-break-running. Default = 30s. */
	confirm(): void {
		if (this.state !== 'transitioning') return;
		const longBreak = this.transitioningPrompt === 'long-break';
		this.#stopTicking();
		this.#transitioningStartedAt = null;
		this.transitioningPrompt = null;
		const now = this.#now();
		this.endAt = now + (longBreak ? LONG_BREAK_MS : SHORT_BREAK_MS);
		this.startedAt = null;
		this.state = longBreak ? 'long-break-running' : 'break-running';
		this.#startTicking();
	}

	/** transitioning → idle. */
	skip(): void {
		if (this.state !== 'transitioning') return;
		this.#stopTicking();
		this.#transitioningStartedAt = null;
		this.endAt = null;
		this.transitioningPrompt = null;
		this.state = 'idle';
	}

	/**
	 * break-running | long-break-running → focus-running. Starts a new focus
	 * (no break-session row written; the previous focus's cycle-counter state
	 * is preserved unless a long break reset it).
	 */
	fastForwardToFocus(taskId: string): void {
		if (this.state !== 'break-running' && this.state !== 'long-break-running') return;
		this.#endBreak();
		this.state = 'idle';
		this.taskId = null;
		this.startedAt = null;
		this.transitioningPrompt = null;
		this.#transitioningStartedAt = null;
		this.startFocus(taskId);
	}

	/** Natural end of break-running or long-break-running → idle. */
	completeBreak(): void {
		if (this.state !== 'break-running' && this.state !== 'long-break-running') return;
		this.#endBreak();
		this.state = 'idle';
		this.#resetForIdle();
	}

	// -- Internals -----------------------------------------------------------

	#endFocus(cause: EndCause): void {
		this.#stopTicking();
		const taskId = this.taskId;
		const startedAt = this.startedAt ?? this.#now();
		const stoppedAt = this.#now();
		if (taskId !== null && this.#onFocusEnd) {
			this.#onFocusEnd({
				taskId,
				startedAt,
				stoppedAt,
				durationSeconds: Math.max(0, Math.round((stoppedAt - startedAt) / 1000)),
				endCause: cause
			});
		}
		if (cause === 'ring') {
			this.lastFocusEndAt = stoppedAt;
		}
	}

	#endBreak(): void {
		this.#stopTicking();
		// Per ADR: any path out of long-break-running resets the cycle counter.
		if (this.state === 'long-break-running') {
			this.counter = 0;
		}
		this.endAt = null;
	}

	#resetForIdle(): void {
		this.endAt = null;
		this.taskId = null;
		this.startedAt = null;
		this.transitioningPrompt = null;
		this.#transitioningStartedAt = null;
	}

	#startTicking(): void {
		if (this.#intervalId !== null) return;
		this.#intervalId = this.#setInterval(() => {
			this.nowTick = this.nowTick + 1;
			const now = this.#now();
			if (this.state === 'focus-running') {
				if (this.endAt !== null && now >= this.endAt) {
					this.ring();
				}
			} else if (this.state === 'break-running' || this.state === 'long-break-running') {
				if (this.endAt !== null && now >= this.endAt) {
					this.completeBreak();
				}
			} else if (this.state === 'transitioning') {
				if (this.endAt !== null && now >= this.endAt) {
					this.confirm();
				}
			}
		}, TICK_MS);
	}

	#stopTicking(): void {
		if (this.#intervalId !== null) {
			this.#clearInterval(this.#intervalId);
			this.#intervalId = null;
		}
	}
}
