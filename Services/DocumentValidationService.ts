import { DocumentReport } from "../DocumentValidation/DocumentReport";
import type { IDocumentReport } from "../DocumentValidation/IDocumentReport";
import type { IDocumentValidationResult } from "../DocumentValidation/IDocumentValidationResult";
import type { IValidationStage } from "../DocumentValidation/IValidationStage";

export class DocumentValidationService {

    public readonly stages: IValidationStage[] = [];

    public async generateReport(): Promise<IDocumentReport> {
        const results: IDocumentValidationResult[] = [];
        for (const stage of this.stages) {
            results.push(await stage.validate());
        }
        return new DocumentReport(results);
    }

}