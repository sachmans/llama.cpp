<script lang="ts">
	import type { MetricsSnapshot } from '$lib/types/admin';

	interface Props {
		history: MetricsSnapshot[];
		metric?: 'predictedTokensPerSecond' | 'promptTokensPerSecond' | 'requestsProcessing';
		label?: string;
		height?: number;
	}

	let {
		history,
		metric = 'predictedTokensPerSecond',
		label = 'Generation Speed (tok/s)',
		height = 120
	}: Props = $props();

	let svgWidth = 600;
	let svgHeight = $derived(height);
	let padding = { top: 10, right: 10, bottom: 20, left: 50 };
	let chartW = svgWidth - padding.left - padding.right;
	let chartH = $derived(svgHeight - padding.top - padding.bottom);

	let values = $derived(history.map((h) => h[metric]));
	let maxVal = $derived(Math.max(...values, 1));

	let polylinePath = $derived.by(() => {
		if (values.length < 2) return '';
		const step = chartW / (values.length - 1);
		return values
			.map((v, i) => {
				const x = padding.left + i * step;
				const y = padding.top + chartH - (v / maxVal) * chartH;
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	});

	let areaPath = $derived.by(() => {
		if (values.length < 2) return '';
		const step = chartW / (values.length - 1);
		const points = values.map((v, i) => {
			const x = padding.left + i * step;
			const y = padding.top + chartH - (v / maxVal) * chartH;
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		});
		const baseline = padding.top + chartH;
		return `M ${padding.left},${baseline} L ${points.join(' L ')} L ${padding.left + (values.length - 1) * (chartW / (values.length - 1))},${baseline} Z`;
	});

	let gridLines = $derived.by(() => {
		const lines = [];
		const steps = 4;
		for (let i = 0; i <= steps; i++) {
			const y = padding.top + (chartH / steps) * i;
			const val = maxVal - (maxVal / steps) * i;
			lines.push({ y, label: val.toFixed(1) });
		}
		return lines;
	});

	let latestValue = $derived(values.length > 0 ? values[values.length - 1] : 0);
</script>

<div class="rounded-lg border border-border bg-card p-4">
	<div class="mb-2 flex items-baseline justify-between">
		<h3 class="text-sm font-medium text-muted-foreground">{label}</h3>
		<span class="text-lg font-bold tabular-nums">{latestValue.toFixed(1)}</span>
	</div>

	{#if values.length >= 2}
		<svg viewBox="0 0 {svgWidth} {svgHeight}" class="w-full" style="height: {height}px">
			<!-- Grid lines -->
			{#each gridLines as line}
				<line
					x1={padding.left}
					y1={line.y}
					x2={svgWidth - padding.right}
					y2={line.y}
					stroke="currentColor"
					stroke-opacity="0.1"
					stroke-width="1"
				/>
				<text
					x={padding.left - 6}
					y={line.y + 3}
					text-anchor="end"
					fill="currentColor"
					fill-opacity="0.4"
					font-size="10"
				>
					{line.label}
				</text>
			{/each}

			<!-- Area fill -->
			<path d={areaPath} fill="currentColor" fill-opacity="0.05" class="text-primary" />

			<!-- Line -->
			<polyline
				points={polylinePath}
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				class="text-primary"
			/>

			<!-- Latest point indicator -->
			{#if values.length > 0}
				{@const lastX = padding.left + (values.length - 1) * (chartW / (values.length - 1))}
				{@const lastY = padding.top + chartH - (values[values.length - 1] / maxVal) * chartH}
				<circle cx={lastX} cy={lastY} r="3" fill="currentColor" class="text-primary" />
			{/if}
		</svg>
	{:else}
		<div
			class="flex items-center justify-center text-sm text-muted-foreground"
			style="height: {height}px"
		>
			Waiting for data...
		</div>
	{/if}
</div>
