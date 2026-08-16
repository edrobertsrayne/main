import { count, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { tasks, focusSessions } from './schema';
import { listPrimaryTaskIdsForDay } from './daily-primary-tasks';

export type Database = BetterSQLite3Database<typeof schema>;

export type TaskRow = schema.Task;

export type TaskWithActuals = TaskRow & {
	actuals: number;
	/**
	 * Whether this task is marked as one of today's primary tasks. Only
	 * populated when `listTasksWithActuals` is called with a `day` string;
	 * without a day, all rows report `false` (no day, no primary scoping).
	 */
	isPrimaryToday: boolean;
};

export function addTask(db: Database, input: { title: string; estimate: number }): TaskRow {
	const now = Date.now();
	const [row] = db
		.insert(tasks)
		.values({
			title: input.title,
			estimate: input.estimate,
			done: false,
			archived: false,
			archivedAt: null,
			createdAt: now
		})
		.returning()
		.all();
	return row;
}

/**
 * Read all tasks plus their derived `actuals` count. When `day` is passed,
 * each row also reports `isPrimaryToday` based on the `daily_primary_tasks`
 * table's composite `(task_id, day)` key — the UI uses this to float
 * primaries to the top of the default view and to label the "Today" filter.
 */
export function listTasksWithActuals(db: Database, day?: string): TaskWithActuals[] {
	const rows = db.select().from(tasks).all();
	const primaryIds = day ? listPrimaryTaskIdsForDay(db, day) : new Set<string>();
	return rows.map((row) => ({
		...row,
		actuals:
			db
				.select({ value: count() })
				.from(focusSessions)
				.where(eq(focusSessions.taskId, row.id))
				.get()?.value ?? 0,
		isPrimaryToday: primaryIds.has(row.id)
	}));
}

export function getTaskWithActuals(db: Database, id: string): TaskWithActuals | undefined {
	const row = db.select().from(tasks).where(eq(tasks.id, id)).get();
	if (!row) return undefined;
	const actuals =
		db.select({ value: count() }).from(focusSessions).where(eq(focusSessions.taskId, id)).get()
			?.value ?? 0;
	return { ...row, actuals, isPrimaryToday: false };
}

export function updateTaskTitle(db: Database, id: string, title: string): TaskRow | undefined {
	const [row] = db.update(tasks).set({ title }).where(eq(tasks.id, id)).returning().all();
	return row;
}

export function updateTaskEstimate(
	db: Database,
	id: string,
	estimate: number
): TaskRow | undefined {
	const [row] = db.update(tasks).set({ estimate }).where(eq(tasks.id, id)).returning().all();
	return row;
}

export function setTaskDone(db: Database, id: string, done: boolean): TaskRow | undefined {
	const [row] = db.update(tasks).set({ done }).where(eq(tasks.id, id)).returning().all();
	return row;
}

export function setTaskArchived(db: Database, id: string, archived: boolean): TaskRow | undefined {
	const [row] = db
		.update(tasks)
		.set({
			archived,
			archivedAt: archived ? Date.now() : null
		})
		.where(eq(tasks.id, id))
		.returning()
		.all();
	return row;
}
