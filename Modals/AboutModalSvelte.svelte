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
	import { AboutModalTopic } from "Enums/AboutModalTopic";

	export let onClose: () => void;
	export let initialTopic: AboutModalTopic = AboutModalTopic.About;

	const plugin: VaultkeeperAIPlugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
	const assetsService: AssetsService = Resolve<AssetsService>(Services.AssetsService);
	const streamingMarkdownService: StreamingMarkdownService = Resolve<StreamingMarkdownService>(Services.StreamingMarkdownService);
	const workSpaceService: WorkSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);

	let closeButton: HTMLButtonElement;
	let dropdownContainer: HTMLDivElement;
	let contentContainer: HTMLDivElement;

	const topics: Record<AboutModalTopic, { title: string; content: string }> = {
		[AboutModalTopic.About]: {
			title: Copy.AboutModalAboutTitle,
			content: Copy.AboutModalAboutContent
		},
		[AboutModalTopic.WhatsNew]: {
			title: Copy.AboutModalWhatsNewTitle,
			content: Copy.AboutModalWhatsNewContent
		},
		[AboutModalTopic.GettingStarted]: {
			title: Copy.AboutModalGettingStartedTitle,
			content: Copy.AboutModalGettingStartedContent
		},
		[AboutModalTopic.ChatModes]: {
			title: Copy.AboutModalChatModesTitle,
			content: Copy.AboutModalChatModesContent
		},
		[AboutModalTopic.Reference]: {
			title: Copy.AboutModalReferenceTitle,
			content: Copy.AboutModalReferenceContent
		},
		[AboutModalTopic.CustomInstructions]: {
			title: Copy.AboutModalCustomInstructionsTitle,
			content: Copy.AboutModalCustomInstructionsContent
		},
		[AboutModalTopic.QuickActions]: {
			title: Copy.AboutModalQuickActionsTitle,
			content: Copy.AboutModalQuickActionsContent
		},
		[AboutModalTopic.UploadedFiles]: {
			title: Copy.AboutModalUploadedFilesTitle,
			content: Copy.AboutModalUploadedFilesContent
		},
		[AboutModalTopic.Troubleshoot]: {
			title: Copy.AboutModalTroubleshootTitle,
			content: Copy.AboutModalTroubleshootContent
		},
		[AboutModalTopic.Privacy]: {
			title: Copy.AboutModalPrivacyTitle,
			content: Copy.AboutModalPrivacyContent
		}
	};

	let selectedTopic: AboutModalTopic = initialTopic;
	let title: string = topics[selectedTopic].title;
	let contentVisible: boolean = true;

	function selectTopic(topicNumber: AboutModalTopic) {
		title = "";
		contentVisible = false;
		selectedTopic = topicNumber;
		setTimeout(() => {
			title = topics[selectedTopic].title;
			contentVisible = true;
		}, 200);
	}

	function helpContentAction(element: HTMLElement, topic: AboutModalTopic) {
		streamingMarkdownService.render(topics[topic].content, element, true);
		return {
			update(newTopic: AboutModalTopic) {
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
				selectTopic(Number(value) as AboutModalTopic);
			});
		}

		if (contentContainer) {
			plugin.registerDomEvent(contentContainer, 'click', handleLinkClick);
		}
	});
</script>

