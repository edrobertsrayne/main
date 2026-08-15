<script lang="ts">
	import { enhance } from '$app/forms';

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
</script>

<div class="mx-auto max-w-3xl px-6 py-10">
	<header class="mb-8">
		<h1 class="text-4xl font-semibold tracking-tight">Pomodoro</h1>
		<p class="mt-1 text-sm text-[var(--ink-soft)]">Focused work, one pomodoro at a time.</p>
	</header>

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

						<form method="POST" action="?/updateTitle" use:enhance class="flex flex-1 items-center">
							<input type="hidden" name="id" value={task.id} />
							<input
								type="text"
								name="title"
								value={task.title}
								required
								aria-label="Task title"
								onchange={(e) => (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()}
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
								<span class="text-[var(--accent)]">{pips(task.estimate, task.actuals).filled}</span
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
								onchange={(e) => (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()}
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
