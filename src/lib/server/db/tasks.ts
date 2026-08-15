import { count, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { tasks, focusSessions } from './schema';

export type Database = BetterSQLite3Database<typeof schema>;

export type TaskRow = schema.Task;

export type TaskWithActuals = TaskRow & {
	actuals: number;
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

export function listTasksWithActuals(db: Database): TaskWithActuals[] {
	const rows = db.select().from(tasks).all();
	return rows.map((row) => ({
		...row,
		actuals:
			db
				.select({ value: count() })
				.from(focusSessions)
				.where(eq(focusSessions.taskId, row.id))
				.get()?.value ?? 0
	}));
}

export function getTaskWithActuals(db: Database, id: string): TaskWithActuals | undefined {
	const row = db.select().from(tasks).where(eq(tasks.id, id)).get();
	if (!row) return undefined;
	const actuals =
		db.select({ value: count() }).from(focusSessions).where(eq(focusSessions.taskId, id)).get()
			?.value ?? 0;
	return { ...row, actuals };
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
