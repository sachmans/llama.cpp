<script lang="ts">
	import { adminStore } from '$lib/stores/admin.svelte';

	let slots = $derived(adminStore.slots);

	function truncate(text: string | undefined, maxLen: number): string {
		if (!text) return '-';
		return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
	}

	const stateColors: Record<string, string> = {
		idle: 'text-green-500',
		processing: 'text-yellow-500',
		started: 'text-blue-500'
	};

	function getSlotState(slot: { is_processing: boolean; state?: string }): string {
		if (slot.is_processing) return 'processing';
		return 'idle';
	}
</script>

<div class="rounded-lg border border-border bg-card">
	<div class="flex items-center justify-between border-b border-border px-4 py-3">
		<h3 class="text-sm font-medium text-muted-foreground">Active Slots</h3>
		{#if adminStore.slotsError}
			<span class="text-xs text-red-500">{adminStore.slotsError}</span>
		{:else}
			<span class="text-xs text-muted-foreground">
				{adminStore.activeSlots} active / {adminStore.totalSlots} total
			</span>
		{/if}
	</div>

	{#if slots.length > 0}
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border text-left text-xs text-muted-foreground">
						<th class="px-4 py-2 font-medium">ID</th>
						<th class="px-4 py-2 font-medium">State</th>
						<th class="px-4 py-2 font-medium">Task</th>
						<th class="px-4 py-2 font-medium">Prompt</th>
						<th class="px-4 py-2 font-medium text-right">Decoded</th>
						<th class="px-4 py-2 font-medium text-right">Remain</th>
					</tr>
				</thead>
				<tbody>
					{#each slots as slot}
						{@const state = getSlotState(slot)}
						<tr class="border-b border-border/50 last:border-0">
							<td class="px-4 py-2 font-mono tabular-nums">{slot.id}</td>
							<td class="px-4 py-2">
								<span class="flex items-center gap-1.5">
									<span
										class="h-1.5 w-1.5 rounded-full {state === 'processing'
											? 'bg-yellow-500'
											: 'bg-green-500'}"
									></span>
									<span class={stateColors[state] || 'text-muted-foreground'}>{state}</span>
								</span>
							</td>
							<td class="px-4 py-2 font-mono text-xs tabular-nums">
								{slot.id_task >= 0 ? slot.id_task : '-'}
							</td>
							<td class="max-w-[250px] px-4 py-2">
								<span class="block truncate font-mono text-xs text-muted-foreground">
									{truncate(slot.prompt, 60)}
								</span>
							</td>
							<td class="px-4 py-2 text-right font-mono tabular-nums">
								{slot.n_decoded ?? '-'}
							</td>
							<td class="px-4 py-2 text-right font-mono tabular-nums">
								{slot.n_remain ?? '-'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if !adminStore.slotsError}
		<div class="px-4 py-6 text-center text-sm text-muted-foreground">No slots available</div>
	{/if}
</div>
