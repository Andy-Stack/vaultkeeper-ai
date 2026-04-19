<script lang="ts">
	import { ChatMode, iconForChatMode } from "Enums/ChatMode";
	import { Copy } from "Enums/Copy";
	import { tick } from "svelte";
	import { setIcon } from "obsidian";

    export let focusInput: () => void;
    export let chatModeSelectionAreaActive: boolean;
    export let currentChatMode: ChatMode;

    let height = 0;

    let ChatModeSelectionContentDiv: HTMLDivElement;
    let chatModeSelectionContainer: HTMLDivElement;

    let selectedChatMode: number = ChatMode.ReadOnly;

    let iconElements: (HTMLDivElement | null)[] = [null, null, null];

    $: if (iconElements.some(element => element !== null)) {
        iconElements.forEach((element, index) => {
            if (element) {
                setIcon(element, iconForChatMode(index));
            }
        });
    }

    $: chatModeSelectionAreaActive, updateHeight();

    $: if (chatModeSelectionAreaActive) {
        selectedChatMode = ChatMode.ReadOnly;
        setTimeout(() => {
            if (chatModeSelectionContainer && chatModeSelectionAreaActive) {
                document.addEventListener("click", handleClickOutside);
                updateHeight();

                if (ChatModeSelectionContentDiv) {
                    ChatModeSelectionContentDiv.focus();
                }
            }
        }, 10);
    } else {
        document.removeEventListener("click", handleClickOutside);
    }

    function updateHeight() {
        tick().then(() => {
            if (ChatModeSelectionContentDiv) {
                height = ChatModeSelectionContentDiv.scrollHeight;
            } else {
                height = 0;
            }
        });
    }

    function handleClickOutside(event: MouseEvent) {
        if (chatModeSelectionContainer && !chatModeSelectionContainer.contains(event.target as Node)) {
            chatModeSelectionAreaActive = false;
        }
    }

    function handleChatModeSelect(e?: MouseEvent) {
        currentChatMode = selectedChatMode;
        chatModeSelectionAreaActive = false;

        e?.preventDefault();
        focusInput();
    }

    async function handleKeydown(e: KeyboardEvent) {
        if (!chatModeSelectionAreaActive) {
            return;
        }
        e.preventDefault();

        if (e.key.startsWith("Arrow")) {
            if (e.key === "ArrowUp") {
                selectedChatMode = selectedChatMode <= 0 ? 2 : selectedChatMode - 1;
            }
            if (e.key === "ArrowDown") {
                selectedChatMode = selectedChatMode >= 2 ? 0 : selectedChatMode + 1;
            }
            return;
        }

        if (e.key === "Enter") {
            handleChatModeSelect();
        }

        if (e.key === "Escape") {
            chatModeSelectionAreaActive = false;
            return;
        }
    }
</script>

<div id="chat-mode-selection" style:height="{height}px" bind:this={chatModeSelectionContainer}>
    {#if chatModeSelectionAreaActive}
        <div 
            id="chat-mode-selection-inner-container" 
            bind:this={ChatModeSelectionContentDiv}
            role="listbox"
            tabindex="0"
            on:keydown={handleKeydown}>
            <div class="chat-mode-selection-container"
                role="option"
                tabindex="-1"
                aria-selected={selectedChatMode === ChatMode.ReadOnly}
                class:current-chat-mode={currentChatMode === ChatMode.ReadOnly}
                style:background-color={selectedChatMode === ChatMode.ReadOnly ? "var(--interactive-accent)" : "transparent"}
                on:mouseenter={() => selectedChatMode = ChatMode.ReadOnly}
                on:mousedown={handleChatModeSelect}
                on:keydown={() => {}}>
                <div class="chat-mode-selection-icon" bind:this={iconElements[ChatMode.ReadOnly]}></div>
                <div class="chat-mode-selection-title">{Copy.ChatModeReadOnlyTitle}</div>
                <div class="chat-mode-selection-subtitle">{Copy.ChatModeReadOnlyDesc}</div>
            </div>
            <div class="chat-mode-selection-container"
                role="option"
                tabindex="-1"
                aria-selected={selectedChatMode === ChatMode.Edit}
                class:current-chat-mode={currentChatMode === ChatMode.Edit}
                style:background-color={selectedChatMode === ChatMode.Edit ? "var(--interactive-accent)" : "transparent"}
                on:mouseenter={() => selectedChatMode = ChatMode.Edit}
                on:mousedown={handleChatModeSelect}
                on:keydown={() => {}}>
                <div class="chat-mode-selection-icon" bind:this={iconElements[ChatMode.Edit]}></div>
                <div class="chat-mode-selection-title">{Copy.ChatModeEditTitle}</div>
                <div class="chat-mode-selection-subtitle">{Copy.ChatModeEditDesc}</div>
            </div>
            <div class="chat-mode-selection-container"
                role="option"
                tabindex="-1"
                aria-selected={selectedChatMode === ChatMode.Planning}
                class:current-chat-mode={currentChatMode === ChatMode.Planning}
                style:background-color={selectedChatMode === ChatMode.Planning ? "var(--interactive-accent)" : "transparent"}
                on:mouseenter={() => selectedChatMode = ChatMode.Planning}
                on:mousedown={handleChatModeSelect}
                on:keydown={() => {}}>
                <div class="chat-mode-selection-icon" bind:this={iconElements[ChatMode.Planning]}></div>
                <div class="chat-mode-selection-title">{Copy.ChatModePlanningTitle}</div>
                <div class="chat-mode-selection-subtitle">{Copy.ChatModePlanningDesc}</div>
            </div>
        </div>
    {/if}
</div>

<style>
    #chat-mode-selection {
        max-height: 15em;
        transition: height 0.2s ease-out;
        overflow: auto;
        scroll-behavior: smooth;
    }

    #chat-mode-selection::-webkit-scrollbar {
        display: none;
    }

    #chat-mode-selection-inner-container {
        display: flex;
        flex-direction: column;
        gap: var(--size-2-2);
    }

    .chat-mode-selection-container {
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

    .chat-mode-selection-icon {
        grid-row: 1 / 3;
        grid-column: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding-right: var(--size-4-2);
        pointer-events: none;
    }

    .chat-mode-selection-container.current-chat-mode {
        box-shadow: inset 0px 0px 4px 1px var(--color-accent);
        border-color: var(--color-accent);
    }

    .chat-mode-selection-title {
        grid-row: 1;
        grid-column: 2;
        font-family: var(--font-interface-theme);
    }

    .chat-mode-selection-subtitle {
        grid-row: 2;
        grid-column: 2;
        font-family: var(--font-interface-theme);
        font-size: var(--font-smallest);
        color: var(--text-muted);
    }

    :global(.is-mobile) .chat-mode-selection-container[aria-selected="true"] {
        background-color: transparent !important;
    }
</style>