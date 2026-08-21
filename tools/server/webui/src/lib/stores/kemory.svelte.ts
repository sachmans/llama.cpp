import { KemoryService } from '$lib/services/kemory.service';
import { KEMORY } from '$lib/constants/api-endpoints';
import { KEMORY_CONFIG_LOCALSTORAGE_KEY } from '$lib/constants/localstorage-keys';
import type {
	KemoryConfig,
	KemoryTool,
	KemoryMemory,
	KemoryNamespace,
	KemoryStatus
} from '$lib/types/kemory';

/**
 * KemoryStore - Reactive state for the Kemory MCP memory store.
 *
 * Connection config (mcp_url + api_key) is persisted to localStorage so the
 * connection survives across browser sessions. Per the Kemory brief:
 *   - recall/list are read-only and run freely;
 *   - store is gated behind explicit user action (the "Store" button here IS
 *     that consent — the UI never stores silently).
 */
class KemoryStore {
	status = $state<KemoryStatus>('disconnected');
	config = $state<KemoryConfig | null>(null);

	tools = $state<KemoryTool[]>([]);
	brief = $state<string>('');
	namespaces = $state<KemoryNamespace[]>([]);
	memories = $state<KemoryMemory[]>([]);
	lastRecallText = $state<string>('');

	loading = $state(false);
	error = $state<string | null>(null);

	/**
	 * When true and a connection exists, chat turns deterministically recall memory
	 * into context (pull) and store the exchange afterwards (write). See
	 * buildContextBlock() / captureTurn(), wired into the chat store.
	 */
	autoMemory = $state(true);
	/** Namespace used for auto-captured chat memories. */
	memoryNamespace = $state(KEMORY.DEFAULT_NAMESPACE);

	private initialized = false;

	get isConnected(): boolean {
		return this.status === 'connected';
	}

	/** Load persisted config from localStorage and try to connect. Call once on mount. */
	async init(): Promise<void> {
		if (this.config) {
			if (!this.isConnected) await this.connect();
			return;
		}
		const stored = this.loadConfig();
		if (stored) {
			this.config = stored;
			await this.connect();
		}
	}

