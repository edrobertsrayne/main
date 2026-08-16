import { describe, expect, it } from 'vitest';
import { compareTasksForDefaultView, shouldShowSoftNudge } from './sort';

type T = { id: string; createdAt: number; isPrimaryToday: boolean };

// Helper for tests: the rows are returned by the data layer with
// `isPrimaryToday` already set per-task per-day. The comparator is pure
// over the rows it sees — it does not consult the database.
function row(id: string, createdAt: number, isPrimaryToday: boolean): T {
	return { id, createdAt, isPrimaryToday };
}

describe('compareTasksForDefaultView', () => {
	it('puts primaries before non-primaries', () => {
		const a = row('a', 100, false);
		const b = row('b', 50, true);
		expect([a, b].sort(compareTasksForDefaultView)).toEqual([b, a]);
		expect([b, a].sort(compareTasksForDefaultView)).toEqual([b, a]);
	});

	it('ranks primaries by createdAt ASC (older first) within the floated group', () => {
		const older = row('older', 100, true);
		const newer = row('newer', 200, true);
		expect([newer, older].sort(compareTasksForDefaultView)).toEqual([older, newer]);
	});

	it('ranks non-primaries by createdAt ASC within the non-floated group', () => {
		const older = row('older', 100, false);
		const newer = row('newer', 200, false);
		expect([newer, older].sort(compareTasksForDefaultView)).toEqual([older, newer]);
	});

	it('returns 0 for two rows with identical primary flag and createdAt (stable identity fallback)', () => {
		const a = row('a', 100, true);
		const b = row('b', 100, true);
		expect(compareTasksForDefaultView(a, b)).toBe(0);
	});

	it('floats all primaries above all non-primaries regardless of createdAt', () => {
		// A very old non-primary and a very new primary: primary still wins.
		const ancientNonPrimary = row('ancient', 1, false);
		const brandNewPrimary = row('fresh', 999_999, true);
		expect([ancientNonPrimary, brandNewPrimary].sort(compareTasksForDefaultView)).toEqual([
			brandNewPrimary,
			ancientNonPrimary
		]);
	});

	it('handles the soft-nudge boundary: 6 primaries still sort cleanly by createdAt', () => {
		// Past the SOFT_NUDGE_THRESHOLD boundary the sort must still rank
		// primaries by createdAt (the UI shows a warm nudge but never
		// reorders the list — the comparator is doing its job, the nudger
		// is a separate concern).
		const primaries = [
			row('p6', 600, true),
			row('p1', 100, true),
			row('p4', 400, true),
			row('p2', 200, true),
			row('p5', 500, true),
			row('p3', 300, true)
		];
		const sorted = primaries.sort(compareTasksForDefaultView);
		expect(sorted.map((r) => r.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
	});

	it('keeps primaries grouped above non-primaries even when there are many of each', () => {
		const primaries = [
			row('p-late', 300, true),
			row('p-early', 100, true),
			row('p-mid', 200, true)
		];
		const nonPrimaries = [
			row('np-late', 600, false),
			row('np-early', 150, false),
			row('np-mid', 400, false)
		];
		const mixed = [...nonPrimaries, ...primaries].sort(compareTasksForDefaultView);
		expect(mixed.map((r) => r.id)).toEqual([
			'p-early',
			'p-mid',
			'p-late',
			'np-early',
			'np-mid',
			'np-late'
		]);
	});
});

describe('shouldShowSoftNudge', () => {
	it('is false at 0, 1, 2, 3, 4, 5 primaries', () => {
		for (let n = 0; n <= 5; n++) {
			expect(shouldShowSoftNudge(n)).toBe(false);
		}
	});

	it('is true at 6, 7, 8, ... (past the threshold)', () => {
		for (const n of [6, 7, 10, 50, 1000]) {
			expect(shouldShowSoftNudge(n)).toBe(true);
		}
	});

	it('the threshold is > 5, not >= 5 — exactly 5 is the visible-but-not-nudged cap', () => {
		expect(shouldShowSoftNudge(5)).toBe(false);
		expect(shouldShowSoftNudge(6)).toBe(true);
	});
});
