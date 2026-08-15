import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function createDb(url: string) {
	const client = new Database(url);
	return drizzle(client, { schema });
}

export function getDb() {
	if (_db) return _db;
	const url = process.env.DATABASE_URL ?? 'local.db';
	_db = createDb(url);
	return _db;
}

export type Database = ReturnType<typeof getDb>;
export { schema };
