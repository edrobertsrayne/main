import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { TimerController, type EndCause } from './timer-controller.svelte';

type IntervalCallback = () => void;
type FakeIntervalHandle = { id: number; cb: IntervalCallback };

type FakeDeps = {
	now: () => number;
	setInterval: typeof setInterval;
	clearInterval: typeof clearInterval;
	tick: (advanceMs: number) => void;
};

function makeDeps(initialNow = 1_700_000_000_000): FakeDeps {
	const handles = new Map<number, FakeIntervalHandle>();
	let nextId = 1;
	let now = initialNow;
	const tick = (advanceMs: number) => {
		now += advanceMs;
		// Snapshot the callbacks first; a tick handler may install/remove timers.
		const cbs = Array.from(handles.values()).map((h) => h.cb);
		for (const cb of cbs) cb();
	};
	const deps: FakeDeps = {
		now: () => now,
		setInterval: ((cb: IntervalCallback) => {
			const id = nextId++;
			handles.set(id, { id, cb });
			return id as unknown as ReturnType<typeof setInterval>;
		}) as typeof setInterval,
		clearInterval: ((handle: unknown) => {
			handles.delete(handle as number);
		}) as typeof clearInterval,
		tick
	};
	return deps;
}

type FocusEndRecord = {
	taskId: string;
	startedAt: number;
	stoppedAt: number;
	durationSeconds: number;
	endCause: EndCause;
};

let focusCalls: FocusEndRecord[] = [];
let breakCalls: number = 0;

beforeEach(() => {
	focusCalls = [];
	breakCalls = 0;
});

afterEach(() => {
	vi.restoreAllMocks();
});

function makeController(
	deps: FakeDeps,
	onFocusEnd: (input: FocusEndRecord) => void = (i) => focusCalls.push(i),
	onBreakEnd: () => void = () => {
		breakCalls++;
	}
) {
	return new TimerController({ deps, onFocusEnd, onBreakEnd });
}

describe('initial state', () => {
	it('starts idle with no task, no clock, counter 0, no last focus', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		expect(t.state).toBe('idle');
		expect(t.taskId).toBeNull();
		expect(t.startedAt).toBeNull();
		expect(t.endAt).toBeNull();
		expect(t.counter).toBe(0);
		expect(t.lastFocusEndAt).toBeNull();
		expect(t.transitioningPrompt).toBeNull();
	});

	it('has no "paused" state value — pausing is structurally inexpressible', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		// TypeScript can't make runtime guarantees about a closed string
		// union, but the structural assertions below are what actually
		// matter: the controller exposes no pause/resume/hold handle, so
		// pausing is impossible from the public API.
		expect((t as unknown as { pause?: unknown }).pause).toBeUndefined();
		expect((t as unknown as { resume?: unknown }).resume).toBeUndefined();
		expect((t as unknown as { hold?: unknown }).hold).toBeUndefined();
		// Every documented transition action (`startFocus`, `ring`, `stop`,
		// `confirm`, `skip`, `fastForwardToFocus`, `completeBreak`) is a
		// function — anything else masquerading as a state-mutation method
		// would be a no-go. Sanity-check the documented set.
		for (const name of [
			'startFocus',
			'ring',
			'stop',
			'confirm',
			'skip',
			'fastForwardToFocus',
			'completeBreak'
		]) {
			expect(typeof (t as unknown as Record<string, unknown>)[name]).toBe('function');
		}
	});

	it('has no "fast-forward to break" gesture — only fast-forward to focus', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		expect((t as unknown as { fastForwardToBreak?: unknown }).fastForwardToBreak).toBeUndefined();
		expect(typeof t.fastForwardToFocus).toBe('function');
	});
});

