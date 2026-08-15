<!--
	PROTOTYPE QUESTION: 3 visual "session-end signal" mechanisms, switched via
	?variant=A|B|C. PIVOTED FROM A TRANSIENT FLASH TO A HELD PALETTE SWAP per
	the human's resolve ("I don't need a flash, just a clear visual signal,
	hence the colour change. no flash."). NO transient animation — just a
	persistent palette swap keyed to the timer phase, held until the next phase
	transition. Three variants of *scope* of swap (not kind of animation):
	  A — only the page --bg swaps (subtle signal: edges shift, surfaces stay coral)
	  B --bg + --surface swap (surfaces acknowledge the phase change)
	  C — full palette swap (everything visible takes the break tone — the whole
	      page becomes a different "room"; most obvious signal)
	Phase mapping: focus-phase = coral (the locked palette from #14, BOLDENED in
	this iteration as a spike — if the bolder coral reads right, #14's 'warm
	pastel' call needs reopening to re-decide); break-phase = deeper sage
	complement (a "you've earned a break" tone). The swap
	fires on the same edges #6 fires its notification: focus-end
	(focus-running → transitioning) flips to 'break'; break-end
	(break-running|long-break-running → idle) flips back to 'focus'. A short
	200ms cross-fade transitions the change (a transition, not a flash — below
	the WCAG flash threshold by design).

	REDUCED-MOTION NOTE: #6's reduced-motion contract — swap the pulse for an
	opacity fade — was defined against a transient flash. With a held palette
	swap as the cue, there is no motion to reduce: a colour change doesn't
	trigger the photosensitivity concerns that motion does, so the reduced-motion
	fallback is implicitly satisfied. The "Instant swap" toggle on the switcher
	now demos the no-cross-fade case (transitions zeroed) — a UX choice, not an
	accommodation override.

	The flash route HARD-CODES coral (no lang cycling). The timer FSM scene is
	local $state (free play, not in the URL); ?variant= lives in the URL
	(reload-stable & shareable). Build on #14's locked coral palette.

	THROWAWAY — do not fold into main. TYPOGRAPHY: Google Fonts CDN download for
	prototype evaluation only — when folding any winner into main, self-host via
	Fontsource instead (the palette prototype notes the same).
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import type { FlashVariant, Phase, TimerScene } from './demo.svelte.ts';
	import { sampleTasks } from './demo.svelte.ts';
	import LockedComposition from './LockedComposition.svelte';
	import FlashSwitcher from './FlashSwitcher.svelte';

	// variant lives in the URL (reload-stable & shareable). Default 'A' if absent
	// or any invalid value.
	const rawVariant = $derived(page.url.searchParams.get('variant'));
	const variant = $derived<FlashVariant>(
		rawVariant === 'A' ? 'A' : rawVariant === 'B' ? 'B' : rawVariant === 'C' ? 'C' : 'A'
	);

	// Scene is local $state (deliberately NOT in the URL — it's free-play).
	// setScene() below drives `phase` on the qualifying edges (focus-end and
	// break-end) so the palette swap fires on the same boundaries #6 fires its
	// notification.
	let scene = $state<TimerScene>('focus-running');

	// phase = the active palette the page is holding. `focus` = coral (the
	// locked palette), `break` = muted sage-cream complement. Default 'focus'
	// — coral is the resting palette a fresh page lands on. Held between
	// transitions — the swap IS the session-end signal, not a transient flash.
	let phase = $state<Phase>('focus');

	// Instant-swap toggle: when true, sets data-rm="force" on the page root so
	// the transition CSS rule is overridden to 0s — palette swaps happen with
	// no cross-fade. The data-rm attribute name is preserved (working plumbing)
	// — #6's reduced-motion contract is implicitly satisfied for this design
	// (no motion to reduce), so the toggle now demos a UX choice rather than an
	// accommodation override.
	let instant = $state<boolean>(false);

	// Static, mock auto-confirm (ADR 0001's 30s). Frozen mock — no setInterval.
	const autoConfirm = 30;

	function setPhase(p: Phase): void {
		phase = p;
	}

	// Scene transitions drive both `scene` and `phase`. The cue fires only on
	// session-end edges, mirroring #6's notification trigger points:
	//   focus-running → transitioning = focus ended (the "ring" event) → phase=break
	//   break-running|long-break-running → idle = break ended → phase=focus
	// Other transitions leave phase alone (e.g. idle → focus-running is a
	// start gesture, not an end; the phase is already 'focus' from idle).
	// Detecting the transition at the mutation point (here, the one function
	// every scene change flows through) avoids the $effect-writes-$state
	// anti-pattern flagged by the svelte-autofixer in the original prototype.
	function setScene(next: TimerScene): void {
		const prev = scene;
		scene = next;
		if (prev === 'focus-running' && next === 'transitioning') {
			setPhase('break');
		} else if ((prev === 'break-running' || prev === 'long-break-running') && next === 'idle') {
			setPhase('focus');
		}
	}

	// Base-relative path to this route — resolve() prepends the configured base.
	// SvelteURLSearchParams satisfies the svelte/prefer-svelte-reactivity rule
	// (it extends URLSearchParams, so cloning page.url.searchParams works).
	function navigateWith(params: SvelteURLSearchParams): void {
		goto(resolve(`/prototype/flash?${params.toString()}`), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function setVariant(v: FlashVariant): void {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		params.set('variant', v);
		navigateWith(params);
	}
</script>

<svelte:head>
	<!-- Google Fonts CDN (prototype only — self-host via Fontsource when folding any winner into main). -->
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div
	data-lang="coral"
	data-phase={phase}
	data-variant={variant}
	data-rm={instant ? 'force' : undefined}
	class="min-h-screen bg-[var(--bg)] text-[var(--ink)]"
>
	<LockedComposition {scene} tasks={sampleTasks} {autoConfirm} />
	<FlashSwitcher
		{variant}
		{scene}
		{phase}
		{instant}
		onVariant={setVariant}
		onScene={setScene}
		onPhase={setPhase}
		onInstantToggle={(b) => (instant = b)}
	/>
</div>

<style>
	/* Coral palette — the DECIDED design language from issue #14. Locked
	   composition reads these via Tailwind arbitrary values like bg-[var(--surface)]
	   / text-[var(--ink)] and the ff-display / ff-heading helper classes.
	   font-family set on the rule makes --font-body the default for the whole
	   subtree; .ff-display / .ff-heading override on specific elements. The
	   flash route hard-codes coral — this block is the focus-phase palette.

	   The break-palette tokens below (--*-break) are the ALWAYS-AVAILABLE
	   complement to coral: muted sage-cream tones for "you've earned a break."
	   They sit inert unless [data-phase='break'] overrides a coral token in the
	   per-variant scope blocks further down. */
	:global([data-lang='coral']) {
		--bg: #faece3;
		--surface: #fdf1ea;
		--surface-2: #f2d2c5;
		--ink: #4a3a37;
		--ink-soft: #a07e78;
		--accent: #cf5444;
		--accent-2: #ea7e72;
		--border: #e6c5b5;
		--hover: #f2d2c5;
		--active: #edc4b5;
		--focus-ring: #ea7e72;
		--error: #b8454a;
		--error-bg: #f6dad6;
		--success: #6f8a4a;
		--shadow: 0 10px 30px -12px rgba(74, 58, 55, 0.2);
		/* Break palette — deeper sage complement. Always defined; only promoted
		   to the live tokens under [data-phase='break'] per the variant scope
		   blocks below. Bolder than the original muted sage-cream so the phase
		   swap reads as a real signal, not a wash. Dark warm-brown ink and the
		   content-semantic tokens (--error, --error-bg, --success) stay coral
		   for both phases because they keep their meaning across the phase swap
		   (a row state is a row state regardless of focus vs break). */
		--bg-break: #e8efe2;
		--surface-break: #eff5e9;
		--surface-2-break: #d0dcc8;
		--accent-break: #6b8a55;
		--accent-2-break: #92b075;
		--border-break: #c0d2b5;
		--hover-break: #d0dcc8;
		--active-break: #c8d8c0;
		--font-display: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		--font-heading: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		--font-body: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		font-family: var(--font-body);
	}

	/* Variant A — minimal: only --bg swaps to break. The page edges take the
	   break tone; surfaces remain coral — a subtle signal for a user only
	   glancing away. */
	:global([data-lang='coral'][data-phase='break'][data-variant='A']) {
		--bg: var(--bg-break);
	}

	/* Variant B — surfaces: --bg + --surface swap. The visible chrome (timer
	   hero card, add-task input bg, etc.) also takes the break tone — a more
	   palpable signal. */
	:global([data-lang='coral'][data-phase='break'][data-variant='B']) {
		--bg: var(--bg-break);
		--surface: var(--surface-break);
	}

	/* Variant C — full palette swap: every coral token flips to its break
	   complement (ink and the content-semantic --error/--error-bg/--success
	   stay coral — they carry content meaning, not phase). The whole page
	   becomes a different "room" — most obvious signal, useful if the user is
	   looking away from the timer. */
	:global([data-lang='coral'][data-phase='break'][data-variant='C']) {
		--bg: var(--bg-break);
		--surface: var(--surface-break);
		--surface-2: var(--surface-2-break);
		--accent: var(--accent-break);
		--accent-2: var(--accent-2-break);
		--border: var(--border-break);
		--hover: var(--hover-break);
		--active: var(--active-break);
		--focus-ring: var(--accent-2-break);
	}

	/* A short cross-fade for the palette-sensitive properties so the swap is a
	   perceivable transition (not a flash — a transition). 200ms is mild and
	   below the WCAG flash threshold. Applies to the page root itself and all
	   its descendants (the locked composition's surfaces + inputs + borders),
	   since the CSS custom props cascade down — Svelte's scoped CSS needs
	   :global to reach the locked composition's elements. */
	:global([data-variant]),
	:global([data-variant] *) {
		transition:
			background-color 200ms ease-out,
			border-color 200ms ease-out,
			color 200ms ease-out,
			box-shadow 200ms ease-out;
	}

	/* Instant-swap override: zero out the transition when [data-rm='force'] is
	   set on the page root (the switcher's "Instant swap" toggle). !important
	   is needed to win the specificity tie with the rule above, since both
	   selectors match the same elements. */
	:global([data-rm='force']),
	:global([data-rm='force'] *) {
		transition: background-color 0s, border-color 0s, color 0s, box-shadow 0s !important;
	}

	:global(.ff-display) {
		font-family: var(--font-display);
	}
	:global(.ff-heading) {
		font-family: var(--font-heading);
	}
</style>