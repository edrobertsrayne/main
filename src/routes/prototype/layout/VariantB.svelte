<!--
	Prototype variant B — "Side dock". THROWAWAY — do not fold into main.
	DESKTOP (md+): two-column grid — LEFT a persistent "dock" card (timer with a
	linear progress bar, a row of 4 cycle dots, square-button controls, a current-task
	chip); RIGHT task cards with a real progress bar, a radio "Today" pip, a per-card
	kebab menu revealing Archive, and a sticky "+ New task" button. MOBILE (<md):
	collapses to a single stacked column (dock on top, cards below). Tighter spacing
	than A; the timer is a side companion. Timer logic is static/mock. Typography:
	Tailwind's default `font-sans` system stack.
-->
<script lang="ts">
	import type { Task, TimerScene } from './demo.svelte.ts';
	import { fmtAutoConfirm, primaryTask, sceneMeta } from './demo.svelte.ts';

	interface Props {
		scene: TimerScene;
		tasks: Task[];
		autoConfirm?: number;
	}
	let { scene, tasks, autoConfirm = 30 }: Props = $props();

	const meta = $derived(sceneMeta[scene]);
	const isIdle = $derived(scene === 'idle');
	const isFocus = $derived(scene === 'focus-running');
	const isTransition = $derived(scene === 'transitioning');

	// Cycle counter == 1 (one focus recorded): one filled dot of four.
	const cycleDots = $derived([true, false, false, false]);

	// Local display-only override records — never mutate the static demo data.
	const primary = $state<Record<string, boolean>>({});
	const archived = $state<Record<string, boolean>>({});

	function isPrimary(t: Task): boolean {
		return primary[t.id] ?? t.isPrimaryToday;
	}
	function isArchived(t: Task): boolean {
		return archived[t.id] ?? t.archived;
	}
	function togglePrimary(t: Task): void {
		primary[t.id] = !isPrimary(t);
	}
	function toggleArchived(t: Task): void {
		archived[t.id] = !isArchived(t);
	}

	const view = $derived(
		tasks.map((t) => ({
			...t,
			isPrimaryToday: isPrimary(t),
			archived: isArchived(t)
		}))
	);
	const focus = $derived(primaryTask(view));

	function progress(t: Task): number {
		return Math.min(100, Math.round((t.actuals / (t.estimate || 1)) * 100));
	}
</script>

<div
	class="mx-auto max-w-6xl px-4 py-8 md:grid md:grid-cols-[20rem_minmax(0,1fr)] md:items-start md:gap-6"
