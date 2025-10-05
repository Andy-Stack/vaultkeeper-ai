import { AIFunction } from "Enums/AIFunction";
import type { FunctionDefinition } from "./AIFunctionDefinition";

export const ListVaultFiles: FunctionDefinition = {
    name: AIFunction.ListVaultFiles,
    description: `Returns complete list of vault files with metadata (names, paths, sizes).
                  Call this whenever you need to know what files exist in the vault to answer questions,
                  verify file presence, or to perform further agentic functions. Use proactively
                  when vault contents would inform your response.`,
    parameters: {
        type: "object",
        properties: {}
    }
}