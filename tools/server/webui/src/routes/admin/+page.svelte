<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { adminStore } from '$lib/stores/admin.svelte';
	import { serverStore } from '$lib/stores/server.svelte';
	import {
		MetricsPanel,
		MetricsChart,
		ServerOverview,
		SlotsMonitor,
		QueryLog,
		MemoryVaultPanel,
		KemoryPanel
	} from '$lib/components/app/admin';

	let pollInterval = $state(3);

	onMount(() => {
		// Ensure server props are loaded
		if (!serverStore.props) {
			serverStore.fetch();
		}
		adminStore.startPolling(pollInterval * 1000);
	});

	onDestroy(() => {
		adminStore.stopPolling();
	});

	function handleIntervalChange() {
		adminStore.startPolling(pollInterval * 1000);
	}

	function togglePolling() {
		if (adminStore.isPolling) {
			adminStore.stopPolling();
		} else {
			adminStore.startPolling(pollInterval * 1000);
		}
	}
</script>

<div class="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
	<!-- Polling controls -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<button
				onclick={togglePolling}
				class="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
			>
				{#if adminStore.isPolling}
					<span class="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
					Live
				{:else}
					<span class="h-2 w-2 rounded-full bg-gray-400"></span>
					Paused
				{/if}
			</button>

			<div class="flex items-center gap-1.5">
				<label for="poll-interval" class="text-xs text-muted-foreground">Interval:</label>
				<select
					id="poll-interval"
					bind:value={pollInterval}
					onchange={handleIntervalChange}
					class="rounded-md border border-border bg-background px-2 py-1 text-xs"
				>
					<option value={1}>1s</option>
					<option value={3}>3s</option>
					<option value={5}>5s</option>
					<option value={10}>10s</option>
				</select>
			</div>
		</div>

		<button
			onclick={() => adminStore.fetchAll()}
			class="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
		>
			Refresh Now
		</button>
	</div>

	<!-- Stat cards grid -->
	<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
		<MetricsPanel />
	</div>

	<!-- Charts + Server Info -->
	<div class="grid gap-4 md:grid-cols-3">
		<div class="md:col-span-2">
			<MetricsChart history={adminStore.metricsHistory} />
		</div>
		<div>
			<ServerOverview />
		</div>
	</div>

	<!-- Slots Monitor -->
	<SlotsMonitor />

	<!-- Query History -->
	<QueryLog />

	<!-- Memory Vault -->
	<MemoryVaultPanel />

	<!-- Kemory (MCP memory) -->
	<KemoryPanel />
</div>
