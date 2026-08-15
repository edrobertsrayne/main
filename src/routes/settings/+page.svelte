<script lang="ts">
	import { resolve } from '$app/paths';
	import { signals } from '$lib/timer/signals-instance';

	let requesting = $state(false);

	async function requestPermission() {
		if (requesting) return;
		requesting = true;
		try {
			await signals.requestPermission();
		} finally {
			requesting = false;
		}
	}
</script>

<!-- Settings is a client-side route (per +page.ts ssr=false). The
     permission gesture must run inside a real user click handler — the
     browser gates Notification.requestPermission() behind user
     activation, so this button is the only acceptable place to ask. -->
<div data-phase="focus" class="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
	<div class="mx-auto max-w-3xl px-6 py-10">
		<header class="mb-8 flex items-baseline justify-between">
			<div>
				<h1 class="text-4xl font-semibold tracking-tight">Settings</h1>
				<p class="mt-1 text-sm text-[var(--ink-soft)]">Local-only preferences for this device.</p>
			</div>
			<a
				href={resolve('/')}
				class="rounded-md px-3 py-1.5 text-xs text-[var(--ink-soft)] hover:bg-[var(--hover)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
				>← Back</a
			>
		</header>

		<section
			aria-labelledby="notifications-heading"
			class="rounded-md border border-[var(--border)] bg-[var(--surface)] p-5"
			data-notifications-section
		>
			<h2 id="notifications-heading" class="text-lg font-semibold tracking-tight">
				Desktop notifications
			</h2>
			<p class="mt-2 text-sm text-[var(--ink-soft)]">
				When a focus session ends, the app fires an OS notification so you notice even with the tab
				backgrounded or muted.
			</p>

			<div class="mt-4 flex items-center gap-3" data-notifications-status>
				{#if signals.permission === 'granted'}
					<span
						class="rounded-full bg-[var(--success)] px-3 py-1 text-xs font-medium text-[var(--on-accent)]"
						data-permission="granted"
					>
						Enabled
					</span>
					<p class="text-xs text-[var(--ink-soft)]">
						Focus ends will fire a desktop notification. To turn it off, use your browser's site
						settings for this origin.
					</p>
				{:else if signals.permission === 'denied'}
					<span
						class="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--ink)]"
						data-permission="denied"
					>
						Blocked
					</span>
					<p class="text-xs text-[var(--ink-soft)]">
						Notifications are blocked for this origin. The browser won't re-ask once denied — change
						the permission in your browser's site settings for <code>localhost</code>.
					</p>
				{:else}
					<button
						type="button"
						data-enable-notifications
						onclick={requestPermission}
						disabled={requesting}
						class="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-[var(--on-accent)] hover:bg-[var(--accent-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{requesting ? 'Asking…' : 'Enable desktop notifications'}
					</button>
					<p class="text-xs text-[var(--ink-soft)]">
						Permission is only requested on this explicit click — never silently at app start.
					</p>
				{/if}
			</div>
		</section>

		<section
			aria-labelledby="sound-heading"
			class="mt-6 rounded-md border border-[var(--border)] bg-[var(--surface)] p-5"
			data-sound-section
		>
			<h2 id="sound-heading" class="text-lg font-semibold tracking-tight">Session chime</h2>
			<p class="mt-2 text-sm text-[var(--ink-soft)]">
				A short, synthesised chime plays at focus-end (louder) and break-end (quieter). The chime
				plays <strong>unconditionally</strong> — there is no on/off toggle. The only way to silence it
				is OS mute (the app adds no UI surface for it).
			</p>
			<p class="mt-2 text-xs text-[var(--ink-soft)]" data-sound-explainer>
				The chime unlocks the first time you click <em>Start focus</em>, and then plays on every
				session boundary without further gesture.
			</p>
		</section>
	</div>
</div>
