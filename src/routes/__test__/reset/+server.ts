import { error, json } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { dailyPrimaryTasks, dayMeta, focusSessions, tasks } from '$lib/server/db/schema';

export const POST = () => {
	if (privateEnv.ENABLE_TEST_RESET !== 'true') throw error(404, 'Not found');
	const db = getDb();
	db.delete(focusSessions).run();
	db.delete(dailyPrimaryTasks).run();
	db.delete(dayMeta).run();
	db.delete(tasks).run();
	return json({ ok: true });
};
