import type { QueryLogEntry } from '$lib/types/admin';

const MAX_ENTRIES = 100;

/**
 * QueryLogStore - Client-side ring buffer of recent completion requests.
 *
 * Populated by hooking into chat completion responses.
 * Entries are per-session (lost on refresh).
 */
class QueryLogStore {
	entries = $state<QueryLogEntry[]>([]);

	get recentEntries(): QueryLogEntry[] {
		return [...this.entries].reverse();
	}

	get averageSpeed(): number {
		const withSpeed = this.entries.filter((e) => e.predicted_per_second > 0);
		if (withSpeed.length === 0) return 0;
		return withSpeed.reduce((sum, e) => sum + e.predicted_per_second, 0) / withSpeed.length;
	}

	get totalTokens(): number {
		return this.entries.reduce((sum, e) => sum + e.predicted_n, 0);
	}

	addEntry(entry: QueryLogEntry): void {
		this.entries = [...this.entries.slice(-(MAX_ENTRIES - 1)), entry];
	}

	clearEntries(): void {
		this.entries = [];
	}
}

export const queryLogStore = new QueryLogStore();
