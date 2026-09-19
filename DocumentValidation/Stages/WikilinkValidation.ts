import type { IDocumentValidationResult } from "../IDocumentValidationResult";
import type { IValidationStage } from "../IValidationStage";
import { WikilinkValidationResult } from "../Results/WikilinkValidationResult";

export class WikilinkValidation implements IValidationStage {
    
    process(oldFileName: string, newFileName: string, oldContent: string, newContent: string): IDocumentValidationResult {
        return new WikilinkValidationResult();
    }
    
}