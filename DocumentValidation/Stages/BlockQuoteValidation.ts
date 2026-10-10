import type { TemporaryVaultService } from "Services/TemporaryVaultService";
import type { IDocumentValidationResult } from "../IDocumentValidationResult";
import type { IValidationStage } from "../IValidationStage";
import { BlockQuoteValidationResult, type IQuoteDrift } from "../Results/BlockQuoteValidationResult";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type VaultkeeperAIPlugin from "main";
import { getLinksToCheck, type IBacklink } from "Helpers/WikilinkHelper";
import { findQuotedText, quoteMatchesBlock } from "Helpers/BlockQuoteHelper";
import { getBlockContent } from "Helpers/MarkdownStructureHelper";

/* Only checks quotes whose link resolves; broken links are reported by WikilinkValidation */
export class BlockQuoteValidation implements IValidationStage {

    private readonly plugin: VaultkeeperAIPlugin;
    private readonly temporaryVaultService: TemporaryVaultService;

    public constructor() {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.temporaryVaultService = Resolve<TemporaryVaultService>(Services.TemporaryVaultService);
    }

    public async validate(): Promise<IDocumentValidationResult> {
        const result = new BlockQuoteValidationResult();

        // Unchanged notes can quote blocks whose text a modified note changes
        const targetPaths = this.temporaryVaultService.modifiedPaths();

        for (const { link, lines } of await getLinksToCheck(this.plugin, this.temporaryVaultService, targetPaths)) {
            const drift = await this.findDrift(link, lines);
            if (drift) {
                result.issues.push(drift);
            }
        }

        return result;
    }

    private async findDrift(link: IBacklink, lines: string[]): Promise<IQuoteDrift | undefined> {
        // Embeds render the block's current text, so they can't drift
        if (link.isEmbed || !link.subpath.startsWith("#^")) {
            return undefined;
        }

        const quotedText = findQuotedText(lines, link);
        if (quotedText === undefined) {
            return undefined;
        }

        const targetPath = this.temporaryVaultService.getFirstLinkpathDest(link.linkpath, link.source);
        if (targetPath === undefined) {
            return undefined;
        }

        const content = await this.temporaryVaultService.read(targetPath);
        const blockText = content === undefined ? undefined : getBlockContent(content, link.subpath.slice(2));
        if (blockText === undefined || quoteMatchesBlock(quotedText, blockText)) {
            return undefined;
        }

        return { ...link, lineText: lines[link.line] ?? "", targetPath, quotedText, blockText };
    }

}
