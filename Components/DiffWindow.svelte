<script lang="ts">
	import { Diff2HtmlUI, type Diff2HtmlUIConfig } from "diff2html/lib/ui/js/diff2html-ui-base";
	import type { IDocumentReport } from "../DocumentValidation/IDocumentReport";
	import { VaultContinuityModal } from "../Modals/VaultContinuityModal";
	import { Resolve } from "Services/DependencyService";
	import { Services } from "Services/Services";
	import type { InputService } from "Services/InputService";
	import type { IVaultChange, TemporaryVaultService } from "Services/TemporaryVaultService";
	import { basename, dirname } from "path-browserify";
	import { slide } from "svelte/transition";
	import { DiffState } from "Enums/DiffState";
	import type { EventService } from "Services/EventService";
	import { Event } from "Enums/Event";
	import { setElementIcon } from "Helpers/ElementHelper";
	import { FileEvent } from "Enums/FileEvent";

	interface DiffRenderOptions {
		vaultChange: IVaultChange | undefined;
		config: Diff2HtmlUIConfig;
	}

	export let config: Diff2HtmlUIConfig;
	export let report: IDocumentReport | undefined;

	const temporaryVaultService: TemporaryVaultService = Resolve<TemporaryVaultService>(Services.TemporaryVaultService);
	const eventService: EventService = Resolve<EventService>(Services.EventService);
	const inputService: InputService = Resolve<InputService>(Services.InputService);

	let suggestionElement: HTMLDivElement | undefined;

	let vaultChanges: IVaultChange[] = temporaryVaultService.getVaultChanges();
	
	let selectedItem: IVaultChange | undefined = vaultChanges[0];

	let stateCounts = countStates();
	$: issueCount = report?.issueCount() ?? 0;

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

	function displayState(vaultChange: IVaultChange): DiffState {
		if (vaultChange.status === DiffState.Suggestion && vaultChange.suggestion === undefined) {
			return DiffState.None;
		}

		return vaultChange.status;
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

	function openReport() {
		if (report) {
			new VaultContinuityModal(report).open();
		}
	}

	function select(vaultChange: IVaultChange) {
		selectedItem = vaultChange;
		if (suggestionElement) {
			suggestionElement.textContent = selectedItem.suggestion ?? "";
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

		refresh();
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
		refresh();
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

		refresh();
	}

	function markVaultChange(vaultChange: IVaultChange | undefined, diffState: DiffState, shouldRefresh: boolean = false) {
		if (vaultChange) {
			vaultChange.status = vaultChange.status === diffState ? DiffState.None : diffState;

			if (vaultChange.status !== DiffState.Suggestion) {
				vaultChange.suggestion = undefined;
			}
		}

		if (shouldRefresh) {
			refresh();
		}
	}

	function handleDone() {
		if (stateCounts[DiffState.None] > 0) {
			return;
		}
		eventService.trigger(Event.DiffClosed);
	}

	function name(vaultChange: IVaultChange): string {
		return vaultChange.file?.basename ?? basename(vaultChange.newPath ?? "-");
	}

	function path(vaultChange: IVaultChange): string {
		return vaultChange.file?.parent?.path ?? dirname(vaultChange.newPath ?? "-");
	}
</script>

<div id="diff-view-grid">
	{#if issueCount > 0}
		<div id="diff-view-banner">
			{issueCount} continuity issues found in this change.
			<button id="diff-view-banner-link" class="transparent-button" aria-label="View report" onclick={openReport}>View report</button>
		</div>
	{/if}
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
					aria-label={vaultChange.newPath ?? vaultChange.file?.path ?? name(vaultChange)}
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
					<span class="diff-view-panel-body-item-name diff-view-ellipsis-label">{name(vaultChange)}</span>
					<span class="diff-view-panel-body-item-path diff-view-ellipsis-label">{path(vaultChange)}</span>
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
	<div id="diff-view-preview">
		{#if selectedItem}
			<div id="diff-view-preview-header">
				<span 
					 id="diff-view-preview-header-ellipse" class="diff-view-ellipse"
					 aria-hidden="true"
					 class:secondary={displayState(selectedItem) === DiffState.None}
					 class:green={displayState(selectedItem) === DiffState.Accepted}
					 class:red={displayState(selectedItem) === DiffState.Rejected}
					 class:accent={displayState(selectedItem) === DiffState.Suggestion}></span>
				<span id="diff-view-preview-header-name" class="diff-view-ellipsis-label">{name(selectedItem)}</span>
				<span id="diff-view-preview-header-path" class="diff-view-ellipsis-label">{path(selectedItem)}</span>
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
			{#if selectedItem.changeType === FileEvent.Rename}
				<div id="diff-view-preview-move-file">
					<span id="diff-view-preview-move-file-title">File will be moved</span>
					<span id="diff-view-preview-move-file-description">File contents will remain identical, only the location will change</span>
					<div id="diff-view-preview-move-file-paths">
						<div id="diff-view-preview-move-file-old-path-container">
							<span class="diff-view-preview-move-file-path-prefix">from:</span>
							<span id="diff-view-preview-move-file-old-path">{selectedItem.oldPath}</span>
						</div>
						<div id="diff-view-preview-move-file-new-path-container">
							<span class="diff-view-preview-move-file-path-prefix">to:</span>
							<span id="diff-view-preview-move-file-new-path">{selectedItem.newPath}</span>
						</div>
					</div>
				</div>
			{:else}
				<div class="d2h-wrapper" use:diffRenderAction={{ vaultChange: selectedItem, config }}></div>
			{/if}
		{/if}
	</div>
	<div id="diff-view-footer">
		<span class="diff-view-ellipse green" aria-hidden="true"></span>
		<span class="diff-view-footer-label">{stateCounts[DiffState.Accepted]} accepted</span>
		<span class="diff-view-ellipse red" aria-hidden="true"></span>
		<span class="diff-view-footer-label">{stateCounts[DiffState.Rejected]} rejected</span>
		<span class="diff-view-ellipse accent" aria-hidden="true"></span>
		<span class="diff-view-footer-label">{stateCounts[DiffState.Suggestion]} to revise</span>
		<span class="diff-view-ellipse secondary" aria-hidden="true"></span>
		<span class="diff-view-footer-label">{stateCounts[DiffState.None]} remaining</span>
		<button 
			   id="diff-view-footer-done"
			   aria-label="Done"
			   class:diff-view-footer-done-active={stateCounts[DiffState.None] === 0}
			   disabled={stateCounts[DiffState.None] > 0}
			   onclick={handleDone}>
			   Done
			</button>
	</div>
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
		padding: 0 var(--size-4-2);
		background-color: rgba(224,175,104,0.10);
		border: 1px solid rgba(224,175,104,0.22);
		color: var(--text-normal);
		border-radius: var(--radius-s);
		font-size: var(--font-smaller);
	}

	#diff-view-banner-link {
		color: var(--color-accent-1);
		text-decoration: underline;
		padding: 0;
		cursor: pointer;
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
		grid-template-columns: auto 1fr auto;
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

	.diff-view-panel-body-item-controls {
		grid-row: 1 / 3;
		grid-column: 3;
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
		grid-template-columns: auto 1fr;
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
		font-size: var(--font-smaller);
		align-self: center;
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
		font-size: var(--font-smaller);
		align-self: center;
	}

	#diff-view-preview .d2h-wrapper {
		grid-row: 3;
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
