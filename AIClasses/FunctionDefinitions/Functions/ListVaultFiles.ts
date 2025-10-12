import { AIFunction } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "../IAIFunctionDefinition";

export const ListVaultFiles: IAIFunctionDefinition = {
    name: AIFunction.ListVaultFiles,
    description: `Returns complete list of vault files with metadata (names, paths, sizes).
                  Call this whenever you need to know what files exist in the vault to answer questions,
                  verify file presence, or to perform further agentic functions. Use proactively
                  when vault contents would inform your response.`,
    parameters: {
        type: "object",
        properties: {
            user_message: {
                type: "string",
                description: "A short message to be displayed to the user that explains the action being taken"
            }
        },
        required: ["user_message"]
    }
}