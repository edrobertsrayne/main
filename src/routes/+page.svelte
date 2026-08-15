<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { TimerController } from '$lib/timer/timer-controller.svelte';

	type TaskRow = {
		id: string;
		title: string;
		estimate: number;
		done: boolean;
		archived: boolean;
		archivedAt: number | null;
		createdAt: number;
		actuals: number;
	};

	let { data } = $props();

	type Filter = 'all' | 'today' | 'done' | 'archived';
	let filter = $state<Filter | null>(null);

	const timer = new TimerController({
		onFocusEnd: async (input) => {
			const fd = new FormData();
			fd.set('task_id', input.taskId);
			fd.set('started_at', String(input.startedAt));
			fd.set('stopped_at', String(input.stoppedAt));
			fd.set('duration_seconds', String(input.durationSeconds));
			fd.set('end_cause', input.endCause);
			fd.set('time_zone', Intl.DateTimeFormat().resolvedOptions().timeZone);
			try {
				await fetch('?/recordFocus', { method: 'POST', body: fd });
				await invalidate(() => true);
			} catch {
				// best-effort: the row will be missing, but the cycle continues
			}
		}
	});

	// Palette phase drives the held palette swap. focus = coral; everything
	// post-focus-end (transitioning, break-running, long-break-running) =
	// sage. The CSS rules in layout.css read [data-phase] to swap --bg,
	// --surface, --accent, --ink. Content-semantic tokens (--error,
	// --error-bg, --success) stay coral on both phases by design.
	const dataPhase = $derived(
		timer.state === 'idle' || timer.state === 'focus-running' ? 'focus' : 'break'
	);

	const firstNonArchivedTask = $derived(data.tasks.find((t) => !t.archived) ?? null);
	const focusedTask = $derived(
		timer.taskId ? (data.tasks.find((t) => t.id === timer.taskId) ?? null) : null
	);
	const focusPercent = $derived.by(() => {
		void timer.nowTick;
		if (timer.totalMs <= 0) return 0;
		const elapsed = timer.totalMs - timer.remainingMs;
		return Math.min(100, Math.max(0, (elapsed / timer.totalMs) * 100));
	});
	const timeText = $derived.by(() => {
		void timer.nowTick;
		const ms = Math.max(0, timer.remainingMs);
		const totalSec = Math.ceil(ms / 1000);
		const m = Math.floor(totalSec / 60);
		const s = totalSec % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	});
	const transitioningSecsLeft = $derived.by(() => {
		void timer.nowTick;
		return Math.max(0, Math.ceil(timer.transitioningRemainingMs / 1000));
	});
	// The 30-second auto-confirm bar depletes from 100% → 0% across the
	// countdown. width = remainingMs / totalMs (the controller owns the
	// total, so retuning the auto-confirm duration can't desync the bar).
	const transitioningProgressPct = $derived.by(() => {
		void timer.nowTick;
		return Math.min(
			100,
			Math.max(0, (timer.transitioningRemainingMs / timer.transitioningTotalMs) * 100)
		);
	});

	const filtered = $derived.by((): TaskRow[] => {
		const rows = data.tasks;
		switch (filter) {
			case 'all':
				return rows;
			case 'today':
				return rows.filter((t) => !t.archived && !t.done);
			case 'done':
				return rows.filter((t) => t.done);
			case 'archived':
				return rows.filter((t) => t.archived);
			default:
				return rows.filter((t) => !t.archived && !t.done);
		}
	});

	const todayCount = $derived(data.tasks.filter((t) => !t.archived && !t.done).length);

	function pips(estimate: number, actuals: number) {
		const filled = Math.min(actuals, estimate);
		const over = Math.max(actuals - estimate, 0);
		const empty = Math.max(estimate - filled, 0);
		return {
			filled: '●'.repeat(filled),
			empty: '○'.repeat(empty),
			over: '●'.repeat(over)
		};
	}

	function startFocus() {
		if (firstNonArchivedTask) timer.startFocus(firstNonArchivedTask.id);
	}
</script>

<!-- The data-phase attribute on this root drives the held palette swap.
     focus = coral tokens; break = sage tokens. See layout.css. -->
