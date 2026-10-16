<script lang="ts">
	import { Resolve } from "Services/DependencyService";
	import { Services } from "Services/Services";
	import type { InputService } from "Services/InputService";
	import type { StreamingMarkdownService } from "Services/StreamingMarkdownService";
	import type { ExecutionPlan } from "Types/ExecutionPlan";
	import { slide } from "svelte/transition";
	import type { PlanApprovalService } from "Services/PlanApprovalService";
	import { setElementIcon } from "Helpers/ElementHelper";
	import { Platform } from "obsidian";
	import type { WorkSpaceService } from "Services/WorkSpaceService";
	import { VIEW_TYPE_MAIN } from "Views/MainView";

	export let plan: ExecutionPlan;

	const planApprovalService: PlanApprovalService = Resolve<PlanApprovalService>(Services.PlanApprovalService);
	const workSpaceService: WorkSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);
	const streamingMarkdownService: StreamingMarkdownService = Resolve<StreamingMarkdownService>(Services.StreamingMarkdownService);
	const inputService: InputService = Resolve<InputService>(Services.InputService);

	const isPhone = Platform.isPhone;

	let suggestionElement: HTMLDivElement | undefined;
	let suggestion: string | undefined;
	let isSuggesting = false;

	function instructionRenderAction(element: HTMLElement, instruction: string) {
		streamingMarkdownService.render(instruction, element, true);
		return {
			update(newInstruction: string) {
				streamingMarkdownService.render(newInstruction, element, true);
			}
		};
	}

	function suggestionField(element: HTMLDivElement) {
		suggestionElement = element;
		element.focus();

		return {
			destroy() {
				suggestionElement = undefined;
			}
		};
	}

	function toggleSuggestion() {
		isSuggesting = !isSuggesting;
		suggestion = undefined;
	}

	function handleInput() {
		if (!suggestionElement) {
			return;
		}

		if (suggestionElement.innerHTML !== suggestionElement.textContent && inputService.hasUnauthorizedHTML(suggestionElement)) {
			inputService.sanitizeToPlainText(suggestionElement);
		}

		if (suggestionElement.textContent.trim() === "") {
			suggestionElement.textContent = "";
			suggestion = undefined;
		} else {
			suggestion = suggestionElement.textContent;
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

	// Must run before the plan leaf detaches, otherwise Obsidian refocuses the editor and collapses the drawer
	async function revealMainView() {
		if (isPhone) {
			await workSpaceService.revealLeafOfType(VIEW_TYPE_MAIN);
		}
	}

	async function handleSubmit() {
		if (suggestion) {
			await revealMainView();
			planApprovalService.onSuggest(suggestion);
		}
	}

	async function handleReject() {
		await revealMainView();
		planApprovalService.onReject();
	}

	async function handleAccept() {
		await revealMainView();
		planApprovalService.onApprove();
	}
</script>

<div id="plan-approval-container" class="mobile-navbar-clearance" class:plan-approval-phone={isPhone}>
	<div id="plan-approval-header">
		<span id="plan-approval-header-ellipse"></span>
		<span id="plan-approval-header-title">Proposed plan</span>
		<span id="plan-approval-header-steps">{plan.executionSteps.length} steps</span>
	</div>
	<div id="plan-approval-body">
		{#each plan.executionSteps as step, index}
			<div>
				<h5>{`${index + 1}. ${step.description}`}</h5>
				<div use:instructionRenderAction={step.instruction}></div>
			</div>
		{/each}
	</div>
	{#if isSuggesting}
		<div id="plan-approval-suggestion" transition:slide>
			<div
				id="plan-approval-suggestion-field"
				use:suggestionField
				contenteditable="plaintext-only"
				oninput={handleInput}
				oncopy={handleCopy}
				onpaste={handlePaste}
				data-placeholder="Suggest changes to the plan..."
				aria-label="Suggest changes to the plan"
				role="textbox"
				aria-multiline="true"
				tabindex="0">
			</div>
			<span id="plan-approval-suggestion-label">Sent to the agent when you submit</span>
			<button
				id="plan-approval-suggestion-button" class="transparent-button"
				aria-label="Remove suggestion"
				onclick={toggleSuggestion}>
				Remove suggestion
			</button>
		</div>
	{/if}
	{#if isPhone}
		<div id="plan-approval-actions">
			<button
				id="plan-approval-actions-suggest"
				class:plan-approval-footer-control-suggest-active={isSuggesting}
				aria-label="Suggest changes"
				use:setElementIcon={"pencil"}
				onclick={toggleSuggestion}>
			</button>
			{#if isSuggesting}
				<button
					id="plan-approval-actions-submit"
					aria-label="Submit"
					disabled={!suggestion}
					onclick={handleSubmit}>
					Submit
				</button>
			{:else}
				<button
					class="plan-approval-actions-button"
					aria-label="Reject"
					onclick={handleReject}>
					Reject
				</button>
				<button
					id="plan-approval-actions-button"
					aria-label="Accept"
					onclick={handleAccept}>
					Accept
				</button>
			{/if}
		</div>
	{:else}
		<div id="plan-approval-footer">
			<span id="plan-approval-footer-label">Review the plan, then accept, reject or suggest changes.</span>
			<div id="plan-approval-footer-controls">
				<button
					id="plan-approval-footer-control-suggest"
					class:plan-approval-footer-control-suggest-active={isSuggesting}
					aria-label="Suggest changes"
					onclick={toggleSuggestion}>
					Suggest changes
				</button>
				{#if isSuggesting}
					<button
						id="plan-approval-footer-control-submit"
						aria-label="Submit"
						disabled={!suggestion}
						onclick={handleSubmit}>
						Submit
					</button>
				{:else}
					<button
						id="plan-approval-footer-control-reject"
						aria-label="Reject"
						onclick={handleReject}>
						Reject
					</button>
					<button
						id="plan-approval-footer-control-accept"
						aria-label="Accept"
						onclick={handleAccept}>
						Accept
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	#plan-approval-container {
		display: grid;
		grid-template-rows: auto 1fr;
		grid-auto-rows: auto;
		gap: var(--size-4-2);
		height: 100%;
	}

	#plan-approval-header {
		grid-row: 1;
		display: flex;
		gap: var(--size-4-2);
		padding: var(--size-4-2);
		border: solid;
		border-width: 1px;
		border-color: var(--background-secondary-alt);
		border-radius: var(--radius-s);
		background-color: var(--background-primary-alt);
	}

	#plan-approval-header-ellipse {
		flex-shrink: 0;
		align-self: center;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: var(--interactive-accent);
	}

	#plan-approval-header-title {
		font-size: var(--font-small);
		font-weight: var(--font-bold);
	}

	#plan-approval-header-steps {
		font-size: var(--font-small);
		color: var(--text-muted);
	}

	#plan-approval-body {
		grid-row: 2;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow-y: auto;
		padding: 0 var(--size-4-4);
		border: solid;
		border-width: 1px;
		border-color: var(--background-secondary-alt);
		border-radius: var(--radius-s);
		background-color: var(--background-primary-alt);
	}

	#plan-approval-suggestion {
		display: grid;
		grid-template-rows: auto auto;
		grid-template-columns: 1fr auto;
		padding: var(--size-4-2) var(--size-4-2) var(--size-2-1) var(--size-4-2);
		border: solid;
		border-width: 1px;
		border-color: var(--background-secondary-alt);
		border-radius: var(--radius-s);
		background-color: color-mix(
			in srgb,
			var(--color-accent-1) 7%,
			var(--background-primary-alt) 10%
		);
	}

	#plan-approval-suggestion-field {
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

	#plan-approval-suggestion-field:focus {
		border-color: var(--color-accent);
		box-shadow: 0px 0px 4px 1px var(--color-accent);
		transition: border-color 0.5s ease-out;
	}

	#plan-approval-suggestion-field::-webkit-scrollbar {
		display: none;
	}

	#plan-approval-suggestion-field:empty::before {
		content: attr(data-placeholder);
		color: var(--text-muted);
		opacity: 0.75;
		pointer-events: none;
	}

	#plan-approval-suggestion-field[contenteditable]:focus {
		outline: none;
	}

	#plan-approval-suggestion-label {
		grid-row: 2;
		grid-column: 1;
		align-self: center;
		color: var(--color-accent-1);
		font-size: var(--font-smallest);
		font-weight: var(--font-light);
	}

	#plan-approval-suggestion-button {
		grid-row: 2;
		grid-column: 2;
		cursor: pointer;
		color: var(--color-accent-1);
	}

	#plan-approval-footer {
		display: flex;
	}

	#plan-approval-footer-label {
		align-self: center;
		font-size: var(--font-smallest);
		color: var(--text-muted);
	}

	#plan-approval-footer-controls {
		display: flex;
		gap: var(--size-4-2);
		margin-left: auto;
	}

	#plan-approval-footer-controls button {
		transition: background-color 0.2s ease-out, border-color 0.2s ease-out;
	}

	.plan-approval-footer-control-suggest-active {
		border: solid;
		border-width: 1px;
		border-color: var(--color-accent);
	}

	#plan-approval-footer-control-reject,
	#plan-approval-footer-control-accept {
		border: solid;
		border-width: 1px;
		border-color: transparent;
	}

	#plan-approval-footer-control-reject:hover {
		border-color: #593030;
	}

	#plan-approval-footer-control-accept:hover {
		border-color: #38533a;
	}

	.plan-approval-phone #plan-approval-body {
		padding: 0 var(--size-4-3);
	}

	#plan-approval-actions {
		display: grid;
		grid-template-columns: auto 1fr 1fr;
		gap: var(--size-4-2);
	}

	#plan-approval-actions button {
		min-height: 44px;
		box-shadow: none;
		cursor: pointer;
		font-size: var(--font-ui-medium);
		transition: background-color 0.2s ease-out, border-color 0.2s ease-out;
	}

	#plan-approval-actions-suggest {
		padding: 0 var(--size-4-4);
	}

	#plan-approval-actions-submit {
		grid-column: 2 / 4;
	}

	#plan-approval-actions-button {
		font-size: var(--font-ui-medium);
	}
</style>