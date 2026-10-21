<script lang="ts">
	import { iconForFreeEdit } from "Enums/ChatMode";
	import { Copy } from "Enums/Copy";
	import { onDestroy, tick } from "svelte";
	import { setIcon } from "obsidian";
	import type { SettingsService } from "Services/SettingsService";
	import { Resolve } from "Services/DependencyService";
	import { Services } from "Services/Services";

    export let focusInput: () => void;
    export let freeEditSelectionAreaActive: boolean;

    const settingsService: SettingsService = Resolve<SettingsService>(Services.SettingsService);

    const settingsSubscription: object = settingsService.subscribeToSettingsChanged(changed => {
        if (changed.includes("freeEdit")) {
            currentFreeEdit = settingsService.settings.freeEdit;
        }
    });

    onDestroy(() => settingsService.unsubscribe(settingsSubscription));

    let height = 0;

    let freeEditSelectionContentDiv: HTMLDivElement;
    let freeEditSelectionContainer: HTMLDivElement;

    let currentFreeEdit: boolean = settingsService.settings.freeEdit;
    let selectedFreeEdit: boolean = false;

    let iconElements: (HTMLDivElement | null)[] = [null, null];
    let indexedOptions: boolean[] = [false, true];

    $: if (iconElements.some(element => element !== null)) {
        iconElements.forEach((element, index) => {
            if (element) {
                setIcon(element, iconForFreeEdit(indexedOptions[index]));
            }
        });
    }

    $: freeEditSelectionAreaActive, updateHeight();

    $: if (freeEditSelectionAreaActive) {
        selectedFreeEdit = false;
        setTimeout(() => {
            if (freeEditSelectionContainer && freeEditSelectionAreaActive) {
                document.addEventListener("click", handleClickOutside);
                updateHeight();

                if (freeEditSelectionContentDiv) {
                    freeEditSelectionContentDiv.focus();
                }
            }
        }, 10);
    } else {
        document.removeEventListener("click", handleClickOutside);
    }

    function updateHeight() {
        tick().then(() => {
            if (freeEditSelectionContentDiv) {
                height = freeEditSelectionContentDiv.scrollHeight;
            } else {
                height = 0;
            }
        });
    }

    function handleClickOutside(event: MouseEvent) {
        if (freeEditSelectionContainer && !freeEditSelectionContainer.contains(event.target as Node)) {
            freeEditSelectionAreaActive = false;
        }
    }

    async function handleFreeEditSelect(e?: MouseEvent) {
        currentFreeEdit = selectedFreeEdit;
        freeEditSelectionAreaActive = false;

        await settingsService.updateSettings(settings => {
            settings.freeEdit = currentFreeEdit
        });

        e?.preventDefault();
        focusInput();
    }

    async function handleKeydown(e: KeyboardEvent) {
        if (!freeEditSelectionAreaActive) {
            return;
        }
        e.preventDefault();

        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            selectedFreeEdit = !selectedFreeEdit;
            return;
        }

        if (e.key === "Enter") {
            handleFreeEditSelect();
        }

        if (e.key === "Escape") {
            freeEditSelectionAreaActive = false;
            return;
        }
    }
</script>

<div id="free-edit-selection" style:height="{height}px" bind:this={freeEditSelectionContainer}>
    {#if freeEditSelectionAreaActive}
        <div
            id="free-edit-selection-inner-container"
            bind:this={freeEditSelectionContentDiv}
            role="listbox"
            tabindex="0"
            on:keydown={handleKeydown}>
            <div class="free-edit-selection-container"
                role="option"
                tabindex="-1"
                aria-selected={!selectedFreeEdit}
                class:current-free-edit={!currentFreeEdit}
                style:background-color={!selectedFreeEdit ? "var(--interactive-accent)" : "transparent"}
                on:mouseenter={() => selectedFreeEdit = false}
                on:mousedown={handleFreeEditSelect}
                on:keydown={() => {}}>
                <div class="free-edit-selection-icon" bind:this={iconElements[indexedOptions.indexOf(false)]}></div>
                <div class="free-edit-selection-title">{Copy.FreeEditOffTitle}</div>
                <div class="free-edit-selection-subtitle">{Copy.FreeEditOffDesc}</div>
            </div>
            <div class="free-edit-selection-container"
                role="option"
                tabindex="-1"
                aria-selected={selectedFreeEdit}
                class:current-free-edit={currentFreeEdit}
                style:background-color={selectedFreeEdit ? "var(--interactive-accent)" : "transparent"}
                on:mouseenter={() => selectedFreeEdit = true}
                on:mousedown={handleFreeEditSelect}
                on:keydown={() => {}}>
                <div class="free-edit-selection-icon" bind:this={iconElements[indexedOptions.indexOf(true)]}></div>
                <div class="free-edit-selection-title">{Copy.FreeEditOnTitle}</div>
                <div class="free-edit-selection-subtitle">{Copy.FreeEditOnDesc}</div>
            </div>
        </div>
    {/if}
</div>

<style>
    #free-edit-selection {
        max-height: 15em;
        transition: height 0.2s ease-out;
        overflow: auto;
        scroll-behavior: smooth;
    }

    #free-edit-selection::-webkit-scrollbar {
        display: none;
    }

    #free-edit-selection-inner-container {
        display: flex;
        flex-direction: column;
        gap: var(--size-2-2);
    }

    .free-edit-selection-container {
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

    .free-edit-selection-icon {
        grid-row: 1 / 3;
        grid-column: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding-right: var(--size-4-2);
        pointer-events: none;
    }

    .free-edit-selection-container.current-free-edit {
        box-shadow: inset 0px 0px 4px 1px var(--color-accent);
        border-color: var(--color-accent);
    }

    .free-edit-selection-title {
        grid-row: 1;
        grid-column: 2;
        font-family: var(--font-interface-theme);
    }

    .free-edit-selection-subtitle {
        grid-row: 2;
        grid-column: 2;
        font-family: var(--font-interface-theme);
        font-size: var(--font-smallest);
        color: var(--text-muted);
    }

    :global(.is-mobile) .free-edit-selection-container[aria-selected="true"] {
        background-color: transparent !important;
    }
</style>
