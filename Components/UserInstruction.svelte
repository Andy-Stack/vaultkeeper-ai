<script lang="ts">
	import { Copy } from "Enums/Copy";
	import { Path } from "Enums/Path";
	import type AIAgentPlugin from "main";
	import { basename } from "path";
	import { Resolve } from "Services/DependencyService";
	import type { FileSystemService } from "Services/FileSystemService";
	import type { SettingsService } from "Services/SettingsService";
	import { Services } from "Services/Services";
	import { tick } from "svelte";

    export let userInstructionActive: boolean;

    const plugin: AIAgentPlugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
    const settingsService: SettingsService = Resolve<SettingsService>(Services.SettingsService);
    const fileSystemService: FileSystemService = Resolve<FileSystemService>(Services.FileSystemService);

    let height = 0;

    let instructionsContentDiv: HTMLDivElement;
    let emptyInstructionsContentDiv: HTMLDivElement;
    let instructionsElements: (HTMLDivElement | null)[] = [];
    let resultsContainer: HTMLDivElement;

    let userInstructions: string[] = [];
    let selectedInstruction: number = 0;

    $: userInstructions, updateHeight();

    $: if (selectedInstruction !== undefined && instructionsElements.length > 0) {
        scrollSelectedIntoView();
    }

    $: if (userInstructionActive) {
        selectedInstruction = 0;
        loadUserInstructions();
        setTimeout(() => {
            if (resultsContainer && userInstructionActive) {
                document.addEventListener("click", handleClickOutside);
            }
        }, 10);
    } else {
        userInstructions = [];
        document.removeEventListener("click", handleClickOutside);
    }

    function updateHeight() {
        tick().then(() => {
            if (instructionsContentDiv) {
                height = instructionsContentDiv.scrollHeight;
            }
            else if (emptyInstructionsContentDiv) {
                height = emptyInstructionsContentDiv.scrollHeight;
            } else {
                height = 0;
            }
        });
    }

    function handleClickOutside(event: MouseEvent) {
        if (resultsContainer && !resultsContainer.contains(event.target as Node)) {
            userInstructionActive = false;
        }
    }

    async function loadUserInstructions() {
        const files = await fileSystemService.listFilesInDirectory(Path.UserInstructions, true, true);
        userInstructions = files.map(file => file.path).filter(path => path != Path.ExampleUserInstructions);

        if (userInstructions.length > 0) {
            userInstructions = [Copy.NoUserInstruction, ...userInstructions];
        }

        tick().then(() => {
            if (instructionsContentDiv) {
                instructionsContentDiv.focus();
            }
        });
    }

    function handleInstructionSelect() {
        if (selectedInstruction < userInstructions.length) {
            settingsService.settings.userInstruction = userInstructions[selectedInstruction];
            settingsService.saveSettings();
        }
        userInstructionActive = false;
    }

    async function handleKeydown(e: KeyboardEvent) {
        if (!userInstructionActive) {
            return;
        }
        e.preventDefault();

        if (e.key.startsWith("Arrow")) {
            if (e.key === "ArrowUp") {
                selectedInstruction = selectedInstruction <= 0 ? userInstructions.length - 1 : selectedInstruction - 1;
            }
            if (e.key === "ArrowDown") {
                selectedInstruction = selectedInstruction >= userInstructions.length - 1 ? 0 : selectedInstruction + 1;
            }
            return;
        }

        if (e.key === "Enter") {
            handleInstructionSelect();
        }

        if (e.key === "Escape") {
            userInstructionActive = false;
            return;
        }
    }

    function scrollSelectedIntoView() {
        tick().then(() => {
            if (selectedInstruction < instructionsElements.length) {
                instructionsElements[selectedInstruction]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'nearest'
                });
            }
        });
    }
</script>

<div id="user-instruction-results" style:height="{height}px" bind:this={resultsContainer}>
    {#if userInstructionActive}
        {#if userInstructions.length === 0}
            <div bind:this={emptyInstructionsContentDiv}>
                <div id="user-instruction-empty" class="user-instruction-container">
                    <div class="user-instruction-title">
                        <span>
                            {Copy.UserInstructions1}
                            <span id="user-instruction-link">
                                {Copy.UserInstructions2}
                            </span>
                            {Copy.UserInstructions3}
                        </span>
                    </div>
                </div>
            </div>
        {/if}
        {#if userInstructions.length > 0}
            {@const currentInstruction = settingsService.settings.userInstruction}
            <div 
                id="user-instruction-results-inner-container" 
                bind:this={instructionsContentDiv}
                role="listbox"
                tabindex="0"
                on:keydown={handleKeydown}>
                {#each userInstructions as userInstruction, index}
                    <div class="user-instruction-container"
                        role="option"
                        tabindex="-1"
                        aria-selected={selectedInstruction === index}
                        class:current-instruction={currentInstruction === userInstruction}
                        style:background-color={selectedInstruction === index ? "var(--interactive-accent)" : "transparent"}
                        bind:this={instructionsElements[index]}
                        on:mouseenter={() => selectedInstruction = index}
                        on:click={handleInstructionSelect}
                        on:keydown={() => {}}>
                        <div class="user-instruction-title">{basename(userInstruction)}</div>
                        {#if userInstruction !== basename(userInstruction)}
                            <div class="user-instruction-subtitle">{userInstruction}</div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</div>

<style>
    #user-instruction-results {
        max-height: 15em;
        transition: height 0.2s ease-out;
        overflow: auto;
        scroll-behavior: smooth;
    }

    #user-instruction-results::-webkit-scrollbar {
        display: none;
    }

    #user-instruction-empty {
        padding-top: var(--size-4-2);
        padding-bottom: var(--size-4-2);
        display: flex;
        justify-content: center;
    }

    #user-instruction-results-inner-container {
        display: flex;
        flex-direction: column;
        gap: var(--size-2-2);
    }

    .user-instruction-container {
        display: grid;
        grid-template-rows: auto auto;
        grid-template-columns: 1fr;
        border-style: solid;
        border-radius: var(--size-2-2);
        border-color: var(--background-primary-alt);
        border-width: 1px;
        padding: var(--size-2-2) var(--size-4-2);
        cursor: pointer;
    }

    .user-instruction-container.current-instruction {
        box-shadow: inset 0px 0px 4px 1px var(--color-accent);
        border-color: var(--color-accent);
    }

    .user-instruction-title {
        grid-row: 1;
        grid-column: 1;
        font-family: var(--font-interface-theme);
    }

    .user-instruction-subtitle {
        grid-row: 2;
        grid-column: 1;
        font-family: var(--font-interface-theme);
        font-size: var(--font-smallest);
        color: var(--text-muted);
    }

    #user-instruction-link {
        color: var(--interactive-accent);
        cursor: pointer;
    }

    #user-instruction-link:hover {
        text-decoration: underline;
    }
</style>