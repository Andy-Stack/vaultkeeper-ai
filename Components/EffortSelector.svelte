<script lang="ts">
	import { AIEffort, iconForEffort } from "Enums/AIEffort";
	import { Copy } from "Enums/Copy";
	import { onDestroy, tick } from "svelte";
	import { setIcon } from "obsidian";
	import type { SettingsService } from "Services/SettingsService";
	import { Resolve } from "Services/DependencyService";
	import { Services } from "Services/Services";

    export let focusInput: () => void;
    export let effortSelectionAreaActive: boolean;

    const settingsService: SettingsService = Resolve<SettingsService>(Services.SettingsService);

    const settingsSubscription: object = settingsService.subscribeToSettingsChanged(changed => {
        if (changed.includes("effort")) {
            currentEffort = settingsService.settings.effort;
        }
    });

    onDestroy(() => settingsService.unsubscribe(settingsSubscription));

    let height = 0;

    let effortSelectionContentDiv: HTMLDivElement;
    let effortSelectionContainer: HTMLDivElement;

    let currentEffort: AIEffort = settingsService.settings.effort;
    let selectedEffort: AIEffort = AIEffort.Fast;

    let iconElements: (HTMLDivElement | null)[] = [null, null];
    let indexedEfforts: AIEffort[] = [AIEffort.Fast, AIEffort.Thinking];

    $: if (iconElements.some(element => element !== null)) {
        iconElements.forEach((element, index) => {
            if (element) {
                setIcon(element, iconForEffort(indexedEfforts[index]));
            }
        });
    }

    $: effortSelectionAreaActive, updateHeight();

    $: if (effortSelectionAreaActive) {
        selectedEffort = AIEffort.Fast;
        setTimeout(() => {
            if (effortSelectionContainer && effortSelectionAreaActive) {
                document.addEventListener("click", handleClickOutside);
                updateHeight();

                if (effortSelectionContentDiv) {
                    effortSelectionContentDiv.focus();
                }
            }
        }, 10);
    } else {
        document.removeEventListener("click", handleClickOutside);
    }

    function updateHeight() {
        tick().then(() => {
            if (effortSelectionContentDiv) {
                height = effortSelectionContentDiv.scrollHeight;
            } else {
                height = 0;
            }
        });
    }

    function handleClickOutside(event: MouseEvent) {
        if (effortSelectionContainer && !effortSelectionContainer.contains(event.target as Node)) {
            effortSelectionAreaActive = false;
        }
    }

    async function handleEffortSelect(e?: MouseEvent) {
        currentEffort = selectedEffort;
        effortSelectionAreaActive = false;

        await settingsService.updateSettings(settings => {
            settings.effort = currentEffort
        });

        e?.preventDefault();
        focusInput();
    }

    async function handleKeydown(e: KeyboardEvent) {
        if (!effortSelectionAreaActive) {
            return;
        }
        e.preventDefault();

        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            selectedEffort = selectedEffort === AIEffort.Fast ? AIEffort.Thinking : AIEffort.Fast;
            return;
        }

        if (e.key === "Enter") {
            handleEffortSelect();
        }

        if (e.key === "Escape") {
            effortSelectionAreaActive = false;
            return;
        }
    }
</script>

<div id="effort-selection" style:height="{height}px" bind:this={effortSelectionContainer}>
    {#if effortSelectionAreaActive}
        <div
            id="effort-selection-inner-container"
            bind:this={effortSelectionContentDiv}
            role="listbox"
            tabindex="0"
            on:keydown={handleKeydown}>
            <div class="effort-selection-container"
                role="option"
                tabindex="-1"
                aria-selected={selectedEffort === AIEffort.Fast}
                class:current-effort={currentEffort === AIEffort.Fast}
                style:background-color={selectedEffort === AIEffort.Fast ? "color-mix(in srgb, var(--color-accent) 30%, transparent)" : "transparent"}
                on:mouseenter={() => selectedEffort = AIEffort.Fast}
                on:mousedown={handleEffortSelect}
                on:keydown={() => {}}>
                <div class="effort-selection-icon" bind:this={iconElements[indexedEfforts.indexOf(AIEffort.Fast)]}></div>
                <div class="effort-selection-title">{Copy.EffortFastTitle}</div>
                <div class="effort-selection-subtitle">{Copy.EffortFastDesc}</div>
            </div>
            <div class="effort-selection-container"
                role="option"
                tabindex="-1"
                aria-selected={selectedEffort === AIEffort.Thinking}
                class:current-effort={currentEffort === AIEffort.Thinking}
                style:background-color={selectedEffort === AIEffort.Thinking ? "color-mix(in srgb, var(--color-accent) 30%, transparent)" : "transparent"}
                on:mouseenter={() => selectedEffort = AIEffort.Thinking}
                on:mousedown={handleEffortSelect}
                on:keydown={() => {}}>
                <div class="effort-selection-icon" bind:this={iconElements[indexedEfforts.indexOf(AIEffort.Thinking)]}></div>
                <div class="effort-selection-title">{Copy.EffortThinkingTitle}</div>
                <div class="effort-selection-subtitle">{Copy.EffortThinkingDesc}</div>
            </div>
        </div>
    {/if}
</div>

<style>
    #effort-selection {
        max-height: 15em;
        transition: height 0.2s ease-out;
        overflow: auto;
        scroll-behavior: smooth;
    }

    #effort-selection::-webkit-scrollbar {
        display: none;
    }

    #effort-selection-inner-container {
        display: flex;
        flex-direction: column;
        gap: var(--size-2-2);
    }

    .effort-selection-container {
        display: grid;
        grid-template-rows: auto auto;
        grid-template-columns: auto 1fr;
        border-style: solid;
        border-radius: var(--size-2-2);
        border-color: var(--background-primary-alt);
        border-width: 1px;
        padding: var(--size-2-2) var(--size-4-2);
        cursor: pointer;
    }

    .effort-selection-icon {
        grid-row: 1 / 3;
        grid-column: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding-right: var(--size-4-2);
        pointer-events: none;
    }

    .effort-selection-container.current-effort {
        box-shadow: inset 0px 0px 4px 1px var(--color-accent);
        border-color: var(--color-accent);
    }

    .effort-selection-title {
        grid-row: 1;
        grid-column: 2;
        font-family: var(--font-interface-theme);
    }

    .effort-selection-subtitle {
        grid-row: 2;
        grid-column: 2;
        font-family: var(--font-interface-theme);
        font-size: var(--font-smallest);
        color: var(--text-muted);
    }

    :global(.is-mobile) .effort-selection-container[aria-selected="true"] {
        background-color: transparent !important;
    }
</style>
