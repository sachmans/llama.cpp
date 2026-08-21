/**
 * Admin analytics dashboard types
 */

export interface ParsedMetrics {
	promptTokensTotal: number;
	tokensPredictedTotal: number;
	promptSecondsTotal: number;
	predictedTokensPerSecond: number;
	promptTokensPerSecond: number;
	requestsProcessing: number;
	requestsDeferred: number;
	busySlotsPerDecode: number;
	nDecodeTotal: number;
	nTokensMax: number;
}

export interface MetricsSnapshot {
	timestamp: number;
	predictedTokensPerSecond: number;
	promptTokensPerSecond: number;
	requestsProcessing: number;
	tokensPredictedTotal: number;
}

export interface HealthStatus {
	status: 'ok' | 'loading model' | 'error';
	progress?: number;
}

export interface SlotState {
	id: number;
	id_task: number;
	n_ctx: number;
	is_processing: boolean;
	state: string;
	prompt?: string;
	generated?: string;
	n_decoded?: number;
	n_remain?: number;
}

export interface QueryLogEntry {
	id: string;
	timestamp: number;
	model?: string;
	prompt_n: number;
	predicted_n: number;
	predicted_per_second: number;
	cache_n: number;
	duration_ms: number;
}

export interface MemoryVaultStatus {
	connected: boolean;
	baseUrl: string;
	error?: string;
}

export interface MemoryEntry {
	id: string;
	content: string;
	metadata?: Record<string, unknown>;
	created_at?: string;
	updated_at?: string;
}
