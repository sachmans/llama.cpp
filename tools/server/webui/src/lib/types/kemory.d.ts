/**
 * Kemory MCP memory-store types.
 *
 * Kemory is a remote MCP server (persistent, cross-session, cross-AI memory).
 * Transport is HTTP: POST {mcpUrl}/tools/list, /tools/call, /prompts/get with an
 * X-API-Key header. See kemory.service.ts for the client.
 */

export interface KemoryConfig {
	/** Base URL for the MCP transport, e.g. https://api.memory.dxb-gw.basanti.ai/mcp/v1 */
	mcpUrl: string;
	/** X-API-Key value obtained from the pairing/claim step */
	apiKey: string;
	/** Agent name assigned at claim time, e.g. llama-cpp-fdcb (display only) */
	agentName?: string;
}

export interface KemoryTool {
	name: string;
	description: string;
	inputSchema?: Record<string, unknown>;
}

/** Normalised result of a tools/call — text content is flattened out of the MCP envelope. */
export interface KemoryToolResult {
	text: string;
	isError: boolean;
	raw: unknown;
}

/** A single memory parsed out of a kemory_recall_memory text response. */
export interface KemoryMemory {
	id?: string;
	namespace?: string;
	contentType?: string;
	content: string;
	version?: string;
	quality?: string;
}

export interface KemoryNamespace {
	name: string;
	count: number;
}

export type KemoryStatus = 'connected' | 'disconnected' | 'checking' | 'error';
