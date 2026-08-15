import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import { focusSessions, tasks as tasksTable } from './schema';
import { recordFocusSession, listFocusSessionsForTask } from './focus-sessions';

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

function seedTask(title = 'Test task'): string {
	const id = `task-${Math.random().toString(36).slice(2, 10)}`;
	db.insert(tasksTable)
		.values({
			id,
			title,
			estimate: 3,
			done: false,
			archived: false,
			archivedAt: null,
			createdAt: Date.now()
		})
		.run();
	return id;
}

beforeEach(boot);
afterEach(() => sqlite?.close());

describe('recordFocusSession', () => {
	it('persists a ring focus with all fields', () => {
		const taskId = seedTask();
		const startedAt = Date.UTC(2026, 7, 15, 12, 0, 0);
		const stoppedAt = startedAt + 25 * 60 * 1000;

		const row = recordFocusSession(db, {
			taskId,
			startedAt,
			stoppedAt,
			durationSeconds: 1500,
			endCause: 'ring',
			timeZone: 'UTC'
		});

		expect(row.taskId).toBe(taskId);
		expect(row.startedAt).toBe(startedAt);
		expect(row.stoppedAt).toBe(stoppedAt);
		expect(row.durationSeconds).toBe(1500);
		expect(row.endCause).toBe('ring');
	});

	it('derives local_day from started_at, not from now() or stoppedAt', () => {
		const taskId = seedTask();
		// Started on Monday at 23:30 local; stopped well after midnight UTC.
		// With America/New_York tz: started_at corresponds to local Mon 19:30 EDT
		// on Aug 17 (Mon). Stored local_day must be Mon, not Tue.
		const startedAt = Date.UTC(2026, 7, 17, 23, 30, 0);
		const stoppedAt = Date.UTC(2026, 7, 18, 0, 45, 0);

		const row = recordFocusSession(db, {
			taskId,
			startedAt,
			stoppedAt,
			durationSeconds: 75 * 60,
			endCause: 'stop',
			timeZone: 'America/New_York'
		});

		expect(row.localDay).toBe('2026-08-17');
	});

	it('uses the passed timezone instead of the host clock', () => {
		const taskId = seedTask();
		// Same instant, two different timezone reports -> different days.
		const startedAt = Date.UTC(2026, 7, 17, 1, 0, 0); // 21:00 EDT on Aug 16

		const ny = recordFocusSession(db, {
			taskId,
			startedAt,
			stoppedAt: startedAt + 1500_000,
			durationSeconds: 1500,
			endCause: 'ring',
			timeZone: 'America/New_York'
		});
		const utc = recordFocusSession(db, {
			taskId,
			startedAt,
			stoppedAt: startedAt + 1500_000,
			durationSeconds: 1500,
			endCause: 'ring',
			timeZone: 'UTC'
		});

		expect(ny.localDay).toBe('2026-08-16');
		expect(utc.localDay).toBe('2026-08-17');
	});

	it('always writes a row, including on stop (one actual per focus attempt)', () => {
		const taskId = seedTask();
		recordFocusSession(db, {
			taskId,
			startedAt: Date.UTC(2026, 7, 15, 12, 0, 0),
			stoppedAt: Date.UTC(2026, 7, 15, 12, 7, 30),
			durationSeconds: 450,
			endCause: 'stop',
			timeZone: 'UTC'
		});

		const all = listFocusSessionsForTask(db, taskId);
		expect(all).toHaveLength(1);
		expect(all[0]?.endCause).toBe('stop');
	});

	it('round-trips the row through SQLite', () => {
		const taskId = seedTask();
		const startedAt = Date.UTC(2026, 7, 15, 12, 0, 0);
		recordFocusSession(db, {
			taskId,
			startedAt,
			stoppedAt: startedAt + 1500_000,
			durationSeconds: 1500,
			endCause: 'ring',
			timeZone: 'UTC'
		});

		const stored = db.select().from(focusSessions).where(eq(focusSessions.taskId, taskId)).get();
		expect(stored).toBeDefined();
		expect(stored?.localDay).toBe('2026-08-15');
		expect(stored?.endCause).toBe('ring');
	});
});

describe('listFocusSessionsForTask', () => {
	it('returns an empty array for a task with no sessions', () => {
		const taskId = seedTask();
		expect(listFocusSessionsForTask(db, taskId)).toEqual([]);
	});

	it('returns multiple sessions for one task', () => {
		const taskId = seedTask();
		for (const cause of ['ring', 'stop', 'ring'] as const) {
			recordFocusSession(db, {
				taskId,
				startedAt: Date.UTC(2026, 7, 15, 12, 0, 0),
				stoppedAt: Date.UTC(2026, 7, 15, 12, 25, 0),
				durationSeconds: 1500,
				endCause: cause,
				timeZone: 'UTC'
			});
		}
		expect(listFocusSessionsForTask(db, taskId)).toHaveLength(3);
	});
});
