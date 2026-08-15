<!--
	Flash switcher — floating bottom-centre dark-pill bar. THROWAWAY — do not
	fold into main. Mirrors the palette prototype's PaletteSwitcher visual
	register (same bg-neutral-900 / ring-1 ring-white/10 / rounded-full /
	shadow-xl pill) but drives the held-palette-swap prototype's controls,
	left-to-right:
	  1) Variant pills (A/B/C) — click sets ?variant= (reload-stable & shareable).
	     Each variant is a SCOPE of palette swap at session-end, not a kind of
	     animation:
	       A = only --bg swaps (subtle, edges only)
	       B = --bg + --surface swap (surfaces acknowledge the phase change)
	       C = full palette swap (whole page becomes a different "room")
	  2) Two phase buttons — ▶ Set focus (warm coral text, mimics break-end →
	     return to coral) / ▶ Set break (softer text, mimics focus-end → swap to
	     the break palette). Held palette swap, NOT a transient flash: phase is
	     the signal.
	  3) Scene tabs (Idle/Focus/Trans/Brk/LBrk) — drive the locked composition's
	     scene local $state so the human also sees the palette swap fire
	     automatically on the Focus→Trans (focus-end) and Brk/LBrk→Idle
	     (break-end) edges, exactly where #6 fires its notification.
	  4) "Instant swap" toggle — sets data-rm="force" on the page root so the
	     200ms cross-fade transition is zeroed out (palette swaps happen with no
	     transition). Demos the no-cross-fade signal strength vs the soft
	     200ms fade. Note: #6's reduced-motion contract is implicitly satisfied
	     for this design — there is no motion to reduce with a held palette
	     swap — so this toggle is a UX choice, not an accommodation override.
	No arrow-key cycling (the palette switcher already claims ←/→ for the lang
	param; don't clash). Per-click only. Gated entirely in {#if dev} so the bar
	+ badge never ship to production builds.
-->
<script lang="ts">
	import { dev } from '$app/environment';
	import type { FlashVariant, Phase, TimerScene } from './demo.svelte.ts';

	interface Props {
		variant: FlashVariant;
		scene: TimerScene;
		phase: Phase;
		instant: boolean;
		onVariant: (v: FlashVariant) => void;
		onScene: (s: TimerScene) => void;
		onPhase: (p: Phase) => void;
		onInstantToggle: (b: boolean) => void;
	}
	let {
		variant,
		scene,
		phase,
		instant,
		onVariant,
		onScene,
		onPhase,
		onInstantToggle
	}: Props = $props();

	const variantPills: { id: FlashVariant; label: string }[] = [
		{ id: 'A', label: 'A — BG only' },
		{ id: 'B', label: 'B — BG + surfaces' },
		{ id: 'C', label: 'C — Full palette swap' }
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
		<!-- Variant pills -->
		<div class="flex items-center gap-0.5">
			{#each variantPills as p (p.id)}
				<button
					type="button"
					onclick={() => onVariant(p.id)}
					class="rounded-md px-2.5 py-1 text-xs font-medium transition {p.id === variant
						? 'bg-white text-neutral-900'
						: 'bg-white/10 text-neutral-300 hover:bg-white/20'}"
				>
					{p.label}
				</button>
			{/each}
		</div>

		<div class="hidden h-5 w-px bg-white/15 sm:block"></div>

		<!-- Phase buttons — held palette swap, not a transient flash -->
		<div class="flex items-center gap-1">
			<button
				type="button"
				onclick={() => onPhase('focus')}
				title="Hold the focus-phase palette (coral). Mimics break-end: the page returns to coral and stays."
				class="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-[var(--accent)] transition hover:bg-white/20 {phase ===
				'focus'
					? 'ring-1 ring-[var(--accent)]/60'
					: ''}"
			>
				▶ Set focus
			</button>
			<button
				type="button"
				onclick={() => onPhase('break')}
				title="Hold the break-phase palette (muted sage-cream). Mimics focus-end: the page swaps to the break palette and stays."
				class="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-[var(--accent-2)] transition hover:bg-white/20 {phase ===
				'break'
					? 'ring-1 ring-[var(--accent-2)]/60'
					: ''}"
			>
				▶ Set break
			</button>
		</div>

		<div class="hidden h-5 w-px bg-white/15 sm:block"></div>

		<!-- Scene tabs -->
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

		<div class="hidden h-5 w-px bg-white/15 sm:block"></div>

		<!-- Instant-swap toggle — zeros the 200ms cross-fade -->
		<button
			type="button"
			onclick={() => onInstantToggle(!instant)}
			title="Toggle to make palette swaps instant (0ms transition) — demos the no-cross-fade signal strength vs the 200ms soft fade. #6's reduced-motion contract is implicitly satisfied for this design (no motion to reduce), so this is a UX choice, not an accommodation override."
			class="rounded-md px-2.5 py-1 text-xs font-medium transition {instant
				? 'bg-amber-300 text-neutral-900'
				: 'bg-white/10 text-amber-200/80 hover:bg-white/20'}"
		>
			instant swap: {instant ? 'On' : 'Off'}
		</button>
	</div>
{/if}