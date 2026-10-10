import type { IBacklink } from "Helpers/WikilinkHelper";
import type { IDocumentValidationResult } from "../IDocumentValidationResult";

export interface IQuoteDrift extends IBacklink {
    lineText: string; // the full source line; column and original.length mark the link within it
    targetPath: string;
    quotedText: string;
    blockText: string;
}

export class BlockQuoteValidationResult implements IDocumentValidationResult {

    public readonly issues: IQuoteDrift[] = [];

    public issueCount(): number {
        return this.issues.length;
    }

    public affectedFiles(): string[] {
        return [...new Set(this.issues.map(issue => issue.source))];
    }

    public toString(): string {
        if (this.issues.length === 0) {
            return "";
        }

        const issueLines = this.issues.map(issue =>
            `- ${issue.source} line ${issue.line + 1}: ${issue.original} quotes "${issue.quotedText}" but the block now reads "${issue.blockText}"`);
        return ["Quotes that no longer match their block once these changes are applied:", ...issueLines].join("\n");
    }

}
