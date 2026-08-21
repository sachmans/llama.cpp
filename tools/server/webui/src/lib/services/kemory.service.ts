import { getProxiedUrlString, buildProxiedHeaders } from '$lib/utils/cors-proxy';
import { KEMORY } from '$lib/constants/api-endpoints';
import type {
	KemoryConfig,
	KemoryTool,
	KemoryToolResult,
	KemoryMemory,
	KemoryNamespace
} from '$lib/types/kemory';

/**
 * KemoryService - Stateless client for the Kemory MCP memory store.
 *
 * Kemory speaks MCP over plain HTTP (POST /tools/list, /tools/call, /prompts/get)
 * and authenticates with an X-API-Key header. Every call is routed through
 * llama-server's /cors-proxy so the browser can reach the remote HTTPS endpoint
 * without CORS trouble; the proxy forwards the X-API-Key via the x-proxy-header-*
 * convention (see cors-proxy.ts).
 */
export class KemoryService {
	private static proxied(config: KemoryConfig, subPath: string): string {
		return getProxiedUrlString(`${config.mcpUrl}${subPath}`);
	}

	private static headers(config: KemoryConfig): Record<string, string> {
		return buildProxiedHeaders({
			'Content-Type': 'application/json',
			Accept: 'application/json',
			'X-API-Key': config.apiKey
		});
	}

	private static async post(
		config: KemoryConfig,
		subPath: string,
		body: Record<string, unknown>,
		timeoutMs = 15000
	): Promise<unknown> {
		const response = await fetch(this.proxied(config, subPath), {
			method: 'POST',
			headers: this.headers(config),
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(timeoutMs)
		});
		if (!response.ok) {
			throw new Error(`Kemory ${subPath} failed: ${response.status} ${response.statusText}`);
		}
		return response.json();
	}

	/**
	 * List available tools. Deprecated s9nmem_* duplicates are filtered out so only
	 * the current kemory_* tools surface.
	 */
	static async listTools(config: KemoryConfig): Promise<KemoryTool[]> {
		const data = (await this.post(config, KEMORY.TOOLS_LIST, {})) as { tools?: KemoryTool[] };
		const tools = data?.tools ?? [];
		return tools.filter((t) => !t.name.startsWith('s9nmem_'));
	}

	/**
	 * Call a tool and flatten the MCP text-content envelope
	 * ({ content: [{ type: 'text', text }], isError }) into a plain result.
	 */
	static async callTool(
		config: KemoryConfig,
		name: string,
		args: Record<string, unknown>,
		timeoutMs = 15000
	): Promise<KemoryToolResult> {
		const raw = (await this.post(
			config,
			KEMORY.TOOLS_CALL,
			{ name, arguments: args },
			timeoutMs
		)) as { content?: Array<{ type?: string; text?: string }>; isError?: boolean };

		const text = (raw?.content ?? [])
			.filter((c) => c?.type === 'text' && typeof c.text === 'string')
			.map((c) => c.text)
			.join('\n')
			.trim();

		return { text, isError: Boolean(raw?.isError), raw };
	}

	/**
	 * Fetch a named prompt (used to refresh the connection brief on reconnect).
	 * Kemory returns { name, version, description, content }.
	 */
	static async getPrompt(config: KemoryConfig, name: string): Promise<string> {
		const data = (await this.post(config, KEMORY.PROMPTS_GET, { name })) as {
			content?: string;
			messages?: Array<{ content?: { text?: string } | string }>;
		};
		if (typeof data?.content === 'string') return data.content;
		// Fallback for a standard MCP prompts/get message shape.
		if (Array.isArray(data?.messages)) {
			return data.messages
				.map((m) => (typeof m.content === 'string' ? m.content : (m.content?.text ?? '')))
				.join('\n')
				.trim();
		}
		return '';
	}

	/** Convenience: refresh the Kemory connection brief. */
	static getBrief(config: KemoryConfig): Promise<string> {
		return this.getPrompt(config, KEMORY.BRIEF_PROMPT);
	}

	// --- Typed memory helpers -------------------------------------------------

