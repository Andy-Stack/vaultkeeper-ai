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
import { DeleteVaultFolder } from "./Tools/DeleteVaultFolder";
import { MoveVaultFolder } from "./Tools/MoveVaultFolder";
import { ChatMode, chatModeAllowsEdits } from "Enums/ChatMode";

export abstract class AIToolDefinitions {

    // Definitions list provides a list of function definitions that does not include any planning functions (used as reference in planning agent prompt)
    private static readonly definitionsList = [SearchVaultFiles, ReadVaultFiles, ListVaultFiles, GetWebViewerContent,
        WriteVaultFile, PatchVaultFile, DeleteVaultFiles, MoveVaultFiles, CreateVaultFolder, DeleteVaultFolder, MoveVaultFolder];

    public static agentDefinitions(chatMode: ChatMode, memories: boolean, updateMemories: boolean, webViewer: boolean): IAIToolDefinition[] {
        
        if (chatMode === ChatMode.Planning) {
            return [ExecuteWorkflow];
        }

        let actions = [
            SearchVaultFiles,
            ReadVaultFiles,
            ListVaultFiles
        ];

        if (webViewer) {
            actions = actions.concat([GetWebViewerContent]);
        }

        if (memories) {
            actions = actions.concat([ReadMemories]);
        }

        if (updateMemories) {
            actions = actions.concat([UpdateMemories]);
        }

        if (chatModeAllowsEdits(chatMode)) {
            actions = actions.concat([
                WriteVaultFile,
                PatchVaultFile,
                DeleteVaultFiles,
                MoveVaultFiles,
                CreateVaultFolder,
                DeleteVaultFolder,
                MoveVaultFolder
            ]);
        }

        return actions;
    }

    public static orchestrationAgentDefinitions(memories: boolean, webViewer: boolean): IAIToolDefinition[] {
        let actions = [
            SearchVaultFiles,
            ReadVaultFiles,
            ListVaultFiles,
            CompleteStep,
            ReviseStep,
            RevisePlan,
            SkipStep,
            CompletePlan,
            CancelPlan
        ];

        if (webViewer) {
            actions = actions.concat([GetWebViewerContent]);
        }

        if (memories) {
            actions = actions.concat([ReadMemories]);
        }

        return actions;
    }

    public static planningAgentDefinitions(memories: boolean, webViewer: boolean): IAIToolDefinition[] {
        let actions = [SearchVaultFiles, ReadVaultFiles, ListVaultFiles, AskUserQuestionPlanning, SubmitPlan];

        if (webViewer) {
            actions = actions.concat([GetWebViewerContent]);
        }

        if (memories) {
            actions = actions.concat([ReadMemories]);
        }

        return actions;
    }

    public static executionAgentDefinitions(): IAIToolDefinition[] {
        return [...this.agentDefinitions(ChatMode.Edit, false, false, false), CompleteTask];
    }

    public static compactSummaryForPlanningAgent(): string {
        return this.definitionsList.map(definition => {
            // Extract first line of description as brief purpose
            const description = definition.description.split('\n')[0].trim();
            return `- ${description}`;
        }).join("\n");
    }
}