<!--
	PROTOTYPE QUESTION: Candidate design languages for the v1 pomodoro slice,
	switched via ?lang=honey|amber|terracotta|coral|clay|editorial|deskclock.
	Five warm-pastel-light palettes share Plus Jakarta Sans (honey = baseline;
	amber/terracotta/coral/clay are alternative colour schemes); editorial pairs
	Fraunces serif + Inter and deskclock pairs Space Mono + Inter as outliers. Each
	defines a palette + a font pairing + state tokens (hover/active/focus-ring/
	error/success); all drive the SAME locked layout (VariantA hero + VariantC
	dense table, see LockedComposition.svelte). The lang lives in the URL
	(reload-stable & shareable); the timer FSM scene is local $state (free play,
	not in the URL). THROWAWAY — do not fold into main.

	TYPOGRAPHY: Google Fonts CDN download for prototype evaluation only — when
	folding any winner into main, self-host via Fontsource instead.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import type { Lang, TimerScene } from './demo.svelte.ts';
	import { sampleTasks } from './demo.svelte.ts';
	import LockedComposition from './LockedComposition.svelte';
	import PaletteSwitcher from './PaletteSwitcher.svelte';

	// lang lives in the URL (reload-stable & shareable). The five warm-pastel-light
	// langs (honey/amber/terracotta/coral/clay) plus the two font-paired outliers
	// (editorial/deskclock) are all valid; any other value falls back to 'honey'.
	const rawLang = $derived(page.url.searchParams.get('lang'));
	const lang = $derived<Lang>(
		rawLang === 'editorial'
			? 'editorial'
			: rawLang === 'deskclock'
				? 'deskclock'
				: rawLang === 'amber'
					? 'amber'
					: rawLang === 'terracotta'
						? 'terracotta'
						: rawLang === 'coral'
							? 'coral'
							: rawLang === 'clay'
								? 'clay'
								: 'honey'
	);

	// Scene is local $state (deliberately NOT in the URL — it's free-play).
	let scene = $state<TimerScene>('focus-running');

	// Static, mock auto-confirm (ADR 0001's 30s). The prototype checks palette/
	// typography, not a live timer, so no setInterval — this is a frozen value
	// the prompt renders.
	const autoConfirm = 30;

	// Base-relative path to this route — resolve() prepends the configured base.
	// SvelteURLSearchParams satisfies the svelte/prefer-svelte-reactivity rule
	// (it extends URLSearchParams, so cloning page.url.searchParams works).
	function navigateWith(params: SvelteURLSearchParams): void {
		goto(resolve(`/prototype/palette?${params.toString()}`), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function setLang(l: Lang): void {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		params.set('lang', l);
		navigateWith(params);
	}
</script>

<svelte:head>
	<!-- Google Fonts CDN (prototype only — self-host via Fontsource when folding any winner into main) -->
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Fraunces:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div data-lang={lang} class="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
	<LockedComposition {scene} tasks={sampleTasks} {autoConfirm} />
	<PaletteSwitcher {lang} {scene} onLang={setLang} onScene={(s) => (scene = s)} />
</div>

<style>
	/* Three design languages as themeable tokens. LockedComposition reads them
	   via Tailwind arbitrary values like bg-[var(--surface)] / text-[var(--ink)] and
	   the ff-display / ff-heading helper classes. font-family set on each rule makes
	   --font-body the default for the whole subtree; .ff-display / .ff-heading override
	   on specific elements. */

	:global([data-lang='honey']) {
		--bg: #faf6ee;
		--surface: #fffdf8;
		--surface-2: #f3ebda;
		--ink: #4a4034;
		--ink-soft: #8a7e6c;
		--accent: #cf7138;
		--accent-2: #e3a45a;
		--border: #e7dcc6;
		--hover: #f3ebda;
		--active: #e8d9bf;
		--focus-ring: #e3a45a;
		--error: #c0533a;
		--error-bg: #f6e6df;
		--success: #6b8a4a;
		--shadow: 0 10px 30px -12px rgba(74, 64, 52, 0.18);
		--font-display: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		--font-heading: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		--font-body: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		font-family: var(--font-body);
	}

	:global([data-lang='amber']) {
		--bg: #fbf7ee;
		--surface: #fffdf7;
		--surface-2: #f4ecd8;
		--ink: #4a4030;
		--ink-soft: #8a7a64;
		--accent: #b8862e;
		--accent-2: #d4a44a;
		--border: #e8dcc4;
		--hover: #f4ecd8;
		--active: #e8dcc0;
		--focus-ring: #d4a44a;
		--error: #b05a2f;
		--error-bg: #f6e8d8;
		--success: #6f8a4a;
		--shadow: 0 10px 30px -12px rgba(74, 64, 48, 0.18);
		--font-display: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		--font-heading: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		--font-body: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		font-family: var(--font-body);
	}

	:global([data-lang='terracotta']) {
		--bg: #f7f2ec;
		--surface: #fffaf4;
		--surface-2: #efe4d7;
		--ink: #4a3d33;
		--ink-soft: #8a7c6e;
		--accent: #b65a3f;
		--accent-2: #d4886a;
		--border: #e4d6c5;
		--hover: #efe4d7;
		--active: #e3d4c2;
		--focus-ring: #d4886a;
		--error: #9a4233;
		--error-bg: #f4ddd5;
		--success: #6f8a4a;
		--shadow: 0 10px 30px -12px rgba(74, 61, 51, 0.2);
		--font-display: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		--font-heading: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		--font-body: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		font-family: var(--font-body);
	}

	:global([data-lang='coral']) {
		--bg: #fcf4f1;
		--surface: #fff9f6;
		--surface-2: #f6e3dc;
		--ink: #4a3a37;
		--ink-soft: #a07e78;
		--accent: #d9685a;
		--accent-2: #ee9690;
		--border: #f0d8cf;
		--hover: #f6e3dc;
		--active: #f0d4c8;
		--focus-ring: #ee9690;
		--error: #b8454a;
		--error-bg: #f6dad6;
		--success: #6f8a4a;
		--shadow: 0 10px 30px -12px rgba(74, 58, 55, 0.2);
		--font-display: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		--font-heading: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		--font-body: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		font-family: var(--font-body);
	}

	:global([data-lang='clay']) {
		--bg: #f8f5f0;
		--surface: #fffdf8;
		--surface-2: #eee9e0;
		--ink: #4a4540;
		--ink-soft: #8a857f;
		--accent: #9a7a5a;
		--accent-2: #b89a7a;
		--border: #e0d9cc;
		--hover: #eee9e0;
		--active: #e3ddcf;
		--focus-ring: #b89a7a;
		--error: #a85544;
		--error-bg: #f4e0d8;
		--success: #6f8a4a;
		--shadow: 0 10px 30px -12px rgba(74, 69, 64, 0.16);
		--font-display: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		--font-heading: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		--font-body: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
		font-family: var(--font-body);
	}

	:global([data-lang='editorial']) {
		--bg: #fbf3f3;
		--surface: #fff8f7;
		--surface-2: #f4e3e3;
		--ink: #4a3839;
		--ink-soft: #9f8488;
		--accent: #b95a73;
		--accent-2: #d28a9a;
		--border: #ecdada;
		--hover: #f4e3e3;
		--active: #ead0d0;
		--focus-ring: #d28a9a;
		--error: #a8424f;
		--error-bg: #f6e2e2;
		--success: #6f8a5e;
		--shadow: 0 10px 30px -12px rgba(74, 56, 57, 0.2);
		--font-display: 'Inter', ui-sans-serif, system-ui, sans-serif;
		--font-heading: 'Fraunces', 'Iowan Old Style', Charter, Georgia, serif;
		--font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
		font-family: var(--font-body);
	}

	:global([data-lang='deskclock']) {
		--bg: #2a2620;
		--surface: #332e27;
		--surface-2: #3d362e;
		--ink: #ede4d4;
		--ink-soft: #a89c87;
		--accent: #e8a838;
		--accent-2: #f0c060;
		--border: #443e35;
		--hover: #3d362e;
		--active: #4a4239;
		--focus-ring: #f0c060;
		--error: #d9604a;
		--error-bg: #4a2e26;
		--success: #8aa560;
		--shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.45);
		--font-display: 'Space Mono', ui-monospace, 'SF Mono', Menlo, monospace;
		--font-heading: 'Inter', ui-sans-serif, system-ui, sans-serif;
		--font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
		font-family: var(--font-body);
	}

	:global(.ff-display) {
		font-family: var(--font-display);
	}
	:global(.ff-heading) {
		font-family: var(--font-heading);
	}

	/* Optional editorial flourish: Fraunces italic on the break-prompt heading only. */
	:global([data-lang='editorial'] .prompt-line) {
		font-style: italic;
	}
</style>
