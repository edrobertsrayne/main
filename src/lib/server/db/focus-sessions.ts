import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { focusSessions } from './schema';
import { localDay } from '$lib/local-day';
import { defaultTimeZone } from '$lib/local-day';
import type { EndCause } from '$lib/timer/types';

export type { EndCause };
export type Database = BetterSQLite3Database<typeof schema>;

export type RecordFocusSessionInput = {
	taskId: string;
	startedAt: number;
	stoppedAt: number;
	durationSeconds: number;
	endCause: EndCause;
	/**
	 * Override the timezone used to derive `localDay` from `startedAt`. Defaults to
	 * the host timezone. Production callers should pass the user's browser tz
	 * explicitly so day attribution tracks the user, not the server clock.
	 */
	timeZone?: string;
};

export type FocusSessionRow = schema.FocusSession;

/**
 * Insert a `focus_session` row. `local_day` is derived from `startedAt`
 * (never from `now()` and never re-derived at read time) so a focus started at
 * 11:30pm Monday and stopped after midnight is attributed to Monday.
 */
export function recordFocusSession(db: Database, input: RecordFocusSessionInput): FocusSessionRow {
	const [row] = db
		.insert(focusSessions)
		.values({
			taskId: input.taskId,
			startedAt: input.startedAt,
			stoppedAt: input.stoppedAt,
			durationSeconds: input.durationSeconds,
			localDay: localDay(input.startedAt, input.timeZone ?? defaultTimeZone()),
			endCause: input.endCause
		})
		.returning()
		.all();
	return row;
}

export function listFocusSessionsForTask(db: Database, taskId: string): FocusSessionRow[] {
	return db.select().from(focusSessions).where(eq(focusSessions.taskId, taskId)).all();
}
