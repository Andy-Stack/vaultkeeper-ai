import type { IAIFunctionDefinition } from "./IAIFunctionDefinition";
import { SearchVaultFiles } from "./Functions/SearchVaultFiles";
import { ReadVaultFiles } from "./Functions/ReadVaultFiles";
import { WriteVaultFile } from "./Functions/WriteVaultFile";
import { DeleteVaultFiles } from "./Functions/DeleteVaultFiles";
import { MoveVaultFiles } from "./Functions/MoveVaultFiles";
import { ListVaultFiles } from "./Functions/ListVaultFiles";
import { PatchVaultFile } from "./Functions/PatchVaultFile";
import { CreatePlan } from "./Functions/CreatePlan";
import { Replan } from "./Functions/Replan";
import { CompleteStep } from "./Functions/CompleteStep";
import { SubmitPlan } from "./Functions/SubmitPlan";
import { CancelPlan } from "./Functions/CancelPlan";
import { AskUserQuestionPlanning } from "./Functions/AskUserQuestionPlanning";
import { CompletePlan } from "./Functions/CompletePlan";
import { AskUserQuestionExecution } from "./Functions/AskUserQuestionExecution";

export abstract class AIFunctionDefinitions {
    
    // Definitions list provides a list of function definitions that does not include any planning functions (used as reference in planning agent prompt)
    private static readonly definitionsList = [SearchVaultFiles, ReadVaultFiles, ListVaultFiles, WriteVaultFile, PatchVaultFile, DeleteVaultFiles, MoveVaultFiles];

    // Definitions for the main agent
    public static agentDefinitions(destructive: boolean, planning: boolean): IAIFunctionDefinition[] {
        if (planning) {
            return [CreatePlan];
        }

        let actions = [
            SearchVaultFiles,
            ReadVaultFiles,
            ListVaultFiles
        ];

        if (destructive) {
            actions = actions.concat([
                WriteVaultFile,
                PatchVaultFile,
                DeleteVaultFiles,
                MoveVaultFiles
            ]);
        }

        return actions;
    }

    // Definitions for the planning agent
    public static planningAgentDefinitions(): IAIFunctionDefinition[] {
        return [SearchVaultFiles, ReadVaultFiles, ListVaultFiles, AskUserQuestionPlanning, SubmitPlan];
    }

    // Definitions for the main agent during plan execution
    public static agentExecutionDefinitions() {
        return [
            SearchVaultFiles,
            ReadVaultFiles,
            ListVaultFiles,
            WriteVaultFile,
            PatchVaultFile,
            DeleteVaultFiles,
            MoveVaultFiles,
            CompleteStep,
            AskUserQuestionExecution,
            Replan,
            CompletePlan,
            CancelPlan
        ];
    }

    public static compactSummaryForPlanningAgent(): string {
        return this.definitionsList.map(definition => {
            // Extract first line of description as brief purpose
            const description = definition.description.split('\n')[0].trim();
            return `- ${description}`;
        }).join("\n");
    }
}