<div data-phase={dataPhase} class="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
	<div class="mx-auto max-w-3xl px-6 py-10">
		<header class="mb-8">
			<h1 class="text-4xl font-semibold tracking-tight">Pomodoro</h1>
			<p class="mt-1 text-sm text-[var(--ink-soft)]">Focused work, one pomodoro at a time.</p>
		</header>

		<section aria-labelledby="timer-heading" class="mb-12" data-timer data-state={timer.state}>
			<h2 id="timer-heading" class="sr-only">Timer</h2>

			<div class="flex flex-col items-center gap-6">
				<!-- Hero ring. Reused across focus-running, break-running, and
				     long-break-running. During transitioning the prompt overlay
				     sits centered on top of it. -->
				<div
					class="relative aspect-square w-64 rounded-full"
					data-timer-ring
					style:--p={focusPercent.toFixed(2)}
					style:--ring-color="var(--accent)"
				>
					<div
						class="absolute inset-0 rounded-full"
						style:background="conic-gradient(var(--ring-color) calc(var(--p) * 1%), transparent 0)"
					></div>
					<div
						class="absolute inset-2 flex items-center justify-center rounded-full bg-[var(--surface)] shadow-[var(--shadow)]"
					>
						<span class="text-7xl font-bold tabular-nums" data-timer-time>{timeText}</span>
					</div>

					{#if timer.state === 'transitioning'}
						<!-- Variant A from issue #16: a centered overlay card over
						     the hero ring. Renders on sage (data-phase=break is set
						     above at focus-end). -->
						<div
							class="absolute inset-0 flex items-center justify-center"
							data-transitioning-prompt
							data-prompt={timer.transitioningPrompt ?? ''}
						>
							<div
								class="w-56 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-center shadow-[var(--shadow)]"
							>
								{#if timer.transitioningPrompt === 'long-break'}
									<p
										class="text-[10px] font-semibold tracking-[0.18em] text-[var(--ink-soft)] uppercase"
										data-long-break-eyebrow
									>
										Long break
									</p>
								{/if}
								<p class="text-sm font-medium text-[var(--ink)]" data-prompt-question>
									{timer.transitioningLabel}
								</p>
								<div
									class="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
									aria-hidden="true"
								>
									<div
										class="h-full bg-[var(--accent)]"
										data-prompt-progress
										style:width={`${transitioningProgressPct.toFixed(2)}%`}
									></div>
								</div>
								<p
									class="mt-2 text-xs text-[var(--ink-soft)] tabular-nums"
									data-prompt-auto-confirm
								>
									Auto-confirm in 0:{String(transitioningSecsLeft).padStart(2, '0')}
								</p>
								<div class="mt-3 flex justify-center gap-2">
									<button
										type="button"
										data-skip
										onclick={() => timer.skip()}
										class="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-[var(--hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
									>
										Skip
									</button>
									<button
										type="button"
										data-confirm
										onclick={() => timer.confirm()}
										class="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-[var(--on-accent)] hover:bg-[var(--accent-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
									>
										Confirm
									</button>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<p
					class="text-sm text-[var(--ink-soft)]"
					data-focusing-on
					data-task-id={focusedTask?.id ?? ''}
				>
					{#if focusedTask}
						Focusing on <span class="font-medium text-[var(--ink)]">{focusedTask.title}</span>
					{:else}
						&nbsp;
					{/if}
				</p>

				<p class="text-xs tracking-wider text-[var(--ink-soft)] uppercase" data-phase-label>
					{timer.phaseLabel}
				</p>

				<!-- Calm pill controls. Each is visible only when its phase
				     allows it (per ADR 0001: no pause, stop is universal, the
				     only fast-forward is to focus). -->
				{#if timer.state === 'idle'}
					<button
						type="button"
						data-start-focus
						onclick={startFocus}
						disabled={!firstNonArchivedTask}
						class="rounded-full bg-[var(--accent)] px-6 py-2 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						Start focus
					</button>
					{#if !firstNonArchivedTask}
						<p class="text-xs text-[var(--ink-soft)]">Add a task below to begin.</p>
					{/if}
				{:else if timer.state === 'focus-running'}
					<button
						type="button"
						data-stop
						onclick={() => timer.stop()}
						class="rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
					>
						Stop
					</button>
				{:else if timer.state === 'break-running' || timer.state === 'long-break-running'}
					<div class="flex gap-2" data-break-controls>
						<button
							type="button"
							data-stop
							onclick={() => timer.stop()}
							class="rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
						>
							Stop
						</button>
						{#if firstNonArchivedTask}
							<button
								type="button"
								data-fast-forward-to-focus
								onclick={() => timer.fastForwardToFocus(firstNonArchivedTask.id)}
								class="rounded-full bg-[var(--accent)] px-6 py-2 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
							>
								Fast-forward → focus
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</section>

		<section aria-labelledby="tasks-heading">
			<div class="mb-3 flex items-baseline justify-between">
				<h2 id="tasks-heading" class="text-lg font-semibold tracking-tight">Today's tasks</h2>
				<span class="text-xs text-[var(--ink-soft)]">
					{todayCount}
					{todayCount === 1 ? 'task' : 'tasks'}
				</span>
			</div>

			<form
				method="POST"
				action="?/add"
				use:enhance={() => {
					return ({ update }) => update({ reset: true });
				}}
				class="mb-4 flex gap-2"
			>
				<input
					type="text"
					name="title"
					placeholder="Add a task…"
					aria-label="New task title"
					required
					class="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-soft)] focus:border-[var(--focus-ring)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
				/>
				<input
					type="number"
					name="estimate"
					value="1"
					min="1"
					max="99"
					aria-label="Estimate in pomodoros"
					class="w-16 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-center text-sm tabular-nums focus:border-[var(--focus-ring)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
				/>
				<button
					type="submit"
					class="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] active:bg-[var(--accent)]"
				>
					Add
				</button>
			</form>

			<div role="tablist" aria-label="Filter tasks" class="mb-4 flex gap-1 text-xs">
				{#each [{ id: 'all', label: 'All' }, { id: 'today', label: 'Today' }, { id: 'done', label: 'Done' }, { id: 'archived', label: 'Archived' }] as tab (tab.id)}
					<button
						type="button"
						role="tab"
						aria-selected={filter === tab.id}
						data-filter={tab.id}
						onclick={() => (filter = tab.id as Filter)}
						class="rounded-md px-3 py-1.5 transition-colors {filter === tab.id
							? 'bg-[var(--surface-2)] font-medium text-[var(--ink)]'
							: 'text-[var(--ink-soft)] hover:bg-[var(--hover)]'}"
					>
						{tab.label}
					</button>
				{/each}
			</div>

			{#if filtered.length === 0}
				<p
					class="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--ink-soft)]"
				>
					{#if filter === 'all'}
						No tasks yet. Add one above to get started.
					{:else if filter === 'today'}
						Nothing planned for today.
					{:else if filter === 'done'}
						No completed tasks yet.
					{:else}
						No archived tasks.
					{/if}
				</p>
			{:else}
				<ul class="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]">
					{#each filtered as task (task.id)}
						<li
							class="group flex items-center gap-3 border-b border-[var(--border)] px-3 py-2 last:border-b-0 hover:bg-[var(--hover)]"
							data-task-row
							data-task-id={task.id}
							data-task-title={task.title}
						>
							<form method="POST" action="?/toggleDone" use:enhance class="contents">
								<input type="hidden" name="id" value={task.id} />
								<input type="hidden" name="done" value={String(!task.done)} />
								<button
									type="submit"
									aria-label={task.done ? 'Mark not done' : 'Mark done'}
									data-done-toggle
									data-done={String(task.done)}
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--success)] accent-[var(--success)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] {task.done
										? 'border-[var(--success)] bg-[var(--success)] text-[var(--on-accent)]'
										: ''}"
								>
									{#if task.done}✓{/if}
								</button>
							</form>

							<form
								method="POST"
								action="?/updateTitle"
								use:enhance
								class="flex flex-1 items-center"
							>
								<input type="hidden" name="id" value={task.id} />
								<input
									type="text"
									name="title"
									value={task.title}
									required
									aria-label="Task title"
									onchange={(e) =>
										(e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()}
									class="w-full bg-transparent text-sm text-[var(--ink)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] {task.done
										? 'text-[var(--ink-soft)] line-through'
										: ''}"
								/>
							</form>

							<form
								method="POST"
								action="?/updateEstimate"
								use:enhance
								class="flex items-center gap-2"
							>
								<input type="hidden" name="id" value={task.id} />
								<span
									class="font-mono text-xs tracking-wider"
									data-pips
									data-actuals={String(task.actuals)}
									data-estimate={String(task.estimate)}
								>
									<span class="text-[var(--accent)]"
										>{pips(task.estimate, task.actuals).filled}</span
									><span class="text-[var(--ink-soft)]"
										>{pips(task.estimate, task.actuals).empty}</span
									>{#if task.actuals > task.estimate}<span class="font-medium text-[var(--error)]"
											>{pips(task.estimate, task.actuals).over}</span
										>{/if}
								</span>
								<span
									class="text-xs tabular-nums {task.actuals > task.estimate
										? 'font-medium text-[var(--error)]'
										: 'text-[var(--ink-soft)]'}"
									data-act-est
								>
									{task.actuals}/{task.estimate}
								</span>
								<input
									type="number"
									name="estimate"
									value={task.estimate}
									min="1"
									max="99"
									aria-label="Estimate in pomodoros"
									onchange={(e) =>
										(e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()}
									class="w-12 rounded border border-transparent bg-transparent px-1 py-0.5 text-center text-xs text-[var(--ink-soft)] tabular-nums hover:border-[var(--border)] focus:border-[var(--focus-ring)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
								/>
							</form>

							<form
								method="POST"
								action="?/toggleArchive"
								use:enhance
								class="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
							>
								<input type="hidden" name="id" value={task.id} />
								<input type="hidden" name="archived" value={String(!task.archived)} />
								<button
									type="submit"
									aria-label={task.archived ? 'Unarchive task' : 'Archive task'}
									data-archive-toggle
									data-archived={String(task.archived)}
									class="rounded-md px-2 py-1 text-xs text-[var(--ink-soft)] hover:bg-[var(--active)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
								>
									{task.archived ? 'Restore' : 'Archive'}
								</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</div>
