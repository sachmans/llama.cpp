<script lang="ts">
	interface Props {
		title: string;
		value: string;
		subtitle?: string;
		sparklineData?: number[];
		status?: 'success' | 'warning' | 'error' | 'neutral';
	}

	let { title, value, subtitle, sparklineData, status = 'neutral' }: Props = $props();

	let sparklinePath = $derived.by(() => {
		if (!sparklineData || sparklineData.length < 2) return '';
		const max = Math.max(...sparklineData, 1);
		const min = Math.min(...sparklineData, 0);
		const range = max - min || 1;
		const w = 80;
		const h = 24;
		const step = w / (sparklineData.length - 1);

		return sparklineData
			.map((v, i) => {
				const x = i * step;
				const y = h - ((v - min) / range) * h;
				return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
			})
			.join(' ');
	});

	const statusColor: Record<string, string> = {
		success: 'text-green-500',
		warning: 'text-yellow-500',
		error: 'text-red-500',
		neutral: 'text-muted-foreground'
	};
</script>

<div class="rounded-lg border border-border bg-card p-4">
	<div class="flex items-start justify-between">
		<div class="min-w-0 flex-1">
			<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
			<p class="mt-1 text-2xl font-bold tabular-nums {statusColor[status]}">{value}</p>
			{#if subtitle}
				<p class="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
			{/if}
		</div>
		{#if sparklineData && sparklineData.length >= 2}
			<svg viewBox="0 0 80 24" class="h-6 w-20 shrink-0 text-primary/60">
				<path d={sparklinePath} fill="none" stroke="currentColor" stroke-width="1.5" />
			</svg>
		{/if}
	</div>
</div>
