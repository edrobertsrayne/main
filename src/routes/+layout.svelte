<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div data-phase="focus" class="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
	{@render children()}
</div>
