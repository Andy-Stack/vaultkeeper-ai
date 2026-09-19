import type { IDocumentValidationResult } from "../IDocumentValidationResult";
import type { IValidationStage } from "../IValidationStage";

export class BlockQuoteValidation implements IValidationStage {
    
    process(oldFileName: string, newFileName: string, oldContent: string, newContent: string): IDocumentValidationResult {
        throw new Error("Method not implemented.");
    }
    
}