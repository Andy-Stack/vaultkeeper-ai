import type { IAIToolDefinition } from "./IAIToolDefinition";
import { SearchVaultFiles } from "./Tools/SearchVaultFiles";
import { ReadVaultFiles } from "./Tools/ReadVaultFiles";
import { WriteVaultFile } from "./Tools/WriteVaultFile";
import { DeleteVaultFiles } from "./Tools/DeleteVaultFiles";
import { MoveVaultFiles } from "./Tools/MoveVaultFiles";
import { ListVaultFiles } from "./Tools/ListVaultFiles";
import { PatchVaultFile } from "./Tools/PatchVaultFile";
import { Replan } from "./Tools/Replan";
import { CompleteStep } from "./Tools/CompleteStep";
import { SubmitPlan } from "./Tools/SubmitPlan";
import { CancelPlan } from "./Tools/CancelPlan";
import { AskUserQuestionPlanning } from "./Tools/AskUserQuestionPlanning";
import { CompletePlan } from "./Tools/CompletePlan";
import { CompleteTask } from "./Tools/CompleteTask";
import { ExecuteWorkflow } from "./Tools/ExecuteWorkflow";

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