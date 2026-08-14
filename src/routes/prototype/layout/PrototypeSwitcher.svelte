<!--
	Prototype switcher — floating bottom-centre bar. THROWAWAY — do not fold into main.
	Visually distinct from the design (high-contrast dark pill) so it's obviously not
	part of what's being evaluated. Cycles the layout variant (A/B/C), switches the
	warm-pastel palette (1..4), and flips the timer FSM scene so every variant can be
	seen in every state. ArrowLeft/ArrowRight cycle variants (but not when an input,
	textarea, or [contenteditable] is focused). A small fixed "PROTOTYPE — throwaway"
	badge sits in a corner. Typography: Tailwind's default `font-sans` system stack.
-->
<script lang="ts">
	import type { TimerScene, Variant } from './demo.svelte.ts';

	interface Props {
		variant: Variant;
		palette: number;
		scene: TimerScene;
		onVariant: (v: Variant) => void;
		onPalette: (n: number) => void;
		onScene: (s: TimerScene) => void;
	}
	let { variant, palette, scene, onVariant, onPalette, onScene }: Props = $props();

	const variantMeta: { id: Variant; label: string }[] = [
		{ id: 'A', label: 'Centered hero' },
		{ id: 'B', label: 'Side dock' },
		{ id: 'C', label: 'Top banner' }
	];

	// Swatch colours mirror each palette's --accent token (see +page.svelte).
	const paletteSwatches: { id: number; color: string }[] = [
		{ id: 1, color: '#cf7138' }, // Sand
		{ id: 2, color: '#d06a86' }, // Blush
		{ id: 3, color: '#5f8a4a' }, // Sage
		{ id: 4, color: '#7b6dc4' } // Lavender
	];

	const sceneTabs: { id: TimerScene; label: string }[] = [
		{ id: 'idle', label: 'Idle' },
		{ id: 'focus-running', label: 'Focus' },
		{ id: 'transitioning', label: 'Trans' },
		{ id: 'break-running', label: 'Brk' },
		{ id: 'long-break-running', label: 'LBrk' }
	];

	const currentLabel = $derived(variantMeta.find((v) => v.id === variant)?.label ?? '');

	function step(dir: 1 | -1): void {
		const idx = variantMeta.findIndex((v) => v.id === variant);
		const next = (idx + dir + variantMeta.length) % variantMeta.length;
		onVariant(variantMeta[next].id);
	}

	function onKey(e: KeyboardEvent): void {
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
	<!-- Variant arrows + label -->
	<div class="flex items-center gap-1.5">
		<button
			type="button"
			onclick={() => step(-1)}
			aria-label="Previous variant"
			class="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-sm transition hover:bg-white/20"
		>
			◀
		</button>
		<span class="min-w-[7rem] text-center text-xs font-medium">
			{variant} — {currentLabel}
		</span>
		<button
			type="button"
			onclick={() => step(1)}
			aria-label="Next variant"
			class="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-sm transition hover:bg-white/20"
		>
			▶
		</button>
	</div>

	<div class="hidden h-5 w-px bg-white/15 sm:block"></div>

	<!-- Palette swatches -->
	<div class="flex items-center gap-1.5">
		{#each paletteSwatches as p (p.id)}
			<button
				type="button"
				onclick={() => onPalette(p.id)}
				aria-label="Palette {p.id}"
				class="h-5 w-5 rounded-full ring-2 ring-offset-2 ring-offset-neutral-900 transition {p.id ===
				palette
					? 'ring-white'
					: 'ring-white/10'}"
				style={`background: ${p.color}`}
			></button>
		{/each}
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
					: 'bg-white/10 text-neutral-300 transition hover:bg-white/20'}"
			>
				{s.label}
			</button>
		{/each}
	</div>
</div>
