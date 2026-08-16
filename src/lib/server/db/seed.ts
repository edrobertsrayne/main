import { eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { dailyPrimaryTasks, dayMeta, tasks } from './schema';
import { listPrimaryTaskIdsForDay } from './daily-primary-tasks';

export type Database = BetterSQLite3Database<typeof schema>;

export type SeedCandidate = {
	id: string;
	title: string;
	done: boolean;
	archived: boolean;
};

/**
 * Pure: which task ids from yesterday's primary set should carry over to
 * today's primaries? The boundary is "not done, not archived" — done
 * primaries cleared their commitment, archived primaries were shelved.
 * Either way, they're not "unfinished day-plan work" and should drop off.
 *
 * The contract is one-directional: this filter answers the carry question
 * only. Yesterday's primaries themselves stay in `daily_primary_tasks`
 * (history preserved per the spec).
 */
export function computeCarryUnfinishedSet(candidates: SeedCandidate[]): string[] {
	return candidates.filter((t) => !t.done && !t.archived).map((t) => t.id);
}

/**
 * Has `day_meta` already recorded a seed for this day? The day_meta row
 * is the once-per-day latch: its existence is the proof that this day's
 * seed has run (whether it was a no-op or it inserted primaries).
 */
export function isDaySeeded(db: Database, day: string): boolean {
	const row = db.select().from(dayMeta).where(eq(dayMeta.day, day)).get();
	return row !== undefined;
}

export type SeedDayResult = {
	seeded: boolean;
	/**
	 * The task ids that were inserted as today's primaries on this run.
	 * Empty when the day was already seeded (the no-op path).
	 */
	carriedFromYesterday: string[];
};

export type SeedDayInput = {
	today: string;
	/**
	 * The previous day, if any. When omitted (e.g. the very first load
	 * with no prior history), the seed runs but inserts no carry-over
	 * primaries — the day_meta latch is still recorded.
	 */
	yesterday?: string;
};

/**
 * The day-boundary seed for `today`. Runs iff no `day_meta` row exists
 * for `today`; carries over yesterday's not-done, not-archived primaries
 * (if `yesterday` is provided) and inserts the `day_meta` row in the
 * same transaction. The atomicity is what makes the seed idempotent
 * across reloads and tabs: a partial failure cannot leave a half-seeded
 * day open to a re-seed.
 *
 * Idempotency model: the day_meta row is the once-per-day latch. Once
 * it exists for `today`, every subsequent seed call for the same day is
 * a no-op regardless of what happened in the meantime. This is the only
 * guard — there is no cross-tab lease or localStorage check.
 */
export function seedDay(db: Database, input: SeedDayInput): SeedDayResult {
	if (isDaySeeded(db, input.today)) {
		return { seeded: false, carriedFromYesterday: [] };
	}

	let carryIds: string[] = [];
	if (input.yesterday) {
		const yesterdayPrimaryIds = listPrimaryTaskIdsForDay(db, input.yesterday);
		if (yesterdayPrimaryIds.size > 0) {
			const candidates = db
				.select({
					id: tasks.id,
					title: tasks.title,
					done: tasks.done,
					archived: tasks.archived
				})
				.from(tasks)
				.where(inArray(tasks.id, Array.from(yesterdayPrimaryIds)))
				.all();
			carryIds = computeCarryUnfinishedSet(candidates);
		}
	}

	// One transaction: insert carry-over primaries AND the day_meta row.
	// Either both rows land or neither does — a partial failure cannot
	// leave the day half-seeded (and thus re-seedable on the next
	// attempt, which would duplicate the carry primaries).
	db.transaction((tx) => {
		for (const taskId of carryIds) {
			tx.insert(dailyPrimaryTasks).values({ taskId, day: input.today }).onConflictDoNothing().run();
		}
		tx.insert(dayMeta).values({ day: input.today }).run();
	});

	return { seeded: true, carriedFromYesterday: carryIds };
}
