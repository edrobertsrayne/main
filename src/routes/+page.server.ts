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

/** @type {import('./$types').PageServerLoad} */
export function load() {
	const db = getDb();
	return { tasks: listTasksWithActuals(db) };
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
	}
};
