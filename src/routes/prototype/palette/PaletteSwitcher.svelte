<!--
	Prototype palette/typography switcher — floating bottom-centre bar. THROWAWAY
	— do not fold into main. Mirrors PrototypeSwitcher (same dark-pill visual
	register) but cycles the design-language ?lang= param and offers the same
	5-state timer-scene free-play. ArrowLeft/ArrowRight cycle the five warm-pastel-
	light langs (honey → amber → terracotta → coral → clay → honey); editorial and
	deskclock stay reachable via ?lang= directly but are deliberately out of the
	cycle (they pair different fonts, not just colour). Skipped when an input,
	textarea, [contenteditable], or [select] is focused. Gated on $app/environment
	`dev` and wrapped in {#if dev} so the bar + badge never ship to production
	builds. <svelte:window> stays at the top level (it cannot live inside a block)
	— its handler early-returns when `!dev`, so keys are never intercepted in prod.
-->
<script lang="ts">
	import { dev } from '$app/environment';
	import type { Lang, TimerScene } from './demo.svelte.ts';

	interface Props {
		lang: Lang;
		scene: TimerScene;
		onLang: (l: Lang) => void;
		onScene: (s: TimerScene) => void;
	}
	let { lang, scene, onLang, onScene }: Props = $props();

	// Labels for every valid lang — used for the centre readout. editorial +
	// deskclock keep their labels here so landing on them via direct URL still
	// renders a descriptor.
	const langLabels: Record<Lang, string> = {
		honey: 'Apricot on Cream',
		amber: 'Golden Hour',
		terracotta: 'Desert Clay',
		coral: 'Warm Peach',
		clay: 'Warm Sand',
		editorial: 'Dusty Rose Serif',
		deskclock: 'Honey on Slate'
	};

	// Arrow keys cycle these five warm-pastel-light langs only (honey = baseline).
	// If `lang` is editorial/deskclock (reached via URL, not in cycle), indexOf
	// returns -1 and the modulo steps to honey (→) / clay (←) — a sensible entry.
	const langCycle: Lang[] = ['honey', 'amber', 'terracotta', 'coral', 'clay'];

	const sceneTabs: { id: TimerScene; label: string }[] = [
		{ id: 'idle', label: 'Idle' },
		{ id: 'focus-running', label: 'Focus' },
		{ id: 'transitioning', label: 'Trans' },
		{ id: 'break-running', label: 'Brk' },
		{ id: 'long-break-running', label: 'LBrk' }
	];

	const currentLabel = $derived(langLabels[lang] ?? '');

	function step(dir: 1 | -1): void {
		const idx = langCycle.indexOf(lang);
		const next = (idx + dir + langCycle.length) % langCycle.length;
		onLang(langCycle[next]);
	}

	function onKey(e: KeyboardEvent): void {
		// Dead-code in production builds: never intercept keys outside dev.
		if (!dev) return;
		const el = document.activeElement;
		if (
			el instanceof HTMLElement &&
			(el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
		) {
			return;
		}
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			step(-1);
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			step(1);
		}
	}
</script>

<svelte:window onkeydown={onKey} />

{#if dev}
	<!-- PROTOTYPE — throwaway badge (corner) -->
	<div
		class="fixed top-3 right-3 z-50 rounded-full bg-black/80 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-amber-300 uppercase"
	>
		Prototype — throwaway
	</div>

	<!-- Floating switcher bar -->
	<div
		class="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-full bg-neutral-900 px-3 py-2 text-neutral-100 shadow-xl ring-1 ring-white/10"
	>
		<!-- Lang arrows + label -->
		<div class="flex items-center gap-1.5">
			<button
				type="button"
				onclick={() => step(-1)}
				aria-label="Previous language"
				class="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-sm transition hover:bg-white/20"
			>
				◀
			</button>
			<span class="min-w-[12rem] text-center text-xs font-medium">
				{lang} — {currentLabel}
			</span>
			<button
				type="button"
				onclick={() => step(1)}
				aria-label="Next language"
				class="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-sm transition hover:bg-white/20"
			>
				▶
			</button>
		</div>

		<div class="hidden h-5 w-px bg-white/15 sm:block"></div>

		<!-- Scene picker -->
		<div class="flex items-center gap-0.5">
			{#each sceneTabs as s (s.id)}
				<button
					type="button"
					onclick={() => onScene(s.id)}
					class="rounded-md px-2 py-1 text-xs transition {s.id === scene
						? 'bg-white text-neutral-900'
						: 'bg-white/10 text-neutral-300 hover:bg-white/20'}"
				>
					{s.label}
				</button>
			{/each}
		</div>
	</div>
{/if}