	static storeMemory(
		config: KemoryConfig,
		params: {
			content: string;
			namespace?: string;
			contentType?: string;
			metadata?: Record<string, unknown>;
			ttlSeconds?: number;
		}
	): Promise<KemoryToolResult> {
		const args: Record<string, unknown> = {
			content: params.content,
			namespace: params.namespace ?? KEMORY.DEFAULT_NAMESPACE
		};
		if (params.contentType) args.content_type = params.contentType;
		if (params.metadata) args.metadata = params.metadata;
		if (params.ttlSeconds) args.ttl_seconds = params.ttlSeconds;
		return this.callTool(config, 'kemory_store_memory', args);
	}

	static async recallMemory(
		config: KemoryConfig,
		params: { query?: string; namespace?: string; limit?: number }
	): Promise<{ memories: KemoryMemory[]; text: string; isError: boolean }> {
		const args: Record<string, unknown> = {};
		if (params.query) args.query = params.query;
		if (params.namespace) args.namespace = params.namespace;
		if (params.limit) args.limit = params.limit;

		const result = await this.callTool(config, 'kemory_recall_memory', args);
		return {
			memories: parseRecallText(result.text),
			text: result.text,
			isError: result.isError
		};
	}

	static async listNamespaces(config: KemoryConfig): Promise<KemoryNamespace[]> {
		const result = await this.callTool(config, 'kemory_list_namespaces', {});
		return parseNamespaces(result.text);
	}

	/**
	 * Get synthesized contextual memory for a topic (used for deterministic recall
	 * injection before a chat turn). Searches across all namespaces unless one is
	 * given, and the response already includes a cross-agent context section.
	 * Kept on a short timeout so it never stalls a chat turn.
	 */
	static async getContext(
		config: KemoryConfig,
		params: { topic: string; namespace?: string; maxResults?: number },
		timeoutMs = 8000
	): Promise<{ text: string; isError: boolean }> {
		const args: Record<string, unknown> = { topic: params.topic };
		if (params.namespace) args.namespace = params.namespace;
		if (params.maxResults) args.max_results = params.maxResults;
		const result = await this.callTool(config, 'kemory_get_context', args, timeoutMs);
		return { text: result.text, isError: result.isError };
	}
}

/**
 * Parse the human-readable text returned by kemory_recall_memory into structured
 * entries. Kemory returns text blocks like:
 *
 *   --- Memory 1 ---
 *   ID: <uuid>
 *   Namespace: shared
 *   Type: text
 *   Content: <possibly multi-line>
 *   Version: 1 | Quality: 0.35
 *
 * The parser is tolerant: any field it can't find is left undefined, and a block
 * with no recognisable content is skipped.
 */
export function parseRecallText(text: string): KemoryMemory[] {
	if (!text) return [];
	const blocks = text.split(/---\s*Memory\s+\d+\s*---/i).slice(1);
	const memories: KemoryMemory[] = [];

	for (const block of blocks) {
		const id = block.match(/^\s*ID:\s*(.+)$/m)?.[1]?.trim();
		const namespace = block.match(/^\s*Namespace:\s*(.+)$/m)?.[1]?.trim();
		const contentType = block.match(/^\s*Type:\s*(.+)$/m)?.[1]?.trim();
		const versionLine = block.match(/^\s*Version:\s*(.+)$/m)?.[1]?.trim();

		let version: string | undefined;
		let quality: string | undefined;
		if (versionLine) {
			const parts = versionLine.split('|').map((p) => p.trim());
			version = parts[0];
			quality = parts.find((p) => /^Quality:/i.test(p))?.replace(/^Quality:\s*/i, '');
		}

		// Content runs from "Content:" up to the trailing Version line (or block end).
		const contentMatch = block.match(/Content:\s*([\s\S]*?)(?:\n\s*Version:[^\n]*)?\s*$/);
		const content = contentMatch?.[1]?.trim() ?? '';

		if (content || id) {
			memories.push({ id, namespace, contentType, content, version, quality });
		}
	}
	return memories;
}

/**
 * Parse kemory_list_namespaces text ("  - <name>: <n> memories") into entries.
 */
export function parseNamespaces(text: string): KemoryNamespace[] {
	if (!text) return [];
	const namespaces: KemoryNamespace[] = [];
	const re = /^\s*-\s*(.+?):\s*(\d+)\s*memories?/gim;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) {
		namespaces.push({ name: m[1].trim(), count: Number(m[2]) });
	}
	return namespaces;
}
