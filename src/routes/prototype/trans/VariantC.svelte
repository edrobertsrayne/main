<!--
	VariantC — "Action strip below + big number readout".
	THROWAWAY prototype variant for #16. Structural position on the open axes:
	  • POSITION    — an in-flow action strip BELOW the static 0:00 ring. The
	    static ring is left visible as "the focus just ended" context; the prompt
	    chrome moves OUT from over the ring into the space below it. No overlay.
	  • COUNTDOWN   — a prominent tabular NUMBER ("0:28") in the strip's left
	    cell. No bar, no ring animation — the number just ticks (the "number"
	    answer to "ring? number? progress bar?").
	  • CONTROLS    — single-emphasis: one primary "Take a break" button + a
	    quiet "skip" text-link beneath it. Skip is de-emphasised.
	  • COPY        — question register, ADR-faithful: "Take a 5-minute break?" /
	    "Take a 20-minute long break?" (with a "Long break" eyebrow for long).

	Renders ON #15's sage break palette. The strip's --surface / --accent
	auto-theme to sage here.
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

	const upcoming = $derived(breakMeta[breakType]);
	const heading = $derived(
		breakType === 'long' ? 'Take a 20-minute long break?' : 'Take a 5-minute break?'
	);

	const stateClasses =
		'focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2 active:bg-[var(--active)]';
</script>

<!--
	In-flow strip card below the static ring (the hero is flex-col items-center,
	so this div stacks after the ring and centres horizontally). The static 0:00
	ring above stays visible as context — this variant intentionally does not
	cover it.
-->
<div
	class="mt-6 w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-sm"
>
	<div class="flex items-center gap-5">
		<!-- Big number countdown readout -->
		<span
			class="ff-display text-3xl font-bold tracking-tight text-[var(--ink)] tabular-nums"
			aria-label="Auto-confirm countdown"
		>
			{fmtAutoConfirm(autoConfirm)}
		</span>

		<!-- Heading + auto-confirm caption -->
		<div class="flex-1 text-left">
			{#if breakType === 'long'}
				<p class="text-[0.65rem] font-semibold tracking-[0.25em] text-[var(--ink-soft)] uppercase">
					{upcoming.label}
				</p>
			{/if}
			<p class="ff-heading text-base font-semibold tracking-tight text-[var(--ink)]">
				{heading}
			</p>
			<p class="mt-0.5 text-xs text-[var(--ink-soft)]">Auto-confirms unless you skip</p>
		</div>

		<!-- Single-emphasis actions -->
		<div class="flex flex-col items-center gap-1.5">
			<button
				type="button"
				onclick={onConfirm}
				class="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--surface)] transition hover:opacity-90 {stateClasses}"
			>
				Take a break
			</button>
			<button
				type="button"
				onclick={onSkip}
				class="text-xs text-[var(--ink-soft)] underline underline-offset-2 transition hover:text-[var(--ink)]"
			>
				skip
			</button>
		</div>
	</div>
</div>
