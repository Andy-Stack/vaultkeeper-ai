import type { TemporaryVaultService } from "Services/TemporaryVaultService";
import type { IDocumentValidationResult } from "../IDocumentValidationResult";
import type { IValidationStage } from "../IValidationStage";
import { WikilinkValidationResult } from "../Results/WikilinkValidationResult";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type VaultkeeperAIPlugin from "main";
import { getLinksToCheck, type IBacklink } from "Helpers/WikilinkHelper";
import { BrokenLinkReason } from "Enums/BrokenLinkReason";
import { getBlockContent, getHeadings, headingMatches, isNotePath } from "Helpers/MarkdownStructureHelper";

export class WikilinkValidation implements IValidationStage {

    private readonly plugin: VaultkeeperAIPlugin;
    private readonly temporaryVaultService: TemporaryVaultService;

    public constructor() {
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.temporaryVaultService = Resolve<TemporaryVaultService>(Services.TemporaryVaultService);
    }

    public async validate(): Promise<IDocumentValidationResult> {
        const result = new WikilinkValidationResult();

        // Modified notes can lose headings and blocks that unchanged notes link to
        const targetPaths = [...this.temporaryVaultService.removedPaths(), ...this.temporaryVaultService.modifiedPaths()];

        for (const { link, lines } of await getLinksToCheck(this.plugin, this.temporaryVaultService, targetPaths)) {
            const reason = await this.brokenReason(link);
            if (reason) {
                result.issues.push({ ...link, reason, lineText: lines[link.line] ?? "" });
            }
        }

        return result;
    }

    private async brokenReason(link: IBacklink): Promise<BrokenLinkReason | undefined> {
        const targetPath = this.temporaryVaultService.getFirstLinkpathDest(link.linkpath, link.source);
        if (targetPath === undefined) {
            return BrokenLinkReason.MissingFile;
        }
        if (!link.subpath || !isNotePath(targetPath)) {
            return undefined;
        }

        // Content we can't read, such as an excluded note, can't be checked
        const content = await this.temporaryVaultService.read(targetPath);
        if (content === undefined) {
            return undefined;
        }

        if (link.subpath.startsWith("#^")) {
            return getBlockContent(content, link.subpath.slice(2)) === undefined ? BrokenLinkReason.MissingBlock : undefined;
        }

        // Links can chain headings, e.g. [[Note#Section#Subsection]]; the last one is enough
        const heading = link.subpath.split("#").filter(Boolean).pop();
        if (heading === undefined) {
            return undefined;
        }
        return getHeadings(content).some(candidate => headingMatches(candidate, heading)) ? undefined : BrokenLinkReason.MissingHeading;
    }

}
