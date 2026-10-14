import type { IVaultChange } from "Services/TemporaryVaultService";
import type { IDocumentReport } from "./IDocumentReport";
import type { IDocumentValidationResult } from "./IDocumentValidationResult";

export class DocumentReport implements IDocumentReport {

    documentValidationResults: IDocumentValidationResult[] = [];

    public constructor(documentValidationResults: IDocumentValidationResult[]) {
        this.documentValidationResults = documentValidationResults;
    }

    issueCount(): number {
        return this.documentValidationResults.reduce((total, result) => total + result.issueCount(), 0);
    }

    issueCountFor(vaultChange: IVaultChange): number {
        return this.documentValidationResults.reduce((total, result) => total + result.issuesFor(vaultChange).length, 0);
    }

    public toString(): string {
        return this.documentValidationResults.join("\n");
    }

}