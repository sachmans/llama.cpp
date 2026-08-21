import { getProxiedUrlString, buildProxiedHeaders } from '$lib/utils/cors-proxy';
import { MEMORY_VAULT } from '$lib/constants/api-endpoints';
import type { MemoryEntry } from '$lib/types/admin';

/**
 * MemoryVaultService - Stateless service for Memory Vault API communication.
 *
 * Routes all requests through llama-server's /cors-proxy to avoid CORS issues.
 * The Memory Vault uses HTTPS with a self-signed certificate.
 */
export class MemoryVaultService {
	/**
	 * Check if the Memory Vault API is reachable.
	 */
	static async checkStatus(baseUrl?: string): Promise<{ ok: boolean; data?: unknown }> {
		try {
			const url = `${baseUrl || MEMORY_VAULT.BASE_URL}/`;
			const proxyUrl = getProxiedUrlString(url);
			const response = await fetch(proxyUrl, {
				headers: buildProxiedHeaders({ Accept: 'application/json' }),
				signal: AbortSignal.timeout(5000)
			});
			if (response.ok) {
				const data = await response.json().catch(() => null);
				return { ok: true, data };
			}
			return { ok: false };
		} catch {
			return { ok: false };
		}
	}

	/**
	 * Fetch available API endpoints/docs from the Memory Vault.
	 */
	static async fetchDocs(baseUrl?: string): Promise<unknown> {
		const url = `${baseUrl || MEMORY_VAULT.BASE_URL}/docs`;
		const proxyUrl = getProxiedUrlString(url);
		const response = await fetch(proxyUrl, {
			headers: buildProxiedHeaders({ Accept: 'application/json' }),
			signal: AbortSignal.timeout(5000)
		});
		if (!response.ok) throw new Error(`Memory Vault docs: ${response.status}`);
		return response.json();
	}

	/**
	 * Search memories in the vault.
	 */
	static async searchMemories(
		query: string,
		baseUrl?: string
	): Promise<MemoryEntry[]> {
		const url = `${baseUrl || MEMORY_VAULT.BASE_URL}/api/memories/search`;
		const proxyUrl = getProxiedUrlString(url);
		const response = await fetch(proxyUrl, {
			method: 'POST',
			headers: buildProxiedHeaders({
				'Content-Type': 'application/json',
				Accept: 'application/json'
			}),
			body: JSON.stringify({ query }),
			signal: AbortSignal.timeout(10000)
		});
		if (!response.ok) throw new Error(`Memory search failed: ${response.status}`);
		return response.json();
	}

	/**
	 * Store a new memory.
	 */
	static async storeMemory(
		content: string,
		metadata?: Record<string, unknown>,
		baseUrl?: string
	): Promise<MemoryEntry> {
		const url = `${baseUrl || MEMORY_VAULT.BASE_URL}/api/memories`;
		const proxyUrl = getProxiedUrlString(url);
		const response = await fetch(proxyUrl, {
			method: 'POST',
			headers: buildProxiedHeaders({
				'Content-Type': 'application/json',
				Accept: 'application/json'
			}),
			body: JSON.stringify({ content, metadata }),
			signal: AbortSignal.timeout(10000)
		});
		if (!response.ok) throw new Error(`Memory store failed: ${response.status}`);
		return response.json();
	}

	/**
	 * List recent memories.
	 */
	static async listMemories(
		limit = 20,
		baseUrl?: string
	): Promise<MemoryEntry[]> {
		const url = `${baseUrl || MEMORY_VAULT.BASE_URL}/api/memories?limit=${limit}`;
		const proxyUrl = getProxiedUrlString(url);
		const response = await fetch(proxyUrl, {
			headers: buildProxiedHeaders({ Accept: 'application/json' }),
			signal: AbortSignal.timeout(10000)
		});
		if (!response.ok) throw new Error(`Memory list failed: ${response.status}`);
		return response.json();
	}
}
