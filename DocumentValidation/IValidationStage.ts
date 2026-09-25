import type { IDocumentValidationResult } from "./IDocumentValidationResult";

export interface IValidationStage {
    validate(): IDocumentValidationResult;
}