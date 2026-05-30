import type VaultkeeperAIPlugin from "main";
import { MarkdownView, Menu, setIcon, type EventRef } from "obsidian";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { SettingsService } from "Services/SettingsService";
import { WorkSpaceService } from "Services/WorkSpaceService";
import type { QuickActionsDefinitionsService } from "./QuickActionsDefinitionsService";

export class QuickActionsService {

    private readonly plugin: VaultkeeperAIPlugin;
    private readonly settingsService: SettingsService;
    private readonly workSpaceService: WorkSpaceService;
    private readonly quickActionsDefinitionsService: QuickActionsDefinitionsService;

    private editorMenuEventRef: EventRef | null = null;
    private layoutChangeEventRef: EventRef | null = null;

    private readonly settingsSubscription: object;
    
    public constructor() {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.workSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);
        this.quickActionsDefinitionsService = Resolve<QuickActionsDefinitionsService>(Services.QuickActionsDefinitionsService);

        this.settingsSubscription = this.settingsService.subscribeToSettingsChanged(changed => {
            if (changed.includes("enableToolbarActions") || changed.includes("enableContextMenuActions")) {
                this.updateRegistrations();
            }
        });

        this.registerEditorMenuActions();
        this.registerViewActions();
    }

    public dispose() {
        this.settingsService.unsubscribe(this.settingsSubscription);
        this.unregisterEditorMenuActions();
        this.unregisterViewActions();
    }

    /* Action Registration */

    private registerEditorMenuActions() {
        if (!this.settingsService.settings.enableContextMenuActions) {
            this.unregisterEditorMenuActions();
            return;
        }
        if (this.editorMenuEventRef) {
            return;
        }

        this.editorMenuEventRef = this.plugin.app.workspace.on("editor-menu", (menu, editor, view) => {
            menu.addItem((item) => {
                item.setTitle("Proofread")
                    .setIcon("scan-text")
                    .onClick(async () => this.quickActionsDefinitionsService.proofread(menu, editor, view));
            });
            menu.addItem((item) => {
                item.setTitle("Beautify")
                    .setIcon("palette")
                    .onClick(async () => this.quickActionsDefinitionsService.beautify(menu, editor, view));
            });
            menu.addItem((item) => {
                item.setTitle("Apply template")
                    .setIcon("notepad-text-dashed")
                    .onClick(async () => this.quickActionsDefinitionsService.applyTemplate(menu, editor, view));
            });
            menu.addItem((item) => {
                item.setTitle("Apply links")
                    .setIcon("link")
                    .onClick(async () => this.quickActionsDefinitionsService.applyLinks(menu, editor, view));
            });
            menu.addItem((item) => {
                item.setTitle("Apply tags")
                    .setIcon("tag")
                    .onClick(async () => this.quickActionsDefinitionsService.applyTags(menu, editor, view));
            });
            menu.addItem((item) => {
                item.setTitle("Suggest tags")
                    .setIcon("tags")
                    .onClick(async () => this.quickActionsDefinitionsService.suggestTags(menu, editor, view));
            });
            menu.addItem((item) => {
                item.setTitle("Generate frontmatter")
                    .setIcon("list-plus")
                    .onClick(async () => this.quickActionsDefinitionsService.generateFrontmatter(menu, editor, view));
            });
        });
        this.plugin.registerEvent(this.editorMenuEventRef);
    }

    private registerViewActions() {
        if (!this.settingsService.settings.enableToolbarActions) {
            this.unregisterViewActions();
            return;
        }
        if (this.layoutChangeEventRef) {
            return;
        }

        this.layoutChangeEventRef = this.plugin.app.workspace.on("layout-change", () => {
            this.injectToolbarButton();
        });
        this.plugin.registerEvent(this.layoutChangeEventRef);
        this.injectToolbarButton();
    }

    private injectToolbarButton() {
        const leaves = this.workSpaceService.getLeavesOfType("markdown");
        for (const leaf of leaves) {
            const view = leaf.view;
            if (!(view instanceof MarkdownView)) {
                continue;
            }

            const actionsEl = view.containerEl.querySelector(".view-actions");
            if (!actionsEl || actionsEl.querySelector(".vault-keeper-ai-actions")) {
                continue;
            }

            const button = createEl("button", { cls: "clickable-icon view-action vault-keeper-ai-actions" });
            button.setAttribute("aria-label", "AI quick actions");
            button.addEventListener("click", (evt) => {
                const { editor } = view;
                const menu = new Menu();
                menu.addItem((item) =>
                    item.setTitle("Proofread")
                        .setIcon("scan-text")
                        .onClick(async () => this.quickActionsDefinitionsService.proofread(menu, editor, view))
                );
                menu.addItem((item) =>
                    item.setTitle("Beautify")
                        .setIcon("palette")
                        .onClick(async () => this.quickActionsDefinitionsService.beautify(menu, editor, view))
                );
                menu.addItem((item) =>
                    item.setTitle("Apply template")
                        .setIcon("notepad-text-dashed")
                        .onClick(async () => this.quickActionsDefinitionsService.applyTemplate(menu, editor, view))
                );
                menu.addItem((item) =>
                    item.setTitle("Apply links")
                        .setIcon("link")
                        .onClick(async () => this.quickActionsDefinitionsService.applyLinks(menu, editor, view))
                );
                menu.addItem((item) =>
                    item.setTitle("Apply tags")
                        .setIcon("tag")
                        .onClick(async () => this.quickActionsDefinitionsService.applyTags(menu, editor, view))
                );
                menu.addItem((item) =>
                    item.setTitle("Suggest tags")
                        .setIcon("tags")
                        .onClick(async () => this.quickActionsDefinitionsService.suggestTags(menu, editor, view))
                );
                menu.addItem((item) =>
                    item.setTitle("Generate frontmatter")
                        .setIcon("list-plus")
                        .onClick(async () => this.quickActionsDefinitionsService.generateFrontmatter(menu, editor, view))
                );
                menu.showAtMouseEvent(evt);
            });
            setIcon(button, "sparkles");
            actionsEl.prepend(button);
        }
    }

    private updateRegistrations() {
        this.registerEditorMenuActions();
        this.registerViewActions();
    }

    private unregisterEditorMenuActions() {
        if (this.editorMenuEventRef) {
            this.plugin.app.workspace.offref(this.editorMenuEventRef);
            this.editorMenuEventRef = null;
        }
    }

    private unregisterViewActions(){
        if (this.layoutChangeEventRef) {
            this.plugin.app.workspace.offref(this.layoutChangeEventRef);
            this.layoutChangeEventRef = null;
            // Remove any existing toolbar buttons
            this.plugin.app.workspace.containerEl
                .querySelectorAll(".vault-keeper-ai-actions")
                .forEach(element => element.remove());
        }
    }

}