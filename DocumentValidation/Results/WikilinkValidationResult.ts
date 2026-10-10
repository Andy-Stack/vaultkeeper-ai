import type { IBacklink } from "Helpers/WikilinkHelper";
import type { IDocumentValidationResult } from "../IDocumentValidationResult";

export class WikilinkValidationResult implements IDocumentValidationResult {

    public issues: IBacklink[] = [];

    issueCount(): number {
        return this.issues.length;
    }
    
    toString(): string {
        return "";
    }
    
}