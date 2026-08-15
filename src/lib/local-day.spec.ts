import { describe, expect, it } from 'vitest';
import { localDay } from './local-day';

describe('localDay', () => {
	it('formats an instant in UTC as YYYY-MM-DD', () => {
		expect(localDay(Date.UTC(2026, 7, 15, 12, 0, 0), 'UTC')).toBe('2026-08-15');
	});

	it('rolls to the next local day at midnight', () => {
		expect(localDay(Date.UTC(2026, 7, 15, 23, 59, 0), 'UTC')).toBe('2026-08-15');
		expect(localDay(Date.UTC(2026, 7, 16, 0, 1, 0), 'UTC')).toBe('2026-08-16');
	});

	it('uses an explicit IANA timezone (not the host)', () => {
		// 23:30 UTC on Aug 15 is 19:30 on the US East Coast (same day).
		const utcMs = Date.UTC(2026, 7, 15, 23, 30, 0);
		expect(localDay(utcMs, 'UTC')).toBe('2026-08-15');
		expect(localDay(utcMs, 'America/New_York')).toBe('2026-08-15');
		// NY is behind UTC in summer (EDT = UTC-4): early UTC on Aug 17 is still Aug 16 in NY.
		const nyPrevDay = Date.UTC(2026, 7, 17, 1, 0, 0); // 21:00 EDT on Aug 16
		expect(localDay(nyPrevDay, 'UTC')).toBe('2026-08-17');
		expect(localDay(nyPrevDay, 'America/New_York')).toBe('2026-08-16');
	});

	it('handles a spring-forward DST boundary in New York', () => {
		// 2026-03-08 in the US: clocks spring forward at 02:00 -> 03:00 EST.
		// 02:30 EST does not exist locally — Intl picks the equivalent UTC instant.
		// Use pre-skip and post-skip instants around the boundary.
		const beforeSkip = Date.UTC(2026, 2, 8, 6, 59, 0); // 01:59 EST -> 06:59 UTC
		const afterSkip = Date.UTC(2026, 2, 8, 7, 1, 0); // 03:01 EDT -> 07:01 UTC
		expect(localDay(beforeSkip, 'America/New_York')).toBe('2026-03-08');
		expect(localDay(afterSkip, 'America/New_York')).toBe('2026-03-08');
	});

	it('handles a fall-back DST boundary in New York', () => {
		// 2026-11-01 in the US: clocks fall back at 02:00 EDT -> 01:00 EST.
		// The hour 01:00-02:00 local occurs twice. The first 01:30 is still EDT (UTC-4).
		const firstAm = Date.UTC(2026, 10, 1, 5, 30, 0); // 01:30 EDT -> 05:30 UTC
		const secondAm = Date.UTC(2026, 10, 1, 6, 30, 0); // 01:30 EST -> 06:30 UTC
		expect(localDay(firstAm, 'America/New_York')).toBe('2026-11-01');
		expect(localDay(secondAm, 'America/New_York')).toBe('2026-11-01');
	});

	it('attributes a focus started at 23:30 local on Monday to Monday', () => {
		// CONTEXT.md worked example: 11:30pm Monday -> Monday, regardless of what
		// UTC says. Verified against America/New_York.
		const local1115 = Date.UTC(2026, 7, 18, 3, 30, 0); // 23:30 EDT on Aug 17 (Mon) -> 03:30 UTC on Aug 18
		expect(localDay(local1115, 'America/New_York')).toBe('2026-08-17');
		const localMidnight = Date.UTC(2026, 7, 18, 4, 15, 0); // 00:15 EDT on Aug 18 (Tue)
		expect(localDay(localMidnight, 'America/New_York')).toBe('2026-08-18');
	});

	it('zero-pads single-digit months and days', () => {
		expect(localDay(Date.UTC(2026, 0, 5, 12, 0, 0), 'UTC')).toBe('2026-01-05');
	});

	it('does not depend on `now` — the same instant always produces the same day', () => {
		const a = Date.UTC(2026, 7, 15, 12, 0, 0);
		const b = Date.UTC(2026, 7, 15, 12, 0, 0);
		expect(localDay(a, 'UTC')).toBe(localDay(b, 'UTC'));
	});
});

describe('defaultTimeZone', () => {
	it('returns a non-empty IANA name from Intl', () => {
		expect(typeof Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('string');
	});
});