describe('idle → focus-running', () => {
	it('captures taskId, startedAt, and the 25-minute endAt', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('task-1');
		expect(t.state).toBe('focus-running');
		expect(t.taskId).toBe('task-1');
		expect(t.startedAt).toBe(deps.now());
		expect(t.endAt).toBe(deps.now() + 25 * 60 * 1000);
		expect(t.totalMs).toBe(25 * 60 * 1000);
	});

	it('is a no-op when called from any non-idle state', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		const before = t.state;
		t.startFocus('b');
		expect(t.taskId).toBe('a');
		expect(t.state).toBe(before);
	});

	it('reports Phase label "Focus"', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		expect(t.phaseLabel).toBe('Focus');
	});

	it('gap-reset threshold: resets counter when gap > LONG_BREAK_MS', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.counter = 3;
		t.lastFocusEndAt = deps.now() - (20 * 60 * 1000 + 1);
		t.startFocus('a');
		expect(t.counter).toBe(0);
	});

	it('gap-reset threshold: keeps counter when gap is exactly LONG_BREAK_MS', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.counter = 3;
		t.lastFocusEndAt = deps.now() - 20 * 60 * 1000;
		t.startFocus('a');
		expect(t.counter).toBe(3);
	});

	it('gap-reset threshold: keeps counter on a short gap', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.counter = 3;
		t.lastFocusEndAt = deps.now() - 4 * 60 * 1000; // 4-min gap
		t.startFocus('a');
		expect(t.counter).toBe(3);
	});

	it('gap-reset threshold is measured from `last_focus_end_at`, not the prior startedAt', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		// lastFocusEndAt is many minutes back; counter should reset.
		t.counter = 2;
		t.lastFocusEndAt = deps.now() - 25 * 60 * 1000; // 25-min gap from a ring
		t.startFocus('a');
		expect(t.counter).toBe(0);
	});
});

describe('focus-running → transitioning via ring', () => {
	it('increments counter and routes to transitioning (short break)', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.ring();
		expect(t.state).toBe('transitioning');
		expect(t.counter).toBe(1);
		expect(t.transitioningPrompt).toBe('break');
		expect(focusCalls).toHaveLength(1);
		expect(focusCalls[0]?.endCause).toBe('ring');
		expect(focusCalls[0]?.taskId).toBe('a');
	});

	it('routes to long-break iff post-increment counter is a positive multiple of 4', () => {
		const deps = makeDeps();
		const t = makeController(deps);

		// Cycle of 4 rings to land on counter=4 (positive multiple of 4).
		t.startFocus('a');
		t.ring();
		expect(t.transitioningPrompt).toBe('break');
		t.confirm();
		t.fastForwardToFocus('a'); // break → focus, counter preserved at 1
		expect(t.counter).toBe(1);
		expect(t.state).toBe('focus-running');
		t.ring();
		expect(t.transitioningPrompt).toBe('break'); // counter=2

		t.confirm();
		t.fastForwardToFocus('a');
		t.ring();
		expect(t.transitioningPrompt).toBe('break'); // counter=3

		t.confirm();
		t.fastForwardToFocus('a');
		t.ring();
		expect(t.counter).toBe(4);
		expect(t.transitioningPrompt).toBe('long-break'); // counter=4 ✓
	});

	it('after a long-break routing, the next ring (counter=5) is short-break again', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.counter = 3;
		t.startFocus('a');
		t.ring();
		expect(t.transitioningPrompt).toBe('long-break');
		t.confirm();
		// Confirming a long-break routes to long-break-running; complete it,
		// which resets counter to 0.
		t.completeBreak();
		expect(t.counter).toBe(0);
		expect(t.state).toBe('idle');

		// Fresh cycle: ring should be counter=1 → break.
		t.startFocus('a');
		t.ring();
		expect(t.transitioningPrompt).toBe('break');
		expect(t.counter).toBe(1);
	});

	it('writes the ring row with startedAt ≤ stoppedAt and durationSeconds in seconds', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.ring();
		expect(focusCalls).toHaveLength(1);
		const call = focusCalls[0]!;
		expect(call.startedAt).toBeLessThanOrEqual(call.stoppedAt);
		expect(call.durationSeconds).toBe(Math.round((call.stoppedAt - call.startedAt) / 1000));
	});

	it('updates lastFocusEndAt on ring, not on stop', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		expect(t.lastFocusEndAt).toBeNull();
		t.ring();
		expect(t.lastFocusEndAt).toBe(deps.now());
	});
});

describe('focus-running → transitioning via stop', () => {
	it('resets counter to 0 and always offers a short break (never long)', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		// crank counter up via direct mutation for the test setup
		t.counter = 3;
		t.stop();
		expect(t.state).toBe('transitioning');
		expect(t.counter).toBe(0);
		expect(t.transitioningPrompt).toBe('break');
		expect(focusCalls[0]?.endCause).toBe('stop');
	});

	it('does NOT update lastFocusEndAt (only rings do)', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.stop();
		expect(t.lastFocusEndAt).toBeNull();
	});

	it('still writes a focus_session row (one actual per attempt)', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		focusCalls = [];
		t.stop();
		expect(focusCalls).toHaveLength(1);
		expect(focusCalls[0]?.endCause).toBe('stop');
	});
});

