<script lang="ts">
	import { memoryVaultStore } from '$lib/stores/memory-vault.svelte';
	import { onMount } from 'svelte';

	let searchQuery = $state('');
	let newMemoryContent = $state('');
	let showStoreForm = $state(false);

	onMount(() => {
		memoryVaultStore.checkConnection();
	});

	async function handleSearch() {
		if (searchQuery.trim()) {
			await memoryVaultStore.searchMemories(searchQuery);
		}
	}

	async function handleStore() {
		if (newMemoryContent.trim()) {
			const success = await memoryVaultStore.storeMemory(newMemoryContent);
			if (success) {
				newMemoryContent = '';
				showStoreForm = false;
			}
		}
	}

	function handleReconnect() {
		memoryVaultStore.checkConnection();
	}

	let displayMemories = $derived(
		memoryVaultStore.searchResults.length > 0
			? memoryVaultStore.searchResults
			: memoryVaultStore.memories
	);

	const statusDot: Record<string, string> = {
		connected: 'bg-green-500',
		disconnected: 'bg-gray-400',
		checking: 'bg-yellow-500 animate-pulse',
		error: 'bg-red-500'
	};
</script>

<div class="rounded-lg border border-border bg-card">
	<div class="flex items-center justify-between border-b border-border px-4 py-3">
		<div class="flex items-center gap-2">
			<h3 class="text-sm font-medium text-muted-foreground">Memory Vault</h3>
			<span class="flex items-center gap-1.5">
				<span class="h-2 w-2 rounded-full {statusDot[memoryVaultStore.status]}"></span>
				<span class="text-xs capitalize text-muted-foreground">{memoryVaultStore.status}</span>
			</span>
		</div>
		<div class="flex items-center gap-2">
			{#if memoryVaultStore.status !== 'connected'}
				<button
					onclick={handleReconnect}
					class="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
					disabled={memoryVaultStore.status === 'checking'}
				>
					Reconnect
				</button>
			{:else}
				<button
					onclick={() => {
						showStoreForm = !showStoreForm;
					}}
					class="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
				>
					{showStoreForm ? 'Cancel' : 'Store New'}
				</button>
				<button
					onclick={() => memoryVaultStore.fetchMemories()}
					class="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
					disabled={memoryVaultStore.loading}
				>
					Refresh
				</button>
			{/if}
		</div>
	</div>

	{#if memoryVaultStore.error}
		<div class="border-b border-red-500/20 bg-red-500/10 px-4 py-2">
			<p class="text-xs text-red-500">{memoryVaultStore.error}</p>
		</div>
	{/if}

	{#if memoryVaultStore.isConnected}
		<!-- Store form -->
		{#if showStoreForm}
			<div class="border-b border-border px-4 py-3">
				<textarea
					bind:value={newMemoryContent}
					placeholder="Enter memory content..."
					class="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
					rows="3"
				></textarea>
				<div class="mt-2 flex justify-end">
					<button
						onclick={handleStore}
						disabled={!newMemoryContent.trim() || memoryVaultStore.loading}
						class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{memoryVaultStore.loading ? 'Storing...' : 'Store Memory'}
					</button>
				</div>
			</div>
		{/if}

		<!-- Search -->
		<div class="border-b border-border px-4 py-2">
			<div class="flex gap-2">
				<input
					bind:value={searchQuery}
					placeholder="Search memories..."
					class="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
					onkeydown={(e) => e.key === 'Enter' && handleSearch()}
				/>
				<button
					onclick={handleSearch}
					disabled={!searchQuery.trim() || memoryVaultStore.loading}
					class="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
				>
					Search
				</button>
			</div>
		</div>

		<!-- Memory list -->
		{#if displayMemories.length > 0}
			<div class="max-h-[300px] divide-y divide-border/50 overflow-y-auto">
				{#each displayMemories as memory}
					<div class="px-4 py-3">
						<p class="text-sm">{memory.content}</p>
						<div class="mt-1 flex gap-3 text-xs text-muted-foreground">
							{#if memory.created_at}
								<span>{new Date(memory.created_at).toLocaleString()}</span>
							{/if}
							<span class="font-mono">{memory.id?.slice(0, 8)}</span>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="px-4 py-6 text-center text-sm text-muted-foreground">
				{memoryVaultStore.loading ? 'Loading...' : 'No memories found'}
			</div>
		{/if}
	{:else}
		<div class="px-4 py-6 text-center text-sm text-muted-foreground">
			<p>Memory Vault is not connected</p>
			<p class="mt-1 font-mono text-xs">{memoryVaultStore.baseUrl}</p>
		</div>
	{/if}
</div>
