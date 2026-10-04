<script lang="ts">
	import { onMount, type Component } from "svelte";
	import { fade, fly } from "svelte/transition";

	export let content: Component<any>;
	export let contentProps: Record<string, unknown>;
	export let label: string;
	export let dismissOnBackdropTap: boolean = true;
	export let maxHeight: string = "85vh";
	export let onClosed: () => void;

	let visible = false;

	// Becoming visible after mount is what plays the intro transitions
	onMount(() => {
		visible = true;
	});

	export function close() {
		visible = false;
	}

	function dismiss() {
		if (dismissOnBackdropTap) {
			close();
		}
	}

	// Capture phase so Obsidian's own Escape handling doesn't also fire
	function handleKeydown(e: KeyboardEvent) {
		if (visible && e.key === "Escape") {
			e.stopPropagation();
			dismiss();
		}
	}
</script>

<svelte:window onkeydowncapture={handleKeydown} />

{#if visible}
	<div class="bottom-sheet-backdrop" aria-hidden="true" onclick={dismiss} transition:fade={{ duration: 200 }}></div>
	<div
		class="bottom-sheet"
		role="dialog"
		aria-modal="true"
		aria-label={label}
		style:max-height={maxHeight}
		transition:fly={{ y: "100%", duration: 250, opacity: 1 }}
		onoutroend={onClosed}>
		<div class="bottom-sheet-handle" aria-hidden="true"></div>
		<div class="bottom-sheet-content">
			<svelte:component this={content} {...contentProps} {close} />
		</div>
	</div>
{/if}

<style>
	.bottom-sheet-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--layer-modal);
		background-color: var(--background-modifier-cover);
	}

	.bottom-sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: var(--layer-modal);
		display: flex;
		flex-direction: column;
		margin: 0 auto;
		padding-bottom: max(var(--safe-area-inset-bottom, 0px), var(--size-4-3));
		background-color: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-bottom: none;
		border-top-left-radius: var(--radius-xl);
		border-top-right-radius: var(--radius-xl);
	}

	.bottom-sheet-handle {
		flex-shrink: 0;
		width: 36px;
		height: 4px;
		margin: var(--size-4-2) auto;
		border-radius: 2px;
		background-color: var(--background-modifier-border-hover);
	}

	.bottom-sheet-content {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
</style>
