import { MetricsService } from '$lib/services/metrics.service';
import type { ParsedMetrics, HealthStatus, SlotState, MetricsSnapshot } from '$lib/types/admin';

const MAX_HISTORY = 60; // ~3 minutes at 3s polling

/**
 * AdminStore - Reactive store for server metrics, slots, and health status.
 *
 * Manages polling lifecycle and maintains a ring buffer of metrics history
 * for chart rendering.
 */
class AdminStore {
	// Current state
	metrics = $state<ParsedMetrics | null>(null);
	slots = $state<SlotState[]>([]);
	health = $state<HealthStatus | null>(null);
	metricsHistory = $state<MetricsSnapshot[]>([]);

	// Polling state
	pollIntervalMs = $state(3000);
	isPolling = $state(false);
	lastFetchTime = $state<number | null>(null);

	// Error state
	metricsError = $state<string | null>(null);
	slotsError = $state<string | null>(null);
	healthError = $state<string | null>(null);

	private pollTimer: ReturnType<typeof setInterval> | null = null;

	// Computed
	get throughput(): number {
		return this.metrics?.predictedTokensPerSecond ?? 0;
	}

	get activeSlots(): number {
		return this.slots.filter((s) => s.is_processing).length;
	}

	get totalSlots(): number {
		return this.slots.length;
	}

	get isHealthy(): boolean {
		return this.health?.status === 'ok';
	}

	/**
	 * Fetch all metrics data in parallel.
	 */
	async fetchAll(): Promise<void> {
		const now = Date.now();

		const [metricsResult, slotsResult, healthResult] = await Promise.allSettled([
			MetricsService.fetchMetrics(),
			MetricsService.fetchSlots(),
			MetricsService.fetchHealth()
		]);

		// Process metrics
		if (metricsResult.status === 'fulfilled') {
			this.metrics = metricsResult.value;
			this.metricsError = null;

			// Append to history ring buffer
			const snapshot: MetricsSnapshot = {
				timestamp: now,
				predictedTokensPerSecond: metricsResult.value.predictedTokensPerSecond,
				promptTokensPerSecond: metricsResult.value.promptTokensPerSecond,
				requestsProcessing: metricsResult.value.requestsProcessing,
				tokensPredictedTotal: metricsResult.value.tokensPredictedTotal
			};
			this.metricsHistory = [...this.metricsHistory.slice(-(MAX_HISTORY - 1)), snapshot];
		} else {
			this.metricsError = metricsResult.reason?.message || 'Failed to fetch metrics';
		}

		// Process slots
		if (slotsResult.status === 'fulfilled') {
			this.slots = slotsResult.value;
			this.slotsError = null;
		} else {
			this.slotsError = slotsResult.reason?.message || 'Failed to fetch slots';
		}

		// Process health
		if (healthResult.status === 'fulfilled') {
			this.health = healthResult.value;
			this.healthError = null;
		} else {
			this.healthError = healthResult.reason?.message || 'Failed to fetch health';
		}

		this.lastFetchTime = now;
	}

	/**
	 * Start polling for metrics data.
	 */
	startPolling(intervalMs?: number): void {
		if (this.pollTimer) this.stopPolling();

		if (intervalMs) this.pollIntervalMs = intervalMs;
		this.isPolling = true;

		// Fetch immediately
		this.fetchAll();

		this.pollTimer = setInterval(() => {
			this.fetchAll();
		}, this.pollIntervalMs);
	}

	/**
	 * Stop polling.
	 */
	stopPolling(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
		this.isPolling = false;
	}

	/**
	 * Clear all state.
	 */
	clear(): void {
		this.stopPolling();
		this.metrics = null;
		this.slots = [];
		this.health = null;
		this.metricsHistory = [];
		this.metricsError = null;
		this.slotsError = null;
		this.healthError = null;
		this.lastFetchTime = null;
	}
}

export const adminStore = new AdminStore();
