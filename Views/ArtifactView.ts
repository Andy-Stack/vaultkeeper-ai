import type { Diff2HtmlUIConfig } from "diff2html/lib/ui/js/diff2html-ui-base";
import { ItemView, WorkspaceLeaf, type ViewStateResult } from "obsidian";
import { mount, unmount } from "svelte";
import type { Artifact } from "Conversations/Artifact";
import ArtifactWindow from "Components/ArtifactWindow.svelte";

export const VIEW_TYPE_ARTIFACT = 'vaultkeeper-ai-artifact-view';

interface ArtifactViewState {
    artifact: Artifact;
    diffString: string;
    config: Diff2HtmlUIConfig;
}

export class ArtifactView extends ItemView {

    private artifact: Artifact | undefined;
    private diffString: string = "";
    private config: Diff2HtmlUIConfig = {};

    private artifactWindow: ReturnType<typeof ArtifactWindow> | undefined;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    protected override onClose(): Promise<void> {
        this.unmountArtifactWindow();
        return Promise.resolve();
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

        this.renderArtifact();

        return super.setState(state, result);
    }

    public getState(): Record<string, unknown> {
        return {
            artifact: this.artifact,
            diffString: this.diffString,
            config: this.config
        };
    }

    private renderArtifact() {
        this.unmountArtifactWindow();

        const container = this.contentEl;
        container.empty();

        if (!this.artifact) {
            return;
        }

        this.artifactWindow = mount(ArtifactWindow, {
            target: container,
            props: {
                artifact: this.artifact,
                diffString: this.diffString,
                config: this.config,
                onClose: () => this.leaf.detach()
            }
        });
    }

    private unmountArtifactWindow() {
        if (this.artifactWindow) {
            void unmount(this.artifactWindow);
            this.artifactWindow = undefined;
        }
    }

}
