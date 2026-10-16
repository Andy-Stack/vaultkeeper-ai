<script lang="ts">
	import { Diff2HtmlUI, type Diff2HtmlUIConfig } from "diff2html/lib/ui/js/diff2html-ui-base";
	import { Resolve } from "Services/DependencyService";
	import { Services } from "Services/Services";
	import type { InputService } from "Services/InputService";
	import type { IVaultChange, TemporaryVaultService } from "Services/TemporaryVaultService";
	import { onDestroy, onMount } from "svelte";
	import { slide } from "svelte/transition";
	import { DiffState } from "Enums/DiffState";
	import type { EventService } from "Services/EventService";
	import { Event } from "Enums/Event";
	import { setElementIcon } from "Helpers/ElementHelper";
	import { FileEvent } from "Enums/FileEvent";
	import { Platform } from "obsidian";
	import { displayState, reviewDoneLabel, vaultChangeFolder, vaultChangeName } from "Helpers/VaultChangeHelper";
	import type { BottomSheetService, IBottomSheetHandle } from "Services/BottomSheetService";
	import DiffChangeListSheet from "Components/DiffChangeListSheet.svelte";
	import TruncatedPath from "Components/TruncatedPath.svelte";
	import type { DocumentValidationService } from "Services/DocumentValidationService";
	import type { SettingsService } from "Services/SettingsService";
	import type { IBrokenLink } from "../DocumentValidation/Results/WikilinkValidationResult";
	import type { IQuoteDrift } from "../DocumentValidation/Results/BlockQuoteValidationResult";
	import { BrokenLinkReason } from "Enums/BrokenLinkReason";
	import type { WorkSpaceService } from "Services/WorkSpaceService";
	import { VIEW_TYPE_MAIN } from "Views/MainView";

	interface DiffRenderOptions {
		vaultChange: IVaultChange | undefined;
		config: Diff2HtmlUIConfig;
	}

	export let config: Diff2HtmlUIConfig;

	const settingsService: SettingsService = Resolve<SettingsService>(Services.SettingsService);
	const temporaryVaultService: TemporaryVaultService = Resolve<TemporaryVaultService>(Services.TemporaryVaultService);
	const documentValidationService: DocumentValidationService = Resolve<DocumentValidationService>(Services.DocumentValidationService);
	const eventService: EventService = Resolve<EventService>(Services.EventService);
	const inputService: InputService = Resolve<InputService>(Services.InputService);
	const bottomSheetService: BottomSheetService = Resolve<BottomSheetService>(Services.BottomSheetService);
	const workSpaceService: WorkSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);

	const isPhone = Platform.isPhone;

	let suggestionElement: HTMLDivElement | undefined;
	let changeListSheet: IBottomSheetHandle | undefined;
	let isContinuityExpanded = false;

	let vaultChanges: IVaultChange[] = temporaryVaultService.getVaultChanges();

	let selectedItem: IVaultChange | undefined = vaultChanges[0];
	
	$: continuityIssues = selectedItem?.continuityIssues ?? [];
	$: brokenLinks = continuityIssues.filter((issue): issue is IBrokenLink => "reason" in issue);
	$: brokenWikilinks = brokenLinks.filter(issue => issue.reason !== BrokenLinkReason.MissingBlock);
	$: brokenBlockReferences = brokenLinks.filter(issue => issue.reason === BrokenLinkReason.MissingBlock);
	$: quoteDrifts = continuityIssues.filter((issue): issue is IQuoteDrift => "quotedText" in issue);

	let stateCounts = countStates();
	$: issueCount = 0;
	$: selectedIndex = selectedItem ? vaultChanges.indexOf(selectedItem) : -1;
	$: doneLabel = reviewDoneLabel(stateCounts[DiffState.None]);

	let latestValidationRun = 0;

	onMount(async () => {
		await validate();
	});

	onDestroy(() => changeListSheet?.close());

	function countStates(): Record<DiffState, number> {
		const counts: Record<DiffState, number> = {
			[DiffState.None]: 0,
			[DiffState.Accepted]: 0,
			[DiffState.Rejected]: 0,
			[DiffState.Suggestion]: 0
		};

		for (const vaultChange of vaultChanges) {
			counts[displayState(vaultChange)]++;
		}

		return counts;
	}

	function refresh() {
		vaultChanges = [...vaultChanges];
		selectedItem = selectedItem;
		stateCounts = countStates();
	}

	async function validate() {
		if (!settingsService.settings.enableContinuity) {
			issueCount = 0;
			vaultChanges.forEach(change => {
				change.continuityIssueCount = undefined;
				change.continuityIssues = undefined;
			});
			return;
		}

		const validationRun = ++latestValidationRun;
		temporaryVaultService.retrack();
		await documentValidationService.generateReport();

		// A newer status change started another run while this one was awaiting, so its results are stale
		if (validationRun !== latestValidationRun) {
			return;
		}

		issueCount = documentValidationService.issueCount();
		documentValidationService.assignContinuityIssuesToVaultChanges(vaultChanges);

		refresh();
	}

	function refreshAndValidate() {
		refresh();
		void validate();
	}

	function draw(element: HTMLElement, options: DiffRenderOptions) {
		element.empty();

		if (!options.vaultChange?.diffString) {
			return;
		}

		new Diff2HtmlUI(element, options.vaultChange.diffString, options.config).draw();

		window.requestAnimationFrame(() => {
			const firstChange = element.querySelector('.d2h-change, .d2h-ins, .d2h-del');
			firstChange?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
	}

	function diffRenderAction(element: HTMLElement, options: DiffRenderOptions) {
		draw(element, options);
		return {
			update(newOptions: DiffRenderOptions) {
				draw(element, newOptions);
			}
		};
	}

	function select(vaultChange: IVaultChange) {
		selectedItem = vaultChange;
		if (suggestionElement) {
			suggestionElement.textContent = selectedItem.suggestion ?? "";
		}
	}

	function step(offset: number) {
		const vaultChange = vaultChanges[selectedIndex + offset];
		if (vaultChange) {
			select(vaultChange);
		}
	}

	function handleInput() {
		if (suggestionElement) {
			if (suggestionElement.innerHTML !== suggestionElement.textContent) {
				if (inputService.hasUnauthorizedHTML(suggestionElement)) {
					inputService.sanitizeToPlainText(suggestionElement);
				}
			}

			if (suggestionElement.textContent.trim() === "") {
				suggestionElement.textContent = "";
				if (selectedItem) {
					selectedItem.suggestion = undefined;
				}
			} else {
				if (selectedItem) {
					selectedItem.suggestion = suggestionElement.textContent;
				}
			}
			refresh();
		}
	}

	function handleCopy(e: ClipboardEvent) {
		e.preventDefault();

		const selection = window.getSelection();

		if (!selection) {
			return;
		}

		e.clipboardData?.setData("text/plain", selection.toString());
	}

	function handlePaste(e: ClipboardEvent) {
		e.preventDefault();
		e.stopPropagation();

		const plainText = inputService.getTextFromDataTransfer(e.clipboardData);

		if (!plainText) {
			return;
		}

		inputService.insertTextAtCursor(plainText, suggestionElement);
		handleInput();
	}

	function suggestionField(element: HTMLDivElement) {
		suggestionElement = element;
		element.textContent = selectedItem?.suggestion ?? "";
		element.focus();

		return {
			destroy() {
				suggestionElement = undefined;
			}
		};
	}

	function toggleSuggestion() {
		if (!selectedItem) {
			return;
		}

		if (selectedItem.status === DiffState.Suggestion) {
			removeSuggestion();
		} else {
			selectedItem.status = DiffState.Suggestion;
		}

		refreshAndValidate();
	}

	function removeSuggestion() {
		if (selectedItem) {
			selectedItem.status = DiffState.None;
			selectedItem.suggestion = undefined;
		}
	}

	function toggleStatus(status: DiffState) {
		if (!selectedItem) {
			return;
		}

		const nextStatus = selectedItem.status === status ? DiffState.None : status;
		removeSuggestion();
		selectedItem.status = nextStatus;
		refreshAndValidate();
	}

	function handleReject() {
		toggleStatus(DiffState.Rejected);
	}

	function handleAccept() {
		toggleStatus(DiffState.Accepted);
	}

	function markRemaining(diffState: DiffState) {
		if (selectedItem?.status === DiffState.None) {
			markVaultChange(selectedItem, diffState);
		}

		for (const vaultChange of vaultChanges) {
			if (vaultChange.status === DiffState.None) {
				markVaultChange(vaultChange, diffState);
			}
		}

		refreshAndValidate();
	}

	function markVaultChange(vaultChange: IVaultChange | undefined, diffState: DiffState, shouldRefresh: boolean = false) {
		if (vaultChange) {
			vaultChange.status = vaultChange.status === diffState ? DiffState.None : diffState;

			if (vaultChange.status !== DiffState.Suggestion) {
				vaultChange.suggestion = undefined;
			}
		}

		if (shouldRefresh) {
			refreshAndValidate();
		}
	}

	async function handleDone() {
		if (stateCounts[DiffState.None] > 0) {
			return;
		}

		// Must run before the diff leaf detaches, otherwise Obsidian refocuses the editor and collapses the drawer
		if (isPhone) {
			await workSpaceService.revealLeafOfType(VIEW_TYPE_MAIN);
		}

		eventService.trigger(Event.DiffClosed);
	}

	function openChangeList() {
		changeListSheet = bottomSheetService.show(
			DiffChangeListSheet,
			{
				vaultChanges,
				selectedItem,
				onSelect: select,
				onMarkRemaining: markRemaining,
				onDone: handleDone
			},
			{ label: "Proposed changes" }
		);

		void changeListSheet.closed.then(() => changeListSheet = undefined);
	}

	function toggleContinuityExpander() {
		isContinuityExpanded = !isContinuityExpanded;
	}

	function handleContinuityExpanderKeydown(event: KeyboardEvent) {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			toggleContinuityExpander();
		}
	}
</script>

<div id="diff-view-grid" class="mobile-navbar-clearance" class:diff-view-phone={isPhone}>
	{#if issueCount > 0}
		<div id="diff-view-banner" transition:slide>
			<span class="diff-view-continuity-alert-icon" use:setElementIcon={"triangle-alert"}></span>
			<span>{issueCount} continuity issue{issueCount === 1 ? "" : "s"}{isPhone ? "." : " found in this change."}</span>
		</div>
	{/if}
	{#if isPhone}
		<div id="diff-view-navigator" class="diff-view-border">
			<button
				class="diff-view-navigator-step transparent-button"
				aria-label="Previous change"
				disabled={selectedIndex <= 0}
				use:setElementIcon={"chevron-left"}
				onclick={() => step(-1)}>
			</button>
			<button
				id="diff-view-navigator-center"
				class="transparent-button"
				aria-label="Show all proposed changes"
				onclick={openChangeList}>
				<span id="diff-view-navigator-count">
					{selectedIndex + 1} of {vaultChanges.length}
					<span id="diff-view-navigator-chevron" use:setElementIcon={"chevron-down"}></span>
				</span>
				<span id="diff-view-navigator-name" class="diff-view-ellipsis-label">{selectedItem ? vaultChangeName(selectedItem) : "-"}</span>
			</button>
			<button
				class="diff-view-navigator-step transparent-button"
				aria-label="Next change"
				disabled={selectedIndex >= vaultChanges.length - 1}
				use:setElementIcon={"chevron-right"}
				onclick={() => step(1)}>
			</button>
		</div>
	{:else}
		<div id="diff-view-panel" class="diff-view-border">
			<div id="diff-view-panel-header">
				<span id="diff-view-panel-header-title">Proposed changes</span>
				<span id="diff-view-panel-header-count">{vaultChanges.length - stateCounts[DiffState.None]}/{vaultChanges.length}</span>
			</div>
			<div id="diff-view-panel-body">
				{#each vaultChanges as vaultChange}
					<div
						class="diff-view-panel-body-item"
						class:diff-view-panel-body-item-selected={vaultChange === selectedItem}
						aria-label={vaultChange.newPath ?? vaultChange.file?.path ?? vaultChangeName(vaultChange)}
						role="button"
						tabindex="0"
						onclick={() => select(vaultChange)}
						onkeydown={(e) => e.key === "Enter" && select(vaultChange)}>
						<span 
							class="diff-view-panel-body-item-ellipse diff-view-ellipse"
							aria-hidden="true"
							class:secondary={displayState(vaultChange) === DiffState.None}
							class:green={displayState(vaultChange) === DiffState.Accepted}
							class:red={displayState(vaultChange) === DiffState.Rejected}
							class:accent={displayState(vaultChange) === DiffState.Suggestion}>
						</span>
						<span class="diff-view-panel-body-item-name diff-view-ellipsis-label">{vaultChangeName(vaultChange)}</span>
						<span class="diff-view-panel-body-item-path diff-view-ellipsis-label">{vaultChangeFolder(vaultChange)}</span>
						{#if (vaultChange.continuityIssueCount ?? 0) > 0}
							<span 
								class="diff-view-panel-body-item-alert diff-view-continuity-alert-icon"
								use:setElementIcon={"triangle-alert"}
								transition:slide={{ axis: 'x' }}></span>
						{/if}
						<div class="diff-view-panel-body-item-controls">
							<button 
								class="diff-view-panel-body-item-control suggest" aria-label="Suggest changes"
								class:accent={vaultChange.status === DiffState.Suggestion}
								use:setElementIcon={"pencil"}
								onclick={(e) => { e.stopPropagation(); markVaultChange(vaultChange, DiffState.Suggestion, true); }}>
							</button>
							<button 
								class="diff-view-panel-body-item-control reject" aria-label="Reject"
								class:button-red={vaultChange.status === DiffState.Rejected}
								use:setElementIcon={"x"}
								onclick={(e) => { e.stopPropagation(); markVaultChange(vaultChange, DiffState.Rejected, true); }}>
							</button>
							<button
								class="diff-view-panel-body-item-control accept" aria-label="Accept"
								class:button-green={vaultChange.status === DiffState.Accepted}
								use:setElementIcon={"check"}
								onclick={(e) => { e.stopPropagation(); markVaultChange(vaultChange, DiffState.Accepted, true); }}>
							</button>
						</div>
					</div>
				{/each}
			</div>
			<div id="diff-view-panel-footer">
				<button
					class="diff-view-panel-link transparent-button"
					aria-label="Accept remaining"
					onclick={() => markRemaining(DiffState.Accepted)}>
					Accept remaining
					</button>
				<button
					class="diff-view-panel-link transparent-button"
					aria-label="Reject remaining"
					onclick={() => markRemaining(DiffState.Rejected)}>
					Reject remaining
					</button>
			</div>
		</div>
	{/if}
		<div id="diff-view-preview">
			{#if selectedItem}
				{#if isPhone}
					<div id="diff-view-preview-meta">
						<span
							class="diff-view-ellipse"
							aria-hidden="true"
							class:secondary={displayState(selectedItem) === DiffState.None}
							class:green={displayState(selectedItem) === DiffState.Accepted}
							class:red={displayState(selectedItem) === DiffState.Rejected}
							class:accent={displayState(selectedItem) === DiffState.Suggestion}></span>
						<span id="diff-view-preview-meta-path" class="diff-view-ellipsis-label">{vaultChangeFolder(selectedItem)}</span>
					</div>
				{:else}
					<div id="diff-view-preview-header">
						<span 
							id="diff-view-preview-header-ellipse" class="diff-view-ellipse"
							aria-hidden="true"
							class:secondary={displayState(selectedItem) === DiffState.None}
							class:green={displayState(selectedItem) === DiffState.Accepted}
							class:red={displayState(selectedItem) === DiffState.Rejected}
							class:accent={displayState(selectedItem) === DiffState.Suggestion}></span>
						<span id="diff-view-preview-header-name" class="diff-view-ellipsis-label">{vaultChangeName(selectedItem)}</span>
						<span id="diff-view-preview-header-path"><TruncatedPath path={vaultChangeFolder(selectedItem)} /></span>
						<div id="diff-view-preview-header-controls">
							<button 
								id="diff-view-preview-header-control-suggest"
								class:diff-view-preview-header-control-suggest-active={selectedItem.status === DiffState.Suggestion}
								aria-label="Suggest changes"
								onclick={toggleSuggestion}>
								Suggest changes
							</button>
							<button 
								id="diff-view-preview-header-control-reject"
								class:button-red={selectedItem.status === DiffState.Rejected}
								aria-label="Reject"
								onclick={handleReject}>
								Reject
								</button>
							<button 
								id="diff-view-preview-header-control-accept"
								class:button-green={selectedItem.status === DiffState.Accepted}
								aria-label="Accept"
								onclick={handleAccept}>
								Accept
								</button>
						</div>
					</div>
				{/if}
				{#if selectedItem.status === DiffState.Suggestion}
					<div id="diff-view-preview-suggestion" transition:slide>
						<div
							id="suggestion-field"
							use:suggestionField
							contenteditable="plaintext-only"
							oninput={handleInput}
							oncopy={handleCopy}
							onpaste={handlePaste}
							data-placeholder="Suggest an alternative change..."
							aria-label="Suggest an alternative change"
							role="textbox"
							aria-multiline="true"
							tabindex="0">
						</div>
						<span id="diff-view-preview-suggestion-label">Sent to the agent when you apply</span>
						<button 
							id="diff-view-preview-suggestion-button" class="transparent-button"
							aria-label="Remove suggestion"
							onclick={toggleSuggestion}>
							Remove suggestion
						</button>
					</div>
				{/if}
				<div id="diff-view-preview-body">
					{#if selectedItem.changeType === FileEvent.Rename}
						<div id="diff-view-preview-move-file">
							<span id="diff-view-preview-move-file-title">File will be moved</span>
							<span id="diff-view-preview-move-file-description">File contents will remain identical, only the location will change</span>
							<div id="diff-view-preview-move-file-paths">
								<div id="diff-view-preview-move-file-old-path-container">
									<span class="diff-view-preview-move-file-path-prefix">from:</span>
									<span id="diff-view-preview-move-file-old-path"><TruncatedPath path={selectedItem.oldPath} /></span>
								</div>
								<div id="diff-view-preview-move-file-new-path-container">
									<span class="diff-view-preview-move-file-path-prefix">to:</span>
									<span id="diff-view-preview-move-file-new-path"><TruncatedPath path={selectedItem.newPath} /></span>
								</div>
							</div>
						</div>
					{:else}
						<div class="d2h-wrapper" use:diffRenderAction={{ vaultChange: selectedItem, config }}></div>
					{/if}
					{#if selectedItem.continuityIssues && (selectedItem.continuityIssueCount ?? 0) > 0}
						<div id="diff-view-continuity" transition:slide>
							<div
								id="diff-view-continuity-expander-header"
								onclick={toggleContinuityExpander}
								onkeydown={handleContinuityExpanderKeydown}
								role="button"
								tabindex="0">
								<span id="diff-view-continuity-expander-chevron" use:setElementIcon={isContinuityExpanded ? "chevron-down" : "chevron-right"}></span>
								<span id="diff-view-continuity-expander-header-title">
									<span class="diff-view-continuity-alert-icon" use:setElementIcon={"triangle-alert"}></span>
									<span>{selectedItem.continuityIssueCount} continuity issue{selectedItem.continuityIssueCount === 1 ? "" : "s"}</span>
								</span>
								<span id="diff-view-continuity-expander-header-label">Informational</span>
							</div>
							{#if isContinuityExpanded}
								<div id="diff-view-continuity-expander-body" transition:slide={{ duration: 250 }}>
									{#snippet issueSource(source: string, line: number, detail: string)}
										<div class="diff-view-continuity-issue-source">
											<TruncatedPath path={source} />
											<span class="diff-view-continuity-issue-detail">line {line + 1} · {detail}</span>
										</div>
									{/snippet}
									{#snippet highlightedLine(lineText: string, column: number, original: string)}
										<div class="diff-view-continuity-issue-line">
											<span>{lineText.slice(0, column)}</span>
											<span class="diff-view-continuity-issue-link">{original}</span>
											<span>{lineText.slice(column + original.length)}</span>
										</div>
									{/snippet}
									{#if brokenWikilinks.length > 0}
										<div class="diff-view-continuity-section-header">
											<span class="diff-view-continuity-section-title">BROKEN WIKILINKS ({brokenWikilinks.length})</span>
											<span class="diff-view-continuity-section-description">Target note or heading no longer exists</span>
										</div>
										{#each brokenWikilinks as brokenWikilink}
											<div class="diff-view-continuity-issue">
												{@render issueSource(brokenWikilink.source, brokenWikilink.line, brokenWikilink.reason)}
												{@render highlightedLine(brokenWikilink.lineText, brokenWikilink.column, brokenWikilink.original)}
											</div>
										{/each}
									{/if}
									{#if brokenBlockReferences.length > 0}
										<div class="diff-view-continuity-section-header">
											<span class="diff-view-continuity-section-title">BROKEN BLOCK REFERENCES ({brokenBlockReferences.length})</span>
											<span class="diff-view-continuity-section-description">Referenced block removed or its ^id dropped</span>
										</div>
										{#each brokenBlockReferences as brokenBlockReference}
											<div class="diff-view-continuity-issue">
												{@render issueSource(brokenBlockReference.source, brokenBlockReference.line, brokenBlockReference.reason)}
												{@render highlightedLine(brokenBlockReference.lineText, brokenBlockReference.column, brokenBlockReference.original)}
											</div>
										{/each}
									{/if}
									{#if quoteDrifts.length > 0}
										<div class="diff-view-continuity-section-header">
											<span class="diff-view-continuity-section-title">CHANGED BLOCK QUOTES ({quoteDrifts.length})</span>
											<span class="diff-view-continuity-section-description">Quoted text no longer matches its block</span>
										</div>
										{#each quoteDrifts as quoteDrift}
											<div class="diff-view-continuity-issue">
												{@render issueSource(quoteDrift.source, quoteDrift.line, `quotes ${quoteDrift.targetPath}`)}
												{@render highlightedLine(quoteDrift.lineText, quoteDrift.column, quoteDrift.original)}
												<div class="diff-view-continuity-quote">
													<span class="diff-view-continuity-quote-prefix">quoted:</span>
													<span class="diff-view-continuity-quote-old">{quoteDrift.quotedText}</span>
													<span class="diff-view-continuity-quote-prefix">now:</span>
													<span class="diff-view-continuity-quote-new">{quoteDrift.blockText}</span>
												</div>
											</div>
										{/each}
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
		<div id="diff-view-footer">
			<span class="diff-view-ellipse green" aria-hidden="true"></span>
			<span class="diff-view-footer-label">{stateCounts[DiffState.Accepted]} accepted</span>
			<span class="diff-view-ellipse red" aria-hidden="true"></span>
			<span class="diff-view-footer-label">{stateCounts[DiffState.Rejected]} rejected</span>
			<span class="diff-view-ellipse accent" aria-hidden="true"></span>
			<span class="diff-view-footer-label">{stateCounts[DiffState.Suggestion]} to revise</span>
			{#if !isPhone}
				<span class="diff-view-ellipse secondary" aria-hidden="true"></span>
				<span class="diff-view-footer-label">{stateCounts[DiffState.None]} remaining</span>
			{/if}
				<button
					id="diff-view-footer-done"
					aria-label={doneLabel}
					class:diff-view-footer-done-active={stateCounts[DiffState.None] === 0}
					disabled={stateCounts[DiffState.None] > 0}
					onclick={handleDone}>
					{doneLabel}
					</button>
		</div>
	{#if isPhone && selectedItem}
		<div id="diff-view-actions">
			<button
				id="diff-view-actions-suggest"
				aria-label="Suggest changes"
				class:diff-view-preview-header-control-suggest-active={selectedItem.status === DiffState.Suggestion}
				use:setElementIcon={"pencil"}
				onclick={toggleSuggestion}>
			</button>
			<button
				class="diff-view-actions-button"
				class:button-red={selectedItem.status === DiffState.Rejected}
				aria-label="Reject"
				onclick={handleReject}>
				Reject
			</button>
			<button
				class="diff-view-actions-button"
				class:button-green={selectedItem.status === DiffState.Accepted}
				aria-label="Accept"
				onclick={handleAccept}>
				Accept
			</button>
		</div>
	{/if}
</div>

<style>
	#diff-view-grid {
		display: grid;
		grid-template-rows: auto 1fr auto;
		grid-template-columns: auto 1fr;
		gap: var(--size-4-2);
		height: 100%;
	}

	#diff-view-banner {
		grid-row: 1;
		grid-column: 1 / 3;
		display: flex;
		align-items: center;
		gap: 0.4em;
		padding: var(--size-4-1) var(--size-4-2);
		background-color: rgba(224,175,104,0.10);
		border: 1px solid rgba(224,175,104,0.22);
		color: var(--text-normal);
		border-radius: var(--radius-s);
		font-size: var(--font-smaller);
		color: rgba(224, 175, 104);
	}

	#diff-view-panel {
		grid-row: 2;
		grid-column: 1;
		display: grid;
		grid-template-rows: auto 1fr auto;
		background-color: var(--background-primary-alt);
	}

	#diff-view-panel-header {
		display: flex;
		border-bottom: solid;
		border-width: 1px;
		border-color: var(--background-secondary-alt);
		padding: var(--size-4-2);
	}

	#diff-view-panel-header-title {
		align-self: center;
		font-weight: bold;
		font-size: var(--font-smaller);
	}

	#diff-view-panel-header-count {
		margin-left: auto;
		align-self: center;
		font-size: var(--font-smallest);
		color: var(--text-muted);
	}

	#diff-view-panel-body {
		display: flex;
		flex-direction: column;
		padding: var(--size-2-1);
		background-color: var(--background-primary);
	}

	.diff-view-panel-body-item {
		display: grid;
		grid-template-rows: auto auto;
		grid-template-columns: auto 1fr auto auto;
		column-gap: var(--size-4-3);
		cursor: pointer;
		border-radius: var(--radius-s);
		border-left: solid;
		border-width: 1px;
		border-color: transparent;
		padding: var(--size-4-2) var(--size-4-2) var(--size-4-2) 0;
	}

	.diff-view-panel-body-item-selected {
		background-color: color-mix(
			in srgb,
			var(--background-primary) 90%,
			var(--background-secondary-alt) 90%
		);
		border-color: var(--color-accent-1);
	}

	.diff-view-panel-body-item-ellipse {
		grid-row: 1 / 3;
		grid-column: 1;
		margin-left: var(--size-4-3);
	}

	.diff-view-panel-body-item-name {
		grid-row: 1;
		grid-column: 2;
		min-width: 6vw;
		max-width: 10vw;
		align-self: center;
		font-size: var(--font-smaller);
	}

	.diff-view-panel-body-item-path {
		grid-row: 2;
		grid-column: 2;
		min-width: 6vw;
		max-width: 10vw;
		align-self: center;
		font-size: var(--font-smallest);
		color: var(--text-muted);
	}

	.diff-view-panel-body-item-alert {
		grid-row: 1 / 3;
		grid-column: 3;
		align-self: center;
	}

	.diff-view-panel-body-item-controls {
		grid-row: 1 / 3;
		grid-column: 4;
		display: flex;
		gap: var(--size-2-1);
		margin-left: auto;
	}

	.diff-view-panel-body-item-control,
	.diff-view-panel-body-item-control:hover {
		cursor: pointer;
		border: 1px solid var(--background-secondary-alt);
		background-color: transparent;
		box-shadow: none;
		transition: background-color 0.2s ease-out, border-color 0.2s ease-out;
	}

	.diff-view-panel-body-item-control.suggest:hover {
		border-color: var(--color-accent);
	}

	.diff-view-panel-body-item-control.reject:hover {
		border-color: #593030;
	}

	.diff-view-panel-body-item-control.accept:hover {
		border-color: #38533a;
	}

	.diff-view-panel-body-item-control.accent {
		background-color: var(--color-accent);
	}

	.diff-view-panel-body-item-control.button-red {
		background-color: #593030;
	}

	.diff-view-panel-body-item-control.button-green {
		background-color: #38533a;
	}

	#diff-view-panel-footer {
		display: flex;
		padding: var(--size-4-2);
		gap: var(--size-4-3);
		border-top: solid;
		border-width: 1px;
		border-color: var(--background-secondary-alt);
	}

	.diff-view-panel-link {
		cursor: pointer;
		color: var(--color-accent-1);
		padding: 0;
		font-size: var(--font-smallest);
	}

	#diff-view-preview {
		grid-row: 2;
		grid-column: 2;
		display: grid;
		grid-template-rows: auto auto 1fr;
	}

	#diff-view-preview-header {
		grid-row: 1;
		display: grid;
		grid-template-rows: auto auto;
		grid-template-columns: auto 1fr auto;
		background-color: var(--background-primary-alt);
		padding: var(--size-4-2) var(--size-4-2) var(--size-4-2) 0;
		border: solid;
		border-width: 1px;
		border-color: var(--background-secondary-alt);
		border-top-left-radius: var(--radius-s);
		border-top-right-radius: var(--radius-s);
	}

	#diff-view-preview-header-ellipse {
		grid-row: 1 / 3;
		grid-column: 1;
		margin: var(--size-4-3);
	}

	#diff-view-preview-header-name {
		grid-row: 1;
		grid-column: 2;
		max-width: 100%;
		min-width: 5vw;
		align-self: center;
		font-size: var(--font-smaller);
	}

	#diff-view-preview-header-path {
		grid-row: 2;
		grid-column: 2;
		display: flex;
		max-width: 100%;
		min-width: 5vw;
		align-self: center;
		font-size: var(--font-smallest);
		color: var(--text-muted);
	}

	#diff-view-preview-header-controls {
		grid-row: 1 / 3;
    	grid-column: 3;
		display: flex;
		margin-left: var(--size-4-4);
	}

	#diff-view-preview-header-control-suggest {
		box-shadow: none;
		transition: background-color 0.2s ease-out, border-color 0.2s ease-out;
	}

	.diff-view-preview-header-control-suggest-active {
		border: solid;
		border-width: 1px;
		border-color: var(--color-accent-1);
		background-color: var(--background-secondary);
	}

	#diff-view-preview-header-control-reject {
		margin-left: var(--size-4-2);
		border-top-right-radius: 0;
    	border-bottom-right-radius: 0;
		box-shadow: none;
		transition: background-color 0.2s ease-out, border-color 0.2s ease-out;
	}

	#diff-view-preview-header-control-accept {
		border-top-left-radius: 0;
    	border-bottom-left-radius: 0;
		box-shadow: none;
		transition: background-color 0.2s ease-out, border-color 0.2s ease-out;
	}

	#diff-view-preview-suggestion {
		grid-row: 2;
		display: grid;
		grid-template-rows: auto auto;
		grid-template-columns: 1fr auto;
		border-left: solid;
		border-right: solid;
		border-bottom: solid;
		border-width: 1px;
		border-color: var(--background-secondary-alt);
		padding: var(--size-4-2) var(--size-4-2) var(--size-2-1) var(--size-4-2);
		background-color: color-mix(
			in srgb,
			var(--color-accent-1) 7%,
			var(--background-primary-alt) 10%
		);
	}

	#suggestion-field {
		grid-row: 1;
		grid-column: 1 / 3;
		min-height: 5vh;
    	max-height: 10vh;
		border-radius: var(--radius-m);
		font-weight: var(--input-font-weight);
		border-width: var(--input-border-width);
		border-style: solid;
		border-color: var(--color-accent-1);
		padding: var(--size-2-2) var(--size-2-3);
		background-color: var(--background-primary-alt);
		font-family: var(--font-interface-theme);
		overflow-y: auto;
		overflow-x: hidden;
		scroll-behavior: smooth;
		transition: border-color 0.5s ease-out;
		word-wrap: break-word;
		white-space: pre-wrap;
	}

	#suggestion-field:focus {
		border-color: var(--color-accent);
		box-shadow: 0px 0px 4px 1px var(--color-accent);
		transition: border-color 0.5s ease-out;
	}

	#suggestion-field::-webkit-scrollbar {
		display: none;
	}

	#suggestion-field:empty::before {
		content: attr(data-placeholder);
		color: var(--text-muted);
		opacity: 0.75;
		pointer-events: none;
	}

	#suggestion-field[contenteditable]:focus {
		outline: none;
	}

	#diff-view-preview-suggestion-label {
		grid-row: 2;
		grid-column: 1;
		align-self: center;
		color: var(--color-accent-1);
		font-size: var(--font-smallest);
		font-weight: var(--font-light);
	}

	#diff-view-preview-suggestion-button {
		grid-row: 2;
		grid-column: 2;
		cursor: pointer;
		color: var(--color-accent-1);
	}

	#diff-view-preview-move-file {
		grid-row: 3;
		display: grid;
		grid-template-rows: 1fr auto auto auto 1fr;
		grid-template-columns: minmax(0, 1fr);
		height: 100%;
		border: solid;
		border-width: 1px;
		border-color: var(--background-secondary-alt);
		border-radius: var(--radius-s);
		border-top: none;
		border-top-left-radius: 0;
		border-top-right-radius: 0;
	}

	#diff-view-preview-move-file-title {
		grid-row: 2;
		text-align: center;
	}

	#diff-view-preview-move-file-description {
		grid-row: 3;
		margin-bottom: 8px;
		font-size: var(--font-smallest);
		color: var(--text-muted);
		text-align: center;
	}

	#diff-view-preview-move-file-paths {
		grid-row: 4;
		justify-self: center;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		max-width: 80%;
	}

	#diff-view-preview-move-file-old-path-container {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
		padding: 0 var(--size-4-4);
		background-color: #593030;
		border: solid;
		border-width: 1px;
		border-color: var(--background-secondary-alt);
		border-top-left-radius: var(--radius-s);
		border-top-right-radius: var(--radius-s);
	}

	.diff-view-preview-move-file-path-prefix {
		font-size: var(--font-smaller);
		color: var(--text-muted);
		align-self: center;
		margin-right: var(--size-4-4);
	}

	#diff-view-preview-move-file-old-path {
		display: flex;
		font-size: var(--font-smaller);
		align-self: center;
		min-width: 0;
	}

	#diff-view-preview-move-file-new-path-container {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
		padding: 0 var(--size-4-4);
		background-color: #38533a;
		border: solid;
		border-width: 1px;
		border-color: var(--background-secondary-alt);
		border-bottom-left-radius: var(--radius-s);
		border-bottom-right-radius: var(--radius-s);
		border-top: none;
	}

	#diff-view-preview-move-file-new-path {
		display: flex;
		font-size: var(--font-smaller);
		align-self: center;
		min-width: 0;
	}

	#diff-view-preview-body {
		grid-row: 3;
		display: grid;
		grid-template-rows: 1fr auto;
		border: solid;
		border-top: none;
		border-width: 1px;
		border-color: var(--background-secondary-alt);
		border-top-left-radius: 0;
		border-top-right-radius: 0;
		border-bottom-left-radius: var(--radius-s);
		border-bottom-right-radius: var(--radius-s);
	}

	#diff-view-preview .d2h-wrapper {
		grid-row: 1;
	}

	#diff-view-continuity {
		grid-row: 2;
		display: flex;
		flex-direction: column;
		min-width: 0;
		background-color: rgba(224,175,104,0.10);
		border-top: 1px solid rgba(224,175,104,0.22);
		border-bottom-left-radius: var(--radius-s);
		border-bottom-right-radius: var(--radius-s);
	}

	#diff-view-continuity-expander-header {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
		padding: var(--size-4-2) var(--size-4-3);
		font-size: var(--font-smaller);
		cursor: pointer;
	}

	#diff-view-continuity-expander-chevron {
		display: flex;
		--icon-size: var(--icon-xs);
		color: var(--text-muted);
	}

	.diff-view-continuity-alert-icon {
		display: flex;
		--icon-size: var(--icon-xs);
		color: rgba(224, 175, 104);
	}

	#diff-view-continuity-expander-header-title {
		display: flex;
		align-items: center;
		gap: var(--size-4-1);
		color: rgba(224, 175, 104);
		font-weight: var(--font-semibold);
	}

	#diff-view-continuity-expander-header-label {
		margin-left: auto;
		font-size: var(--font-smallest);
		color: var(--text-muted);
	}

	#diff-view-continuity-expander-body {
		max-height: 30vh;
		overflow-y: auto;
		border-top: 1px solid rgba(224,175,104,0.22);
		background-color: var(--background-primary);
		border-radius: var(--radius-s);
	}

	.diff-view-continuity-section-header {
		position: sticky;
		top: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: var(--size-4-3);
		padding: var(--size-4-2) var(--size-4-3);
		background-color: rgba(224, 175, 104, 0.22);
	}

	.diff-view-continuity-section-title {
		font-size: var(--font-smallest);
		font-weight: var(--font-bold);
		letter-spacing: 0.05em;
		color: rgba(200, 175, 135);
	}

	.diff-view-continuity-section-description {
		margin-left: auto;
		font-size: var(--font-smallest);
		color: var(--text-muted);
	}

	.diff-view-continuity-issue {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-1);
		padding: var(--size-4-2) var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
		font-size: var(--font-smaller);
	}

	.diff-view-continuity-issue-source {
		display: flex;
		align-items: baseline;
		gap: var(--size-4-2);
		min-width: 0;
		font-family: var(--font-monospace);
		font-size: var(--font-smaller);
	}

	.diff-view-continuity-issue-source :global(.truncated-path-directory) {
		color: var(--text-muted);
	}

	.diff-view-continuity-issue-source :global(.truncated-path-directory)::after {
		content: "/";
	}

	.diff-view-continuity-issue-detail {
		flex-shrink: 0;
		font-family: var(--font-interface);
		font-size: var(--font-smallest);
		color: var(--text-muted);
	}

	.diff-view-continuity-issue-line {
		font-family: var(--font-monospace);
		font-size: var(--font-smaller);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.diff-view-continuity-issue-link {
		padding: 0 var(--size-2-1);
		border-radius: var(--radius-s);
		color: #aa4646;
		background-color: rgba(var(--color-red-rgb), 0.12);
		text-decoration: underline dashed;
		text-underline-offset: 3px;
	}

	.diff-view-continuity-quote {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		column-gap: var(--size-4-2);
		row-gap: var(--size-2-1);
		margin-top: var(--size-2-2);
		padding-left: var(--size-4-2);
		border-left: 2px solid var(--background-modifier-border);
		font-size: var(--font-smaller);
	}

	.diff-view-continuity-quote-prefix {
		font-size: var(--font-smallest);
		color: var(--text-muted);
	}

	.diff-view-continuity-quote-old {
		color: var(--text-muted);
		text-decoration: line-through;
		overflow-wrap: anywhere;
	}

	.diff-view-continuity-quote-new {
		color: var(--text-normal);
		overflow-wrap: anywhere;
	}

	#diff-view-footer {
		grid-row: 3;
		grid-column: 1 / 3;
		display: flex;
	}

	.diff-view-footer-label {
		font-size: var(--font-smallest);
		color: var(--text-muted);
		margin-left: var(--size-4-2);
		margin-right: var(--size-4-4);
		align-self: center;
	}

	#diff-view-footer-done {
		margin-left: auto;
		transition: background-color 0.2s ease-out, border-color 0.2s ease-out;
	}

	.diff-view-footer-done-active {
		border: solid;
		border-width: 1px;
		border-color: var(--color-accent);
	}

	#diff-view-grid.diff-view-phone {
		grid-template-rows: auto auto 1fr auto auto;
		grid-template-columns: 1fr;
	}

	.diff-view-phone #diff-view-banner {
		grid-column: 1;
		padding: var(--size-4-2);
	}

	#diff-view-navigator {
		grid-row: 2;
		display: grid;
		grid-template-columns: auto 1fr auto;
		background-color: var(--background-primary-alt);
	}

	.diff-view-navigator-step.diff-view-navigator-step {
		height: 100%;
		padding: 0 var(--size-4-4);
		border-radius: 0;
		color: var(--text-muted);
		cursor: pointer;
	}

	.diff-view-navigator-step:first-child {
		border-right: 1px solid var(--background-secondary-alt);
	}

	.diff-view-navigator-step:last-child {
		border-left: 1px solid var(--background-secondary-alt);
	}

	.diff-view-navigator-step:disabled {
		opacity: 0.4;
		cursor: default;
	}

	#diff-view-navigator-center.transparent-button {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 0;
		height: auto;
		padding: var(--size-4-2);
		color: var(--text-normal);
		cursor: pointer;
		border-radius: 0;
	}

	#diff-view-navigator-count {
		display: flex;
		align-items: center;
		gap: var(--size-2-1);
		font-size: var(--font-smallest);
		color: var(--text-muted);
	}

	#diff-view-navigator-chevron {
		display: flex;
		--icon-size: var(--icon-xs);
	}

	#diff-view-navigator-name {
		max-width: 100%;
	}

	.diff-view-phone #diff-view-preview {
		grid-row: 3;
		grid-column: 1;
		min-height: 0;
	}

	#diff-view-preview-meta {
		grid-row: 1;
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
		padding: var(--size-4-2) var(--size-4-3);
		background-color: var(--background-primary-alt);
		border: 1px solid var(--background-secondary-alt);
		border-top-left-radius: var(--radius-s);
		border-top-right-radius: var(--radius-s);
	}

	#diff-view-preview-meta-path {
		min-width: 0;
		font-size: var(--font-smallest);
		color: var(--text-muted);
	}

	.diff-view-phone #diff-view-footer {
		grid-row: 4;
		grid-column: 1;
	}

	.diff-view-phone .diff-view-continuity-section-description {
		display: none;
	}

	.diff-view-phone .diff-view-footer-label {
		margin-left: var(--size-4-1);
		margin-right: var(--size-4-2);
	}

	#diff-view-actions {
		grid-row: 5;
		display: grid;
		grid-template-columns: auto 1fr 1fr;
		gap: var(--size-4-2);
	}

	#diff-view-actions button {
		min-height: 44px;
		box-shadow: none;
		cursor: pointer;
		transition: background-color 0.2s ease-out, border-color 0.2s ease-out;
	}

	#diff-view-actions-suggest {
		padding: 0 var(--size-4-4);
	}

	.diff-view-actions-button {
		font-size: var(--font-ui-medium);
	}

	.diff-view-ellipsis-label {
		display: inline-block;
		align-self: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.diff-view-border {
		border: solid;
		border-width: 1px;
		border-radius: var(--radius-s);
		border-color: var(--background-secondary-alt);
	}

	.diff-view-ellipse {
		flex-shrink: 0;
		align-self: center;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		transition: background-color 0.2s ease-out;
	}

	.button-green {
		background-color: #38533a;
	}

	.button-red {
		background-color: #593030;
	}

	.green {
		background-color: #46874a;
	}

	.red {
		background-color: #aa4646;
	}

	.accent {
		background-color: var(--color-accent);
	}

	.secondary {
		background-color: var(--background-secondary-alt);
	}
</style>
