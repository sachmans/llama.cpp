import { MemoryVaultService } from '$lib/services/memory-vault.service';
import { MEMORY_VAULT } from '$lib/constants/api-endpoints';
import type { MemoryEntry } from '$lib/types/admin';

/**
 * MemoryVaultStore - Reactive store for Memory Vault state.
 *
 * Manages connection status, memory listing, search, and storage.
 * Tries internal URL first, falls back to public if needed.
 */
class MemoryVaultStore {
	status = $state<'connected' | 'disconnected' | 'checking' | 'error'>('disconnected');
	memories = $state<MemoryEntry[]>([]);
	searchResults = $state<MemoryEntry[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	baseUrl = $state(MEMORY_VAULT.BASE_URL);
	apiInfo = $state<unknown>(null);

	get isConnected(): boolean {
		return this.status === 'connected';
	}

	async checkConnection(): Promise<void> {
		this.status = 'checking';
		this.error = null;

		// Try configured base URL
		const result = await MemoryVaultService.checkStatus(this.baseUrl);
		if (result.ok) {
			this.status = 'connected';
			this.apiInfo = result.data;
			return;
		}

		this.status = 'error';
		this.error = `Cannot reach Memory Vault at ${this.baseUrl}`;
	}

	async fetchMemories(): Promise<void> {
		if (!this.isConnected) return;
		this.loading = true;
		this.error = null;

		try {
			this.memories = await MemoryVaultService.listMemories(20, this.baseUrl);
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to fetch memories';
		} finally {
			this.loading = false;
		}
	}

	async searchMemories(query: string): Promise<void> {
		if (!this.isConnected || !query.trim()) return;
		this.loading = true;
		this.error = null;

		try {
			this.searchResults = await MemoryVaultService.searchMemories(query, this.baseUrl);
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Search failed';
		} finally {
			this.loading = false;
		}
	}

	async storeMemory(content: string, metadata?: Record<string, unknown>): Promise<boolean> {
		if (!this.isConnected) return false;
		this.loading = true;
		this.error = null;

		try {
			const entry = await MemoryVaultService.storeMemory(content, metadata, this.baseUrl);
			this.memories = [entry, ...this.memories];
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Store failed';
			return false;
		} finally {
			this.loading = false;
		}
	}

	updateBaseUrl(url: string): void {
		this.baseUrl = url;
		this.status = 'disconnected';
		this.error = null;
	}

	clear(): void {
		this.status = 'disconnected';
		this.memories = [];
		this.searchResults = [];
		this.loading = false;
		this.error = null;
		this.apiInfo = null;
	}
}

export const memoryVaultStore = new MemoryVaultStore();
