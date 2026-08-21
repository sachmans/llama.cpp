<script lang="ts">
	import { serverStore } from '$lib/stores/server.svelte';
	import { adminStore } from '$lib/stores/admin.svelte';

	let props = $derived(serverStore.props);

	let modelName = $derived(
		props?.default_generation_settings?.model || props?.model || 'Unknown'
	);
	let contextSize = $derived(props?.default_generation_settings?.n_ctx ?? 0);
	let totalSlots = $derived(props?.total_slots ?? 0);
	let buildInfo = $derived(props?.build_info || '');
	let healthStatus = $derived(adminStore.health?.status ?? 'unknown');

	const statusDot: Record<string, string> = {
		ok: 'bg-green-500',
		'loading model': 'bg-yellow-500',
		error: 'bg-red-500',
		unknown: 'bg-gray-400'
	};
</script>

<div class="rounded-lg border border-border bg-card p-4">
	<div class="mb-3 flex items-center justify-between">
		<h3 class="text-sm font-medium text-muted-foreground">Server Info</h3>
		<div class="flex items-center gap-1.5">
			<span class="h-2 w-2 rounded-full {statusDot[healthStatus]}"></span>
			<span class="text-xs capitalize text-muted-foreground">{healthStatus}</span>
		</div>
	</div>

	<div class="space-y-2 text-sm">
		<div class="flex justify-between">
			<span class="text-muted-foreground">Model</span>
			<span class="max-w-[200px] truncate font-mono text-xs" title={modelName}>
				{modelName}
			</span>
		</div>
		<div class="flex justify-between">
			<span class="text-muted-foreground">Context</span>
			<span class="font-mono tabular-nums">{contextSize.toLocaleString()}</span>
		</div>
		<div class="flex justify-between">
			<span class="text-muted-foreground">Slots</span>
			<span class="font-mono tabular-nums">{totalSlots}</span>
		</div>
		{#if buildInfo}
			<div class="flex justify-between">
				<span class="text-muted-foreground">Build</span>
				<span class="max-w-[200px] truncate font-mono text-xs">{buildInfo}</span>
			</div>
		{/if}
		{#if adminStore.lastFetchTime}
			<div class="flex justify-between">
				<span class="text-muted-foreground">Last Update</span>
				<span class="font-mono text-xs tabular-nums">
					{new Date(adminStore.lastFetchTime).toLocaleTimeString()}
				</span>
			</div>
		{/if}
	</div>
</div>
