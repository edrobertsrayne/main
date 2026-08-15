<!--
	PROTOTYPE QUESTION (#16 — transitioning prompt micro-UX): four structurally
	distinct variants of the 25:00 focus-end → break prompt, switched via
	?prompt=A|B|C|D. The macro behavior is LOCKED by ADR 0001: every focus→break
	route (ring or stop — stop never earns a long break per #12) enters a
	`transitioning` state showing a 30s auto-confirm prompt; confirm / 30s ⇒
	break-running|long-break-running, skip ⇒ idle. This prototype decides the
	MICRO-UX only — the three open axes from #16:
	  • countdown shape  — bar / ring / number / number+bar
	  • control layout   — side-by-side / inline / single-emphasis / stacked
	  • prompt position  — card-over-ring / ring-is-countdown / strip-below / takeover
	Copy register is held COMPLEMENTARY to structure (faithful to ADR 0001's
	"Take a 5-minute break?" / "Take a 20-minute long break?" family) — the variants
	agree on STRUCTURE, not just copy, per the /prototype UI skill.

	Builds ON #15's locked held palette swap (Variant C, full swap) —
	data-variant="C" is PINNED on the page root so the coral→sage swap fires at
	focus-end exactly as locked. So the prompt renders ON the sage break palette
	(see VariantA's note). The switcher's Short/Long break-type toggle drives
	which break the prompt is offering (ADR: long only on a `ring` that lands the
	counter on a positive multiple of 4). Build on #14's locked composition +
	Plus Jakarta Sans.

	THROWAWAY — do not fold into main. TYPOGRAPHY: Google Fonts CDN download for
	prototype evaluation only — when folding any winner into main, self-host via
	Fontsource instead (per #14).
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import type { BreakType, Phase, PromptVariant, TimerScene } from './demo.svelte.ts';
	import { sampleTasks } from './demo.svelte.ts';
	import LockedComposition from './LockedComposition.svelte';
	import TransSwitcher from './TransSwitcher.svelte';
	import VariantA from './VariantA.svelte';
	import VariantB from './VariantB.svelte';
	import VariantC from './VariantC.svelte';
	import VariantD from './VariantD.svelte';

	// Prompt variant lives in the URL (reload-stable & shareable). Default 'A'.
	// NOTE: the flash route's `?variant=` param scopes the PALETTE swap; here
	// data-variant="C" is PINNED (the locked full swap) so the `?variant=` param
	// stays free — but we name this one `?prompt=` to keep the prompt axis
	// cleanly separable from any future palette-scope question.
	const rawPrompt = $derived(page.url.searchParams.get('prompt'));
	const promptVariant = $derived<PromptVariant>(
		rawPrompt === 'A'
			? 'A'
			: rawPrompt === 'B'
				? 'B'
				: rawPrompt === 'C'
					? 'C'
					: rawPrompt === 'D'
						? 'D'
						: 'A'
	);

	// Scene + phase + break-type are local $state (deliberately NOT in the URL —
	// free-play driving the timer FSM, same as the flash route).
	let scene = $state<TimerScene>('focus-running');
	let phase = $state<Phase>('focus');
	let breakType = $state<BreakType>('short');

	// Auto-confirm countdown, per ADR 0001 (30s). Driven by a 1s interval armed
	// only while in `transitioning` (see the $effect below). `freezeCountdown`
	// lets a reviewer hold a mid-count to inspect a countdown treatment.
	let autoConfirm = $state(30);
	let freezeCountdown = $state(false);

	function setPhase(p: Phase): void {
		phase = p;
	}

	// Every scene change flows through here. Extended from the flash route:
	//   focus-running → transitioning         → phase = break (sage shows DURING the prompt)
	//   break-running|long-break-running → idle → phase = focus (back to coral)
	//   transitioning → idle (skip)           → phase = focus (skip = leave the break palette)
	// Detecting phase swaps at the mutation point avoids the $effect-writes-
	// $state anti-pattern the svelte-autofixer flags. Entering transitioning
	// also resets autoConfirm to 30 (the countdown restarts on each prompt).
	function setScene(next: TimerScene): void {
		const prev = scene;
		if (prev !== 'transitioning' && next === 'transitioning') {
			autoConfirm = 30;
		}
		scene = next;
		if (prev === 'focus-running' && next === 'transitioning') {
			setPhase('break');
		} else if ((prev === 'break-running' || prev === 'long-break-running') && next === 'idle') {
			setPhase('focus');
		} else if (prev === 'transitioning' && next === 'idle') {
			setPhase('focus');
		}
	}

	function setBreakType(b: BreakType): void {
		breakType = b;
	}

	// Confirm routes per ADR 0001: long during the prompt, the break the prompt
	// is offering fires on confirm/30s — short or long per breakType.
	function confirm(): void {
		setScene(breakType === 'long' ? 'long-break-running' : 'break-running');
	}
	// Skip ⇒ idle (and phase returns to focus/coral via setScene's rule above).
	function skip(): void {
		setScene('idle');
	}

	function navigateWith(params: SvelteURLSearchParams): void {
		goto(resolve(`/prototype/trans?${params.toString()}`), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function setPrompt(v: PromptVariant): void {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		params.set('prompt', v);
		navigateWith(params);
	}

	// Live 30s countdown — armed only while transitioning & not frozen. Fires
	// confirm() at 0. The interval callback writing $state is the canonical
	// async-timer pattern; synchronous effect body only reads scene +
	// freezeCountdown (no reactive write-in-effect loop).
	$effect(() => {
		if (scene !== 'transitioning' || freezeCountdown) return;
		const id = setInterval(() => {
			if (autoConfirm <= 1) {
				autoConfirm = 0;
				clearInterval(id);
				confirm();
			} else {
				autoConfirm = autoConfirm - 1;
			}
		}, 1000);
		return () => clearInterval(id);
	});

	// Arrow-key cycling of the prompt variant (per the /prototype UI skill), so
	// the human can flip A→B→C→D→A from the keyboard. Suppressed while an input,
	// textarea, or contenteditable is focused (the locked composition's add-task
	// input would otherwise steal ←/→ for caret movement).
	$effect(() => {
		function onKey(e: KeyboardEvent): void {
			if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
			const el = document.activeElement;
			if (
				el &&
				(el instanceof HTMLInputElement ||
					el instanceof HTMLTextAreaElement ||
					(el instanceof HTMLElement && el.isContentEditable))
			) {
				return;
			}
			e.preventDefault();
			const order: PromptVariant[] = ['A', 'B', 'C', 'D'];
			const idx = order.indexOf(promptVariant);
			const next =
				e.key === 'ArrowRight'
					? order[(idx + 1) % order.length]
					: order[(idx - 1 + order.length) % order.length];
			setPrompt(next);
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
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

<!--
	Page root: `data-lang="coral"` + `data-variant="C"` PINNED (so #15's locked
	full palette swap applies — coral focus / sage break). `data-phase` drives
	the swap, `data-prompt` exposes the prompt variant for inspection / CSS hook.
-->
<div
	data-lang="coral"
	data-variant="C"
	data-phase={phase}
	data-prompt={promptVariant}
	class="min-h-screen bg-[var(--bg)] text-[var(--ink)]"
>
	<LockedComposition {scene} tasks={sampleTasks}>
		{#if promptVariant === 'A'}
			<VariantA {autoConfirm} {breakType} onConfirm={confirm} onSkip={skip} />
		{:else if promptVariant === 'B'}
			<VariantB {autoConfirm} {breakType} onConfirm={confirm} onSkip={skip} />
		{:else if promptVariant === 'C'}
			<VariantC {autoConfirm} {breakType} onConfirm={confirm} onSkip={skip} />
		{:else if promptVariant === 'D'}
			<VariantD {autoConfirm} {breakType} onConfirm={confirm} onSkip={skip} />
		{/if}
	</LockedComposition>
	<TransSwitcher
		{promptVariant}
		{scene}
		{breakType}
		{freezeCountdown}
		onPrompt={setPrompt}
		onScene={setScene}
		onBreakType={setBreakType}
		onFreezeToggle={(b) => (freezeCountdown = b)}
	/>
</div>

<style>
	/* Coral palette — the DECIDED design language from #14 (boldened by #15).
	   Verbatim from the flash route; the break-palette tokens below are the
	   ALWAYS-AVAILABLE complement, promoted to the live tokens under
	   [data-phase='break'] per the locked Variant-C scope block further down. */
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
		/* Break palette — sage complement (#15's bolder break tones). Content-
		   semantic --error/--error-bg/--success stay coral across the phase swap. */
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

	/* #15's locked Variant C — full palette swap on [data-phase='break']. Pinned:
	   this route hard-codes data-variant="C" on the page root, so only this scope
	   block ever applies. Coral flips to sage at focus-end (transitioning shows
	   the sage palette DURING the prompt — that's what #16's variants paint on),
	   and flips back to coral at break-end. */
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

	/* #15's 200ms cross-fade on the palette-sensitive properties — a perceivable
	   transition (not a flash), below the WCAG flash threshold. The swap from
	   coral → sage as the prompt appears reads as a calm room-change. */
	:global([data-variant]),
	:global([data-variant] *) {
		transition:
			background-color 200ms ease-out,
			border-color 200ms ease-out,
			color 200ms ease-out,
			box-shadow 200ms ease-out;
	}

	:global(.ff-display) {
		font-family: var(--font-display);
	}
	:global(.ff-heading) {
		font-family: var(--font-heading);
	}
</style>
