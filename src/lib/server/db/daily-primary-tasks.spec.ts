import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import { dailyPrimaryTasks, tasks as tasksTable } from './schema';
import {
	countPrimaryTasksForDay,
	listPrimaryTaskIdsForDay,
	togglePrimaryTask
} from './daily-primary-tasks';

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

function seedTask(id: string) {
	db.insert(tasksTable)
		.values({
			id,
			title: id,
			estimate: 1,
			done: false,
			archived: false,
			archivedAt: null,
			createdAt: Date.now()
		})
		.run();
}

beforeEach(boot);
afterEach(() => sqlite?.close());

describe('togglePrimaryTask', () => {
	it('inserts a primary task row when toggling on', () => {
		seedTask('a');
		togglePrimaryTask(db, { taskId: 'a', day: '2026-08-15', isPrimary: true });
		const rows = db.select().from(dailyPrimaryTasks).where(eq(dailyPrimaryTasks.taskId, 'a')).all();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.day).toBe('2026-08-15');
	});

	it('removes a primary task row when toggling off', () => {
		seedTask('a');
		togglePrimaryTask(db, { taskId: 'a', day: '2026-08-15', isPrimary: true });
		togglePrimaryTask(db, { taskId: 'a', day: '2026-08-15', isPrimary: false });
		const rows = db.select().from(dailyPrimaryTasks).where(eq(dailyPrimaryTasks.taskId, 'a')).all();
		expect(rows).toEqual([]);
	});

	it('is idempotent: toggling on twice does not create a duplicate row', () => {
		seedTask('a');
		togglePrimaryTask(db, { taskId: 'a', day: '2026-08-15', isPrimary: true });
		togglePrimaryTask(db, { taskId: 'a', day: '2026-08-15', isPrimary: true });
		const rows = db.select().from(dailyPrimaryTasks).where(eq(dailyPrimaryTasks.taskId, 'a')).all();
		expect(rows).toHaveLength(1);
	});

	it('is idempotent: toggling off when not primary is a no-op', () => {
		seedTask('a');
		togglePrimaryTask(db, { taskId: 'a', day: '2026-08-15', isPrimary: false });
		const rows = db.select().from(dailyPrimaryTasks).where(eq(dailyPrimaryTasks.taskId, 'a')).all();
		expect(rows).toEqual([]);
	});

	it('scopes by day: the same task can be primary on Mon and not on Tue', () => {
		seedTask('a');
		togglePrimaryTask(db, { taskId: 'a', day: '2026-08-15', isPrimary: true });
		expect(listPrimaryTaskIdsForDay(db, '2026-08-15')).toEqual(new Set(['a']));
		expect(listPrimaryTaskIdsForDay(db, '2026-08-16')).toEqual(new Set());
	});

	it('different tasks are independent on the same day', () => {
		seedTask('a');
		seedTask('b');
		togglePrimaryTask(db, { taskId: 'a', day: '2026-08-15', isPrimary: true });
		expect(listPrimaryTaskIdsForDay(db, '2026-08-15')).toEqual(new Set(['a']));
		togglePrimaryTask(db, { taskId: 'b', day: '2026-08-15', isPrimary: true });
		expect(listPrimaryTaskIdsForDay(db, '2026-08-15')).toEqual(new Set(['a', 'b']));
	});
});

describe('listPrimaryTaskIdsForDay', () => {
	it('returns an empty set for a day with no primaries', () => {
		expect(listPrimaryTaskIdsForDay(db, '2026-08-15')).toEqual(new Set());
	});

	it('returns the set of all task ids marked primary on the given day', () => {
		seedTask('a');
		seedTask('b');
		seedTask('c');
		togglePrimaryTask(db, { taskId: 'a', day: '2026-08-15', isPrimary: true });
		togglePrimaryTask(db, { taskId: 'b', day: '2026-08-15', isPrimary: true });
		togglePrimaryTask(db, { taskId: 'c', day: '2026-08-16', isPrimary: true });
		const mon = listPrimaryTaskIdsForDay(db, '2026-08-15');
		const tue = listPrimaryTaskIdsForDay(db, '2026-08-16');
		expect(mon).toEqual(new Set(['a', 'b']));
		expect(tue).toEqual(new Set(['c']));
	});
});

describe('countPrimaryTasksForDay', () => {
	it('returns 0 for an empty day', () => {
		expect(countPrimaryTasksForDay(db, '2026-08-15')).toBe(0);
	});

	it('counts distinct task ids per day', () => {
		seedTask('a');
		seedTask('b');
		seedTask('c');
		togglePrimaryTask(db, { taskId: 'a', day: '2026-08-15', isPrimary: true });
		togglePrimaryTask(db, { taskId: 'b', day: '2026-08-15', isPrimary: true });
		togglePrimaryTask(db, { taskId: 'c', day: '2026-08-15', isPrimary: true });
		expect(countPrimaryTasksForDay(db, '2026-08-15')).toBe(3);
	});

	it('is scoped to the day: another day does not contribute', () => {
		seedTask('a');
		seedTask('b');
		togglePrimaryTask(db, { taskId: 'a', day: '2026-08-15', isPrimary: true });
		togglePrimaryTask(db, { taskId: 'b', day: '2026-08-16', isPrimary: true });
		expect(countPrimaryTasksForDay(db, '2026-08-15')).toBe(1);
		expect(countPrimaryTasksForDay(db, '2026-08-16')).toBe(1);
	});
});