describe('transitioning interactions', () => {
	it('confirm with short-break prompt routes to break-running (5 min)', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.ring();
		t.confirm();
		expect(t.state).toBe('break-running');
		expect(t.endAt).toBe(deps.now() + 5 * 60 * 1000);
		expect(t.totalMs).toBe(5 * 60 * 1000);
		expect(t.phaseLabel).toBe('Short break');
	});

	it('confirm with long-break prompt routes to long-break-running (20 min)', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.counter = 3;
		t.startFocus('a');
		t.ring();
		expect(t.counter).toBe(4);
		expect(t.transitioningPrompt).toBe('long-break');
		t.confirm();
		expect(t.state).toBe('long-break-running');
		expect(t.endAt).toBe(deps.now() + 20 * 60 * 1000);
		expect(t.totalMs).toBe(20 * 60 * 1000);
		expect(t.phaseLabel).toBe('Long break');
	});

	it('skip returns to idle and clears the prompt', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.ring();
		t.skip();
		expect(t.state).toBe('idle');
		expect(t.transitioningPrompt).toBeNull();
	});

	it('stop in transitioning returns to idle (no row written)', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.ring();
		expect(t.state).toBe('transitioning');
		const callsBefore = focusCalls.length; // 1 from the ring above
		t.stop();
		expect(t.state).toBe('idle');
		expect(focusCalls.length).toBe(callsBefore);
	});

	it('30-second auto-confirm: confirm fires when 30s elapses (no manual click)', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.ring();
		expect(t.state).toBe('transitioning');
		deps.tick(30 * 1000);
		expect(t.state).toBe('break-running');
	});
});

describe('break-running → idle', () => {
	it('natural completion returns to idle and the counter is preserved', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		// counter=1, ring → counter=2 → break-running
		t.counter = 1;
		t.startFocus('a');
		t.ring();
		expect(t.counter).toBe(2);
		t.confirm();
		expect(t.state).toBe('break-running');
		t.completeBreak();
		expect(t.state).toBe('idle');
		expect(t.counter).toBe(2); // short break doesn't reset counter
	});

	it('stop returns to idle and the counter is preserved', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.counter = 1;
		t.startFocus('a');
		t.ring();
		t.confirm();
		t.stop();
		expect(t.state).toBe('idle');
		expect(t.counter).toBe(2);
	});

	it('natural completion via the fake clock (5 min elapses)', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.ring();
		t.confirm();
		expect(t.state).toBe('break-running');
		deps.tick(5 * 60 * 1000);
		expect(t.state).toBe('idle');
	});
});

describe('long-break-running → idle', () => {
	it('natural completion resets counter to 0', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		// counter=3, ring → counter=4 → transitioning(long-break) → confirm
		t.counter = 3;
		t.startFocus('a');
		t.ring();
		expect(t.counter).toBe(4);
		t.confirm();
		expect(t.state).toBe('long-break-running');
		t.completeBreak();
		expect(t.state).toBe('idle');
		expect(t.counter).toBe(0);
	});

	it('stop also resets counter to 0', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.counter = 3;
		t.startFocus('a');
		t.ring();
		t.confirm();
		expect(t.state).toBe('long-break-running');
		t.stop();
		expect(t.state).toBe('idle');
		expect(t.counter).toBe(0);
	});
});

describe('break-running → focus-running (fast-forward)', () => {
	it('starts a new focus without writing a break-session row', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.ring();
		t.confirm();
		expect(t.state).toBe('break-running');
		const callsBefore = focusCalls.length; // 1 from the ring above
		t.fastForwardToFocus('b');
		expect(t.state).toBe('focus-running');
		expect(t.taskId).toBe('b');
		expect(focusCalls.length).toBe(callsBefore);
	});

	it('preserves the counter from a short-break fast-forward', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		// counter=1, ring → counter=2 → break-running
		t.counter = 1;
		t.startFocus('a');
		t.ring();
		expect(t.counter).toBe(2);
		t.confirm();
		expect(t.state).toBe('break-running');
		expect(t.counter).toBe(2);
		t.fastForwardToFocus('b');
		expect(t.counter).toBe(2);
	});

	it('counter is reset on a long-break fast-forward', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		// counter=3, ring → counter=4 → long-break-running
		t.counter = 3;
		t.startFocus('a');
		t.ring();
		expect(t.counter).toBe(4);
		t.confirm();
		expect(t.state).toBe('long-break-running');
		// Fast-forward out of long-break-running resets the cycle counter —
		// the long break is over, the cycle starts fresh.
		t.fastForwardToFocus('b');
		expect(t.state).toBe('focus-running');
		expect(t.counter).toBe(0);
	});
});

