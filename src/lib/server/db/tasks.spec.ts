import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import {
	addTask,
	getTaskWithActuals,
	listTasksWithActuals,
	setTaskArchived,
	setTaskDone,
	updateTaskEstimate,
	updateTaskTitle
} from './tasks';
import { togglePrimaryTask } from './daily-primary-tasks';
import * as schema from './schema';
import { focusSessions, tasks as tasksTable } from './schema';

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;

function boot() {
	sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');

	sqlite.exec(`
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  estimate INTEGER NOT NULL DEFAULT 1,
  done INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE focus_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  started_at INTEGER NOT NULL,
  stopped_at INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  local_day TEXT NOT NULL,
  end_cause TEXT NOT NULL
);
CREATE TABLE daily_primary_tasks (
  task_id TEXT NOT NULL REFERENCES tasks(id),
  day TEXT NOT NULL,
  PRIMARY KEY (task_id, day)
);
CREATE TABLE day_meta (
  day TEXT PRIMARY KEY,
  initialised_at INTEGER NOT NULL
);
`);
	db = drizzle(sqlite, { schema });
}

function recordFocus(taskId: string, id?: string) {
	db.insert(focusSessions)
		.values({
			id: id ?? crypto.randomUUID(),
			taskId,
			startedAt: Date.now(),
			stoppedAt: Date.now(),
			durationSeconds: 1500,
			localDay: '2026-08-15',
			endCause: 'ring'
		})
		.run();
}

beforeEach(boot);
afterEach(() => sqlite?.close());

describe('addTask', () => {
	it('persists a task with the given title and estimate, defaulting done/archived to false', () => {
		const row = addTask(db, { title: 'Write spec', estimate: 3 });
		expect(row.title).toBe('Write spec');
		expect(row.estimate).toBe(3);
		expect(row.done).toBe(false);
		expect(row.archived).toBe(false);
		expect(row.archivedAt).toBeNull();
		expect(typeof row.id).toBe('string');
		expect(row.id.length).toBeGreaterThan(0);
		expect(typeof row.createdAt).toBe('number');
	});

	it('returns a row present in the database', () => {
		const row = addTask(db, { title: 'X', estimate: 1 });
		const stored = db.select().from(tasksTable).where(eq(tasksTable.id, row.id)).get();
		expect(stored).toBeDefined();
		expect(stored?.title).toBe('X');
	});
});

describe('listTasksWithActuals', () => {
	it('returns an empty list when there are no tasks', () => {
		expect(listTasksWithActuals(db)).toEqual([]);
	});

	it('reports actuals=0 when no focus sessions have been recorded', () => {
		const task = addTask(db, { title: 'T', estimate: 5 });
		const list = listTasksWithActuals(db);
		expect(list).toHaveLength(1);
		expect(list[0]?.id).toBe(task.id);
		expect(list[0]?.actuals).toBe(0);
	});

	it('counts focus sessions per task as actuals', () => {
		const a = addTask(db, { title: 'A', estimate: 5 });
		const b = addTask(db, { title: 'B', estimate: 3 });
		recordFocus(a.id, 'fs-1');
		recordFocus(a.id, 'fs-2');
		recordFocus(b.id, 'fs-3');
		recordFocus(b.id, 'fs-4');
		recordFocus(b.id, 'fs-5');

		const list = listTasksWithActuals(db);
		const aRow = list.find((r) => r.id === a.id);
		const bRow = list.find((r) => r.id === b.id);
		expect(aRow?.actuals).toBe(2);
		expect(bRow?.actuals).toBe(3);
	});
});

describe('getTaskWithActuals', () => {
	it('returns undefined for an unknown id', () => {
		expect(getTaskWithActuals(db, 'nope')).toBeUndefined();
	});

	it('returns the task with its derived actuals', () => {
		const task = addTask(db, { title: 'T', estimate: 4 });
		recordFocus(task.id);
		const row = getTaskWithActuals(db, task.id);
		expect(row?.title).toBe('T');
		expect(row?.estimate).toBe(4);
		expect(row?.actuals).toBe(1);
	});
});

describe('updateTaskTitle', () => {
	it('updates the title and leaves other fields unchanged', () => {
		const task = addTask(db, { title: 'Old', estimate: 2 });
		const updated = updateTaskTitle(db, task.id, 'New');
		expect(updated?.title).toBe('New');
		expect(updated?.estimate).toBe(2);
	});

	it('returns undefined for an unknown id', () => {
		expect(updateTaskTitle(db, 'nope', 'X')).toBeUndefined();
	});

	it('persists across reloads', () => {
		const task = addTask(db, { title: 'Old', estimate: 2 });
		updateTaskTitle(db, task.id, 'New');
		const refetched = getTaskWithActuals(db, task.id);
		expect(refetched?.title).toBe('New');
	});
});