<div class="about-modal-container">
	<div class="about-modal-top-bar">
		<div class="about-modal-top-bar-content">
			{#if title !== ""}
				<div id="about-modal-title" transition:fade={{ duration: 100 }}>
					{title}
				</div>
			{/if}
			<button
			bind:this={closeButton}
			id="close-button"
			class="top-bar-button clickable-icon"
			on:click={onClose}
			aria-label={Copy.AboutModalCloseAriaLabel}
			></button>
		</div>
	</div>
	<div class="about-modal-body">
		<div class="about-modal-dropdown" bind:this={dropdownContainer}></div>
		<div class="about-modal-topics">
			{#each Object.entries(topics) as [key, topic] (key)}
				<div
					class="about-modal-topic-frame"
					class:hidden={selectedTopic !== Number(key)}
					on:click={() => selectTopic(Number(key) as AboutModalTopic)}
					on:keydown={(e) => e.key === 'Enter' && selectTopic(Number(key) as AboutModalTopic)}
					role="button"
					tabindex="0">
					<div class="about-modal-topic-item">
						{topic.title}
					</div>
				</div>
			{/each}
		</div>
		<div class="about-modal-content" bind:this={contentContainer}>
			{#if contentVisible}
				{#if selectedTopic === AboutModalTopic.About}
					<img class="about-modal-banner" src={assetsService.bannerSource} alt="Plugin Banner">
				{/if}
				<div transition:fade={{ duration: 100 }} use:helpContentAction={selectedTopic}></div>
				<div transition:fade={{ duration: 100 }}>
					{#if selectedTopic === AboutModalTopic.About}
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
				{#if selectedTopic === AboutModalTopic.About}
					<div class="about-modal-version-string" transition:fade={{ duration: 100 }}>
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
	.about-modal-container {
		display: grid;
		grid-template-rows: auto var(--size-4-1) 1fr var(--size-4-2);
		grid-template-columns: var(--size-4-2) 1fr var(--size-4-2);
		max-height: 60vh;
		min-height: 60vh;
		margin: 10px;
	}

	.about-modal-top-bar {
		grid-row: 1;
		grid-column: 2;
		height: var(--size-4-16);
		display: grid;
		grid-template-rows: var(--size-4-2) 1fr var(--size-4-2);
		grid-template-columns: 1fr;
	}

	.about-modal-top-bar-content {
		grid-row: 2;
		grid-column: 1;
		display: grid;
		grid-template-rows: auto;
		grid-template-columns: var(--size-4-2) 1fr auto var(--size-4-2);
		background-color: var(--background-secondary-alt);
		border-radius: var(--radius-m);
	}

	#about-modal-title {
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

	.about-modal-body {
		grid-row: 3;
		grid-column: 2;
		display: grid;
		grid-template-rows: auto var(--size-4-3) auto var(--size-4-3) auto var(--size-4-3) auto 1fr;
		grid-template-columns: auto var(--size-4-2) 1fr;
		height: 100%;
		width: 100%;
		overflow: auto;
	}

	.about-modal-dropdown {
		display: none;
	}

	.about-modal-topic-frame {
		grid-column: 1 / 4;
		display: grid;
		grid-template-rows: auto;
		grid-template-columns: auto var(--size-4-2) 1fr;
		padding: var(--size-4-2) var(--size-4-1);
		margin-right: var(--size-4-2);
		border-radius: var(--radius-m);
		cursor: pointer;
		background-color: var(--alt-background-primary);
		transition: background-color 0.25s ease-in-out;
	}

	.about-modal-topic-frame.hidden {
		background-color: transparent;
	}

	.about-modal-topics {
		grid-row: 1 / 9;
		grid-column: 1;
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
		overflow-y: scroll;
		overflow-x: hidden;
	}

	.about-modal-topic-item {
		display: inline-block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding: var(--size-4-1) var(--size-4-3);
		cursor: pointer;
		transition: color 0.15s ease-in-out;
	}

	.about-modal-topic-item:hover {
		color: var(--text-normal);
	}

	.about-modal-content {
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

	.about-modal-banner {
		margin-top: var(--size-2-2);
		margin-left: calc(var(--size-4-2) * -1);
		border-radius: var(--radius-s);
	}

	.about-modal-version-string {
		/* Absorbs leftover vertical space so the version sits bottom-right on tall
		   screens, but collapses and scrolls naturally when content overflows. */
		margin-top: auto;
		display: flex;
		justify-content: flex-end;
		padding-top: var(--size-4-2);
	}

	.about-modal-version-string p {
		margin: 0;
		font-size: var(--font-smallest);
		color: var(--text-muted);
	}

	/* Mobile styles */
	:global(.is-mobile) .about-modal-banner {
		margin-top: calc(var(--size-4-1) * -1);;
		margin-left: calc(var(--size-4-2) * -0.6);
	}

	:global(.is-mobile) .about-modal-body {
		grid-template-rows: auto var(--size-4-2) 1fr var(--size-4-2) auto;
		grid-template-columns: 1fr;
	}

	:global(.is-mobile) .about-modal-dropdown {
		display: block;
		grid-row: 1;
		grid-column: 1;
		width: 100%;
	}

	.about-modal-dropdown :global(.dropdown) {
		width: 100%;
		border: solid;
		border-width: 1px;
		border-color: var(--color-accent) !important;
		outline: none;
	}

	@media (max-width: 600px) {
		.about-modal-container {
			margin: 0px;
		}
	}

	:global(.is-mobile) .about-modal-topics {
		display: none;
	}

	:global(.is-mobile) .about-modal-content {
		grid-row: 3;
		grid-column: 1;
		padding: var(--size-4-2);
		overflow-x: hidden;
	}
</style>
