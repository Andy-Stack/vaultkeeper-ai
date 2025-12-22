<script lang="ts">
	import type { Attachment } from "Conversations/Attachment";
	import { toMimeType } from "Enums/MimeType";
	import { setIcon } from "obsidian";
    import {
		isAudioFile,
		isImageFile,
		isKnownFileType,
		isTextFile,
		isVideoFile,
		MimeTypeToFileTypes,
	} from "Enums/FileType";

	export let attachments: Attachment[] = [];

	let removeAttachmentButtons: (HTMLButtonElement | null)[] = [];
	let iconElements: (HTMLDivElement | null)[] = [];
	let attachmentElements: (HTMLDivElement | null)[] = [];
	let selectedElement: HTMLDivElement | null = null;

	$: if (removeAttachmentButtons.length > 0) {
		removeAttachmentButtons.forEach((button) => {
			if (button) {
				setIcon(button, "circle-x");
			}
		});
	}

	$: if (iconElements.length > 0) {
		iconElements.forEach((iconElement, index) => {
			if (iconElement && attachments[index]) {
				const iconName = getIconName(attachments[index]);
                setIcon(iconElement, iconName);
			}
		});
	}

	function getIconName(attachment: Attachment | null): string {
		if (attachment === null) {
			return "file";
		}

		const fileTypes = MimeTypeToFileTypes[toMimeType(attachment.mimeType)];

		if (fileTypes.some((fileType) => isTextFile(fileType))) {
			return "file-text";
		}
		if (fileTypes.some((fileType) => isImageFile(fileType))) {
			return "file-image";
		}
		if (fileTypes.some((fileType) => isAudioFile(fileType))) {
			return "file-music";
		}
		if (fileTypes.some((fileType) => isVideoFile(fileType))) {
			return "file-play";
		}
		if (fileTypes.some((fileType) => isKnownFileType(fileType))) {
			return "file";
		}
		return "file";
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

<div id="chat-attachments-container">
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
				bind:this={iconElements[index]}
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

<style>
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
		border: var(--border-width) solid var(--background-modifier-border);
		border-radius: var(--radius-m);
        max-width: 15vw;
	}

    .chat-attachmanet.selected {
		box-shadow: inset 0px 0px 4px 1px var(--color-accent);
	}

	.chat-attachment-icon {
		grid-row: 2;
		grid-column: 2;
		align-content: center;
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
