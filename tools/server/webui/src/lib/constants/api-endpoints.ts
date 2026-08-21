export const API_MODELS = {
	LIST: '/v1/models',
	LOAD: '/models/load',
	UNLOAD: '/models/unload'
};

/** Admin dashboard endpoints exposed by llama-server (/metrics needs --metrics) */
export const API_ADMIN = {
	METRICS: '/metrics',
	SLOTS: '/slots',
	HEALTH: '/health'
};

/**
 * Memory Vault REST API.
 * NOTE: this host currently serves the Kemory MCP API (see KEMORY below); the REST
 * paths used by memory-vault.service.ts return 404, so that panel is still WIP.
 */
export const MEMORY_VAULT = {
	BASE_URL: 'https://api.memory.dxb-gw.basanti.ai'
};

/** CORS proxy endpoint path */
export const CORS_PROXY_ENDPOINT = '/cors-proxy';

/**
 * Kemory MCP memory store.
 * Transport sub-paths are appended to the user-configured mcp_url (see KemoryConfig).
 */
export const KEMORY = {
	/** MCP transport sub-paths (relative to the configured mcp_url) */
	TOOLS_LIST: '/tools/list',
	TOOLS_CALL: '/tools/call',
	PROMPTS_GET: '/prompts/get',
	/** Prompt name for the connection brief (refresh on every reconnect) */
	BRIEF_PROMPT: 'kemory_brief',
	/** Default namespace per the Kemory brief */
	DEFAULT_NAMESPACE: 'shared'
};
