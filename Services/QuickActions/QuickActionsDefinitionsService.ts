import { Resolve } from "../DependencyService";
import { Services } from "../Services";
import type { QuickAgent } from "../AIServices/QuickAgent";
import type VaultkeeperAIPlugin from "main";
import { FuzzySuggestModal, MarkdownView, Menu, Notice, TFile, type Editor, type MarkdownFileInfo } from "obsidian";
import { FileSystemService } from "../FileSystemService";
import { BeautifyPrompt } from "AIPrompts/QuickActionPrompts/BeautifyPrompt";
import Spinner from "Components/Spinner.svelte";
import { mount } from "svelte";
import { ApplyTemplatePrompt } from "AIPrompts/QuickActionPrompts/ApplyTemplatePrompt";
import { Copy } from "Enums/Copy";
import type { SettingsService } from "../SettingsService";
import { openPluginSettings, replaceCopy, splitFrontmatter } from "Helpers/Helpers";
import { mergeFrontmatterFields, mergeListIntoFrontmatter, parseFrontmatterYaml } from "Helpers/FrontmatterHelpers";
import { ProofreadPrompt } from "AIPrompts/QuickActionPrompts/ProofreadPrompt";
import { VaultCacheService } from "Services/VaultCacheService";
import { ApplyLinksPrompt } from "AIPrompts/QuickActionPrompts/ApplyLinksPrompt";
import { ApplyTagsPrompt } from "AIPrompts/QuickActionPrompts/ApplyTagsPrompt";
import { GenerateFrontmatterPrompt } from "AIPrompts/QuickActionPrompts/GenerateFrontmatterPrompt";
import { Semaphore } from "Helpers/Semaphore";
import { SuggestTagsPrompt } from "AIPrompts/QuickActionPrompts/SuggestTagsPrompt";

export class QuickActionsDefinitionsService {

    private plugin: VaultkeeperAIPlugin;
    private fileSystemService: FileSystemService;
    private vaultcacheService: VaultCacheService;
    private settingsService: SettingsService;

    private semaphore: Semaphore = new Semaphore(1, true);

    public constructor() {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
        this.vaultcacheService = Resolve<VaultCacheService>(Services.VaultCacheService);
        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
    }

    public async proofread(_menu: Menu, editor: Editor, view: MarkdownView | MarkdownFileInfo) {
        await this.asSerialAction("Proofread", async () => {
            const file = view.file;
            if (!file) {
                return;
            }

            const selection = editor.getSelection();
            const content = await this.fileSystemService.readFile(file);

            if (content instanceof Error || (selection.trim() === "" && content.trim() === "")) {
                return; // Either an excluded file or nothing to proofread
            }

            const notice = this.showNotice("Proofreading...");
            try {
                if (selection.length > 0) {
                    const result = await this.performAction(ProofreadPrompt, selection);
                    if (result) {
                        await this.fileSystemService.patchFile(file, [selection], [result], false, false);
                    }
                } else {
                    const { body } = splitFrontmatter(content);
                    if (body.trim() === "") {
                        return;
                    }
                    const result = await this.performAction(ProofreadPrompt, body);
                    if (result) {
                        await this.fileSystemService.patchFile(file, [body], [result], false, false);
                    }
                }
            } finally {
                notice.hide();
            }
        });
    }

