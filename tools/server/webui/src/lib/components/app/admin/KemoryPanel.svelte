<script lang="ts">
	import { kemoryStore } from '$lib/stores/kemory.svelte';
	import { KEMORY } from '$lib/constants/api-endpoints';
	import { onMount } from 'svelte';

	// Connection form (only shown when not configured/connected).
	let mcpUrl = $state('https://api.memory.dxb-gw.basanti.ai/mcp/v1');
	let apiKey = $state('');

	// Recall + store forms.
	let searchQuery = $state('');
	let searchNamespace = $state('');
	let newContent = $state('');
	let newNamespace = $state(KEMORY.DEFAULT_NAMESPACE);
	let showStoreForm = $state(false);
	let showBrief = $state(false);
	let storeNotice = $state('');

	onMount(() => {
		kemoryStore.init();
	});

	async function handleConnect() {
		if (!mcpUrl.trim() || !apiKey.trim()) return;
		await kemoryStore.connect({ mcpUrl, apiKey });
	}

	async function handleSearch() {
		if (searchQuery.trim()) {
			await kemoryStore.recall(searchQuery, searchNamespace.trim() || undefined);
		}
	}

	async function handleStore() {
		if (!newContent.trim()) return;
		const res = await kemoryStore.store(newContent, newNamespace.trim() || KEMORY.DEFAULT_NAMESPACE);
		storeNotice = res.message;
		if (res.ok) {
			newContent = '';
			showStoreForm = false;
		}
	}

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
			<h3 class="text-sm font-medium text-muted-foreground">Kemory (MCP memory)</h3>
			<span class="flex items-center gap-1.5">
				<span class="h-2 w-2 rounded-full {statusDot[kemoryStore.status]}"></span>
				<span class="text-xs capitalize text-muted-foreground">{kemoryStore.status}</span>
			</span>
			{#if kemoryStore.config?.agentName}
				<span class="font-mono text-xs text-muted-foreground">{kemoryStore.config.agentName}</span>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if kemoryStore.isConnected}
				<button
					onclick={() => {
						showBrief = !showBrief;
						if (showBrief) kemoryStore.refreshBrief();
					}}
					class="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
				>
					{showBrief ? 'Hide brief' : 'Brief'}
				</button>
				<button
					onclick={() => {
						showStoreForm = !showStoreForm;
						storeNotice = '';
					}}
					class="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
				>
					{showStoreForm ? 'Cancel' : 'Store New'}
				</button>
				<button
					onclick={() => kemoryStore.fetchNamespaces()}
					class="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
					disabled={kemoryStore.loading}
				>
					Refresh
				</button>
				<button
					onclick={() => kemoryStore.disconnect(true)}
					class="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
				>
					Disconnect
				</button>
			{/if}
		</div>
	</div>

	{#if kemoryStore.error}
		<div class="border-b border-red-500/20 bg-red-500/10 px-4 py-2">
			<p class="text-xs text-red-500">{kemoryStore.error}</p>
		</div>
	{/if}

	{#if !kemoryStore.isConnected}
		<!-- Connection form -->
		<div class="space-y-2 px-4 py-3">
			<p class="text-xs text-muted-foreground">
				Paste the Kemory <span class="font-mono">mcp_url</span> and
				<span class="font-mono">X-API-Key</span> from your claim response. Stored locally in this
				browser only.
			</p>
			<input
				bind:value={mcpUrl}
				placeholder="mcp_url"
				class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
			/>
			<input
				bind:value={apiKey}
				type="password"
				placeholder="X-API-Key (kemory_…)"
				class="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
			/>
			<div class="flex justify-end">
				<button
					onclick={handleConnect}
					disabled={!mcpUrl.trim() || !apiKey.trim() || kemoryStore.status === 'checking'}
					class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
				>
					{kemoryStore.status === 'checking' ? 'Connecting…' : 'Connect'}
				</button>
			</div>
		</div>
	{:else}
		<!-- Brief -->
		{#if showBrief && kemoryStore.brief}
			<div class="max-h-[240px] overflow-y-auto border-b border-border bg-muted/30 px-4 py-3">
				<pre class="whitespace-pre-wrap text-xs text-muted-foreground">{kemoryStore.brief}</pre>
			</div>
		{/if}

		<!-- Store form (explicit consent gate per the brief) -->
		{#if showStoreForm}
			<div class="space-y-2 border-b border-border px-4 py-3">
				<textarea
					bind:value={newContent}
					placeholder="Memory content…"
					class="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
					rows="3"
				></textarea>
				<div class="flex items-center gap-2">
					<input
						bind:value={newNamespace}
						placeholder="namespace"
						class="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
					/>
					<button
						onclick={handleStore}
						disabled={!newContent.trim() || kemoryStore.loading}
						class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{kemoryStore.loading ? 'Storing…' : 'Store Memory'}
					</button>
				</div>
			</div>
		{/if}

		{#if storeNotice}
			<div class="border-b border-border px-4 py-2">
				<p class="text-xs text-muted-foreground">{storeNotice}</p>
			</div>
		{/if}

		<!-- Namespaces -->
		{#if kemoryStore.namespaces.length > 0}
			<div class="flex flex-wrap gap-1.5 border-b border-border px-4 py-2">
				{#each kemoryStore.namespaces.slice(0, 12) as ns}
					<button
						onclick={() => {
							searchNamespace = ns.name;
						}}
						class="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-accent"
						title="Filter recall to this namespace"
					>
						{ns.name} <span class="text-muted-foreground">({ns.count})</span>
					</button>
				{/each}
			</div>
		{/if}

		<!-- Recall -->
		<div class="border-b border-border px-4 py-2">
			<div class="flex gap-2">
				<input
					bind:value={searchQuery}
					placeholder="Recall memories…"
					class="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
					onkeydown={(e) => e.key === 'Enter' && handleSearch()}
				/>
				<input
					bind:value={searchNamespace}
					placeholder="namespace (opt)"
					class="w-32 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
				/>
				<button
					onclick={handleSearch}
					disabled={!searchQuery.trim() || kemoryStore.loading}
					class="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
				>
					Recall
				</button>
			</div>
		</div>

		<!-- Results -->
		{#if kemoryStore.memories.length > 0}
			<div class="max-h-[300px] divide-y divide-border/50 overflow-y-auto">
				{#each kemoryStore.memories as memory}
					<div class="px-4 py-3">
						<p class="whitespace-pre-wrap text-sm">{memory.content}</p>
						<div class="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
							{#if memory.namespace}<span>{memory.namespace}</span>{/if}
							{#if memory.contentType}<span>{memory.contentType}</span>{/if}
							{#if memory.quality}<span>q={memory.quality}</span>{/if}
							{#if memory.id}<span class="font-mono">{memory.id.slice(0, 8)}</span>{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else if kemoryStore.lastRecallText}
			<div class="max-h-[300px] overflow-y-auto px-4 py-3">
				<pre class="whitespace-pre-wrap text-xs text-muted-foreground">{kemoryStore.lastRecallText}</pre>
			</div>
		{:else}
			<div class="px-4 py-6 text-center text-sm text-muted-foreground">
				{kemoryStore.loading ? 'Loading…' : 'Recall memories to see results'}
			</div>
		{/if}
	{/if}
</div>
