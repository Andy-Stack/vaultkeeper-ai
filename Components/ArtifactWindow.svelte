<script lang="ts">
	import { Diff2HtmlUI, type Diff2HtmlUIConfig } from "diff2html/lib/ui/js/diff2html-ui-base";
	import { base64ToArrayBuffer, Notice } from "obsidian";
	import { onDestroy } from "svelte";
	import type { Artifact } from "Conversations/Artifact";
	import { Copy } from "Enums/Copy";
	import { ArtifactAction } from "Enums/ArtifactAction";
	import { isDocumentMimeType, toMimeType } from "Enums/MimeType";
	import { Resolve } from "Services/DependencyService";
	import { Services } from "Services/Services";
	import type { FileSystemService } from "Services/FileSystemService";
	import type { WorkSpaceService } from "Services/WorkSpaceService";
	import { basename, dirname } from "path-browserify";

	type ConfirmAction = "restorePrevious" | "restore";

	interface DiffRenderOptions {
		diffString: string;
		config: Diff2HtmlUIConfig;
	}

	const CONFIRM_TIMEOUT_MS = 3000;

	export let artifact: Artifact;
	export let diffString: string;
	export let config: Diff2HtmlUIConfig;
	export let onClose: () => void;

	const fileSystemService: FileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
	const workSpaceService: WorkSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);

	let confirming: ConfirmAction | undefined;
	let confirmingWidth = 0;
	let resetTimeoutId: number | undefined;

	$: restorePreviousLabel = confirming === "restorePrevious" ? Copy.ButtonConfirm : Copy.ButtonRestorePrevious;
	$: restoreLabel = confirming === "restore" ? Copy.ButtonConfirm : getControlMessage();

	onDestroy(resetConfirm);

	function draw(element: HTMLElement, options: DiffRenderOptions) {
		element.empty();

		new Diff2HtmlUI(element, options.diffString, options.config).draw();

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

	function resetConfirm() {
		confirming = undefined;
		if (resetTimeoutId !== undefined) {
			window.clearTimeout(resetTimeoutId);
			resetTimeoutId = undefined;
		}
	}

	async function handleConfirmClick(e: MouseEvent, action: ConfirmAction, onConfirm: () => Promise<void>) {
		if (confirming !== action) {
			resetConfirm();
			const button = e.currentTarget as HTMLButtonElement;
			confirmingWidth = button.offsetWidth;
			confirming = action;
			button.blur();
			resetTimeoutId = window.setTimeout(resetConfirm, CONFIRM_TIMEOUT_MS);
			return;
		}

		resetConfirm();
		await onConfirm();
	}

	/** If a file was modified then we have the option of restoring original content or the updated content
	 * If the operation was create / delete then we only restore updated or original respectively
	 * Binary / office file formats cannot be modified or created so we only ever restore the original for these **/
	async function restore() {
		switch (artifact.action) {
			case ArtifactAction.Create:
			case ArtifactAction.Delete:
				await write();
				break;
			case ArtifactAction.Modify:
				await restoreNew();
				break;
			case ArtifactAction.Move:
				await move();
				break;
		}
	}

	async function restorePrevious() {
		await fileSystemService.writeToFilePath(artifact.filePath, artifact.originalContent);
		await close(ArtifactAction.Modify, `Restored previous version of ${basename(artifact.filePath)}`);
	}

	async function restoreNew() {
		await fileSystemService.writeToFilePath(artifact.filePath, artifact.updatedContent);
		await close(ArtifactAction.Modify, `Restored updated version of ${basename(artifact.filePath)}`);
	}

	async function write() {
		if (artifact.base64) {
			const arrayBuffer = base64ToArrayBuffer(artifact.base64);
			await fileSystemService.writeBinaryFile(artifact.filePath, arrayBuffer);
			await close(artifact.action, `Restored ${basename(artifact.filePath)} to ${artifact.filePath}`);
			return;
		}

		// If the action is delete then we restore original otherwise restore updated
		const restoreOriginal = artifact.action === ArtifactAction.Delete;

		await fileSystemService.writeToFilePath(artifact.filePath, restoreOriginal
			? artifact.originalContent : artifact.updatedContent);

		await close(artifact.action, restoreOriginal
			? `Restored deleted file ${basename(artifact.filePath)} to ${artifact.filePath}`
			: `Re-created ${basename(artifact.filePath)} at ${artifact.filePath}`);
	}

	async function move() {
		if (!artifact.previousPath) {
			new Notice("Failed to move file to previous location");
			return;
		}

		if (!await fileSystemService.exists(artifact.filePath)) {
			new Notice(`File at '${artifact.filePath}' no longer exists`);
			return
		}

		if (await fileSystemService.exists(artifact.previousPath)) {
			new Notice(`A file at ${artifact.previousPath} already exists`);
			return;
		}

		await fileSystemService.moveFile(artifact.filePath, artifact.previousPath);
		await close(ArtifactAction.Move, `Restored ${basename(artifact.filePath)} to ${artifact.previousPath}`);
	}

	async function close(action: ArtifactAction, message: string) {
		if (!isDocumentMimeType(toMimeType(artifact.mimeType))) {
			if (action === ArtifactAction.Move && artifact.previousPath) {
				await workSpaceService.openNoteByPath(artifact.previousPath);
			} else {
				await workSpaceService.openNoteByPath(artifact.filePath);
			}
		}
		new Notice(message);
		onClose();
	}

	function getFooterMessage() {
		switch (artifact.action) {
			case ArtifactAction.Create:
				return "This file was created by this change. Restoring will attemp to re-create it again.";
			case ArtifactAction.Delete:
				return "This file was deleted by this change. Restoring will bring it back to its original location.";
			case ArtifactAction.Modify:
				return "Restore either side of this change to the vault.";
			case ArtifactAction.Move:
				return "Restoring will attempt to move the file back to its original location.";
		}
	}

	function getControlMessage() {
		switch (artifact.action) {
			case ArtifactAction.Move:
				return "Restore previous location";
			default:
				return "Restore this version";
		}
	}

	function name(): string {
		return basename(artifact.filePath);
	}

	function path(): string {
		return dirname(artifact.filePath);
	}
</script>

<div class="artifact-container mobile-navbar-clearance">
	<div class="artifact-view">
		<div class="artifact-view-header">
			<span
				class="artifact-view-header-ellipse artifact-action-{artifact.action}"
				role="img"
				aria-label="File action: {artifact.action}"></span>
			<span class="artifact-view-header-file-path">{path()}/</span>
			<span class="artifact-view-header-file-name">{name()}</span>
		</div>
		<div class="artifact-view-diff">
			{#if artifact.action === ArtifactAction.Move}
				<div class="artifact-view-move-file">
					<span class="artifact-view-move-file-title">File was moved</span>
					<span class="artifact-view-move-file-description">File contents remained identical, only the location changed</span>
					<div class="artifact-view-move-file-paths">
						<div class="artifact-view-move-file-old-path-container">
							<span class="artifact-view-move-file-path-prefix">from:</span>
							<span class="artifact-view-move-file-path" title={artifact.previousPath}>{artifact.previousPath}</span>
						</div>
						<div class="artifact-view-move-file-new-path-container">
							<span class="artifact-view-move-file-path-prefix">to:</span>
							<span class="artifact-view-move-file-path" title={artifact.filePath}>{artifact.filePath}</span>
						</div>
					</div>
				</div>
			{:else}
				<div class="d2h-wrapper" use:diffRenderAction={{ diffString, config }}></div>
			{/if}
		</div>
	</div>
	<div class="artifact-view-footer">
		<span class="artifact-view-footer-label">{getFooterMessage()}</span>
		<div class="artifact-view-footer-controls">
			{#if artifact.action === ArtifactAction.Modify}
				<button
					type="button"
					class="artifact-view-footer-control-1"
					class:confirming={confirming === "restorePrevious"}
					style:min-width={confirming === "restorePrevious" ? `${confirmingWidth}px` : undefined}
					aria-label={restorePreviousLabel}
					onclick={(e) => handleConfirmClick(e, "restorePrevious", restorePrevious)}>
					{restorePreviousLabel}
				</button>
			{/if}
			<button
				type="button"
				class="artifact-view-footer-control-2"
				class:confirming={confirming === "restore"}
				style:min-width={confirming === "restore" ? `${confirmingWidth}px` : undefined}
				aria-label={restoreLabel}
				onclick={(e) => handleConfirmClick(e, "restore", restore)}>
				{restoreLabel}
			</button>
		</div>
	</div>
</div>

<style>
	.artifact-container {
		display: grid;
		grid-template-rows: 1fr auto;
		height: 100%;
	}

	.artifact-view {
		grid-row: 1;
		min-height: 0;
		display: grid;
		grid-template-rows: auto 1fr;
		border: solid;
		border-width: 1px;
		border-color: var(--background-secondary-alt);
		border-radius: var(--radius-s);
		background-color: var(--background-secondary);
	}

	.artifact-view-header {
		grid-row: 1;
		display: flex;
		border-bottom: solid;
		border-width: 1px;
		border-color: var(--background-secondary-alt);
		padding: var(--size-4-2);
	}

	.artifact-view-header-ellipse {
		flex-shrink: 0;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		align-self: center;
	}

	.artifact-action-create {
		background: var(--color-green);
	}

	.artifact-action-modify {
		background: var(--color-blue);
	}

	.artifact-action-delete {
		background: var(--color-red);
	}

	.artifact-action-move {
		background: var(--color-cyan);
	}

	.artifact-view-header-file-path {
		font-size: var(--font-size-smaller);
		color: var(--text-muted);
		margin-left: var(--size-4-2);
	}

	.artifact-view-header-file-name {
		font-size: var(--font-size-smaller);
		font-weight: var(--font-bold);
	}

	.artifact-view-diff {
		grid-row: 2;
		min-height: 0;
	}

	.artifact-view-move-file {
		display: grid;
		grid-template-rows: 1fr auto auto auto 1fr;
		grid-template-columns: minmax(0, 1fr);
		height: 100%;
		background-color: var(--background-primary);
	}

	.artifact-view-move-file-title {
		grid-row: 2;
		text-align: center;
	}

	.artifact-view-move-file-description {
		grid-row: 3;
		margin-bottom: 8px;
		font-size: var(--font-smallest);
		color: var(--text-muted);
		text-align: center;
	}

	.artifact-view-move-file-paths {
		grid-row: 4;
		justify-self: center;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		max-width: 80%;
	}

	.artifact-view-move-file-old-path-container {
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

	.artifact-view-move-file-new-path-container {
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

	.artifact-view-move-file-path-prefix {
		font-size: var(--font-smaller);
		color: var(--text-muted);
		align-self: center;
		margin-right: var(--size-4-4);
	}

	.artifact-view-move-file-path {
		font-size: var(--font-smaller);
		align-self: center;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.artifact-view-footer {
		grid-row: 2;
		display: flex;
		margin-top: var(--size-4-4);
	}

	.artifact-view-footer-label {
		align-self: center;
		font-size: var(--font-smaller);
		color: var(--text-muted);
		font-style: italic;
	}

	.artifact-view-footer-controls {
		display: flex;
    	gap: var(--size-4-2);
		margin-left: auto;
	}

	:global(.is-mobile) .artifact-view-footer {
		flex-direction: column;
		gap: var(--size-4-2);
	}

	:global(.is-mobile) .artifact-view-footer-label {
		align-self: stretch;
	}

	.artifact-view-diff:focus-visible {
		outline: 1px solid var(--color-accent);
		outline-offset: -1px;
	}

	.artifact-view-footer-control-1,
	.artifact-view-footer-control-2 {
		transition: background-color 0.2s ease-out, border-color 0.2s ease-out;
	}

	.artifact-view-footer-control-2 {
		background-color: #38533a;
	}

	.artifact-view-footer-control-2:hover {
		background-color: #46874a;
	}

	.artifact-view-footer-control-1.confirming,
	.artifact-view-footer-control-2.confirming {
		color: white;
		background-color: #38533a;
	}

	.artifact-view-footer-control-1.confirming:hover,
	.artifact-view-footer-control-1.confirming:focus-visible,
	.artifact-view-footer-control-1.confirming:active,
	.artifact-view-footer-control-2.confirming:hover,
	.artifact-view-footer-control-2.confirming:focus-visible,
	.artifact-view-footer-control-2.confirming:active {
		background-color: #537555;
	}
</style>