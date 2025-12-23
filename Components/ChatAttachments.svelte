<script lang="ts">
	import type { Attachment } from "Conversations/Attachment";
	import { setElementIcon } from "Helpers/ElementHelper";
	import { setIcon } from "obsidian";
	import { tick } from "svelte";

	export let attachments: Attachment[] = [];

	let removeAttachmentButtons: (HTMLButtonElement | null)[] = [];
	let attachmentElements: (HTMLDivElement | null)[] = [];
	let selectedElement: HTMLDivElement | null = null;
	let contentDiv: HTMLDivElement;
	let height = 0;

	$: attachments, updateHeight();

	$: if (removeAttachmentButtons.length > 0) {
		removeAttachmentButtons.forEach((button) => {
			if (button) {
				setIcon(button, "circle-x");
			}
		});
	}

	function updateHeight() {
		tick().then(() => {
			if (contentDiv) {
				height = contentDiv.scrollHeight;
			}
		});
	}

	function removeAttachment(attachment: Attachment) {
		attachments = attachments.filter((a) => a !== attachment);
	}

	function handleKeydown(event: KeyboardEvent, attachment: Attachment) {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			removeAttachment(attachment);
		}
	}

	function handleFocus(event: FocusEvent) {
		selectedElement = event.currentTarget as HTMLDivElement;
	}

	function handleBlur() {
		selectedElement = null;
	}
</script>

<div id="chat-attachments-wrapper" style:height="{height}px">
	<div id="chat-attachments-container" bind:this={contentDiv}>
		{#each attachments as attachment, index}
			<div class="chat-attachmanet"
	            class:selected={attachmentElements[index] === selectedElement}
	            role="option"
	            tabindex="0"
	            aria-selected={attachmentElements[index] === selectedElement ? "true" : "false"}
	            on:keydown={(e) => handleKeydown(e, attachment)}
	            on:mouseover={handleFocus}
	            on:mouseleave={handleBlur}
	            on:focus={handleFocus}
	            on:blur={handleBlur}
	            bind:this={attachmentElements[index]}>
				<div
					class="chat-attachment-icon"
					use:setElementIcon={attachment.getIconName()}
				></div>
				<div class="chat-attachment-info">
	                <div class="chat-attachment-name" aria-label="{attachment.fileName}">{attachment.fileName}</div>
	                <div class="chat-attachment-size">{attachment.approximateFileSizeMB()}MB</div>
	            </div>
				<button
					class="chat-attachment-remove transparent-button"
					bind:this={removeAttachmentButtons[index]}
					on:click={() => {
						removeAttachment(attachment);
					}}
					aria-label="Remove Attachment"
				>
				</button>
			</div>
		{/each}
	</div>
</div>

<style>
	#chat-attachments-wrapper {
		transition: height 0.2s ease-out;
		overflow: hidden;
	}

	#chat-attachments-container {
		display: flex;
		overflow-x: auto;
		overflow-y: hidden;
		scroll-behavior: smooth;
		gap: var(--size-4-2);
	}

	#chat-attachments-container::-webkit-scrollbar {
		display: none;
	}

	.chat-attachmanet {
		display: grid;
		grid-template-rows: var(--size-4-2) auto var(--size-4-2);
		grid-template-columns: var(--size-4-2) auto var(--size-4-2) auto var(--size-4-2) auto var(--size-4-2);
		background-color: var(--background-secondary-alt);
		border: var(--border-width) solid var(--background-modifier-border);
		border-radius: var(--radius-m);
        max-width: 33%;
        min-width: 110px;
		flex-shrink: 0;
	}

    .chat-attachmanet.selected {
		box-shadow: inset 0px 0px 4px 1px var(--color-accent);
	}

	.chat-attachment-icon {
		grid-row: 2;
		grid-column: 2;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.chat-attachment-info {
		grid-row: 2;
		grid-column: 4;
		min-width: 40px;
		overflow: hidden;
	}

    .chat-attachment-name {
        display: inline-block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
        padding: 0;
        font-size: var(--font-smaller);
    }

    .chat-attachment-size {
        padding: 0;
        font-size: var(--font-smallest);
        color: var(--text-muted);
    }

	.chat-attachment-remove {
		grid-row: 2;
		grid-column: 6;
        align-self: center;
        padding: 0;
	}
</style>
