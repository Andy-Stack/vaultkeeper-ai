<script lang="ts">
	import { slide } from "svelte/transition";

    let displayItem: HTMLElement | undefined;
	let contentDiv: HTMLDivElement;

    export function setDisplayItem(element: HTMLElement) {
        displayItem = element;
    }

    export function clearDisplayItem() {
        displayItem = undefined;
    }

    $: if (contentDiv && displayItem) {
        contentDiv.empty();
        contentDiv.appendChild(displayItem);
    }
</script>

{#if displayItem}
    <div id="input-display-wrapper" transition:slide>
        <div id="input-display-container" bind:this={contentDiv}>
        </div>
    </div>
{/if}

<style>
	#input-display-wrapper {
		transition: height 0.2s ease-out;
		overflow: hidden;
	}

	#input-display-container {
		display: flex;
		overflow-y: auto;
		scroll-behavior: smooth;
        justify-content: center;
        align-items: flex-start;
        margin: var(--size-4-2) 0;
        padding: var(--size-4-2);
        border: solid;
        border-radius: var(--radius-m);
        border-width: var(--border-width);
        border-color: var(--color-accent);
        box-shadow: inset 0px 0px 2px 1px var(--color-accent);
        font-size: var(--font-ui-medium);
        font-family: var(--font-interface-theme);
        transition: border-color 0.5s ease-out;
        max-height: 30vh;
	}

    :global(.is-mobile) #input-display-container {
        max-height: 15vh;
    }

    #input-display-container::-webkit-scrollbar {
        display: none;
    }
</style>
