import { DocumentReport } from "../DocumentValidation/DocumentReport";
import type { IDocumentReport } from "../DocumentValidation/IDocumentReport";
import type { IDocumentValidationResult } from "../DocumentValidation/IDocumentValidationResult";
import type { IValidationStage } from "../DocumentValidation/IValidationStage";
import { WikilinkValidation } from "../DocumentValidation/Stages/WikilinkValidation";

export class DocumentValidationService {

    private readonly stages: IValidationStage[] = [];

    public constructor() {
        this.stages.push(new WikilinkValidation());
    }

    public process(oldFileName: string, newFileName: string, oldContent: string, newContent: string): IDocumentReport {
        const results: IDocumentValidationResult[] = [];
        for (const stage of this.stages) {
            results.push(stage.process(oldFileName, newFileName, oldContent, newContent));
        }
        return new DocumentReport(results);
    }

}