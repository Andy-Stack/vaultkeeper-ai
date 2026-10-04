<script lang="ts">
	import { DiffState } from "Enums/DiffState";
	import type { IVaultChange } from "Services/TemporaryVaultService";
	import { countUndecided, displayState, reviewDoneLabel, vaultChangeFolder, vaultChangeName } from "Helpers/VaultChangeHelper";
	import StatusDot from "Components/StatusDot.svelte";

	export let vaultChanges: IVaultChange[];
	export let selectedItem: IVaultChange | undefined;
	export let onSelect: (vaultChange: IVaultChange) => void;
	export let onMarkRemaining: (diffState: DiffState) => void;
	export let onDone: () => void;
	export let close: () => void;

	const statusLabels: Record<DiffState, string> = {
		[DiffState.None]: "Undecided",
		[DiffState.Accepted]: "Accepted",
		[DiffState.Rejected]: "Rejected",
		[DiffState.Suggestion]: "To revise"
	};

	let undecided = countUndecided(vaultChanges);

	// The callbacks mutate the shared vault changes and refresh the diff window; this refreshes the sheet
	function refresh() {
		vaultChanges = vaultChanges;
		undecided = countUndecided(vaultChanges);
	}

	function select(vaultChange: IVaultChange) {
		onSelect(vaultChange);
		close();
	}

	function markRemaining(diffState: DiffState) {
		onMarkRemaining(diffState);
		refresh();
	}
</script>

<div id="diff-change-list">
	<div id="diff-change-list-header">
		<span id="diff-change-list-title">Proposed changes</span>
		<span id="diff-change-list-count">{undecided} undecided</span>
	</div>
	<div id="diff-change-list-items">
		{#each vaultChanges as vaultChange}
			<div
				class="diff-change-list-item"
				class:diff-change-list-item-selected={vaultChange === selectedItem}
				aria-label={vaultChange.newPath ?? vaultChange.file?.path ?? vaultChangeName(vaultChange)}
				role="button"
				tabindex="0"
				onclick={() => select(vaultChange)}
				onkeydown={(e) => e.key === "Enter" && select(vaultChange)}>
				<StatusDot state={displayState(vaultChange)} />
				<div class="diff-change-list-item-labels">
					<span class="diff-change-list-item-name diff-change-list-ellipsis">{vaultChangeName(vaultChange)}</span>
					<span class="diff-change-list-item-path diff-change-list-ellipsis">{vaultChangeFolder(vaultChange)}</span>
				</div>
				<span
					class="diff-change-list-item-status"
					class:accepted={displayState(vaultChange) === DiffState.Accepted}
					class:rejected={displayState(vaultChange) === DiffState.Rejected}
					class:suggestion={displayState(vaultChange) === DiffState.Suggestion}>
					{statusLabels[displayState(vaultChange)]}
				</span>
			</div>
		{/each}
	</div>
	<div id="diff-change-list-footer">
		<button aria-label="Accept remaining" onclick={() => markRemaining(DiffState.Accepted)}>Accept remaining</button>
		<button aria-label="Reject remaining" onclick={() => markRemaining(DiffState.Rejected)}>Reject remaining</button>
		<button
			id="diff-change-list-done"
			aria-label={reviewDoneLabel(undecided)}
			class:diff-change-list-done-active={undecided === 0}
			disabled={undecided > 0}
			onclick={onDone}>
			{reviewDoneLabel(undecided)}
		</button>
	</div>
</div>

<style>
	#diff-change-list {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	#diff-change-list-header {
		display: flex;
		align-items: baseline;
		padding: 0 var(--size-4-4) var(--size-4-3);
		border-bottom: 1px solid var(--background-modifier-border);
	}

	#diff-change-list-title {
		font-weight: bold;
	}

	#diff-change-list-count {
		margin-left: auto;
		font-size: var(--font-smallest);
		color: var(--text-muted);
	}

	#diff-change-list-items {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.diff-change-list-item {
		display: flex;
		align-items: center;
		gap: var(--size-4-3);
		min-height: 44px;
		padding: var(--size-4-2) var(--size-4-4);
		border-bottom: 1px solid var(--background-modifier-border);
		cursor: pointer;
	}

	.diff-change-list-item-selected {
		background-color: var(--background-modifier-hover);
	}

	.diff-change-list-item-labels {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.diff-change-list-item-name {
		font-size: var(--font-smaller);
	}

	.diff-change-list-item-path {
		font-size: var(--font-smallest);
		color: var(--text-muted);
	}

	.diff-change-list-item-status {
		flex-shrink: 0;
		font-size: var(--font-smallest);
		color: var(--text-muted);
	}

	.diff-change-list-item-status.accepted {
		color: var(--color-green);
	}

	.diff-change-list-item-status.rejected {
		color: var(--color-red);
	}

	.diff-change-list-item-status.suggestion {
		color: var(--color-accent-1);
	}

	.diff-change-list-ellipsis {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	#diff-change-list-footer {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--size-4-2);
		padding: var(--size-4-3) var(--size-4-4) 0;
	}

	#diff-change-list-footer button {
		min-height: 44px;
		box-shadow: none;
		cursor: pointer;
		transition: background-color 0.2s ease-out, border-color 0.2s ease-out;
	}

	#diff-change-list-done {
		grid-column: 1 / -1;
	}

	.diff-change-list-done-active {
		border: 1px solid var(--color-accent);
	}
</style>