describe('tick-based auto-transitions (setInterval + Date.now driven)', () => {
	it('fires ring() automatically when the wall clock reaches endAt', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		expect(t.state).toBe('focus-running');
		deps.tick(25 * 60 * 1000);
		expect(t.state).toBe('transitioning');
		expect(t.counter).toBe(1);
	});

	it('drives the 5-min short break to natural completion', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.ring();
		t.confirm();
		expect(t.state).toBe('break-running');
		deps.tick(5 * 60 * 1000);
		expect(t.state).toBe('idle');
	});

	it('drives the 20-min long break to natural completion and resets counter', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.counter = 3;
		t.startFocus('a');
		t.ring();
		t.confirm();
		expect(t.state).toBe('long-break-running');
		deps.tick(20 * 60 * 1000);
		expect(t.state).toBe('idle');
		expect(t.counter).toBe(0);
	});
});

describe('onFocusEnd callback', () => {
	it('is invoked exactly once per ring', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.ring();
		expect(focusCalls).toHaveLength(1);
	});

	it('is invoked exactly once per stop', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.stop();
		expect(focusCalls).toHaveLength(1);
		expect(focusCalls[0]?.endCause).toBe('stop');
	});

	it('is not invoked on fast-forward to focus', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.ring();
		t.confirm();
		const callsBefore = focusCalls.length;
		t.fastForwardToFocus('b');
		expect(focusCalls.length).toBe(callsBefore);
	});

	it('passes startedAt from the in-flight focus, not from now()', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		const startNow = deps.now();
		t.ring();
		expect(focusCalls[0]?.startedAt).toBe(startNow);
	});
});

describe('focus-end writes always happen', () => {
	it('even on a stop that is the very first action', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.stop();
		expect(focusCalls).toHaveLength(1);
	});

	it('a stopped 4th focus never reaches a long break (counter resets to 0)', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.counter = 3;
		t.startFocus('a');
		t.stop();
		expect(t.transitioningPrompt).toBe('break');
		expect(t.counter).toBe(0);
	});
});

describe('onBreakEnd callback', () => {
	it('fires on natural completion of a short break', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.ring();
		t.confirm();
		expect(t.state).toBe('break-running');
		t.completeBreak();
		expect(breakCalls).toBe(1);
	});

	it('fires on natural completion of a long break', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.counter = 3;
		t.startFocus('a');
		t.ring();
		t.confirm();
		expect(t.state).toBe('long-break-running');
		t.completeBreak();
		expect(breakCalls).toBe(1);
	});

	it('does NOT fire when a break ends via `stop`', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.ring();
		t.confirm();
		expect(t.state).toBe('break-running');
		t.stop();
		expect(breakCalls).toBe(0);
	});

	it('does NOT fire when a break ends via `fastForwardToFocus`', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.ring();
		t.confirm();
		expect(t.state).toBe('break-running');
		t.fastForwardToFocus('b');
		expect(breakCalls).toBe(0);
	});
});

describe('mid-cycle persistence', () => {
	it('does not persist: a fresh controller instance starts idle regardless of prior state', () => {
		const deps = makeDeps();
		const old = makeController(deps);
		old.startFocus('a');
		old.ring();
		const fresh = makeController(deps);
		expect(fresh.state).toBe('idle');
		expect(fresh.taskId).toBeNull();
		expect(fresh.counter).toBe(0);
		expect(focusCalls).toHaveLength(1);
	});
});

describe('remainingMs getter', () => {
	it('computes endAt - now() while running', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		expect(t.remainingMs).toBe(25 * 60 * 1000);
	});

	it('clamps to 0 once endAt has passed', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		t.startFocus('a');
		t.endAt = deps.now() - 1;
		expect(t.remainingMs).toBe(0);
	});

	it('is 0 when idle (no endAt)', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		expect(t.remainingMs).toBe(0);
	});
});

describe('transitioningTotalMs', () => {
	it('is the constant 30-second auto-confirm duration regardless of state', () => {
		const deps = makeDeps();
		const t = makeController(deps);
		expect(t.transitioningTotalMs).toBe(30 * 1000);
		t.startFocus('a');
		expect(t.transitioningTotalMs).toBe(30 * 1000);
		t.ring();
		expect(t.transitioningTotalMs).toBe(30 * 1000);
		t.skip();
		expect(t.transitioningTotalMs).toBe(30 * 1000);
	});
});
