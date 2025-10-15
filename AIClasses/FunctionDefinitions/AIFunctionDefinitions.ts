import type { IAIFunctionDefinition } from "./IAIFunctionDefinition";
import { SearchVaultFiles } from "./Functions/SearchVaultFiles";
import { ReadVaultFiles } from "./Functions/ReadVaultFiles";
import { WriteVaultFile } from "./Functions/WriteVaultFile";
import { DeleteVaultFile } from "./Functions/DeleteVaultFile";

export class AIFunctionDefinitions {
    public getQueryActions(destructive: boolean): IAIFunctionDefinition[] {
        let actions = [
            SearchVaultFiles,
            ReadVaultFiles
        ];

        if (destructive) {
            actions = actions.concat([
                WriteVaultFile,
                DeleteVaultFile
            ]);
        }

        return actions;
    }
}