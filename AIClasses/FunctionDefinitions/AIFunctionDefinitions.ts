import type { IAIFunctionDefinition } from "./IAIFunctionDefinition";
import { ListVaultFiles } from "./ListVaultFiles";

export class AIFunctionDefinitions {
    public getQueryActions(): IAIFunctionDefinition[] {
        return [ListVaultFiles];
    }
}