<script lang="ts">
	import type { ISearchState } from 'Stores/SearchStateStore';
    import { tick } from 'svelte';

    export let searchState: ISearchState;

    let contentDiv: HTMLDivElement;
    let height = 0;

    $: searchState.results, updateHeight();

    function updateHeight() {
        tick().then(() => {
            if (contentDiv) {
                height = contentDiv.scrollHeight;
            }
        });
    }

</script>

<div id="input-search-results" style:height="{height}px">
    <div id="input-search-results-inner-container" bind:this={contentDiv}>
        {#each searchState.results as searchResult}
            <div style:background-color="{searchResult === searchState.selectedResult ? "red" : "transparent"}">{searchResult}</div>
        {/each}
    </div>
</div>

<style>
    #input-search-results {
        max-height: 15em;
        transition: height 0.2s ease-out;
        overflow: auto;
        scroll-behavior: smooth;
        scroll-snap-type: mandatory;
    }

    #input-search-results::-webkit-scrollbar {
        display: none;
    }

    #input-search-results-inner-container {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
</style>