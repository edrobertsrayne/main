<!--
	VariantB — "Ring becomes the countdown".
	THROWAWAY prototype variant for #16. Structural position on the open axes:
	  • POSITION    — no separate card. A 30s countdown ring is ABSOLUTELY overlaid
	    on top of the static 0:00 focus ring (same h-64 w-64 → visually replaces
	    it). Its centre previews the UPCOMING break's duration ("5:00" / "20:00").
	    The heading + inline controls sit in a strip BELOW the ring (in-flow).
	  • COUNTDOWN   — the conic-gradient ring itself depletes 100% → 0%. The ring
	    IS the countdown (the "ring" answer to "ring? number? progress bar?").
	  • CONTROLS    — inline strip below the ring: ghost "Skip" + primary "Start
	    break", side-by-side pills.
	  • COPY        — statement register, ADR-family: "Time for a 5-minute
	    break." / "Time for a 20-minute long break." Caption "Starts automatically
	    in 0:28".

	Renders ON #15's sage break palette (page is in `data-phase=break` during
	transitioning), so --accent / --surface auto-theme to sage.
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

	// ADR 0001: the auto-confirm window is 30s. The conic ring depletes full → empty.
	const total = 30;
	const pct = $derived((autoConfirm / total) * 100);
	const upcoming = $derived(breakMeta[breakType]);
	const heading = $derived(
		breakType === 'long' ? 'Time for a 20-minute long break.' : 'Time for a 5-minute break.'
	);

	const stateClasses =
		'focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2 active:bg-[var(--active)]';
</script>

<!--
	Countdown ring overlay — `absolute` over the hero container's static ring
	(same h-64 w-64 at top-0) so the focus ring visually becomes the 30s
	countdown. z-10 keeps it above the locked composition's static ring.
-->
<div
	class="absolute top-0 left-1/2 z-10 h-64 w-64 -translate-x-1/2"
	aria-label="Auto-confirm countdown"
>
	<div
		class="absolute inset-0 rounded-full"
		style={`background: conic-gradient(var(--accent) ${pct}%, var(--surface-2) 0)`}
	></div>
	<div
		class="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-[var(--surface)] text-center"
	>
		<span class="ff-display text-7xl font-bold tracking-tight text-[var(--ink)] tabular-nums">
			{upcoming.duration}
		</span>
		<span class="mt-1 text-sm text-[var(--ink-soft)]">break</span>
	</div>
</div>

<!-- In-flow strip below the ring (the hero is flex-col items-center, so a plain
     div centres horizontally and stacks after the static ring). -->
<div class="mt-6 text-center">
	<p class="ff-heading text-lg font-semibold tracking-tight text-[var(--ink)]">{heading}</p>
	<p class="mt-1 text-xs text-[var(--ink-soft)]">
		Starts automatically in
		<span class="font-medium text-[var(--ink)] tabular-nums">
			{fmtAutoConfirm(autoConfirm)}
		</span>
	</p>
	<div class="mt-3 flex items-center justify-center gap-2.5">
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
			Start break
		</button>
	</div>
</div>
