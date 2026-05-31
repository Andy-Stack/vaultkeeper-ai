<script lang="ts">
	import { Copy } from "Enums/Copy";
	import type VaultkeeperAIPlugin from "main";
	import { DropdownComponent, setIcon } from "obsidian";
	import { Resolve } from "Services/DependencyService";
	import { Services } from "Services/Services";
	import type { StreamingMarkdownService } from "Services/StreamingMarkdownService";
	import type { WorkSpaceService } from "Services/WorkSpaceService";
	import { fade } from "svelte/transition";
	import { onMount } from "svelte";
	import type { AssetsService } from "Services/AssetsService";

	export let onClose: () => void;
	export let initialTopic: number = 1;

	const plugin: VaultkeeperAIPlugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
	const assetsService: AssetsService = Resolve<AssetsService>(Services.AssetsService);
	const streamingMarkdownService: StreamingMarkdownService = Resolve<StreamingMarkdownService>(Services.StreamingMarkdownService);
	const workSpaceService: WorkSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);

	let closeButton: HTMLButtonElement;
	let dropdownContainer: HTMLDivElement;
	let contentContainer: HTMLDivElement;

	const topics: Record<number, { title: string; content: string }> = {
		1: {
			title: Copy.HelpModalAboutTitle,
			content: Copy.HelpModalAboutContent
		},
		2: {
			title: Copy.HelpModalGettingStartedTitle,
			content: Copy.HelpModalGettingStartedContent
		},
		3: {
			title: Copy.HelpModalChatModesTitle,
			content: Copy.HelpModalChatModesContent
		},
		4: {
			title: Copy.HelpModalReferenceTitle,
			content: Copy.HelpModalReferenceContent
		},
		5: {
			title: Copy.HelpModalCustomInstructionsTitle,
			content: Copy.HelpModalCustomInstructionsContent
		},
		6: {
			title: Copy.HelpModalQuickActionsTitle,
			content: Copy.HelpModalQuickActionsContent
		},
		7: {
			title: Copy.HelpModalUploadedFilesTitle,
			content: Copy.HelpModalUploadedFilesContent
		},
		8: {
			title: Copy.HelpModalTroubleshootTitle,
			content: Copy.HelpModalTroubleshootContent
		},
		9: {
			title: Copy.HelpModalPrivacyTitle,
			content: Copy.HelpModalPrivacyContent
		}
	};

	let selectedTopic: number = initialTopic;
	let title: string = topics[selectedTopic].title;
	let contentVisible: boolean = true;

	function selectTopic(topicNumber: number) {
		title = "";
		contentVisible = false;
		selectedTopic = topicNumber;
		setTimeout(() => {
			title = topics[selectedTopic].title;
			contentVisible = true;
		}, 200);
	}

	function helpContentAction(element: HTMLElement, topic: number) {
		streamingMarkdownService.render(topics[topic].content, element, true);
		return {
			update(newTopic: number) {
				streamingMarkdownService.render(topics[newTopic].content, element, true);
			}
		};
	}

	$: if (closeButton) {
		setIcon(closeButton, 'circle-x');
	}

	async function handleLinkClick(evt: MouseEvent) {
		const target = evt.target as HTMLElement;

		const link = target.closest('.internal-link') as HTMLAnchorElement | null;
		if (!link) {
			return;
		}

		const notePath = link.getAttribute('data-href');
		if (!notePath) {
			return;
		}

		evt.preventDefault();
		evt.stopPropagation();

		await workSpaceService.openNote(notePath);
		onClose();
	}

	onMount(() => {
		if (dropdownContainer) {
			const dropdown = new DropdownComponent(dropdownContainer);

			// Add all topic options
			Object.entries(topics).forEach(([key, topic]) => {
				dropdown.addOption(key, topic.title);
			});

			// Set initial value
			dropdown.setValue(selectedTopic.toString());

			// Handle changes
			dropdown.onChange((value) => {
				selectTopic(Number(value));
			});
		}

		if (contentContainer) {
			plugin.registerDomEvent(contentContainer, 'click', handleLinkClick);
		}
	});
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
			aria-label={Copy.HelpModalCloseAriaLabel}
			></button>
		</div>
	</div>
	<div class="help-modal-body">
		<div class="help-modal-dropdown" bind:this={dropdownContainer}></div>
		<div class="help-modal-topics">
			{#each Object.entries(topics) as [key, topic] (key)}
				<div
					class="help-modal-topic-frame"
					class:hidden={selectedTopic !== Number(key)}
					on:click={() => selectTopic(Number(key))}
					on:keydown={(e) => e.key === 'Enter' && selectTopic(Number(key))}
					role="button"
					tabindex="0">
					<div class="help-modal-topic-item">
						{topic.title}
					</div>
				</div>
			{/each}
		</div>
		<div class="help-modal-content" bind:this={contentContainer}>
			{#if contentVisible}
				{#if selectedTopic === 1}
					<img class="help-modal-banner" src={assetsService.bannerSource} alt="Plugin Banner">
				{/if}
				<div transition:fade={{ duration: 100 }} use:helpContentAction={selectedTopic}></div>
				<div transition:fade={{ duration: 100 }}>
					{#if selectedTopic === 1}
						<a
							href="{plugin.manifest.authorUrl}/vaultkeeper-ai"
							style="text-decoration: none; display: inline-flex; align-items: center; gap: 0.5em; margin: 0 0 1em 0;">
							<svg
								width="1em"
								height="1em"
								viewBox="0 0 98 96"
								xmlns="http://www.w3.org/2000/svg"
								aria-label={Copy.GitHubIconAriaLabel}
								style="display: inline-block; vertical-align: middle;">
								<path fill-rule="evenodd" clip-rule="evenodd" d={Copy.GitHubIconPath} fill="currentColor"/>
							</svg>
							<span>{Copy.GitHubLinkText}</span>
						</a>
						<br>
						<span style="display: inline-block; margin-bottom: 1em;">{Copy.CoffeeLinkIntroText}</span>
						<br>
						<a href={(plugin.manifest as any).fundingUrl} style="text-decoration: none; display: inline-flex; align-items: center; gap: 0.5em;">
							<span>{Copy.CoffeeIcon}</span>
							<span>{Copy.CoffeeLinkText}</span>
						</a>
						<p style="margin-top: 1em; font-style: italic;">{Copy.ThankYouMessage}</p>
					{/if}
				</div>
				{#if selectedTopic === 1}
					<div class="help-modal-version-string" transition:fade={{ duration: 100 }}>
						<p>{Copy.PluginVersionPrefix}{plugin.manifest.version}</p>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>

<!-- margin-top: auto;
		align-self: flex-end;
		padding: var(--size-4-1) var(--size-4-3);
		font-size: var(--font-smallest); -->

<style>
	.help-modal-container {
		display: grid;
		grid-template-rows: auto var(--size-4-1) 1fr var(--size-4-2);
		grid-template-columns: var(--size-4-2) 1fr var(--size-4-2);
		max-height: 60vh;
		min-height: 60vh;
		margin: 10px;
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
		background-color: var(--background-secondary-alt);
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

	.help-modal-dropdown {
		display: none;
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

	.help-modal-topics {
		grid-row: 1 / 9;
		grid-column: 1;
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
		max-width: 150px;
	}

	.help-modal-topic-item {
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

	.help-modal-content {
		grid-row: 1 / 9;
		grid-column: 3;
		height: 100%;
		display: flex;
		flex-direction: column;
		border-radius: var(--radius-m);
		background-color: var(--alt-background-primary);
		padding: 0 var(--size-4-2) var(--size-4-2) var(--size-4-3);
		overflow-y: auto;
	}

	.help-modal-banner {
		margin-top: var(--size-2-2);
		margin-left: calc(var(--size-4-2) * -1);
		width: calc(100% + (var(--size-4-2) * 2) - var(--size-2-2));
		border-radius: var(--radius-s);
	}

	.help-modal-version-string {
		/* Absorbs leftover vertical space so the version sits bottom-right on tall
		   screens, but collapses and scrolls naturally when content overflows. */
		margin-top: auto;
		display: flex;
		justify-content: flex-end;
		padding-top: var(--size-4-2);
	}

	.help-modal-version-string p {
		margin: 0;
		font-size: var(--font-smallest);
		color: var(--text-muted);
	}

	/* Mobile styles */
	:global(.is-mobile) .help-modal-body {
		grid-template-rows: auto var(--size-4-2) 1fr var(--size-4-2) auto;
		grid-template-columns: 1fr;
	}

	:global(.is-mobile) .help-modal-dropdown {
		display: block;
		grid-row: 1;
		grid-column: 1;
		width: 100%;
	}

	.help-modal-dropdown :global(.dropdown) {
		width: 100%;
		border: solid;
		border-width: 1px;
		border-color: var(--color-accent) !important;
		outline: none;
	}

	@media (max-width: 600px) {
		.help-modal-container {
			margin: 0px;
		}
	}

	:global(.is-mobile) .help-modal-topics {
		display: none;
	}

	:global(.is-mobile) .help-modal-content {
		grid-row: 3;
		grid-column: 1;
		padding: var(--size-4-2);
	}
</style>
