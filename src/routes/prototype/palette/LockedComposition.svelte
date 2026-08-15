<!--
	Locked composition for the palette/typography prototype. THROWAWAY — do not
	fold into main. Answers question #14 (palette + typography): it composes the
	LOCKED layout decided in ticket #7 — VariantA's centered-hero timer SECTION
	on top, VariantC's dense task TABLE below — and applies the three candidate
	design languages (honey / editorial / deskclock) via ?lang=. Those themes
	live in +page.svelte (CSS custom properties + Google Fonts); this component
	reads them through Tailwind arbitrary values like bg-[var(--surface)] and the
	ff-display / ff-heading helper classes. State-color wiring — hover / active
	(focus-ring) / error / success — is demonstrated on real interactive states.
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

	// Local display-only override records. Empty at init (no prop read), so they
	// never mutate the static demo data and never trigger state_referenced_locally.
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

	// A view of tasks with local overrides applied, so the in-focus label + list
	// reflect the toggles the user just clicked.
	const view = $derived(
		tasks.map((t) => ({
			...t,
			isPrimaryToday: isPrimary(t),
			archived: isArchived(t),
			done: isDone(t)
		}))
	);
	const focus = $derived(primaryTask(view));

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

	// Shared interactive-state token classes for every control. focus-visible
	// (not focus) so the ring only appears for keyboard users; active gives the
	// press state. Hover remains per-element via hover:bg-[var(--surface-2)].
	const stateClasses =
		'focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2 active:bg-[var(--active)]';
</script>

<main class="mx-auto max-w-5xl px-6 py-16">
	<!-- Hero section — centered timer ring + pill controls (VariantA's centrepiece) -->
	<section class="text-center">
		<p class="text-center text-xs tracking-[0.3em] text-[var(--ink-soft)] uppercase">Pomodoro</p>
		<h1 class="ff-heading mt-3 text-center text-4xl font-semibold tracking-tight text-[var(--ink)]">
			{meta.label}
		</h1>

		<!-- Timer hero -->
		<div class="relative mt-12 flex flex-col items-center">
			<div class="relative h-64 w-64">
				<div
					class="absolute inset-0 rounded-full"
					style={`background: conic-gradient(var(--accent) ${meta.ringPct}%, var(--surface-2) 0)`}
				></div>
				<div
					class="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-[var(--surface)] text-center"
				>
					<span class="ff-display text-7xl font-bold tracking-tight text-[var(--ink)] tabular-nums">
						{meta.countdown}
					</span>
					<span class="mt-1 text-sm text-[var(--ink-soft)]">{meta.label}</span>
				</div>
			</div>

			{#if isTransition}
				<!-- Modal-ish overlay card over the hero ring: the transitioning prompt. -->
				<div
					class="absolute top-1/2 left-1/2 z-10 w-72 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-lg"
				>
					<p class="ff-heading prompt-line text-lg font-semibold text-[var(--ink)]">
						Take a 5-minute break?
					</p>
					<p class="mt-1 text-sm text-[var(--ink-soft)]">
						Auto-confirm in
						<span class="font-medium text-[var(--ink)] tabular-nums">
							{fmtAutoConfirm(autoConfirm)}
						</span>
					</p>
					<div class="mt-4 flex justify-center gap-3">
						<button
							type="button"
							class="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--surface)] transition hover:opacity-90 {stateClasses}"
						>
							Confirm break
						</button>
						<button
							type="button"
							class="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface-2)] {stateClasses}"
						>
							Skip
						</button>
					</div>
				</div>
				<p class="invisible mt-6 min-h-5" aria-hidden="true">placeholder</p>
			{:else}
				<p class="mt-6 min-h-5 text-center text-[var(--ink-soft)]">
					{#if isIdle}
						Pick a task — start focus
					{:else if isFocus && focus}
						Focusing on <span class="font-medium text-[var(--ink)]">{focus.title}</span>
					{:else}
						On break — pick your next focus
					{/if}
				</p>

				<!-- Controls as pill buttons -->
				<div class="mt-4 flex flex-wrap items-center justify-center gap-3">
					{#if isIdle}
						<button
							type="button"
							class="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-[var(--surface)] shadow-sm transition hover:opacity-90 {stateClasses}"
						>
							Start focus
						</button>
					{:else}
						<button
							type="button"
							class="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface-2)] {stateClasses}"
						>
							Stop
						</button>
						<button
							type="button"
							class="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface-2)] {stateClasses}"
						>
							Fast-forward → {isFocus ? 'break' : 'focus'}
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	<!-- Task table section — dense table (VariantC) -->
	<section class="mt-16">
		<h2 class="ff-heading mb-4 text-lg font-semibold tracking-tight text-[var(--ink)]">
			Today's tasks
		</h2>

		<!-- Filter toggles -->
		<div class="mb-3 flex gap-1.5">
			{#each filters as f (f)}
				<button
					type="button"
					onclick={() => (filter = f)}
					class="rounded-md px-2.5 py-1 text-xs font-medium transition {filter === f
						? 'bg-[var(--ink)] text-[var(--surface)]'
						: 'border border-[var(--border)] text-[var(--ink-soft)] hover:bg-[var(--surface-2)]'} {stateClasses}"
				>
					{f}
				</button>
			{/each}
		</div>

		<!-- Add-task input (full width, top of list) — focus-ring demo -->
		<input
			type="text"
			bind:value={draft}
			placeholder="Add a task…"
			class="mb-2 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
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
						: ''} hover:bg-[var(--surface-2)]"
				>
					<button
						type="button"
						onclick={() => togglePrimary(task)}
						aria-label="Toggle primary today"
						class="text-center {isPrimary(task)
							? 'text-[var(--accent)]'
							: 'text-[var(--ink-soft)]'} {stateClasses}"
					>
						{isPrimary(task) ? '★' : '☆'}
					</button>
					<span
						class="truncate {isDone(task) ? 'text-[var(--ink-soft)]' : 'text-[var(--ink)]'}"
						class:line-through={isDone(task)}
					>
						{task.title}
					</span>
					<span class="tracking-tight text-[var(--ink-soft)] tabular-nums">
						{pips(task.actuals, task.estimate, '●', '○')}
					</span>
					<span
						class="text-right tabular-nums {task.actuals > task.estimate
							? 'font-medium text-[var(--error)]'
							: 'text-[var(--ink-soft)]'}"
					>
						{task.actuals}/{task.estimate}
					</span>
					<div class="flex justify-center">
						<input
							type="checkbox"
							checked={isDone(task)}
							onchange={() => toggleDone(task)}
							class="h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--success)]"
						/>
					</div>
					<button
						type="button"
						onclick={() => toggleArchived(task)}
						aria-label="Archive task"
						class="text-center text-[var(--ink-soft)] opacity-0 transition group-hover:opacity-100 {stateClasses}"
					>
						🗑
					</button>
				</div>
			{:else}
				<div class="px-2 py-3 text-sm text-[var(--ink-soft)]">No tasks match this filter.</div>
			{/each}
		</div>
	</section>
</main>
