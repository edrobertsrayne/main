<!--
	VariantA — "Centered card + depleting progress bar".
	THROWAWAY prototype variant for #16. Structural position on the open axes:
	  • POSITION    — centered overlay card over the hero ring (the ring stays
	    faintly visible behind the card's surface bg). Closest to the flash
	    prototype's placeholder prompt, refined.
	  • COUNTDOWN   — a thin horizontal progress BAR that depletes 30s → 0s
	    (width = autoConfirm/30 * 100%), plus an "Auto-confirm in 0:28" caption.
	  • CONTROLS    — side-by-side: ghost "Skip" (left) + primary "Confirm" (right).
	  • COPY        — question register, ADR-faithful: "Take a 5-minute break?" /
	    "Take a 20-minute long break?"; long break gets a small "Long break" eyebrow.

	Renders ON #15's sage break palette (the page is already in `data-phase=break`
	during transitioning), so --accent / --surface auto-theme to sage here.
-->
<script lang="ts">
	import type { BreakType } from './demo.svelte.ts';
	import { breakMeta, fmtAutoConfirm } from './demo.svelte.ts';

	interface Props {
		autoConfirm: number;
		breakType: BreakType;
		onConfirm: () => void;
		onSkip: () => void;
	}
	let { autoConfirm, breakType, onConfirm, onSkip }: Props = $props();

	// ADR 0001: the auto-confirm window is 30s. The bar depletes from full → empty.
	const total = 30;
	const pct = $derived((autoConfirm / total) * 100);
	const upcoming = $derived(breakMeta[breakType]);
	const heading = $derived(
		breakType === 'long' ? 'Take a 20-minute long break?' : 'Take a 5-minute break?'
	);

	const stateClasses =
		'focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2 active:bg-[var(--active)]';
</script>

<!-- Center on the hero container (ring-only height during transitioning) -->
<div
	class="absolute top-1/2 left-1/2 z-10 w-72 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-lg"
>
	{#if breakType === 'long'}
		<p class="text-[0.65rem] font-semibold tracking-[0.25em] text-[var(--ink-soft)] uppercase">
			{upcoming.label}
		</p>
	{/if}
	<p class="ff-heading text-lg font-semibold tracking-tight text-[var(--ink)]">{heading}</p>

	<!-- Depleting progress bar — width tracks the remaining countdown. -->
	<div class="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
		<div
			class="h-full rounded-full bg-[var(--accent)]"
			style={`width: ${pct}%; transition: width 1s linear`}
		></div>
	</div>

	<p class="mt-2 text-xs text-[var(--ink-soft)]">
		Auto-confirm in
		<span class="font-medium text-[var(--ink)] tabular-nums">
			{fmtAutoConfirm(autoConfirm)}
		</span>
	</p>

	<div class="mt-4 flex justify-center gap-3">
		<button
			type="button"
			onclick={onSkip}
			class="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface-2)] {stateClasses}"
		>
			Skip
		</button>
		<button
			type="button"
			onclick={onConfirm}
			class="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--surface)] transition hover:opacity-90 {stateClasses}"
		>
			Confirm
		</button>
	</div>
</div>
