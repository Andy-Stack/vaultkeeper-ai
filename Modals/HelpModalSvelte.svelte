<script lang="ts">
	import { Copy } from "Enums/Copy";
	import type AIAgentPlugin from "main";
	import { setIcon } from "obsidian";
	import { Resolve } from "Services/DependencyService";
	import { Services } from "Services/Services";
	import type { StreamingMarkdownService } from "Services/StreamingMarkdownService";
	import { fade } from "svelte/transition";

	export let onClose: () => void;

	const plugin: AIAgentPlugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
	const streamingMarkdownService: StreamingMarkdownService = Resolve<StreamingMarkdownService>(Services.StreamingMarkdownService);

	let closeButton: HTMLButtonElement;

	const topics: Record<number, { title: string; content: string }> = {
		1: {
			title: Copy.HelpModalAboutTitle,
			content: Copy.HelpModalAboutContent
		},
		2: {
			title: Copy.HelpModalGuideTitle,
			content: Copy.HelpModalGuideContent
		},
		3: {
			title: Copy.HelpModalTroubleshootTitle,
			content: Copy.HelpModalTroubleshootContent
		},
		4: {
			title: Copy.HelpModalPrivacyTitle,
			content: Copy.HelpModalPrivacyContent
		}
	};

	let selectedTopic: number = 1;
	let title: string = topics[selectedTopic].title;
	let content: string = streamingMarkdownService.formatText(topics[selectedTopic].content);

	function selectTopic(topicNumber: number) {
		title = "";
		content = "";
		selectedTopic = topicNumber;
		setTimeout(() => {
			title = topics[selectedTopic].title;
			content = streamingMarkdownService.formatText(topics[selectedTopic].content);
		}, 200);
	}

	$: if (closeButton) {
		setIcon(closeButton, 'circle-x');
	}
</script>

