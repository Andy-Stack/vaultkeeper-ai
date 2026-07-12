import { Diff2HtmlUI, type Diff2HtmlUIConfig } from "diff2html/lib/ui/js/diff2html-ui-base";
import { base64ToArrayBuffer, ItemView, WorkspaceLeaf, type ViewStateResult } from "obsidian";
import type { Artifact } from "Conversations/Artifact";
import { Copy } from "Enums/Copy";
import { ArtifactAction } from "Enums/ArtifactAction";
import type { FileSystemService } from "Services/FileSystemService";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { WorkSpaceService } from "Services/WorkSpaceService";
import { isDocumentMimeType, toMimeType } from "Enums/MimeType";

export const VIEW_TYPE_ARTIFACT = 'vaultkeeper-ai-artifact-view';

interface ArtifactViewState {
    artifact: Artifact;
    diffString: string;
    config: Diff2HtmlUIConfig;
}

const CONFIRM_TIMEOUT_MS = 3000;

export class ArtifactView extends ItemView {

    private readonly fileSystemService: FileSystemService;
    private readonly workSpaceService: WorkSpaceService;

    private artifact: Artifact | undefined;
    private diffString: string = "";
    private config: Diff2HtmlUIConfig = {};

    private diffContainer: HTMLElement | null = null;
    private buttonsContainer: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
        this.workSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);
    }

    public getViewType(): string {
        return VIEW_TYPE_ARTIFACT;
    }
    
    public getDisplayText(): string {
        return "Vaultkeeper AI artifact viewer";
    }

    public async setState(state: ArtifactViewState, result: ViewStateResult): Promise<void> {
        this.artifact = state.artifact;
        this.diffString = state.diffString;
        this.config = state.config;

        this.renderDiff();

        return super.setState(state, result);
    }

    public getState(): Record<string, unknown> {
        return {
            artifact: this.artifact,
            diffString: this.diffString,
            config: this.config
        };
    }

    private renderDiff() {
        if (!this.artifact) {
            return;
        }

        const container = this.resetContainer();

        this.diffContainer = container.createDiv({ cls: 'd2h-wrapper' });
        const diff2htmlUi = new Diff2HtmlUI(this.diffContainer, this.diffString, this.config);

        diff2htmlUi.draw();

        const buttonsContainer = this.createButtons();
        if (buttonsContainer) {
            this.buttonsContainer = buttonsContainer;
        }

        window.requestAnimationFrame(() => {
            const firstChange = this.diffContainer?.querySelector('.d2h-change, .d2h-ins, .d2h-del');
            firstChange?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    private resetContainer(): HTMLElement {
        const container = this.contentEl;
        container.empty();

        if (this.diffContainer) {
            this.diffContainer.remove();
            this.diffContainer = null;
        }

        if (this.buttonsContainer) {
            this.buttonsContainer.remove();
            this.buttonsContainer = null;
        }

        return container;
    }

    private createButtons(): HTMLElement | undefined {
        if (!this.artifact) {
            return;
        }

        const container = this.contentEl.createDiv({ cls: 'artifact-view-controls' });

        // If a file was modified then we have the option of restoring original content or the updated content
        // If the operation was create / delete then we only restore updated or original respectively
        // Binary / office file formats cannot be modified or created so we only ever restore the original for these

        // We only need the restore previous button if the action was a modify
        if (this.artifact.action === ArtifactAction.Modify) {
            const restorePreviousButton = container.createEl('button', {
                cls: 'artifact-view-button',
                text: Copy.ButtonRestorePrevious
            });

            this.registerConfirmButton(restorePreviousButton, Copy.ButtonRestorePrevious, async () => {
                if (!this.artifact) {
                    return;
                }

                await this.fileSystemService.writeToFilePath(this.artifact.filePath, this.artifact.originalContent, false, false);
                await this.closeArtifactView();
            });
        }

        const restoreButton = container.createEl('button', {
            cls: 'artifact-view-button',
            text: Copy.ButtonRestore
        });

        this.registerConfirmButton(restoreButton, Copy.ButtonRestore, async () => {
            if (!this.artifact) {
                return;
            }

            if (this.artifact.base64) {
                const arrayBuffer = base64ToArrayBuffer(this.artifact.base64);
                await this.fileSystemService.writeBinaryFile(this.artifact.filePath, arrayBuffer, false);
                await this.closeArtifactView();
                return;
            }

            // If the action is delete then we restore original otherwise restore updated
            const restoreOriginal = this.artifact.action === ArtifactAction.Delete;

            await this.fileSystemService.writeToFilePath(this.artifact.filePath, restoreOriginal
                ? this.artifact.originalContent : this.artifact.updatedContent, false, false);
            
            await this.closeArtifactView();
        });

        return container;
    }

    private registerConfirmButton(button: HTMLButtonElement, defaultLabel: string, onConfirm: () => Promise<void>): void {
        button.setAttribute('aria-label', defaultLabel);

        let resetTimeoutId: number | undefined;
        let awaitingConfirmation = false;

        const reset = () => {
            awaitingConfirmation = false;
            button.setText(defaultLabel);
            button.setAttribute('aria-label', defaultLabel);
            button.removeClass('artifact-view-button-confirming');
            if (resetTimeoutId !== undefined) {
                window.clearTimeout(resetTimeoutId);
                resetTimeoutId = undefined;
            }
        };

        this.registerDomEvent(button, 'click', async () => {
            if (!awaitingConfirmation) {
                awaitingConfirmation = true;
                button.setCssProps({ '--artifact-view-button-width': `${button.offsetWidth}px` });
                button.addClass('artifact-view-button-confirming');
                button.setText(Copy.ButtonConfirm);
                button.setAttribute('aria-label', Copy.ButtonConfirm);
                button.blur();
                resetTimeoutId = window.setTimeout(reset, CONFIRM_TIMEOUT_MS);
                return;
            }

            reset();
            await onConfirm();
        });

        this.register(reset);
    }

    private async closeArtifactView(): Promise<void> {
        if (!this.artifact) {
            return;
        }

        if (!isDocumentMimeType(toMimeType(this.artifact.mimeType))) {
            await this.workSpaceService.openNoteByPath(this.artifact.filePath);
        }
        this.leaf.detach();
    }
}