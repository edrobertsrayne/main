// Prototype trans demo data + helpers. THROWAWAY — do not fold into main.
// Local copy of ../flash/demo.svelte.ts (self-contained route — do NOT import
// across). Used by the /prototype/trans route to evaluate the transitioning
// prompt micro-UX (issue #16) on top of the LOCKED coral composition (#14,
// boldened by #15) and #15's held palette swap (Variant C, pinned here). Every
// field name below matches the domain glossary (CONTEXT.md) exactly; timer
// scene states match ADR 0001.

export type Task = {
	id: string;
	title: string;
	estimate: number;
	actuals: number;
	done: boolean;
	archived: boolean;
	isPrimaryToday: boolean;
};

// The timer's FSM states, per ADR 0001 (timer state machine). The `transitioning`
// state is what this prototype is about — every focus→break route enters it and
// shows a 30s auto-confirm prompt.
export type TimerScene =
	'idle' | 'focus-running' | 'transitioning' | 'break-running' | 'long-break-running';

// The active palette the page is holding, per #15's locked held-palette swap.
// `focus` = coral (the locked palette from #14, boldened by #15); `break` =
// sage complement. The swap fires on the same edges #6 fires its notification:
//   focus-running → transitioning           → phase = 'break' (sage shows DURING the prompt)
//   break-running | long-break-running → idle → phase = 'focus' (back to coral)
//   transitioning → idle (skip)              → phase = 'focus' (skip = return to coral)
// So the prompt widget renders on the SAGE break palette — a real design constraint.
export type Phase = 'focus' | 'break';

// Which break the transitioning prompt is offering — short (5 min, every
// focus-end) or long (20 min, only after 4 consecutive *ring* focuses per #12).
// The prompt copy, the upcoming-break duration preview, and (in variant B) the
// countdown-ring's inner label all derive from this.
export type BreakType = 'short' | 'long';

// The four structurally-distinct prompt micro-UX variants the trans prototype
// evaluates, switched via ?prompt=A|B|C|D (default A). They differ on THREE open
// axes from #16 — countdown shape, control layout/affordance, prompt position:
//   A — centered overlay card over the ring + a depleting linear progress bar
//   B — the 30s countdown IS the hero ring (conic gradient depletes); strip below
//   C — static 0:00 ring stays + an action strip below with a big number readout
//   D — full-hero soft-wash takeover, stacked centered prompt + number + arc
// Copy register is held complementary to structure (faithful to ADR 0001's
// "Take a 5-minute break?" / "Take a 20-minute long break?" wording family).
export type PromptVariant = 'A' | 'B' | 'C' | 'D';

// Six realistic pomodoro work items (verbatim from the flash/layout prototypes).
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

// Static, mock per-scene timer cosmetics. The prototype checks the prompt
// micro-UX, not a live focus timer, so countdowns are fixed strings and
// ringPct is a cosmetic fill (0..100). The transitioning state shows 0:00 /
// ringPct 100 (focus just rang). break-running = 5:00 (#11's short break);
// long-break-running = 20:00 (#11's long break — ADR's canonical default).
export const sceneMeta: Record<TimerScene, { countdown: string; ringPct: number; label: string }> =
	{
		idle: { countdown: '—:—', ringPct: 0, label: 'Idle' },
		'focus-running': { countdown: '18:42', ringPct: 25, label: 'Focus' },
		transitioning: { countdown: '0:00', ringPct: 100, label: 'Transition' },
		'break-running': { countdown: '5:00', ringPct: 12, label: 'Short break' },
		'long-break-running': { countdown: '20:00', ringPct: 6, label: 'Long break' }
	};

// Per-break-type metadata for the prompt: the upcoming break's duration string
// (what variant B's countdown-ring centre previews + what every variant's copy
// holds) + a short label for the eyebrow / skip-line register variants use.
export const breakMeta: Record<BreakType, { duration: string; label: string }> = {
	short: { duration: '5:00', label: 'Short break' },
	long: { duration: '20:00', label: 'Long break' }
};

// The task the timer is "against" in focus-running: the first primary-today,
// non-archived task, falling back to the first non-archived task.
export function primaryTask(tasks: Task[]): Task | undefined {
	return tasks.find((t) => !t.archived && t.isPrimaryToday) ?? tasks.find((t) => !t.archived);
}

// Estimate/actuals pip string: `filled` repeated actuals times (capped at
// estimate), then `empty` for the remaining estimate. e.g. pips(2,5,'●','○') -> "●●○○○".
export function pips(actuals: number, estimate: number, filled = '🟡', empty = '⚪'): string {
	const f = Math.min(actuals, estimate);
	return filled.repeat(f) + empty.repeat(Math.max(0, estimate - f));
}

// Format the transitioning prompt's 30s auto-confirm countdown as 0:SS.
export function fmtAutoConfirm(seconds: number): string {
	return `0:${String(Math.max(0, seconds)).padStart(2, '0')}`;
}
