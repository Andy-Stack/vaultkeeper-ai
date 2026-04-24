import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { QuickAgent } from "./AIServices/QuickAgent";
import type VaultkeeperAIPlugin from "main";
import { FuzzySuggestModal, MarkdownView, Menu, Notice, setIcon, TFile, type Editor, type MarkdownFileInfo } from "obsidian";
import { FileSystemService } from "./FileSystemService";
import { BeautifyPrompt } from "AIPrompts/QuickActionPrompts/Beautify";
import Spinner from "Components/Spinner.svelte";
import { mount } from "svelte";
import { ApplyTemplatePrompt } from "AIPrompts/QuickActionPrompts/ApplyTemplatePrompt";
import { Copy } from "Enums/Copy";
import type { WorkSpaceService } from "./WorkSpaceService";

export class QuickActionsService {

    private readonly actionTimeout: number = 30000;

    private plugin: VaultkeeperAIPlugin;
    private workSpaceService: WorkSpaceService
    private fileSystemService: FileSystemService;

    public constructor() {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.workSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);

        this.registerViewActions();
        this.registerEditorMenuActions();
    }

    /* Edit Menu Action Definitions */

    private async beautify(menu: Menu, editor: Editor, view: MarkdownView | MarkdownFileInfo) {
        const file = view.file;
        if (!file) {
            return;
        }

        const selection = editor.getSelection();
        const content = await this.fileSystemService.readFile(file);
        
        if (content instanceof Error || (selection.trim() === "" && content.trim() === "")) {
            return; // Either an excluded file or nothing to beautify
        }

        const notice = this.showNotice("Beautifying content...");
        try {
            if (selection.length > 0) {
                const result = await this.newAction(BeautifyPrompt, selection);
                if (result) {
                    await this.fileSystemService.patchFile(file, [selection], [result], false, false);
                }
            } else {
                const result = await this.newAction(BeautifyPrompt, content);
                if (result) {
                    await this.fileSystemService.writeToFile(file, result, false, false);
                }
            }
        } finally {
            notice.hide();
        }
    }

    private async applyTemplate(menu: Menu, editor: Editor, view: MarkdownView | MarkdownFileInfo) {
        const file = view.file;
        if (!file) {
            return;
        }

        const content = await this.fileSystemService.readFile(file);
        if (content instanceof Error || content.trim() === "") {
            return; // Either an excluded file or nothing to apply a template to
        }

        this.userSelectFile(this.plugin, async (templateFile) => {
            const templateContent = await this.fileSystemService.readFile(templateFile);
            if (templateContent instanceof Error || templateContent.trim() === "") {
                return; // Either an excluded file or the template is empty
            }

            const notice = this.showNotice("Applying template...");
            try {
                const context = `${Copy.ApplyTemplateTemplateSeparator}\n${templateContent}\n${Copy.ApplyTemplateContentSeparator}\n${content}`;
                const result = await this.newAction(ApplyTemplatePrompt, context);

                if (result && result.trim() !== Copy.ApplyTemplateCancelled.toString()) {
                    await this.fileSystemService.writeToFile(file, result, false, false);
                }
            } finally {
                notice.hide();
            }
        });
    }

    /* Registered Edit Menu Actions */

    private registerEditorMenuActions() {
        // Beautify
        this.plugin.registerEvent(
            this.plugin.app.workspace.on("editor-menu", (menu, editor, view) => {
                menu.addItem((item) => {
                item.setTitle("Beautify")
                    .setIcon("palette")
                    .onClick(async () => this.beautify(menu, editor, view));
                });
            })
        );

        // Apply Template
        this.plugin.registerEvent(
            this.plugin.app.workspace.on("editor-menu", (menu, editor, view) => {
                menu.addItem((item) => {
                item.setTitle("Apply template")
                    .setIcon("notepad-text-dashed")
                    .onClick(async () => this.applyTemplate(menu, editor, view));
                });
            })
        );
    }

    private registerViewActions() {
        this.plugin.registerEvent(
			this.plugin.app.workspace.on("layout-change", () => {
                const actionsView = this.workSpaceService.getViewActionsView();
                if (actionsView) {
                    if (actionsView.querySelector(".vault-keeper-ai-actions")) {
                        return;
                    }
                    const button = createEl("button", { cls: "clickable-icon view-action vault-keeper-ai-actions" });
                    button.setAttribute('aria-label', 'AI Quick Actions');
                    button.addEventListener('click', (evt) => {
                        const view = this.workSpaceService.getActiveViewOfType(MarkdownView);
                        if (view) {
                            const { editor } = view;
                            const menu = new Menu();
                            menu.addItem((item) =>
                                item.setTitle("Beautify")
                                    .setIcon("palette")
                                    .onClick(async () => this.beautify(menu, editor, view))
                            );
                            menu.addItem((item) =>
                                item.setTitle("Apply template")
                                    .setIcon("notepad-text-dashed")
                                    .onClick(async () => this.applyTemplate(menu, editor, view))
                            );
                            menu.showAtMouseEvent(evt);
                        }
                    });
                    setIcon(button, "sparkles");
                    actionsView.prepend(button);
                }  
            })
		);
    }

    /* Helpers */

    private userSelectFile(plugin: VaultkeeperAIPlugin, onSelected: (file: TFile) => Promise<void>): void {
        const fileSystemService = this.fileSystemService;

        new (class extends FuzzySuggestModal<TFile> {
            getItems()             { return fileSystemService.getMarkdownFiles(); }
            getItemText(f: TFile)  { return f.path; }
            onChooseItem(f: TFile) { void onSelected(f); }
        })(plugin.app).open();
    }

    private async newAction(action: string, context: string): Promise<string | null> {
        const agent = Resolve<QuickAgent>(Services.QuickAgent);
        agent.resolveAIProvider();

        const timeoutPromise = new Promise<never>((_, reject) =>
            activeWindow.setTimeout(() => reject(new DOMException(`Action timed out after ${this.actionTimeout}s`, "AbortError")), this.actionTimeout)
        );

        return Promise.race([agent.quickAction(action, context), timeoutPromise]);
    }

    private showNotice(message: string): Notice {
        const fragment = activeDocument.createDocumentFragment();
        const container = activeDocument.createElement("div");

        container.addClass("quick-action-notice");
        mount(Spinner, { target: container, props: {
            width: "var(--size-4-4)",
            height: "var(--size-4-4)",
            background: "var(--background-modifier-message)"
        }});
        
        container.createSpan({ text: message });
        fragment.appendChild(container);
        
        return new Notice(fragment, 0);
    }
}