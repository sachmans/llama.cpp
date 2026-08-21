import { base } from '$app/paths';
import { getAuthHeaders } from '$lib/utils/api-headers';
import { apiFetch } from '$lib/utils/api-fetch';
import { API_ADMIN } from '$lib/constants/api-endpoints';
import type { ParsedMetrics, HealthStatus, SlotState } from '$lib/types/admin';

/**
 * MetricsService - Stateless service for fetching server metrics, slots, and health.
 *
 * The /metrics endpoint returns Prometheus text format, not JSON,
 * so we parse it manually. /slots and /health return JSON.
 */
export class MetricsService {
	/**
	 * Fetch and parse Prometheus metrics from /metrics endpoint.
	 * Requires --metrics flag on the server.
	 */
	static async fetchMetrics(): Promise<ParsedMetrics> {
		const response = await fetch(`${base}${API_ADMIN.METRICS}`, {
			headers: getAuthHeaders()
		});

		if (!response.ok) {
			if (response.status === 404) {
				throw new Error('Metrics endpoint not available. Start server with --metrics flag.');
			}
			throw new Error(`Metrics fetch failed: ${response.status}`);
		}

		const text = await response.text();
		return MetricsService.parsePrometheusText(text);
	}

	/**
	 * Fetch slot data from /slots endpoint.
	 */
	static async fetchSlots(): Promise<SlotState[]> {
		return apiFetch<SlotState[]>(API_ADMIN.SLOTS, { authOnly: true });
	}

	/**
	 * Fetch health status from /health endpoint.
	 */
	static async fetchHealth(): Promise<HealthStatus> {
		return apiFetch<HealthStatus>(API_ADMIN.HEALTH, { authOnly: true });
	}

	/**
	 * Parse Prometheus exposition format text into structured metrics.
	 *
	 * Format: lines of "metric_name value" or "metric_name{labels} value"
	 * Comment lines start with #
	 */
	static parsePrometheusText(text: string): ParsedMetrics {
		const values: Record<string, number> = {};

		for (const line of text.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;

			// Handle metrics with labels: metric{label="value"} 123
			// Strip label portion if present
			const match = trimmed.match(/^([^\s{]+)(?:\{[^}]*\})?\s+(.+)$/);
			if (match) {
				values[match[1]] = parseFloat(match[2]);
			}
		}

		return {
			promptTokensTotal: values['llamacpp:prompt_tokens_total'] ?? 0,
			tokensPredictedTotal: values['llamacpp:tokens_predicted_total'] ?? 0,
			promptSecondsTotal: values['llamacpp:prompt_seconds_total'] ?? 0,
			predictedTokensPerSecond: values['llamacpp:predicted_tokens_seconds'] ?? 0,
			promptTokensPerSecond: values['llamacpp:prompt_tokens_seconds'] ?? 0,
			requestsProcessing: values['llamacpp:requests_processing'] ?? 0,
			requestsDeferred: values['llamacpp:requests_deferred'] ?? 0,
			busySlotsPerDecode: values['llamacpp:n_busy_slots_per_decode'] ?? 0,
			nDecodeTotal: values['llamacpp:n_decode_total'] ?? 0,
			nTokensMax: values['llamacpp:n_tokens_max'] ?? 0
		};
	}
}
