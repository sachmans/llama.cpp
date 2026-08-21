<script lang="ts">
	import { adminStore } from '$lib/stores/admin.svelte';
	import AdminStatCard from './AdminStatCard.svelte';

	let metrics = $derived(adminStore.metrics);
	let history = $derived(adminStore.metricsHistory);

	let throughputHistory = $derived(history.map((h) => h.predictedTokensPerSecond));
	let processingHistory = $derived(history.map((h) => h.requestsProcessing));

	function formatNumber(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
		return n.toFixed(0);
	}
</script>

{#if adminStore.metricsError}
	<div class="col-span-full rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
		<p class="text-sm text-yellow-600 dark:text-yellow-400">{adminStore.metricsError}</p>
	</div>
{/if}

<AdminStatCard
	title="Generation Speed"
	value="{(metrics?.predictedTokensPerSecond ?? 0).toFixed(1)} tok/s"
	sparklineData={throughputHistory}
	status={metrics && metrics.predictedTokensPerSecond > 0 ? 'success' : 'neutral'}
/>

<AdminStatCard
	title="Total Tokens"
	value={formatNumber(metrics?.tokensPredictedTotal ?? 0)}
	subtitle="predicted"
/>

<AdminStatCard
	title="Active Requests"
	value="{adminStore.activeSlots} / {adminStore.totalSlots}"
	sparklineData={processingHistory}
	status={adminStore.activeSlots > 0 ? 'warning' : 'success'}
/>

<AdminStatCard
	title="Deferred"
	value={String(metrics?.requestsDeferred ?? 0)}
	status={metrics && metrics.requestsDeferred > 0 ? 'error' : 'success'}
/>
