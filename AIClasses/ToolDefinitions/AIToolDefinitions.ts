import type { IAIToolDefinition } from "./IAIToolDefinition";
import { SearchVaultFiles } from "./Tools/SearchVaultFiles";
import { ReadVaultFiles } from "./Tools/ReadVaultFiles";
import { WriteVaultFile } from "./Tools/WriteVaultFile";
import { DeleteVaultFiles } from "./Tools/DeleteVaultFiles";
import { MoveVaultFiles } from "./Tools/MoveVaultFiles";
import { ListVaultFiles } from "./Tools/ListVaultFiles";
import { PatchVaultFile } from "./Tools/PatchVaultFile";
import { CompleteStep } from "./Tools/CompleteStep";
import { SubmitPlan } from "./Tools/SubmitPlan";
import { CancelPlan } from "./Tools/CancelPlan";
import { AskUserQuestionPlanning } from "./Tools/AskUserQuestionPlanning";
import { CompletePlan } from "./Tools/CompletePlan";
import { CompleteTask } from "./Tools/CompleteTask";
import { ExecuteWorkflow } from "./Tools/ExecuteWorkflow";
import { ReviseStep } from "./Tools/ReviseStep";
import { RevisePlan } from "./Tools/RevisePlan";
import { SkipStep } from "./Tools/SkipStep";
import { ReadMemories } from "./Tools/ReadMemories";
import { UpdateMemories } from "./Tools/UpdateMemories";
import { CreateVaultFolder } from "./Tools/CreateVaultFolder";
import { GetWebViewerContent } from "./Tools/GetWebViewerContent";

export abstract class AIToolDefinitions {
    
    public static isGated: boolean = false;

    // Definitions list provides a list of function definitions that does not include any planning functions (used as reference in planning agent prompt)
    private static readonly definitionsList = [SearchVaultFiles, ReadVaultFiles, ListVaultFiles, GetWebViewerContent,
        WriteVaultFile, PatchVaultFile, DeleteVaultFiles, MoveVaultFiles, CreateVaultFolder];

    public static agentDefinitions(destructive: boolean, planningMode: boolean, memories: boolean, updateMemories: boolean): IAIToolDefinition[] {
        this.isGated = false;
        
        if (planningMode) {
            return [ExecuteWorkflow];
        }

        let actions = [
            SearchVaultFiles,
            ReadVaultFiles,
            ListVaultFiles,
            GetWebViewerContent
        ];

        if (memories) {
            actions = actions.concat([ReadMemories]);
        }

        if (updateMemories) {
            actions = actions.concat([UpdateMemories]);
        }

        if (destructive) {
            actions = actions.concat([
                WriteVaultFile,
                PatchVaultFile,
                DeleteVaultFiles,
                MoveVaultFiles,
                CreateVaultFolder
            ]);
        }

        return actions;
    }

    public static orchestrationAgentDefinitions(): IAIToolDefinition[] {
        return [
            SearchVaultFiles,
            ReadVaultFiles,
            ListVaultFiles,
            GetWebViewerContent,
            CompleteStep,
            ReviseStep,
            RevisePlan,
            SkipStep,
            CompletePlan,
            CancelPlan
        ];
    }

    public static planningAgentDefinitions(memories: boolean): IAIToolDefinition[] {
        let actions = [SearchVaultFiles, ReadVaultFiles, ListVaultFiles, GetWebViewerContent, AskUserQuestionPlanning, SubmitPlan];

        if (memories) {
            actions = actions.concat([ReadMemories]);
        }

        return actions;
    }

    public static executionAgentDefinitions(): IAIToolDefinition[] {
        return [...this.agentDefinitions(true, false, false, false), CompleteTask];
    }

    public static compactSummaryForPlanningAgent(): string {
        return this.definitionsList.map(definition => {
            // Extract first line of description as brief purpose
            const description = definition.description.split('\n')[0].trim();
            return `- ${description}`;
        }).join("\n");
    }
}