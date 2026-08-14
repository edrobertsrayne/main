<!--
	PROTOTYPE QUESTION: Three structurally-different layout compositions for the
	timer+tasks page (A centered hero / B side dock / C top banner + dense table),
	switchable via ?variant=A|B|C, plus 4 warm-pastel palettes (?palette=1..4 : Sand,
	Blush, Sage, Lavender) and a 5-state timer-scene free-play (local state, not in
	the URL). THROWAWAY — do not fold into main.

	TYPOGRAPHY: Tailwind's default `font-sans` (ui-sans-serif, system-ui, -apple-system,
	Segoe UI, Roboto, Inter, sans-serif) — a warm, open system stack. No webfont added.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import type { TimerScene, Variant } from './demo.svelte.ts';
	import { sampleTasks } from './demo.svelte.ts';
	import VariantA from './VariantA.svelte';
	import VariantB from './VariantB.svelte';
	import VariantC from './VariantC.svelte';
	import PrototypeSwitcher from './PrototypeSwitcher.svelte';

	// variant + palette live in the URL (reload-stable & shareable); scene is local.
	const rawVariant = $derived(page.url.searchParams.get('variant'));
	const variant = $derived<Variant>(rawVariant === 'B' || rawVariant === 'C' ? rawVariant : 'A');

	const rawPalette = $derived(page.url.searchParams.get('palette'));
	const palette = $derived<number>(
		rawPalette === '2' ? 2 : rawPalette === '3' ? 3 : rawPalette === '4' ? 4 : 1
	);

	// Scene is local $state (deliberately NOT in the URL — it's free-play).
	let scene = $state<TimerScene>('focus-running');

	// Static, mock auto-confirm (ADR 0001's 30s). The prototype checks layout, not a
	// live timer, so no setInterval — this is a frozen value the prompt renders.
	const autoConfirm = 30;

	// Base-relative path to this route — resolve() prepends the configured base.
	// SvelteURLSearchParams satisfies the svelte/prefer-svelte-reactivity rule
	// (it extends URLSearchParams, so cloning page.url.searchParams works).
	function navigateWith(params: SvelteURLSearchParams): void {
		goto(resolve(`/prototype/layout?${params.toString()}`), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function setVariant(v: Variant): void {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		params.set('variant', v);
		navigateWith(params);
	}

	function setPalette(n: number): void {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		params.set('palette', String(n));
		navigateWith(params);
	}
</script>

<div data-palette={String(palette)} class="min-h-screen bg-[var(--bg)] font-sans text-[var(--ink)]">
	{#if variant === 'A'}
		<VariantA {scene} tasks={sampleTasks} {autoConfirm} />
	{:else if variant === 'B'}
		<VariantB {scene} tasks={sampleTasks} {autoConfirm} />
	{:else}
		<VariantC {scene} tasks={sampleTasks} {autoConfirm} />
	{/if}

	<PrototypeSwitcher
		{variant}
		{palette}
		{scene}
		onVariant={setVariant}
		onPalette={setPalette}
		onScene={(s) => (scene = s)}
	/>
</div>

<style>
	/* Four warm-pastel palettes as themeable tokens. Variants read these via
	   Tailwind arbitrary values like bg-[var(--surface)] / text-[var(--ink)] etc. */
	:global([data-palette='1']) {
		--bg: #faf6ee;
		--surface: #fffdf8;
		--surface-2: #f0e7d6;
		--ink: #4a4034;
		--ink-soft: #8a7e6c;
		--accent: #cf7138;
		--accent-2: #e3a45a;
		--border: #e7dcc6;
	}
	:global([data-palette='2']) {
		--bg: #fbf2f4;
		--surface: #fff7f8;
		--surface-2: #f5dfe5;
		--ink: #4a3740;
		--ink-soft: #a08690;
		--accent: #d06a86;
		--accent-2: #eaa0b4;
		--border: #edd5dc;
	}
	:global([data-palette='3']) {
		--bg: #f3f6f0;
		--surface: #fafdf7;
		--surface-2: #e2ecdd;
		--ink: #36402f;
		--ink-soft: #7e8b6f;
		--accent: #5f8a4a;
		--accent-2: #93b67c;
		--border: #d4e0cd;
	}
	:global([data-palette='4']) {
		--bg: #f4f2fb;
		--surface: #fbfaff;
		--surface-2: #e6e1f4;
		--ink: #3c3950;
		--ink-soft: #87829e;
		--accent: #7b6dc4;
		--accent-2: #aea0df;
		--border: #dad4ee;
	}
</style>