	private loadConfig(): KemoryConfig | null {
		if (typeof localStorage === 'undefined') return null;
		try {
			const raw = localStorage.getItem(KEMORY_CONFIG_LOCALSTORAGE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as Partial<KemoryConfig>;
			if (parsed.mcpUrl && parsed.apiKey) {
				return { mcpUrl: parsed.mcpUrl, apiKey: parsed.apiKey, agentName: parsed.agentName };
			}
		} catch {
			// ignore malformed config
		}
		return null;
	}

	private persistConfig(config: KemoryConfig): void {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(KEMORY_CONFIG_LOCALSTORAGE_KEY, JSON.stringify(config));
	}

	/**
	 * Save config (if provided) and establish the connection: verify via tools/list,
	 * then refresh the brief and namespaces.
	 */
	async connect(config?: KemoryConfig): Promise<boolean> {
		if (config) {
			this.config = {
				mcpUrl: config.mcpUrl.replace(/\/$/, ''),
				apiKey: config.apiKey.trim(),
				agentName: config.agentName
			};
			this.persistConfig(this.config);
		}
		if (!this.config) {
			this.error = 'No Kemory connection configured';
			this.status = 'error';
			return false;
		}

		this.status = 'checking';
		this.error = null;
		try {
			this.tools = await KemoryService.listTools(this.config);
			this.status = 'connected';
			// Best-effort context refresh; failures here don't drop the connection.
			void this.refreshBrief();
			void this.fetchNamespaces();
			return true;
		} catch (err) {
			this.status = 'error';
			this.error = err instanceof Error ? err.message : 'Failed to connect to Kemory';
			return false;
		}
	}

	async refreshBrief(): Promise<void> {
		if (!this.config) return;
		try {
			this.brief = await KemoryService.getBrief(this.config);
		} catch {
			// brief is non-essential; leave prior value
		}
	}

	async fetchNamespaces(): Promise<void> {
		if (!this.config || !this.isConnected) return;
		try {
			this.namespaces = await KemoryService.listNamespaces(this.config);
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to list namespaces';
		}
	}

	/** Recall is read-only per the brief; runs freely. */
	async recall(query: string, namespace?: string, limit = 10): Promise<void> {
		if (!this.config || !this.isConnected) return;
		this.loading = true;
		this.error = null;
		try {
			const res = await KemoryService.recallMemory(this.config, { query, namespace, limit });
			this.memories = res.memories;
			this.lastRecallText = res.text;
			if (res.isError) this.error = res.text || 'Recall returned an error';
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Recall failed';
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Store a memory. This is only ever invoked from an explicit user action in the
	 * UI (the consent gate required by the brief). Returns a status line on success.
	 */
	async store(
		content: string,
		namespace = KEMORY.DEFAULT_NAMESPACE,
		contentType = 'text'
	): Promise<{ ok: boolean; message: string }> {
		if (!this.config || !this.isConnected) {
			return { ok: false, message: 'Not connected to Kemory' };
		}
		this.loading = true;
		this.error = null;
		try {
			const res = await KemoryService.storeMemory(this.config, { content, namespace, contentType });
			if (res.isError) {
				this.error = res.text || 'Store failed';
				return { ok: false, message: this.error };
			}
			void this.fetchNamespaces();
			return { ok: true, message: res.text || 'Memory stored' };
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Store failed';
			return { ok: false, message: this.error };
		} finally {
			this.loading = false;
		}
	}

	// --- Auto-memory: deterministic recall + capture around a chat turn ---------

	/**
	 * Lazily load persisted config and connect. Safe to call on every turn — it
	 * only does work on the first call (or after a disconnect). Never throws.
	 */
	private async ensureReady(): Promise<boolean> {
		if (this.isConnected) return true;
		if (this.initialized && !this.config) return false;
		this.initialized = true;
		if (!this.config) {
			const stored = this.loadConfig();
			if (!stored) return false;
			this.config = stored;
		}
		try {
			return await this.connect();
		} catch {
			return false;
		}
	}

	/**
	 * PULL: build a system-context block of relevant memory for the given topic
	 * (typically the latest user message). Returns null when auto-memory is off,
	 * no connection is configured, or nothing relevant came back. Best-effort:
	 * any failure returns null so the chat turn proceeds normally.
	 */
	async buildContextBlock(topic: string): Promise<string | null> {
		if (!this.autoMemory || !topic.trim()) return null;
		if (!(await this.ensureReady()) || !this.config) return null;
		try {
			const { text, isError } = await KemoryService.getContext(this.config, {
				topic,
				maxResults: 5
			});
			if (isError || !text) return null;
			const trimmed = text.trim();
			// Skip non-answers so we don't waste context on "no memories found".
			if (!trimmed || /^no\b|no (relevant )?memor/i.test(trimmed)) return null;
			return [
				'## Relevant memory (from Kemory)',
				'Persistent memory recalled for this user. Use it if relevant; do not repeat it verbatim unless asked.',
				'',
				trimmed
			].join('\n');
		} catch {
			return null;
		}
	}

	/**
	 * WRITE: auto-store a chat exchange as durable memory. Fire-and-forget from the
	 * chat store; never throws. Skips trivial/empty turns.
	 */
	async captureTurn(userText: string, assistantText: string): Promise<void> {
		if (!this.autoMemory) return;
		const user = (userText || '').trim();
		const assistant = (assistantText || '').trim();
		if (!assistant || user.length + assistant.length < 20) return;
		if (!(await this.ensureReady()) || !this.config) return;

		const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s);
		const content = `User: ${cap(user, 2000)}\nAssistant: ${cap(assistant, 2000)}`;
		try {
			await KemoryService.storeMemory(this.config, {
				content,
				namespace: this.memoryNamespace,
				contentType: 'conversation'
			});
		} catch {
			// best-effort; a failed capture must not disrupt chat
		}
	}

	disconnect(clearStored = false): void {
		this.status = 'disconnected';
		this.tools = [];
		this.brief = '';
		this.namespaces = [];
		this.memories = [];
		this.lastRecallText = '';
		this.error = null;
		if (clearStored) {
			this.config = null;
			this.initialized = false;
			if (typeof localStorage !== 'undefined') {
				localStorage.removeItem(KEMORY_CONFIG_LOCALSTORAGE_KEY);
			}
		}
	}
}

export const kemoryStore = new KemoryStore();
