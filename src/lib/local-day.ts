/**
 * Compute the calendar day in a given IANA timezone as a `YYYY-MM-DD` string,
 * derived from a given epoch-millisecond instant. Pure: no DOM, no I/O, no
 * `Date.now()` — the instant and the timezone are the only inputs. DST-aware
 * by construction (the host's timezone is only the default; callers in
 * non-default contexts — and tests, and the Drizzle layer's per-row writers
 * — pass `timeZone` explicitly).
 */
export function localDay(epochMs: number, timeZone: string = defaultTimeZone()): string {
	const fmt = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
	const parts = fmt.formatToParts(new Date(epochMs));
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
	return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * The host's local IANA timezone. In Node 20+ this is the OS-resolved
 * timezone; in the browser it reflects the user's system clock. Pages that
 * emit `local_day` rows should pass `timeZone` explicitly (their browser
 * timezone) rather than relying on this default at write time — the
 * Drizzle layer's tests do, and the client-side `recordFocus` server
 * action's caller must mirror the user's browser timezone, not the
 * server's.
 */
export function defaultTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Shift a `YYYY-MM-DD` day string by `delta` calendar days. Returns a
 * `YYYY-MM-DD` string. Pure: parses with `Date.UTC` so it's timezone-free
 * (we only care about the calendar date). Negative `delta` walks backwards.
 */
export function shiftDay(day: string, delta: number): string {
	const [y, m, d] = day.split('-').map(Number) as [number, number, number];
	const utc = new Date(Date.UTC(y, m - 1, d));
	utc.setUTCDate(utc.getUTCDate() + delta);
	const yy = utc.getUTCFullYear();
	const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(utc.getUTCDate()).padStart(2, '0');
	return `${yy}-${mm}-${dd}`;
}