>
	<!-- LEFT: the dock -->
	<aside class="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
		<div class="flex items-center justify-between">
			<span class="text-xs tracking-[0.2em] text-[var(--ink-soft)] uppercase">{meta.label}</span>
			<span class="text-xs text-[var(--ink-soft)] tabular-nums">Pomodoro</span>
		</div>
		<div class="mt-2 text-4xl font-semibold text-[var(--ink)] tabular-nums">
			{meta.countdown}
		</div>
		<!-- Linear progress bar (no ring) -->
		<div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
			<div class="h-full rounded-full bg-[var(--accent)]" style={`width: ${meta.ringPct}%`}></div>
		</div>
		<!-- 4 cycle dots, one filled (counter == 1) -->
		<div class="mt-4 flex gap-1.5">
			{#each cycleDots as filled, i (i)}
				<span
					class="h-2.5 w-2.5 rounded-full {filled ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)]'}"
				></span>
			{/each}
		</div>

		{#if isTransition}
			<!-- Inline transition banner (B's structural treatment) -->
			<div class="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm">
				<p class="font-medium text-[var(--ink)]">Take a 5-minute break?</p>
				<p class="mt-0.5 text-[var(--ink-soft)]">
					Auto-confirm in
					<span class="font-medium text-[var(--ink)] tabular-nums">
						{fmtAutoConfirm(autoConfirm)}
					</span>
				</p>
			</div>
		{:else if focus}
			<!-- Current task chip -->
			<div
				class="mt-4 truncate rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--ink)]"
			>
				<span class="text-[var(--ink-soft)]">Current:</span>
				{focus.title}
			</div>
		{:else}
			<div
				class="mt-4 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--ink-soft)]"
			>
				No task selected
			</div>
		{/if}

		<!-- Square-button controls -->
		<div class="mt-4 flex gap-2">
			{#if isIdle}
				<button
					type="button"
					aria-label="Start focus"
					class="grid h-11 w-11 place-items-center rounded-lg bg-[var(--accent)] text-[var(--surface)] transition hover:opacity-90"
				>
					▶
				</button>
			{:else if isTransition}
				<button
					type="button"
					aria-label="Confirm break"
					class="grid h-11 w-11 place-items-center rounded-lg bg-[var(--accent)] text-[var(--surface)] transition hover:opacity-90"
				>
					✓
				</button>
				<button
					type="button"
					aria-label="Skip break"
					class="grid h-11 w-11 place-items-center rounded-lg border border-[var(--border)] text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
				>
					✕
				</button>
			{:else}
				<button
					type="button"
					aria-label="Stop"
					class="grid h-11 w-11 place-items-center rounded-lg border border-[var(--border)] text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
				>
					■
				</button>
				<button
					type="button"
					aria-label="Fast-forward"
					class="grid h-11 w-11 place-items-center rounded-lg border border-[var(--border)] text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
				>
					⤳
				</button>
				<span class="grid h-11 place-items-center px-1 text-xs text-[var(--ink-soft)]">
					{#if isFocus}to break{:else}to focus{/if}
				</span>
			{/if}
		</div>
	</aside>

	<!-- RIGHT: task cards -->
	<section class="mt-6 md:mt-0">
		<h2 class="mb-3 text-sm font-semibold tracking-[0.15em] text-[var(--ink-soft)] uppercase">
			Task list
		</h2>
		<div class="flex flex-col gap-3">
			{#each view as task (task.id)}
				<div
					class="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 {isArchived(task)
						? 'opacity-60'
						: ''}"
				>
					<div class="flex items-start gap-3">
						<!-- Radio "Today" pip (primary) -->
						<button
							type="button"
							role="radio"
							aria-checked={isPrimary(task)}
							aria-label="Mark primary today"
							onclick={() => togglePrimary(task)}
							class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border {isPrimary(
								task
							)
								? 'border-[var(--accent)] bg-[var(--accent)]'
								: 'border-[var(--border)]'}"
						>
							{#if isPrimary(task)}
								<span class="h-2 w-2 rounded-full bg-[var(--surface)]"></span>
							{/if}
						</button>
						<div class="min-w-0 flex-1">
							<div class="flex items-start justify-between gap-2">
								<p class="truncate text-[var(--ink)]" class:line-through={task.done}>
									{task.title}
								</p>
								<!-- Kebab menu revealing Archive -->
								<details class="relative">
									<summary
										class="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-md text-[var(--ink-soft)] transition hover:bg-[var(--surface-2)] [&::-webkit-details-marker]:hidden"
									>
										⋯
									</summary>
									<div
										class="absolute right-0 z-10 mt-1 w-32 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg"
									>
										<button
											type="button"
											onclick={() => toggleArchived(task)}
											class="block w-full rounded-md px-2 py-1.5 text-left text-sm text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
										>
											{isArchived(task) ? 'Unarchive' : 'Archive'}
										</button>
									</div>
								</details>
							</div>
							<div class="mt-3 flex items-center gap-2">
								<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
									<div
										class="h-full rounded-full bg-[var(--accent)]"
										style={`width: ${progress(task)}%`}
									></div>
								</div>
								<span class="text-xs text-[var(--ink-soft)] tabular-nums">
									{task.actuals}/{task.estimate}
								</span>
							</div>
						</div>
					</div>
				</div>
			{/each}

			<!-- Sticky "+ New task" button -->
			<div class="sticky bottom-4 mt-1">
				<button
					type="button"
					class="w-full rounded-2xl bg-[var(--accent)] py-2.5 text-center text-sm font-medium text-[var(--surface)] shadow-sm transition hover:opacity-90"
				>
					+ New task
				</button>
			</div>
		</div>
	</section>
</div>
