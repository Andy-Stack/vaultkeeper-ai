<script lang="ts">
	import { basename } from "path-browserify";
	import type { ISearchState, SearchStateStore } from "Stores/SearchStateStore";
    import { tick } from "svelte";
    import { setIcon } from "obsidian";
    import { SearchTrigger } from "Enums/SearchTrigger";
    import { Resolve } from "Services/DependencyService";
    import { Services } from "Services/Services";

    export let searchState: ISearchState;
    export let onResultAccept: () => void;

    const searchStateStore: SearchStateStore = Resolve<SearchStateStore>(Services.SearchStateStore);

    let height = 0;
    let contentDiv: HTMLDivElement;
    let resultElements: (HTMLDivElement | null)[] = [];
    let iconElements: (HTMLDivElement | null)[] = [];

    $: searchState.results, updateHeight();

    $: if (searchState.selectedResult && resultElements.length > 0) {
        scrollSelectedIntoView();
    }

    $: if (searchState.results.length > 0 && iconElements.length > 0) {
        iconElements.forEach((iconEl) => {
            if (iconEl) {
                const iconName = getIconName(searchState.trigger);
                setIcon(iconEl, iconName);
            }
        });
    }

    function getIconName(trigger: SearchTrigger | null): string {
        switch(trigger) {
            case SearchTrigger.File:
                return "file-text";
            case SearchTrigger.Folder:
                return "folder";
            case SearchTrigger.Tag:
                return "tag";
            default:
                return "file-text";
        }
    }

    function updateHeight() {
        tick().then(() => {
            if (contentDiv) {
                height = contentDiv.scrollHeight;
            }
        });
    }

    function scrollSelectedIntoView() {
        tick().then(() => {
            const selectedIndex = searchState.results.indexOf(searchState.selectedResult);
            if (selectedIndex !== -1 && resultElements[selectedIndex]) {
                resultElements[selectedIndex]?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "nearest"
                });
            }
        });
    }

</script>

<div id="input-search-results" style:height="{height}px">
    <div id="input-search-results-inner-container" bind:this={contentDiv} role="listbox" tabindex="0">
        {#each searchState.results as searchResult, index}
            <div class="input-search-result-container"
                role="option"
                tabindex="-1"
                aria-selected={searchResult === searchState.selectedResult}
                bind:this={resultElements[index]}
                style:background-color={searchResult === searchState.selectedResult ? "var(--interactive-accent)" : "transparent"}
                on:mouseenter={() => searchStateStore.setSelectedResult(index)}
                on:mousedown={onResultAccept}
                on:keydown={() => {}}>
                <div class="input-search-result-icon" bind:this={iconElements[index]}></div>
                <div class="input-search-result-title">{basename(searchResult)}</div>
                <div class="input-search-result-subtitle">{searchResult}</div>
            </div>
        {/each}
    </div>
</div>

<style>
    #input-search-results {
        max-height: 15em;
        transition: height 0.2s ease-out;
        overflow: auto;
        scroll-behavior: smooth;
    }

    #input-search-results::-webkit-scrollbar {
        display: none;
    }

    #input-search-results-inner-container {
        display: flex;
        flex-direction: column;
        gap: var(--size-2-2);
    }

    .input-search-result-container {
        display: grid;
        grid-template-rows: auto auto;
        grid-template-columns: auto 1fr;
        border-style: solid;
        border-radius: var(--size-2-2);
        border-color: var(--background-primary-alt);
        border-width: 1px;
        padding: var(--size-2-2) var(--size-4-2);
        cursor: pointer;
        position: relative;
        z-index: 10;
    }

    .input-search-result-icon {
        grid-row: 1 / 3;
        grid-column: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding-right: var(--size-4-2);
        pointer-events: none;
    }

    .input-search-result-title {
        grid-row: 1;
        grid-column: 2;
        font-family: var(--font-interface-theme);
        pointer-events: none;
    }

    .input-search-result-subtitle {
        grid-row: 2;
        grid-column: 2;
        font-family: var(--font-interface-theme);
        pointer-events: none;
        font-size: var(--font-smallest);
        color: var(--text-muted);
    }

    :global(.is-mobile) .input-search-result-container[aria-selected="true"] {
        background-color: transparent !important;
    }
</style>