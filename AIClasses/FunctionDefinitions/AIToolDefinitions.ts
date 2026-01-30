import type { IAIToolDefinition } from "./IAIToolDefinition";
import { SearchVaultFiles } from "./Functions/SearchVaultFiles";
import { ReadVaultFiles } from "./Functions/ReadVaultFiles";
import { WriteVaultFile } from "./Functions/WriteVaultFile";
import { DeleteVaultFiles } from "./Functions/DeleteVaultFiles";
import { MoveVaultFiles } from "./Functions/MoveVaultFiles";
import { ListVaultFiles } from "./Functions/ListVaultFiles";
import { PatchVaultFile } from "./Functions/PatchVaultFile";
import { Replan } from "./Functions/Replan";
import { CompleteStep } from "./Functions/CompleteStep";
import { SubmitPlan } from "./Functions/SubmitPlan";
import { CancelPlan } from "./Functions/CancelPlan";
import { AskUserQuestionPlanning } from "./Functions/AskUserQuestionPlanning";
import { CompletePlan } from "./Functions/CompletePlan";
import { CompleteTask } from "./Functions/CompleteTask";
import { ExecuteWorkflow } from "./Functions/ExecuteWorkflow";

export abstract class AIToolDefinitions {
    
    public static isGated: boolean = false;

    // Definitions list provides a list of function definitions that does not include any planning functions (used as reference in planning agent prompt)
    private static readonly definitionsList = [SearchVaultFiles, ReadVaultFiles, ListVaultFiles, WriteVaultFile, PatchVaultFile, DeleteVaultFiles, MoveVaultFiles];

    public static agentDefinitions(destructive: boolean, planning: boolean): IAIToolDefinition[] {
        this.isGated = false;
        
        if (planning) {
            return [ExecuteWorkflow];
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

    public static orchestrationAgentDefinitions(): IAIToolDefinition[] {
        return [CompleteStep, Replan, CancelPlan, CompletePlan];
    }

    public static planningAgentDefinitions(): IAIToolDefinition[] {
        return [SearchVaultFiles, ReadVaultFiles, ListVaultFiles, AskUserQuestionPlanning, SubmitPlan];
    }

    public static executionAgentDefinitions(): IAIToolDefinition[] {
        return [...this.agentDefinitions(true, false), CompleteTask];
    }

    public static compactSummaryForPlanningAgent(): string {
        return this.definitionsList.map(definition => {
            // Extract first line of description as brief purpose
            const description = definition.description.split('\n')[0].trim();
            return `- ${description}`;
        }).join("\n");
    }
}