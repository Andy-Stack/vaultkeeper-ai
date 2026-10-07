import { DocumentReport } from "../DocumentValidation/DocumentReport";
import type { IDocumentReport } from "../DocumentValidation/IDocumentReport";
import type { IDocumentValidationResult } from "../DocumentValidation/IDocumentValidationResult";
import type { IValidationStage } from "../DocumentValidation/IValidationStage";
import { WikilinkValidation } from "../DocumentValidation/Stages/WikilinkValidation";
import type { IVaultChange } from "./TemporaryVaultService";

export class DocumentValidationService {

    public readonly stages: IValidationStage[] = [];

    public constructor() {
        this.stages.push(new WikilinkValidation());
    }

    public generateReport(vaultChanges: IVaultChange[]): IDocumentReport {
        const results: IDocumentValidationResult[] = [];
        for (const stage of this.stages) {
            results.push(stage.validate(vaultChanges));
        }
        return new DocumentReport(results);
    }

}