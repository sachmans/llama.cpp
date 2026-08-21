<script lang="ts">
	import { queryLogStore } from '$lib/stores/query-log.svelte';

	let entries = $derived(queryLogStore.recentEntries);

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function formatDuration(ms: number): string {
		if (ms < 1000) return `${ms.toFixed(0)}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}
</script>

<div class="rounded-lg border border-border bg-card">
	<div class="flex items-center justify-between border-b border-border px-4 py-3">
		<h3 class="text-sm font-medium text-muted-foreground">Query History</h3>
		<div class="flex items-center gap-3">
			{#if entries.length > 0}
				<span class="text-xs text-muted-foreground">
					{entries.length} queries | avg {queryLogStore.averageSpeed.toFixed(1)} tok/s
				</span>
				<button
					onclick={() => queryLogStore.clearEntries()}
					class="text-xs text-muted-foreground hover:text-foreground"
				>
					Clear
				</button>
			{/if}
		</div>
	</div>

	{#if entries.length > 0}
		<div class="max-h-[300px] overflow-y-auto">
			<table class="w-full text-sm">
				<thead class="sticky top-0 bg-card">
					<tr class="border-b border-border text-left text-xs text-muted-foreground">
						<th class="px-4 py-2 font-medium">Time</th>
						<th class="px-4 py-2 font-medium">Model</th>
						<th class="px-4 py-2 font-medium text-right">Prompt</th>
						<th class="px-4 py-2 font-medium text-right">Generated</th>
						<th class="px-4 py-2 font-medium text-right">Speed</th>
						<th class="px-4 py-2 font-medium text-right">Cache</th>
						<th class="px-4 py-2 font-medium text-right">Duration</th>
					</tr>
				</thead>
				<tbody>
					{#each entries as entry}
						<tr class="border-b border-border/50 last:border-0">
							<td class="px-4 py-2 font-mono text-xs tabular-nums">
								{formatTime(entry.timestamp)}
							</td>
							<td class="max-w-[120px] px-4 py-2">
								<span class="block truncate font-mono text-xs">{entry.model || '-'}</span>
							</td>
							<td class="px-4 py-2 text-right font-mono tabular-nums">{entry.prompt_n}</td>
							<td class="px-4 py-2 text-right font-mono tabular-nums">{entry.predicted_n}</td>
							<td class="px-4 py-2 text-right font-mono tabular-nums">
								{entry.predicted_per_second.toFixed(1)} t/s
							</td>
							<td class="px-4 py-2 text-right font-mono tabular-nums">{entry.cache_n}</td>
							<td class="px-4 py-2 text-right font-mono text-xs tabular-nums">
								{formatDuration(entry.duration_ms)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="px-4 py-6 text-center text-sm text-muted-foreground">
			No queries recorded yet. Send a chat message to see it here.
		</div>
	{/if}
</div>
