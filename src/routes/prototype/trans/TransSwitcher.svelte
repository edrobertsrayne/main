<!--
	Trans switcher — floating bottom-centre dark-pill bar. THROWAWAY — do not
	fold into main. Mirrors the flash route's FlashSwitcher visual register
	(bg-neutral-900 / ring-1 ring-white/10 / rounded-full / shadow-xl) but drives
	the transitioning-prompt prototype's controls, left-to-right:
	  1) Prompt variant — ◀ arrow + label + ▶ arrow. Cycles A→B→C→D→A (◀/▶ also
	     bound at the window level in +page for arrow-key cycling). The four
	     variants diverge on #16's open axes (countdown shape / control layout /
	     prompt position):
	       A — Centered card over the ring + depleting progress bar
	       B — The 30s countdown IS the hero ring; strip below
	       C — Strip below the static ring + big number readout
	       D — Full-hero soft-wash takeover, stacked
	  2) Break-type toggle (Short / Long) — drives which break the prompt offers,
	     per ADR 0001 (long only on a `ring` landing the counter on a positive
	     multiple of 4 per #12). Changes the prompt copy + VariantB / D previews.
	  3) Scene tabs (Idle/Focus/Trans/Brk/LBrk) — drive the locked composition's
	     scene local $state; the prompt appears at `Trans` (and fires the #15
	     palette swap to sage automatically via +page's setScene).
	  4) Freeze countdown toggle — holds the 30s auto-confirm mid-countdown so a
	     reviewer can inspect a countdown treatment at e.g. 0:15 without waiting.
	Gated entirely in {#if dev} so the bar + badge never ship to production.
-->
<script lang="ts">
	import { dev } from '$app/environment';
	import type { BreakType, PromptVariant, TimerScene } from './demo.svelte.ts';

	interface Props {
		promptVariant: PromptVariant;
		scene: TimerScene;
		breakType: BreakType;
		freezeCountdown: boolean;
		onPrompt: (v: PromptVariant) => void;
		onScene: (s: TimerScene) => void;
		onBreakType: (b: BreakType) => void;
		onFreezeToggle: (b: boolean) => void;
	}
	let {
		promptVariant,
		scene,
		breakType,
		freezeCountdown,
		onPrompt,
		onScene,
		onBreakType,
		onFreezeToggle
	}: Props = $props();

	// Single source of truth for the variant labels (the ◀/▶ arrows show this).
	// Mirror of the intent documented on each Variant*.svelte file's top comment.
	const variantLabels: Record<PromptVariant, string> = {
		A: 'A — Centered card + bar',
		B: 'B — Ring is the countdown',
		C: 'C — Strip below + number',
		D: 'D — Full-hero takeover'
	};

	const order: PromptVariant[] = ['A', 'B', 'C', 'D'];
	function cycle(delta: number): void {
		const idx = order.indexOf(promptVariant);
		const next = order[(idx + delta + order.length) % order.length];
		onPrompt(next);
	}

	const breakTabs: { id: BreakType; label: string }[] = [
		{ id: 'short', label: 'Short 5' },
		{ id: 'long', label: 'Long 20' }
	];

	const sceneTabs: { id: TimerScene; label: string }[] = [
		{ id: 'idle', label: 'Idle' },
		{ id: 'focus-running', label: 'Focus' },
		{ id: 'transitioning', label: 'Trans' },
		{ id: 'break-running', label: 'Brk' },
		{ id: 'long-break-running', label: 'LBrk' }
	];
</script>

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
		<!-- Prompt variant arrows + label -->
		<div class="flex items-center gap-1">
			<button
				type="button"
				onclick={() => cycle(-1)}
				title="Previous prompt variant (←)"
				aria-label="Previous prompt variant"
				class="rounded-md bg-white/10 px-2 py-1 text-xs transition hover:bg-white/20"
			>
				◀
			</button>
			<span class="min-w-[10.5rem] text-center text-xs font-medium text-neutral-100">
				{variantLabels[promptVariant]}
			</span>
			<button
				type="button"
				onclick={() => cycle(1)}
				title="Next prompt variant (→)"
				aria-label="Next prompt variant"
				class="rounded-md bg-white/10 px-2 py-1 text-xs transition hover:bg-white/20"
			>
				▶
			</button>
		</div>

		<div class="hidden h-5 w-px bg-white/15 sm:block"></div>

		<!-- Break-type toggle -->
		<div class="flex items-center gap-1" role="group" aria-label="Break type">
			{#each breakTabs as bt (bt.id)}
				<button
					type="button"
					onclick={() => onBreakType(bt.id)}
					class="rounded-md px-2.5 py-1 text-xs font-medium transition {bt.id === breakType
						? 'bg-white text-neutral-900'
						: 'bg-white/10 text-neutral-300 hover:bg-white/20'}"
				>
					{bt.label}
				</button>
			{/each}
		</div>

		<div class="hidden h-5 w-px bg-white/15 sm:block"></div>

		<!-- Scene tabs -->
		<div class="flex items-center gap-0.5">
			{#each sceneTabs as s (s.id)}
				<button
					type="button"
					onclick={() => onScene(s.id)}
					title={s.label}
					class="rounded-md px-2 py-1 text-xs transition {s.id === scene
						? 'bg-white text-neutral-900'
						: 'bg-white/10 text-neutral-300 hover:bg-white/20'}"
				>
					{s.label}
				</button>
			{/each}
		</div>

		<div class="hidden h-5 w-px bg-white/15 sm:block"></div>

		<!-- Freeze countdown toggle — hold the 30s auto-confirm mid-count -->
		<button
			type="button"
			onclick={() => onFreezeToggle(!freezeCountdown)}
			title="Hold the 30s auto-confirm countdown to inspect the treatment at a fixed value"
			class="rounded-md px-2.5 py-1 text-xs font-medium transition {freezeCountdown
				? 'bg-amber-300 text-neutral-900'
				: 'bg-white/10 text-amber-200/80 hover:bg-white/20'}"
		>
			freeze: {freezeCountdown ? 'On' : 'Off'}
		</button>
	</div>
{/if}