<div class="help-modal-container">
	<div class="help-modal-top-bar">
		<div class="help-modal-top-bar-content">
			{#if title !== ""}
				<div id="help-modal-title" transition:fade={{ duration: 100 }}>
					{title}
				</div>
			{/if}
			<button
			bind:this={closeButton}
			id="close-button"
			class="top-bar-button clickable-icon"
			on:click={onClose}
			aria-label="Close Conversation History"
			></button>
		</div>
	</div>
	<div class="help-modal-body">
		<div class="help-modal-topics">
			<div
				class="help-modal-topic-frame"
				class:hidden={selectedTopic !== 1}
				on:click={() => selectTopic(1)}
				on:keydown={(e) => e.key === 'Enter' && selectTopic(1)}
				role="button"
				tabindex="0">
				<div class="help-modal-topic-item">
					{topics[1].title}
				</div>
			</div>
			<div
				class="help-modal-topic-frame"
				class:hidden={selectedTopic !== 2}
				on:click={() => selectTopic(2)}
				on:keydown={(e) => e.key === 'Enter' && selectTopic(2)}
				role="button"
				tabindex="0">
				<div class="help-modal-topic-item">
					{topics[2].title}
				</div>
			</div>
			<div
				class="help-modal-topic-frame"
				class:hidden={selectedTopic !== 3}
				on:click={() => selectTopic(3)}
				on:keydown={(e) => e.key === 'Enter' && selectTopic(3)}
				role="button"
				tabindex="0">
				<div class="help-modal-topic-item">
					{topics[3].title}
				</div>
			</div>
			<div
				class="help-modal-topic-frame"
				class:hidden={selectedTopic !== 4}
				on:click={() => selectTopic(4)}
				on:keydown={(e) => e.key === 'Enter' && selectTopic(4)}
				role="button"
				tabindex="0">
				<div class="help-modal-topic-item">
					{topics[4].title}
				</div>
			</div>
			<div id="help-modal-version-string">
				Plugin version: {plugin.manifest.version}
			</div>
		</div>
		<div class="help-modal-content">
			{#if content !== ""}
				<div transition:fade={{ duration: 100 }}>
					{@html content}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.help-modal-container {
		display: grid;
		grid-template-rows: auto var(--size-4-1) 1fr var(--size-4-2);
		grid-template-columns: var(--size-4-2) 1fr var(--size-4-2);
		max-height: 60vh;
		min-height: 60vh;
	}

	.help-modal-top-bar {
		grid-row: 1;
		grid-column: 2;
		height: var(--size-4-16);
		display: grid;
		grid-template-rows: var(--size-4-2) 1fr var(--size-4-2);
		grid-template-columns: 1fr;
	}

	.help-modal-top-bar-content {
		grid-row: 2;
		grid-column: 1;
		display: grid;
		grid-template-rows: auto;
		grid-template-columns: var(--size-4-2) 1fr auto var(--size-4-2);
		background-color: var(--background-modifier-hover);
		border-radius: var(--radius-m);
	}

	#help-modal-title {
		grid-row: 1;
		grid-column: 2 / 4;
		display: inline-block;
		text-align: center;
		align-self: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
		color: var(--text-muted);
	}

	#close-button {
		grid-row: 1;
		grid-column: 3;
		z-index: 1;
	}

	.help-modal-body {
		grid-row: 3;
		grid-column: 2;
		display: grid;
		grid-template-rows: auto var(--size-4-3) auto var(--size-4-3) auto var(--size-4-3) auto 1fr;
		grid-template-columns: auto var(--size-4-2) 1fr;
		height: 100%;
		width: 100%;
		overflow: auto;
	}

	.help-modal-topic-frame {
		grid-column: 1 / 4;
		display: grid;
		grid-template-rows: auto;
		grid-template-columns: auto var(--size-4-2) 1fr;
		width: 150%;
		padding: var(--size-4-2) var(--size-4-1);
		border-radius: var(--radius-m);
		cursor: pointer;
		background-color: var(--alt-background-primary);
		transition: background-color 0.25s ease-in-out;
	}

	.help-modal-topic-frame.hidden {
		background-color: transparent;
	}

	.help-modal-topic-frame:nth-child(1) {
		grid-row: 1;
	}

	.help-modal-topic-frame:nth-child(2) {
		grid-row: 3;
	}

	.help-modal-topic-frame:nth-child(3) {
		grid-row: 5;
	}

	.help-modal-topic-frame:nth-child(4) {
		grid-row: 7;
	}

	.help-modal-topics {
		grid-row: 1 / 9;
		grid-column: 1;
		display: grid;
		max-width: 150px;
		grid-template-rows: auto var(--size-4-3) auto var(--size-4-3) auto var(--size-4-3) auto 1fr;
		grid-template-columns: auto var(--size-4-2) 1fr;
	}

	.help-modal-topic-item {
		grid-column: 1;
		display: inline-block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding: var(--size-4-1) var(--size-4-3);
		cursor: pointer;
		transition: color 0.15s ease-in-out;
	}

	.help-modal-topic-item:hover {
		color: var(--text-normal);
	}

	.help-modal-topic-item:nth-child(1) {
		grid-row: 1;
	}

	.help-modal-topic-item:nth-child(2) {
		grid-row: 3;
	}

	.help-modal-topic-item:nth-child(3) {
		grid-row: 5;
	}

	.help-modal-topic-item:nth-child(4) {
		grid-row: 7;
	}

	#help-modal-version-string {
		grid-row: 8;
		grid-column: 1;
		align-self: flex-end;
		padding: var(--size-4-1) var(--size-4-3);
		font-size: var(--font-smallest);
	}

	.help-modal-content {
		grid-row: 1 / 9;
		grid-column: 3;
		height: 100%;
		border-radius: var(--radius-m);
		background-color: var(--alt-background-primary);
		padding: 0 var(--size-4-2) var(--size-4-2) var(--size-4-6);
		overflow-y: auto;
	}
</style>