    public async beautify(_menu: Menu, editor: Editor, view: MarkdownView | MarkdownFileInfo) {
        await this.asSerialAction("Beautify", async () => {
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
                    const result = await this.performAction(BeautifyPrompt, selection);
                    if (result) {
                        await this.fileSystemService.patchFile(file, [selection], [result], false, false);
                    }
                } else {
                    const { body } = splitFrontmatter(content);
                    if (body.trim() === "") {
                        return;
                    }
                    const result = await this.performAction(BeautifyPrompt, body);
                    if (result) {
                        await this.fileSystemService.patchFile(file, [body], [result], false, false);
                    }
                }
            } finally {
                notice.hide();
            }
        });
    }

    public async applyTemplate(_menu: Menu, _editor: Editor, view: MarkdownView | MarkdownFileInfo) {
        const file = view.file;
        if (!file) {
            return;
        }

        const preview = await this.fileSystemService.readFile(file);
        if (preview instanceof Error || preview.trim() === "") {
            return; // Either an excluded file or nothing to apply a template to
        }

        this.userSelectFile(this.plugin, async (templateFile) => {
            await this.asSerialAction("Apply template", async () => {
                const content = await this.fileSystemService.readFile(file);
                if (content instanceof Error || content.trim() === "") {
                    return; // Either an excluded file or nothing to apply a template to
                }

                const templateContent = await this.fileSystemService.readFile(templateFile);
                if (templateContent instanceof Error || templateContent.trim() === "") {
                    return; // Either an excluded file or the template is empty
                }

                const notice = this.showNotice("Applying template...");
                try {
                    const context = `${Copy.ApplyTemplateTemplateSeparator}\n${templateContent}\n${Copy.ApplyTemplateContentSeparator}\n${content}`;
                    const result = await this.performAction(ApplyTemplatePrompt, context);
                    if (result && result.trim() !== Copy.ApplyTemplateCancelled.toString()) {
                        await this.fileSystemService.writeToFile(file, result, false, false);
                    }
                } finally {
                    notice.hide();
                }
            });
        });
    }

    public async applyLinks(_menu: Menu, editor: Editor, view: MarkdownView | MarkdownFileInfo) {
        await this.asSerialAction("Apply links", async () => {
            const file = view.file;
            if (!file) {
                return;
            }

            const selection = editor.getSelection();
            const content = await this.fileSystemService.readFile(file);

            if (content instanceof Error || (selection.trim() === "" && content.trim() === "")) {
                return; // Either an excluded file or nothing to proofread
            }

            const links = this.vaultcacheService.wikiLinks.links.join("\n");
            const prompt = replaceCopy(ApplyLinksPrompt, [links]);

            const notice = this.showNotice("Applying links...");
            try {
                if (selection.length > 0) {
                    const result = await this.performAction(prompt, selection);
                    if (result) {
                        await this.fileSystemService.patchFile(file, [selection], [result], false, false);
                    }
                } else {
                    const { body } = splitFrontmatter(content);
                    if (body.trim() === "") {
                        return;
                    }
                    const result = await this.performAction(prompt, body);
                    if (result) {
                        await this.fileSystemService.patchFile(file, [body], [result], false, false);
                    }
                }
            } finally {
                notice.hide();
            }
        });
    }

    public async applyTags(_menu: Menu, _editor: Editor, view: MarkdownView | MarkdownFileInfo) {
        await this.asSerialAction("Apply tags", async () => {
            const file = view.file;
            if (!file) {
                return;
            }

            const content = await this.fileSystemService.readFile(file);

            if (content instanceof Error || content.trim() === "") {
                return; // Either an excluded file or nothing to tag
            }

            const { body } = splitFrontmatter(content);
            if (body.trim() === "") {
                return; // Nothing to base tags on
            }

            const allowedTags = this.vaultcacheService.tags;
            const prompt = replaceCopy(ApplyTagsPrompt, [Array.from(allowedTags).join("\n")]);

            const notice = this.showNotice("Applying tags...");
            try {
                const result = await this.performAction(prompt, body);
                if (!result || result.trim() === "") {
                    return;
                }

                const chosen = result
                    .split(/\r?\n/)
                    .map(tag => tag.trim())
                    .map(tag => tag.length > 0 && !tag.startsWith("#") ? `#${tag}` : tag)
                    .filter(tag => tag.length > 0 && allowedTags.has(tag))
                    .map(tag => tag.replace(/^#/, ""));

                if (chosen.length === 0) {
                    return;
                }

                await this.fileSystemService.updateFrontmatter(file, frontmatter => {
                    mergeListIntoFrontmatter(frontmatter, "tags", chosen);
                });
            } finally {
                notice.hide();
            }
        });
    }

    public async suggestTags(_menu: Menu, _editor: Editor, view: MarkdownView | MarkdownFileInfo) {
        await this.asSerialAction("Suggest tags", async () => {
            const file = view.file;
            if (!file) {
                return;
            }

            const content = await this.fileSystemService.readFile(file);

            if (content instanceof Error || content.trim() === "") {
                return; // Either an excluded file or nothing to tag
            }

            const { body } = splitFrontmatter(content);
            if (body.trim() === "") {
                return; // Nothing to base tags on
            }

            const availableTags = this.vaultcacheService.tags;
            const prompt = replaceCopy(SuggestTagsPrompt, [Array.from(availableTags).join("\n")]);

            const notice = this.showNotice("Suggesting tags...");
            try {
                const result = await this.performAction(prompt, body);
                if (!result || result.trim() === "") {
                    return;
                }

                const chosen = result
                    .split(/\r?\n/)
                    .map(tag => tag.trim())
                    .map(tag => tag.length > 0 && !tag.startsWith("#") ? `#${tag}` : tag)
                    .filter(tag => tag.length > 0)
                    .map(tag => tag.replace(/^#/, ""));

                if (chosen.length === 0) {
                    return;
                }

                await this.fileSystemService.updateFrontmatter(file, frontmatter => {
                    mergeListIntoFrontmatter(frontmatter, "tags", chosen);
                });
            } finally {
                notice.hide();
            }
        });
    }

    public async generateFrontmatter(_menu: Menu, _editor: Editor, view: MarkdownView | MarkdownFileInfo) {
        await this.asSerialAction("Generate frontmatter", async () => {
            const file = view.file;
            if (!file) {
                return;
            }

            const content = await this.fileSystemService.readFile(file);

            if (content instanceof Error || content.trim() === "") {
                return; // Either an excluded file or nothing to describe
            }

            const { body } = splitFrontmatter(content);
            if (body.trim() === "") {
                return; // Nothing to base frontmatter on
            }

            const availableTags = this.vaultcacheService.tags;
            const prompt = replaceCopy(GenerateFrontmatterPrompt, [Array.from(availableTags).join("\n")]);

            const notice = this.showNotice("Generating frontmatter...");
            try {
                const result = await this.performAction(prompt, body);
                if (!result || result.trim() === "") {
                    return;
                }

                const suggested = parseFrontmatterYaml(result);
                if (!suggested) {
                    return; // Model returned something that isn't a frontmatter object
                }

                await this.fileSystemService.updateFrontmatter(file, frontmatter => {
                    mergeFrontmatterFields(frontmatter, suggested);
                });
            } finally {
                notice.hide();
            }
        });
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

    private async asSerialAction(name: string, action: () => Promise<void>): Promise<void> {
        if (!await this.semaphore.wait(30000)) {
            this.showNotice(`Quick action '${name}' timed out`, 3000);
            return;
        }

        try {
            await action();
        } finally {
            this.semaphore.release();
        }
    }

    private async performAction(action: string, context: string): Promise<string | null> {
        if (this.settingsService.getApiKeyForCurrentModel().trim() == "") {
            openPluginSettings(this.plugin);
            return null;
        }
        const agent = Resolve<QuickAgent>(Services.QuickAgent);
        agent.resolveAIProvider();
        return agent.quickAction(action, context);
    }

    private showNotice(message: string, durationMs: number = 0): Notice {
        const fragment = createFragment();
        const container = fragment.createDiv();

        container.addClass("quick-action-notice");
        mount(Spinner, { target: container, props: {
            width: "var(--size-4-4)",
            height: "var(--size-4-4)",
            background: "var(--background-modifier-message)"
        }});

        container.createSpan({ text: message });

        return new Notice(fragment, durationMs);
    }
}