import type { IVaultChange } from "Services/TemporaryVaultService";
import type { IValidationIssue } from "./IValidationIssue";

export interface IDocumentValidationResult {
    issueCount(): number;
    issuesFor(vaultChange: IVaultChange): IValidationIssue[];
    toString(): string;
}