describe('updateTaskEstimate', () => {
	it('updates the estimate', () => {
		const task = addTask(db, { title: 'T', estimate: 1 });
		const updated = updateTaskEstimate(db, task.id, 7);
		expect(updated?.estimate).toBe(7);
		expect(updated?.title).toBe('T');
	});

	it('returns undefined for an unknown id', () => {
		expect(updateTaskEstimate(db, 'nope', 5)).toBeUndefined();
	});
});

describe('setTaskDone', () => {
	it('marks a task done and unmarks it again', () => {
		const task = addTask(db, { title: 'T', estimate: 1 });
		expect(setTaskDone(db, task.id, true)?.done).toBe(true);
		expect(setTaskDone(db, task.id, false)?.done).toBe(false);
	});

	it('does not touch the archived flag', () => {
		const task = addTask(db, { title: 'T', estimate: 1 });
		setTaskArchived(db, task.id, true);
		setTaskDone(db, task.id, true);
		const row = getTaskWithActuals(db, task.id);
		expect(row?.done).toBe(true);
		expect(row?.archived).toBe(true);
	});

	it('returns undefined for an unknown id', () => {
		expect(setTaskDone(db, 'nope', true)).toBeUndefined();
	});
});

describe('setTaskArchived', () => {
	it('archives a task and stamps archived_at', () => {
		const before = Date.now();
		const task = addTask(db, { title: 'T', estimate: 1 });
		const archived = setTaskArchived(db, task.id, true);
		expect(archived?.archived).toBe(true);
		expect(archived?.archivedAt).not.toBeNull();
		expect((archived?.archivedAt ?? 0) >= before).toBe(true);
	});

	it('unarchives and clears archived_at', () => {
		const task = addTask(db, { title: 'T', estimate: 1 });
		setTaskArchived(db, task.id, true);
		const unarchived = setTaskArchived(db, task.id, false);
		expect(unarchived?.archived).toBe(false);
		expect(unarchived?.archivedAt).toBeNull();
	});

	it('never deletes the row', () => {
		const task = addTask(db, { title: 'T', estimate: 1 });
		setTaskArchived(db, task.id, true);
		const row = db.select().from(tasksTable).where(eq(tasksTable.id, task.id)).get();
		expect(row).toBeDefined();
		expect(row?.title).toBe('T');
	});

	it('does not touch the done flag', () => {
		const task = addTask(db, { title: 'T', estimate: 1 });
		setTaskDone(db, task.id, true);
		setTaskArchived(db, task.id, true);
		const row = getTaskWithActuals(db, task.id);
		expect(row?.archived).toBe(true);
		expect(row?.done).toBe(true);
	});

	it('returns undefined for an unknown id', () => {
		expect(setTaskArchived(db, 'nope', true)).toBeUndefined();
	});
});

describe('listTasksWithActuals with day scoping (primary tasks)', () => {
	it('returns isPrimaryToday=false for all tasks when no day is passed', () => {
		const a = addTask(db, { title: 'A', estimate: 1 });
		const list = listTasksWithActuals(db);
		expect(list).toHaveLength(1);
		expect(list[0]?.isPrimaryToday).toBe(false);
		expect(a.id).toBeDefined();
	});

	it('returns isPrimaryToday=true for tasks marked primary on the given day', () => {
		const a = addTask(db, { title: 'A', estimate: 1 });
		const b = addTask(db, { title: 'B', estimate: 1 });
		togglePrimaryTask(db, { taskId: a.id, day: '2026-08-15', isPrimary: true });
		const list = listTasksWithActuals(db, '2026-08-15');
		const aRow = list.find((r) => r.id === a.id);
		const bRow = list.find((r) => r.id === b.id);
		expect(aRow?.isPrimaryToday).toBe(true);
		expect(bRow?.isPrimaryToday).toBe(false);
	});

	it('scopes by day: a task marked primary on Mon is not primary on Tue', () => {
		const a = addTask(db, { title: 'A', estimate: 1 });
		togglePrimaryTask(db, { taskId: a.id, day: '2026-08-15', isPrimary: true });
		const mon = listTasksWithActuals(db, '2026-08-15');
		const tue = listTasksWithActuals(db, '2026-08-16');
		expect(mon[0]?.isPrimaryToday).toBe(true);
		expect(tue[0]?.isPrimaryToday).toBe(false);
	});
});
