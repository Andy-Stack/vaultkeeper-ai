import type { IBacklink } from "Helpers/WikilinkHelper";
import type { IVaultChange } from "Services/TemporaryVaultService";
import { isIssueForChange } from "Helpers/VaultChangeHelper";
import type { IDocumentValidationResult } from "../IDocumentValidationResult";
import type { IValidationIssue } from "../IValidationIssue";

export interface IQuoteDrift extends IBacklink, IValidationIssue {
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

    public issuesFor(vaultChange: IVaultChange): IQuoteDrift[] {
        return this.issues.filter(issue => isIssueForChange(issue, vaultChange));
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
        return ["Unresolved quotes that no longer match their block once these changes are applied (not fixed yet):", ...issueLines].join("\n");
    }

}
