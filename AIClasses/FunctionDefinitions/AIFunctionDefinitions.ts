import type { IAIFunctionDefinition } from "./IAIFunctionDefinition";
import { SearchVaultFiles } from "./Functions/SearchVaultFiles";
import { ReadVaultFile } from "./Functions/ReadVaultFile";
import { WriteVaultFile } from "./Functions/WriteVaultFile";

export class AIFunctionDefinitions {
    public getQueryActions(destructive: boolean): IAIFunctionDefinition[] {
        let actions = [
            SearchVaultFiles,
            ReadVaultFile
        ];

        if (destructive) {
            actions = actions.concat([
                WriteVaultFile
            ]);
        }

        return actions;
    }
}