import type { IDocumentValidationResult } from "./IDocumentValidationResult";

export interface IValidationStage {
    process(oldFileName: string, newFileName: string, oldContent: string, newContent: string): IDocumentValidationResult;
}