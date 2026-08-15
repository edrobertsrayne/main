import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';

export const tasks = sqliteTable('tasks', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	estimate: integer('estimate').notNull().default(1),
	done: integer('done', { mode: 'boolean' }).notNull().default(false),
	archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
	archivedAt: integer('archived_at'),
	createdAt: integer('created_at')
		.notNull()
		.$defaultFn(() => Date.now())
});

export const focusSessions = sqliteTable('focus_sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	taskId: text('task_id')
		.notNull()
		.references(() => tasks.id),
	startedAt: integer('started_at').notNull(),
	stoppedAt: integer('stopped_at').notNull(),
	durationSeconds: integer('duration_seconds').notNull(),
	localDay: text('local_day').notNull(),
	endCause: text('end_cause', { enum: ['ring', 'stop'] }).notNull()
});

export const dailyPrimaryTasks = sqliteTable(
	'daily_primary_tasks',
	{
		taskId: text('task_id')
			.notNull()
			.references(() => tasks.id),
		day: text('day').notNull()
	},
	(table) => [primaryKey({ columns: [table.taskId, table.day] })]
);

export const dayMeta = sqliteTable('day_meta', {
	day: text('day').primaryKey(),
	initialisedAt: integer('initialised_at')
		.notNull()
		.$defaultFn(() => Date.now())
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type FocusSession = typeof focusSessions.$inferSelect;
export type NewFocusSession = typeof focusSessions.$inferInsert;
