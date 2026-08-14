<!--
	Prototype variant A — "Centered hero". THROWAWAY — do not fold into main.
	Single centered column (max-w-xl), generous vertical spacing. Timer is a big
	circular countdown ring (conic-gradient) with mm:ss in the centre; below it,
	pill-button controls. Tasks are a simple vertical card-stack with pip estimates
	and a star (primary-today) toggle. Timer logic is static/mock — this checks
	layout, not a live timer. Typography: Tailwind's default `font-sans` system stack.
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

	// A view of tasks with local overrides applied, so the in-focus label + list
	// reflect the toggles the user just clicked.
	const view = $derived(
		tasks.map((t) => ({
			...t,
			isPrimaryToday: isPrimary(t),
			archived: isArchived(t)
		}))
	);
	const focus = $derived(primaryTask(view));
</script>

<main class="mx-auto max-w-xl px-6 py-20">
	<p class="text-center text-xs tracking-[0.3em] text-[var(--ink-soft)] uppercase">Pomodoro</p>
	<h1
		class="mt-3 text-center text-4xl leading-relaxed font-semibold tracking-tight text-[var(--ink)]"
	>
		{meta.label}
	</h1>

	<!-- Timer hero -->
	<section class="relative mt-12 flex flex-col items-center">
		<div class="relative h-64 w-64">
			<div
				class="absolute inset-0 rounded-full"
				style={`background: conic-gradient(var(--accent) ${meta.ringPct}%, var(--surface-2) 0)`}
			></div>
			<div
				class="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-[var(--surface)] text-center"
			>
				<span class="text-6xl font-semibold tracking-tight text-[var(--ink)] tabular-nums">
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
				<p class="text-lg leading-relaxed font-medium text-[var(--ink)]">Take a 5-minute break?</p>
				<p class="mt-1 text-sm text-[var(--ink-soft)]">
					Auto-confirm in
					<span class="font-medium text-[var(--ink)] tabular-nums">
						{fmtAutoConfirm(autoConfirm)}
					</span>
				</p>
				<div class="mt-4 flex justify-center gap-3">
					<button
						type="button"
						class="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--surface)] transition hover:opacity-90"
					>
						Confirm break
					</button>
					<button
						type="button"
						class="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
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
						class="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-[var(--surface)] shadow-sm transition hover:opacity-90"
					>
						Start focus
					</button>
				{:else}
					<button
						type="button"
						class="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
					>
						Stop
					</button>
					<button
						type="button"
						class="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
					>
						Fast-forward → {isFocus ? 'break' : 'focus'}
					</button>
				{/if}
			</div>
		{/if}
	</section>

	<!-- Task list: vertical card-stack -->
	<section class="mt-16">
		<h2 class="mb-4 text-lg font-medium tracking-tight text-[var(--ink)]">Today's tasks</h2>
		<div class="flex flex-col gap-3">
			{#each view as task (task.id)}
				<div
					class="group relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 {isArchived(
						task
					)
						? 'opacity-60'
						: ''}"
				>
					<div class="flex items-center gap-3">
						<button
							type="button"
							onclick={() => togglePrimary(task)}
							aria-label="Toggle primary today"
							class="shrink-0 text-lg leading-none {isPrimary(task)
								? 'text-[var(--accent)]'
								: 'text-[var(--ink-soft)]'}"
						>
							{isPrimary(task) ? '★' : '☆'}
						</button>
						<div class="min-w-0 flex-1">
							<p class="truncate text-[var(--ink)]" class:line-through={task.done}>
								{task.title}
							</p>
							<p class="mt-1 flex items-center gap-2 text-sm text-[var(--ink-soft)] tabular-nums">
								<span class="tracking-tight">{pips(task.actuals, task.estimate)}</span>
								<span>{task.actuals}/{task.estimate}</span>
							</p>
						</div>
						<!-- Hover-revealed archive checkbox -->
						<label
							class="flex items-center gap-1.5 text-xs text-[var(--ink-soft)] opacity-0 transition group-hover:opacity-100"
						>
							<input
								type="checkbox"
								checked={isArchived(task)}
								onchange={() => toggleArchived(task)}
								class="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--accent)]"
							/>
							Archive
						</label>
					</div>
				</div>
			{/each}
			<!-- Inline ghost add-task row -->
			<button
				type="button"
				class="rounded-2xl border border-dashed border-[var(--border)] bg-transparent px-4 py-3 text-left text-[var(--ink-soft)] transition hover:bg-[var(--surface)]"
			>
				＋ Add task
			</button>
		</div>
	</section>
</main>
