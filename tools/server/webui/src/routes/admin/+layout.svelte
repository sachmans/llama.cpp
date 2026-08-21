<script lang="ts">
	import '../../app.css';
	import { base } from '$app/paths';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from 'svelte-sonner';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { TOOLTIP_DELAY_DURATION } from '$lib/constants';

	let { children } = $props();
</script>

<Tooltip.Provider delayDuration={TOOLTIP_DELAY_DURATION}>
	<ModeWatcher />
	<Toaster richColors />

	<div class="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
		<!-- Top nav bar -->
		<header
			class="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4"
		>
			<div class="flex items-center gap-3">
				<a
					href="{base}/"
					class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="m15 18-6-6 6-6" />
					</svg>
					Back to Chat
				</a>
				<div class="h-5 w-px bg-border"></div>
				<h1 class="text-base font-semibold">Admin Dashboard</h1>
			</div>
		</header>

		<!-- Main content -->
		<main class="flex-1 overflow-y-auto">
			{@render children?.()}
		</main>
	</div>
</Tooltip.Provider>
