<!--
	Prototype variant C — "Top banner / dense table". THROWAWAY — do not fold into main.
	A slim full-bleed sticky BANNER across the top: left = live countdown + tiny state
	label, centre = current task name inline, right = small Start/Stop controls; a thin
	accent rule below it. Below the banner: filter toggles (All/Today/Done/Archived),
	a full-width single-line "Add a task…" input at the top of the list, then a DENSE
	table-like list of task ROWS (not cards): flag, title, ●/○ pips, "act/est", done
	checkbox, hover archive. Maximum information density; the timer is minimised to a
	banner, not a centrepiece — the opposite register to A. Timer logic is static/mock.
	Typography: Tailwind's default `font-sans` system stack.
-->
<script lang="ts">
	import type { Task, TimerScene } from './demo.svelte.ts';
	import { fmtAutoConfirm, pips, primaryTask, sceneMeta } from './demo.svelte.ts';

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

	// Local display-only override records — never mutate the static demo data.
	const primary = $state<Record<string, boolean>>({});
	const archived = $state<Record<string, boolean>>({});
	const done = $state<Record<string, boolean>>({});

	function isPrimary(t: Task): boolean {
		return primary[t.id] ?? t.isPrimaryToday;
	}
	function isArchived(t: Task): boolean {
		return archived[t.id] ?? t.archived;
	}
	function isDone(t: Task): boolean {
		return done[t.id] ?? t.done;
	}
	function togglePrimary(t: Task): void {
		primary[t.id] = !isPrimary(t);
	}
	function toggleArchived(t: Task): void {
		archived[t.id] = !isArchived(t);
	}
	function toggleDone(t: Task): void {
		done[t.id] = !isDone(t);
	}

	const view = $derived(
		tasks.map((t) => ({
			...t,
			isPrimaryToday: isPrimary(t),
			archived: isArchived(t),
			done: isDone(t)
		}))
	);
	const focus = $derived(primaryTask(view));

	// Banner: left countdown + label (the transition state borrows the live 30s
	// auto-confirm countdown as the banner's left number).
	const bannerCountdown = $derived(isTransition ? fmtAutoConfirm(autoConfirm) : meta.countdown);
	const bannerLabel = $derived(isTransition ? 'Confirm?' : meta.label);

	// Filter toggles over the view.
	type Filter = 'All' | 'Today' | 'Done' | 'Archived';
	const filters: Filter[] = ['All', 'Today', 'Done', 'Archived'];
	let filter = $state<Filter>('All');
	const visible = $derived.by(() => {
		switch (filter) {
			case 'Today':
				return view.filter((t) => !t.archived && t.isPrimaryToday);
			case 'Done':
				return view.filter((t) => t.done);
			case 'Archived':
				return view.filter((t) => t.archived);
			default:
				return view;
		}
	});

	// Add-task draft (throwaway — never persisted).
	let draft = $state('');
</script>

<div class="min-h-screen">
	<!-- Sticky top banner -->
	<header class="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]">
		<div class="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2.5">
			<div class="flex items-baseline gap-2">
				<span class="text-2xl font-semibold text-[var(--ink)] tabular-nums">
					{bannerCountdown}
				</span>
				<span class="text-xs tracking-[0.2em] text-[var(--ink-soft)]">
					{bannerLabel.toUpperCase()}
				</span>
			</div>
			<div class="min-w-0 flex-1 truncate text-center text-sm text-[var(--ink-soft)]">
				{#if isTransition}
					Take a 5-minute break?
				{:else if isFocus && focus}
					Focusing: <span class="font-medium text-[var(--ink)]">{focus.title}</span>
				{:else}
					{meta.label}
				{/if}
			</div>
			<div class="flex items-center gap-2">
				{#if isIdle}
					<button
						type="button"
						class="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--surface)] transition hover:opacity-90"
					>
						Start
					</button>
				{:else if isTransition}
					<span class="text-xs text-[var(--ink-soft)] tabular-nums">
						{fmtAutoConfirm(autoConfirm)}
					</span>
					<button
						type="button"
						class="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--surface)] transition hover:opacity-90"
					>
						Confirm
					</button>
					<button
						type="button"
						class="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
					>
						Skip
					</button>
				{:else}
					<button
						type="button"
						class="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
					>
						Stop
					</button>
					<button
						type="button"
						class="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
					>
						FF → {isFocus ? 'break' : 'focus'}
					</button>
				{/if}
			</div>
		</div>
		<div class="h-0.5 bg-[var(--accent)]"></div>
	</header>

	<main class="mx-auto max-w-5xl px-4 py-4">
		<!-- Filter toggles -->
		<div class="mb-3 flex gap-1.5">
			{#each filters as f (f)}
				<button
					type="button"
					onclick={() => (filter = f)}
					class="rounded-md px-2.5 py-1 text-xs font-medium transition {filter === f
						? 'bg-[var(--ink)] text-[var(--surface)]'
						: 'border border-[var(--border)] text-[var(--ink-soft)] hover:bg-[var(--surface-2)]'}"
				>
					{f}
				</button>
			{/each}
		</div>

		<!-- Add-task input (full width, top of list) -->
		<input
			type="text"
			bind:value={draft}
			placeholder="Add a task…"
			class="mb-2 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:outline-none"
		/>

		<!-- Dense table-like rows -->
		<div class="border-t border-[var(--border)]">
			<!-- tiny header -->
			<div
				class="grid grid-cols-[1.5rem_1fr_6rem_3rem_1.5rem_1.5rem] items-center gap-2 border-b border-[var(--border)] px-1.5 py-1 text-[0.65rem] tracking-wider text-[var(--ink-soft)] uppercase"
			>
				<span class="text-center">★</span>
				<span>Task</span>
				<span>Progress</span>
				<span class="text-right">Act/Est</span>
				<span class="text-center">✓</span>
				<span class="text-center">🗑</span>
			</div>
			{#each visible as task (task.id)}
				<div
					class="group grid grid-cols-[1.5rem_1fr_6rem_3rem_1.5rem_1.5rem] items-center gap-2 border-b border-[var(--border)] px-1.5 py-1.5 text-sm text-[var(--ink)] {isArchived(
						task
					)
						? 'opacity-50'
						: ''} hover:bg-[var(--surface)]"
				>
					<button
						type="button"
						onclick={() => togglePrimary(task)}
						aria-label="Toggle primary today"
						class="text-center {isPrimary(task)
							? 'text-[var(--accent)]'
							: 'text-[var(--ink-soft)]'}"
					>
						{isPrimary(task) ? '★' : '☆'}
					</button>
					<span class="truncate" class:line-through={isDone(task)}>{task.title}</span>
					<span class="tracking-tight text-[var(--ink-soft)] tabular-nums">
						{pips(task.actuals, task.estimate, '●', '○')}
					</span>
					<span class="text-right text-[var(--ink-soft)] tabular-nums">
						{task.actuals}/{task.estimate}
					</span>
					<div class="flex justify-center">
						<input
							type="checkbox"
							checked={isDone(task)}
							onchange={() => toggleDone(task)}
							class="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--accent)]"
						/>
					</div>
					<button
						type="button"
						onclick={() => toggleArchived(task)}
						aria-label="Archive task"
						class="text-center text-[var(--ink-soft)] opacity-0 transition group-hover:opacity-100"
					>
						🗑
					</button>
				</div>
			{:else}
				<div class="px-2 py-3 text-sm text-[var(--ink-soft)]">No tasks match this filter.</div>
			{/each}
		</div>
	</main>
</div>
