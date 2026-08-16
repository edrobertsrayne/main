import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	addTask,
	listTasksWithActuals,
	setTaskArchived,
	setTaskDone,
	updateTaskEstimate,
	updateTaskTitle
} from '$lib/server/db/tasks';
import { recordFocusSession } from '$lib/server/db/focus-sessions';
import { countPrimaryTasksForDay, togglePrimaryTask } from '$lib/server/db/daily-primary-tasks';
import { seedDay } from '$lib/server/db/seed';
import { defaultTimeZone, localDay, shiftDay } from '$lib/local-day';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** @type {import('./$types').PageServerLoad} */
export function load({ url }) {
	const db = getDb();
	const today = localDay(Date.now(), defaultTimeZone());
	const day = url.searchParams.get('day');
	const safeDay = day && DAY_PATTERN.test(day) ? day : today;
	const yesterday = shiftDay(safeDay, -1);
	seedDay(db, { today: safeDay, yesterday });
	return {
		tasks: listTasksWithActuals(db, safeDay),
		primaryTaskCount: countPrimaryTasksForDay(db, safeDay),
		today: safeDay
	};
}

/** @satisfies {import('./$types').Actions} */
export const actions = {
	add: async ({ request }) => {
		const data = await request.formData();
		const title = String(data.get('title') ?? '').trim();
		const estimateRaw = data.get('estimate');

		if (!title) return fail(400, { action: 'add', message: 'Title is required' });

		const estimate = Number.parseInt(String(estimateRaw ?? '1'), 10);
		if (!Number.isFinite(estimate) || estimate < 1) {
			return fail(400, { action: 'add', message: 'Estimate must be at least 1' });
		}

		const db = getDb();
		addTask(db, { title, estimate });
		return { action: 'add' };
	},

	updateTitle: async ({ request }) => {
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		const title = String(data.get('title') ?? '').trim();
		if (!id || !title) return fail(400, { action: 'updateTitle', id });

		const db = getDb();
		updateTaskTitle(db, id, title);
		return { action: 'updateTitle', id };
	},

	updateEstimate: async ({ request }) => {
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		const estimateRaw = data.get('estimate');
		const estimate = Number.parseInt(String(estimateRaw ?? ''), 10);
		if (!id || !Number.isFinite(estimate) || estimate < 1) {
			return fail(400, { action: 'updateEstimate', id });
		}

		const db = getDb();
		updateTaskEstimate(db, id, estimate);
		return { action: 'updateEstimate', id };
	},

	toggleDone: async ({ request }) => {
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		const done = data.get('done') === 'true';
		if (!id) return fail(400, { action: 'toggleDone', id });

		const db = getDb();
		setTaskDone(db, id, done);
		return { action: 'toggleDone', id };
	},

	toggleArchive: async ({ request }) => {
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		const archived = data.get('archived') === 'true';
		if (!id) return fail(400, { action: 'toggleArchive', id });

		const db = getDb();
		setTaskArchived(db, id, archived);
		return { action: 'toggleArchive', id };
	},

	togglePrimary: async ({ request }) => {
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		const day = String(data.get('day') ?? '');
		const isPrimary = data.get('primary') === 'true';
		if (!id) return fail(400, { action: 'togglePrimary', id, message: 'id is required' });
		if (!DAY_PATTERN.test(day)) {
			return fail(400, { action: 'togglePrimary', id, message: 'day must be YYYY-MM-DD' });
		}

		const db = getDb();
		togglePrimaryTask(db, { taskId: id, day, isPrimary });
		return { action: 'togglePrimary', id };
	},

	seedDay: async ({ request }) => {
		const data = await request.formData();
		const today = String(data.get('today') ?? '');
		const yesterday = String(data.get('yesterday') ?? '');
		if (!DAY_PATTERN.test(today)) {
			return fail(400, { message: 'today must be YYYY-MM-DD' });
		}
		if (yesterday && !DAY_PATTERN.test(yesterday)) {
			return fail(400, { message: 'yesterday must be YYYY-MM-DD' });
		}

		const db = getDb();
		const result = seedDay(db, {
			today,
			yesterday: yesterday || undefined
		});
		return { ok: true, ...result };
	},

	recordFocus: async ({ request }) => {
		const data = await request.formData();
		const taskId = String(data.get('task_id') ?? '');
		const startedAt = Number(data.get('started_at') ?? 0);
		const stoppedAt = Number(data.get('stopped_at') ?? 0);
		const durationSeconds = Number(data.get('duration_seconds') ?? 0);
		const endCause = String(data.get('end_cause') ?? '');
		const timeZone = String(data.get('time_zone') ?? '');

		if (!taskId) return fail(400, { message: 'task_id is required' });
		if (!Number.isFinite(startedAt) || startedAt <= 0) {
			return fail(400, { message: 'started_at is required' });
		}
		if (!Number.isFinite(stoppedAt) || stoppedAt <= 0) {
			return fail(400, { message: 'stopped_at is required' });
		}
		if (endCause !== 'ring' && endCause !== 'stop') {
			return fail(400, { message: 'end_cause must be ring or stop' });
		}

		const db = getDb();
		recordFocusSession(db, {
			taskId,
			startedAt,
			stoppedAt,
			durationSeconds,
			endCause,
			timeZone: timeZone || undefined
		});
		return { ok: true };
	}
};
