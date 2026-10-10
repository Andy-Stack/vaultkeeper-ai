import type { IBacklink } from "Helpers/WikilinkHelper";
import { BrokenLinkReason } from "Enums/BrokenLinkReason";
import type { IDocumentValidationResult } from "../IDocumentValidationResult";

export interface IBrokenLink extends IBacklink {
    reason: BrokenLinkReason;
    lineText: string; // the full source line; column and original.length mark the link within it
}

export class WikilinkValidationResult implements IDocumentValidationResult {

    public readonly issues: IBrokenLink[] = [];

    public issueCount(): number {
        return this.issues.length;
    }

    public brokenWikilinks(): IBrokenLink[] {
        return this.issues.filter(issue => issue.reason !== BrokenLinkReason.MissingBlock);
    }

    public brokenBlockReferences(): IBrokenLink[] {
        return this.issues.filter(issue => issue.reason === BrokenLinkReason.MissingBlock);
    }

    public embedCount(): number {
        return this.issues.filter(issue => issue.isEmbed).length;
    }

    public affectedFiles(): string[] {
        return [...new Set(this.issues.map(issue => issue.source))];
    }

    public toString(): string {
        if (this.issues.length === 0) {
            return "";
        }

        const issueLines = this.issues.map(issue => `- ${issue.source} line ${issue.line + 1}: ${issue.original} (${issue.reason})`);
        return ["Broken links once these changes are applied:", ...issueLines].join("\n");
    }

}
