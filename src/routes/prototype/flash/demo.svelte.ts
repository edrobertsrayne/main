// Prototype flash demo data + helpers. THROWAWAY — do not fold into main.
// Local copy of ../palette/demo.svelte.ts (self-contained route — do NOT import
// across). Used by the /prototype/flash route to evaluate the session-end flash
// mechanism (issue #15) on top of the LOCKED coral composition. Reflects the
// DECIDED data model (issue #4) + domain glossary (CONTEXT.md): every field
// name below matches the glossary exactly.

export type Task = {
	id: string;
	title: string;
	estimate: number;
	actuals: number;
	done: boolean;
	archived: boolean;
	isPrimaryToday: boolean;
};

// The timer's FSM states, per ADR 0001 (timer state machine).
export type TimerScene =
	'idle' | 'focus-running' | 'transitioning' | 'break-running' | 'long-break-running';

// The design languages this prototype evaluates. Five warm-pastel-light palettes
// share Plus Jakarta Sans (honey = baseline; amber/terracotta/coral/clay are
// alternative colour schemes); editorial + deskclock pair different fonts and stay
// reachable via ?lang= directly but out of the switcher's arrow-cycle. Switched via ?lang=.
// NOTE: the flash route hard-codes coral and never switches lang — this type is kept
// for verbatim parity with ../palette/demo.svelte.ts (throwaway, do not remove).
export type Lang = 'honey' | 'amber' | 'terracotta' | 'coral' | 'clay' | 'editorial' | 'deskclock';

// The three candidate session-end signal scopes the flash prototype evaluates,
// switched via ?variant=A|B|C (default A). PIVOT: the prototype now shows a HELD
// palette swap keyed to the timer phase — no transient flash — so the variants
// differ on the SCOPE of swap, not the kind of animation:
//   A = only --bg swaps to the break palette (subtle edge signal)
//   B = --bg + --surface swap (surfaces acknowledge the phase change)
//   C = full palette swap (whole page becomes a different "room")
export type FlashVariant = 'A' | 'B' | 'C';

// The active palette the page is holding. `focus` = coral (the locked palette
// from #14, boldened in this iteration as a spike — may reopen #14's 'warm
// pastel' lock if the bolder coral reads right); `break` = deeper sage
// complement. The phase flips on the same
// edges #6 fires its notification: focus-end (focus-running → transitioning)
// flips to 'break'; break-end (break-running|long-break-running → idle) flips
// back to 'focus'. Held between transitions — the swap IS the signal, not a
// transient flash.
export type Phase = 'focus' | 'break';

// Six realistic pomodoro work items — five mirror the layout prototype's required
// shapes, plus a sixth that naturally demonstrates the over-estimate (error) state:
// - a not-started primary-today task (estimate 3, actuals 0)
// - an in-progress task (actuals 2 of estimate 5)
// - a done task (done, actuals 4 of estimate 4)
// - an archived-not-done task (archived, actuals 1 of estimate 2)
// - a not-primary not-started task (estimate 1, actuals 0)
// - a not-started task with actuals > estimate (over-estimate -> --error token)
export const sampleTasks: Task[] = [
	{
		id: 't1',
		title: 'Draft the focus-session API spec',
		estimate: 3,
		actuals: 0,
		done: false,
		archived: false,
		isPrimaryToday: true
	},
	{
		id: 't2',
		title: 'Refactor the timer state controller',
		estimate: 5,
		actuals: 2,
		done: false,
		archived: false,
		isPrimaryToday: false
	},
	{
		id: 't3',
		title: 'Write ADR 0001 review notes',
		estimate: 4,
		actuals: 4,
		done: true,
		archived: false,
		isPrimaryToday: false
	},
	{
		id: 't4',
		title: 'Investigate long-break length (#11)',
		estimate: 2,
		actuals: 1,
		done: false,
		archived: true,
		isPrimaryToday: false
	},
	{
		id: 't5',
		title: 'Triage the issue inbox',
		estimate: 1,
		actuals: 0,
		done: false,
		archived: false,
		isPrimaryToday: false
	},
	{
		id: 't6',
		title: 'Ship the v1 slice',
		estimate: 5,
		actuals: 6,
		done: false,
		archived: false,
		isPrimaryToday: false
	}
];

// Static, mock per-scene timer cosmetics. The prototype checks palette/typography,
// not a live timer, so countdowns are fixed strings and ringPct is a cosmetic fill
// (0..100). Long break is 20:00 per ticket #11 (layout prototype froze it at 15:00).
export const sceneMeta: Record<TimerScene, { countdown: string; ringPct: number; label: string }> =
	{
		idle: { countdown: '—:—', ringPct: 0, label: 'Idle' },
		'focus-running': { countdown: '18:42', ringPct: 25, label: 'Focus' },
		transitioning: { countdown: '0:00', ringPct: 100, label: 'Transition' },
		'break-running': { countdown: '5:00', ringPct: 12, label: 'Short break' },
		'long-break-running': { countdown: '20:00', ringPct: 6, label: 'Long break' }
	};

// The task the timer is "against" in focus-running: the first primary-today,
// non-archived task, falling back to the first non-archived task.
export function primaryTask(tasks: Task[]): Task | undefined {
	return tasks.find((t) => !t.archived && t.isPrimaryToday) ?? tasks.find((t) => !t.archived);
}

// Estimate/actuals pip string: `filled` repeated actuals times (capped at estimate),
// then `empty` for the remaining estimate. e.g. pips(2,5,'●','○') -> "●●○○○".
export function pips(actuals: number, estimate: number, filled = '🟡', empty = '⚪'): string {
	const f = Math.min(actuals, estimate);
	return filled.repeat(f) + empty.repeat(Math.max(0, estimate - f));
}

// Format the transitioning prompt's 30s auto-confirm countdown as 0:SS.
export function fmtAutoConfirm(seconds: number): string {
	return `0:${String(Math.max(0, seconds)).padStart(2, '0')}`;
}
