/**
 * Module-level session-signals instance.
 *
 * Both the home route (which fires `notifyFocusEnd` / `notifyBreakEnd`)
 * and the `/settings` route (which owns the permission gesture) need to
 * read and mutate the same SessionSignals state — the same AudioContext,
 * the same DOM mutations, the same `permission` field. A module-level
 * singleton avoids constructing two instances and keeps the read of
 * `Notification.permission` consistent across the app.
 *
 * The class itself remains importable for tests
 * (`import { SessionSignals } from '$lib/timer/signals.svelte'`).
 */
import { SessionSignals } from './signals.svelte';

export const signals = new SessionSignals();
