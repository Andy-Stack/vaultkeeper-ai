import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import { AbortService } from "./AbortService";
import type { QuickAgent } from "./AIServices/QuickAgent";
import type VaultkeeperAIPlugin from "main";
import type { Editor, MarkdownFileInfo, MarkdownView, Menu } from "obsidian";
import type { FileSystemService } from "./FileSystemService";
import { BeautifyPrompt } from "AIPrompts/QuickActionPrompts/Beautify";

export class QuickActionsService {

    private plugin: VaultkeeperAIPlugin;
    private abortService: AbortService;
    private fileSystemService: FileSystemService;

    public constructor() {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.abortService = Resolve<AbortService>(Services.AbortService);
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);

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
        
        if (content instanceof Error) {
            return; // Likely an excluded file
        }

        if (selection.length > 0) {
            const result = await this.newAction(BeautifyPrompt, selection);
            await this.fileSystemService.patchFile(file, [selection], [result], false, false);
        } else {
            const result = await this.newAction(BeautifyPrompt, content);
            await this.fileSystemService.writeToFile(file, result, false, false);
        }
    }

    private async applyTemplate(menu: Menu, editor: Editor, view: MarkdownView | MarkdownFileInfo) {
    }

    private async newAction(action: string, context: string): Promise<string> {
        return this.abortService.abortableOperation(async () => {
            const agent = Resolve<QuickAgent>(Services.QuickAgent);
            agent.resolveAIProvider();
            return agent.quickAction(action, context);
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

}