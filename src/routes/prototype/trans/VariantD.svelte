<!--
	VariantD — "Full-hero takeover, stacked".
	THROWAWAY prototype variant for #16. Structural position on the open axes:
	  • POSITION    — an absolute inset-0 soft wash (frosted `--surface` over the
	    ring) DOMINATES the hero. The static ring is obscured behind the wash.
	    Stacked centered prompt inside.
	  • COUNTDOWN   — a big NUMBER readout ("0:28") with a THIN progress BAR
	    under it — combining the number + bar treatments (the "number + bar"
	    pole of the countdown-shape axis).
	  • CONTROLS    — STACKED centered: primary "Take a break" on top, an
	    explicit "Skip — back to idle" beneath it (the maximal, most hand-holding
	    control treatment).
	  • COPY        — warm declarative, ADR-family: "You've earned a 5-minute
	    break." / "You've earned a 20-minute long break." Subtext
	    "Auto-confirming shortly."

	Renders ON #15's sage break palette (the wash + accents auto-theme to sage).
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

	const total = 30;
	const pct = $derived((autoConfirm / total) * 100);
	const upcoming = $derived(breakMeta[breakType]);
	const heading = $derived(
		breakType === 'long'
			? 'You\u2019ve earned a 20-minute long break.'
			: 'You\u2019ve earned a 5-minute break.'
	);

	const stateClasses =
		'focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2 active:bg-[var(--active)]';
</script>

<!-- Absolute takeover over the hero container (ring-height during
     transitioning). The frosted wash obscures the static ring behind it. -->
<div
	class="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl text-center"
	style="background-color: color-mix(in srgb, var(--surface) 78%, transparent); backdrop-filter: blur(2px)"
>
	{#if breakType === 'long'}
		<p class="text-[0.65rem] font-semibold tracking-[0.25em] text-[var(--ink-soft)] uppercase">
			{upcoming.label}
		</p>
	{/if}
	<p class="ff-heading text-lg font-semibold tracking-tight text-[var(--ink)]">{heading}</p>

	<!-- Big number readout + a thin progress bar under it -->
	<span class="ff-display mt-3 text-5xl font-bold tracking-tight text-[var(--ink)] tabular-nums">
		{fmtAutoConfirm(autoConfirm)}
	</span>
	<div class="mt-1.5 h-1 w-40 overflow-hidden rounded-full bg-[var(--surface-2)]">
		<div
			class="h-full rounded-full bg-[var(--accent)]"
			style={`width: ${pct}%; transition: width 1s linear`}
		></div>
	</div>
	<p class="mt-1.5 text-xs text-[var(--ink-soft)]">Auto-confirming shortly</p>

	<!-- Stacked controls: primary + explicit skip -->
	<div class="mt-3 flex flex-col items-center gap-1.5">
		<button
			type="button"
			onclick={onConfirm}
			class="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-[var(--surface)] shadow-sm transition hover:opacity-90 {stateClasses}"
		>
			Take a break
		</button>
		<button
			type="button"
			onclick={onSkip}
			class="text-xs text-[var(--ink-soft)] underline underline-offset-2 transition hover:text-[var(--ink)]"
		>
			Skip — back to idle
		</button>
	</div>
</div>
