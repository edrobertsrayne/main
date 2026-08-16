import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import { dailyPrimaryTasks, dayMeta, tasks as tasksTable } from './schema';
import { togglePrimaryTask } from './daily-primary-tasks';
import { computeCarryUnfinishedSet, isDaySeeded, seedDay, type SeedCandidate } from './seed';

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

function seedTask(id: string, extra: Partial<{ done: boolean; archived: boolean }> = {}) {
	db.insert(tasksTable)
		.values({
			id,
			title: id,
			estimate: 1,
			done: extra.done ?? false,
			archived: extra.archived ?? false,
			archivedAt: extra.archived ? Date.now() : null,
			createdAt: Date.now()
		})
		.run();
}

function markPrimary(taskId: string, day: string) {
	togglePrimaryTask(db, { taskId, day, isPrimary: true });
}

beforeEach(boot);
afterEach(() => sqlite?.close());

describe('computeCarryUnfinishedSet', () => {
	const cand = (id: string, done: boolean, archived: boolean): SeedCandidate => ({
		id,
		title: id,
		done,
		archived
	});

	it('excludes done tasks', () => {
		const set = computeCarryUnfinishedSet([cand('a', false, false), cand('d', true, false)]);
		expect(set).toEqual(['a']);
	});

	it('excludes archived tasks', () => {
		const set = computeCarryUnfinishedSet([cand('a', false, false), cand('r', false, true)]);
		expect(set).toEqual(['a']);
	});

	it('excludes tasks that are both done AND archived', () => {
		const set = computeCarryUnfinishedSet([cand('a', false, false), cand('x', true, true)]);
		expect(set).toEqual(['a']);
	});

	it('keeps tasks that are not-done and not-archived', () => {
		const set = computeCarryUnfinishedSet([
			cand('a', false, false),
			cand('d', true, false),
			cand('r', false, true),
			cand('b', false, false),
			cand('c', false, false)
		]);
		expect(set).toEqual(['a', 'b', 'c']);
	});

	it('returns an empty set when there are no candidates', () => {
		expect(computeCarryUnfinishedSet([])).toEqual([]);
	});

	it('returns an empty set when every candidate is done or archived', () => {
		expect(
			computeCarryUnfinishedSet([
				cand('d', true, false),
				cand('r', false, true),
				cand('x', true, true)
			])
		).toEqual([]);
	});
});

describe('isDaySeeded', () => {
	it('is false for a day with no day_meta row', () => {
		expect(isDaySeeded(db, '2026-08-15')).toBe(false);
	});

	it('is true for a day with a day_meta row', () => {
		db.insert(dayMeta).values({ day: '2026-08-15' }).run();
		expect(isDaySeeded(db, '2026-08-15')).toBe(true);
	});

	it('is scoped to the day', () => {
		db.insert(dayMeta).values({ day: '2026-08-15' }).run();
		expect(isDaySeeded(db, '2026-08-15')).toBe(true);
		expect(isDaySeeded(db, '2026-08-16')).toBe(false);
	});
});

