import { error, json } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { focusSessions } from '$lib/server/db/schema';

export const GET = async () => {
	if (privateEnv.ENABLE_TEST_RESET !== 'true') throw error(404, 'Not found');
	const db = getDb();
	const rows = db
		.select({
			id: focusSessions.id,
			day: focusSessions.localDay,
			startedAt: focusSessions.startedAt,
			taskId: focusSessions.taskId,
			endCause: focusSessions.endCause
		})
		.from(focusSessions)
		.all();
	return json(rows);
};
