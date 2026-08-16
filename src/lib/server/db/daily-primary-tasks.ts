import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { dailyPrimaryTasks } from './schema';

export type Database = BetterSQLite3Database<typeof schema>;

/**
 * Mark a task as (or not) one of today's primary tasks. The composite PK
 * on `(task_id, day)` makes this idempotent: toggling on twice does not
 * create a second row, and toggling off when not primary is a no-op.
 *
 * Toggling on is an INSERT; toggling off is a DELETE. The transaction
 * boundary is the row itself — both are atomic on a single statement.
 */
export function togglePrimaryTask(
	db: Database,
	input: { taskId: string; day: string; isPrimary: boolean }
): void {
	if (input.isPrimary) {
		db.insert(dailyPrimaryTasks)
			.values({ taskId: input.taskId, day: input.day })
			.onConflictDoNothing()
			.run();
	} else {
		db.delete(dailyPrimaryTasks)
			.where(and(eq(dailyPrimaryTasks.taskId, input.taskId), eq(dailyPrimaryTasks.day, input.day)))
			.run();
	}
}

/**
 * The set of task ids marked primary for the given day. Used by the data
 * layer to compute `isPrimaryToday` per task and to count today's
 * primaries for the "Today" filter counter.
 */
export function listPrimaryTaskIdsForDay(db: Database, day: string): Set<string> {
	const rows = db
		.select({ taskId: dailyPrimaryTasks.taskId })
		.from(dailyPrimaryTasks)
		.where(eq(dailyPrimaryTasks.day, day))
		.all();
	return new Set(rows.map((r) => r.taskId));
}

/**
 * Count of primaries for the given day. Drives the "(n)" counter on the
 * "Today" filter tab and the soft-nudge threshold (>5).
 */
export function countPrimaryTasksForDay(db: Database, day: string): number {
	return listPrimaryTaskIdsForDay(db, day).size;
}
