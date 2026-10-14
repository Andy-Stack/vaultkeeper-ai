import { DocumentReport } from "../DocumentValidation/DocumentReport";
import type { IDocumentReport } from "../DocumentValidation/IDocumentReport";
import type { IDocumentValidationResult } from "../DocumentValidation/IDocumentValidationResult";
import type { IValidationStage } from "../DocumentValidation/IValidationStage";
import type { IVaultChange } from "./TemporaryVaultService";

export class DocumentValidationService {

    public readonly stages: IValidationStage[] = [];

    private _documentReport: IDocumentReport | undefined;

    public get documentReport(): IDocumentReport | undefined {
        return this._documentReport;
    }

    public issueCount(): number {
        return this.documentReport?.issueCount() ?? 0;
    }

    public async generateReport(): Promise<void> {
        const results: IDocumentValidationResult[] = [];
        for (const stage of this.stages) {
            results.push(await stage.validate());
        }
        this._documentReport = new DocumentReport(results);
    }

    public assignContinuityIssuesToVaultChanges(vaultChanges: IVaultChange[]) {
        if (!this.documentReport) {
            return;
        }

        for (const vaultChange of vaultChanges) {
            vaultChange.continuityIssueCount = this.documentReport.issueCountFor(vaultChange);
            vaultChange.continuityIssues = this.documentReport.documentValidationResults
                .flatMap(documentValidationResult => documentValidationResult.issuesFor(vaultChange));
        }
    }
}