describe('seedDay', () => {
	it('inserts the day_meta row and the carry primaries in one transaction', () => {
		seedTask('a');
		seedTask('b');
		seedTask('d', { done: true });
		seedTask('r', { archived: true });
		markPrimary('a', '2026-08-15');
		markPrimary('b', '2026-08-15');
		markPrimary('d', '2026-08-15');
		markPrimary('r', '2026-08-15');

		const result = seedDay(db, { today: '2026-08-16', yesterday: '2026-08-15' });
		expect(result.seeded).toBe(true);

		// day_meta row exists
		expect(isDaySeeded(db, '2026-08-16')).toBe(true);
		// Only not-done, not-archived tasks were carried
		const primed = db
			.select()
			.from(dailyPrimaryTasks)
			.where(eq(dailyPrimaryTasks.day, '2026-08-16'))
			.all();
		const primedIds = primed.map((r) => r.taskId).sort();
		expect(primedIds).toEqual(['a', 'b']);
	});

	it('is idempotent: a second seed for the same day is a no-op', () => {
		seedTask('a');
		markPrimary('a', '2026-08-15');

		const first = seedDay(db, { today: '2026-08-16', yesterday: '2026-08-15' });
		expect(first.seeded).toBe(true);

		// Add a new primary to yesterday — it should NOT be carried on a second
		// seed run (the day_meta latch is the once-per-day guard).
		seedTask('b');
		markPrimary('b', '2026-08-15');
		const second = seedDay(db, { today: '2026-08-16', yesterday: '2026-08-15' });
		expect(second.seeded).toBe(false);

		const primed = db
			.select()
			.from(dailyPrimaryTasks)
			.where(eq(dailyPrimaryTasks.day, '2026-08-16'))
			.all();
		expect(primed.map((r) => r.taskId).sort()).toEqual(['a']);
	});

	it('is a no-op when the day is already seeded (no primaries inserted)', () => {
		seedTask('a');
		markPrimary('a', '2026-08-15');

		// Pre-seed the day directly via the day_meta row.
		db.insert(dayMeta).values({ day: '2026-08-16' }).run();

		const result = seedDay(db, { today: '2026-08-16', yesterday: '2026-08-15' });
		expect(result.seeded).toBe(false);

		const primed = db
			.select()
			.from(dailyPrimaryTasks)
			.where(eq(dailyPrimaryTasks.day, '2026-08-16'))
			.all();
		expect(primed).toEqual([]);
	});

	it('carries zero primaries when yesterday had no primaries', () => {
		seedTask('a');
		// a is not marked primary on yesterday

		const result = seedDay(db, { today: '2026-08-16', yesterday: '2026-08-15' });
		expect(result.seeded).toBe(true);

		expect(isDaySeeded(db, '2026-08-16')).toBe(true);
		const primed = db
			.select()
			.from(dailyPrimaryTasks)
			.where(eq(dailyPrimaryTasks.day, '2026-08-16'))
			.all();
		expect(primed).toEqual([]);
	});

	it('does not crash when yesterday is not provided (no carryover)', () => {
		seedTask('a');
		markPrimary('a', '2026-08-15');

		const result = seedDay(db, { today: '2026-08-16' });
		expect(result.seeded).toBe(true);

		expect(isDaySeeded(db, '2026-08-16')).toBe(true);
		const primed = db
			.select()
			.from(dailyPrimaryTasks)
			.where(eq(dailyPrimaryTasks.day, '2026-08-16'))
			.all();
		expect(primed).toEqual([]);
	});

	it('handles done-but-not-archived primaries correctly (boundary case)', () => {
		seedTask('carry');
		seedTask('done', { done: true });
		markPrimary('carry', '2026-08-15');
		markPrimary('done', '2026-08-15');

		seedDay(db, { today: '2026-08-16', yesterday: '2026-08-15' });

		const primed = db
			.select()
			.from(dailyPrimaryTasks)
			.where(eq(dailyPrimaryTasks.day, '2026-08-16'))
			.all();
		// Done drops off — done primaries are not carried over.
		expect(primed.map((r) => r.taskId)).toEqual(['carry']);
	});

	it('handles archived-but-not-done primaries correctly (boundary case)', () => {
		seedTask('carry');
		seedTask('archived', { archived: true });
		markPrimary('carry', '2026-08-15');
		markPrimary('archived', '2026-08-15');

		seedDay(db, { today: '2026-08-16', yesterday: '2026-08-15' });

		const primed = db
			.select()
			.from(dailyPrimaryTasks)
			.where(eq(dailyPrimaryTasks.day, '2026-08-16'))
			.all();
		// Archived drops off — archived primaries are not carried over.
		expect(primed.map((r) => r.taskId)).toEqual(['carry']);
	});

	it('seeds the day-meta row even when there are no primaries to carry', () => {
		seedDay(db, { today: '2026-08-16' });
		const meta = db.select().from(dayMeta).where(eq(dayMeta.day, '2026-08-16')).get();
		expect(meta).toBeDefined();
		expect(typeof meta?.initialisedAt).toBe('number');
	});

	it('handles a day with no task table rows at all (still seeds the latch)', () => {
		const result = seedDay(db, { today: '2026-08-16' });
		expect(result.seeded).toBe(true);
		expect(isDaySeeded(db, '2026-08-16')).toBe(true);
	});

	it('does not seed with a yesterday reference that has no day_meta row of its own', () => {
		// Yesterday's primaries themselves might have been inserted by an
		// older seed run (the ones without a day_meta row are the "primaries
		// typed manually before the day-boundary feature shipped").
		seedTask('a');
		markPrimary('a', '2026-08-15');

		const result = seedDay(db, { today: '2026-08-16', yesterday: '2026-08-15' });
		expect(result.seeded).toBe(true);
		const primed = db
			.select()
			.from(dailyPrimaryTasks)
			.where(eq(dailyPrimaryTasks.day, '2026-08-16'))
			.all();
		expect(primed.map((r) => r.taskId)).toEqual(['a']);
	});
});
