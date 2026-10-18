import { AIToolCall } from "AIClasses/AIToolCall";
import type { ConversationContent } from "Conversations/ConversationContent";
import { AITool, fromString } from "Enums/AITool";
import { Role } from "Enums/Role";
import { basename, dirname } from "path-browserify";
import { parseToolCalls } from "./ResponseHelper";
import { StringTools } from "./StringTools";
import {
    CreateVaultFolderArgsSchema,
    DeleteVaultFilesArgsSchema,
    DeleteVaultFolderArgsSchema,
    ExecuteWorkflowArgsSchema,
    GetWebViewerContentArgsSchema,
    ListVaultFilesArgsSchema,
    MoveVaultFilesArgsSchema,
    MoveVaultFolderArgsSchema,
    PatchVaultFileArgsSchema,
    ReadVaultFilesArgsSchema,
    SearchVaultFilesArgsSchema,
    WriteVaultFileArgsSchema
} from "AIClasses/Schemas/AIToolSchemas";

export function describeToolCall(toolCall: AIToolCall): string | undefined {
    switch (toolCall.name) {
        case AITool.ReadMemories:
            return "Read memories";

        case AITool.UpdateMemories:
            return "Update memories";

        case AITool.ListVaultFiles: {
            const parseResult = ListVaultFilesArgsSchema.safeParse(toolCall.arguments);
            return parseResult.success ? `List files in '${parseResult.data.path}'` : undefined;
        }

        case AITool.SearchVaultFiles: {
            const parseResult = SearchVaultFilesArgsSchema.safeParse(toolCall.arguments);
            return parseResult.success
                ? `Search vault for ${parseResult.data.search_terms.map(term => `'${term.search_term}'`).join(", ")}`
                : undefined;
        }

        case AITool.ReadVaultFiles: {
            const parseResult = ReadVaultFilesArgsSchema.safeParse(toolCall.arguments);
            if (!parseResult.success) {
                return undefined;
            }
            const files = parseResult.data.files;
            return `Read ${StringTools.pluralise("file", files.length)} ${files.map(file => `'${basename(file.file_path)}'`).join(", ")}`;
        }

        case AITool.GetWebViewerContent: {
            const parseResult = GetWebViewerContentArgsSchema.safeParse(toolCall.arguments);
            return parseResult.success ? `Get web viewer content as ${parseResult.data.format}` : undefined;
        }

        case AITool.CreateVaultFolder: {
            const parseResult = CreateVaultFolderArgsSchema.safeParse(toolCall.arguments);
            return parseResult.success ? `Create folder ${describePath(parseResult.data.path)}` : undefined;
        }

        case AITool.WriteVaultFile: {
            const parseResult = WriteVaultFileArgsSchema.safeParse(toolCall.arguments);
            return parseResult.success ? `Write file ${describePath(parseResult.data.file_path)}` : undefined;
        }

        case AITool.PatchVaultFile: {
            const parseResult = PatchVaultFileArgsSchema.safeParse(toolCall.arguments);
            return parseResult.success ? `Patch file ${describePath(parseResult.data.file_path)}` : undefined;
        }

        case AITool.DeleteVaultFiles: {
            const parseResult = DeleteVaultFilesArgsSchema.safeParse(toolCall.arguments);
            if (!parseResult.success) {
                return undefined;
            }
            const filePaths = parseResult.data.file_paths;
            return `Delete ${StringTools.pluralise("file", filePaths.length)} ${filePaths.map(filePath => `'${basename(filePath)}'`).join(", ")}`;
        }

        case AITool.MoveVaultFiles: {
            const parseResult = MoveVaultFilesArgsSchema.safeParse(toolCall.arguments);
            if (!parseResult.success) {
                return undefined;
            }
            const { source_paths: sourcePaths, destination_paths: destinationPaths } = parseResult.data;
            const moves = Array.from({ length: Math.max(sourcePaths.length, destinationPaths.length) }, (_, index) => ({
                source: sourcePaths[index] ?? "",
                destination: destinationPaths[index] ?? ""
            }));

            const renameCount = moves.filter(move => isRename(move.source, move.destination)).length;
            const action = renameCount === moves.length ? "Rename" : renameCount === 0 ? "Move" : "Move / Rename";
            const descriptions = moves.map(move => describeMove(move.source, move.destination));
            return `${action} ${StringTools.pluralise("file", moves.length)} ${descriptions.join(", ")}`;
        }

        case AITool.DeleteVaultFolder: {
            const parseResult = DeleteVaultFolderArgsSchema.safeParse(toolCall.arguments);
            return parseResult.success ? `Delete folder ${describePath(parseResult.data.path)}` : undefined;
        }

        case AITool.MoveVaultFolder: {
            const parseResult = MoveVaultFolderArgsSchema.safeParse(toolCall.arguments);
            if (!parseResult.success) {
                return undefined;
            }
            const { source_path: sourcePath, destination_path: destinationPath } = parseResult.data;
            const action = isRename(sourcePath, destinationPath) ? "Rename" : "Move";
            return `${action} folder ${describeMove(sourcePath, destinationPath)}`;
        }

        // Only seen when rebuilding past steps, the workflow's own steps are shown live by its sub-agents
        case AITool.ExecuteWorkflow: {
            const parseResult = ExecuteWorkflowArgsSchema.safeParse(toolCall.arguments);
            return parseResult.success ? `Ran workflow '${parseResult.data.goal}'` : undefined;
        }

        // Return undefined for tools that shouldn't be shown to the user as a step
        case AITool.RequestWebSearch:
        case AITool.SubmitPlan:
        case AITool.CompleteTask:
        case AITool.CompleteStep:
        case AITool.SkipStep:
        case AITool.ReviseStep:
        case AITool.RevisePlan:
        case AITool.CompletePlan:
        case AITool.CancelPlan:
        case AITool.AskUserQuestionPlanning:
        case AITool.AskUserQuestionExecution:
        case AITool.Unknown:
            return undefined;
    }
}

export function describeMessageSteps(message: ConversationContent): string[] {
    if (message.role !== Role.Assistant || !message.toolCalls) {
        return [];
    }
    return (parseToolCalls(message.toolCalls) ?? []).flatMap(storedToolCall => {
        const { name, args, id } = storedToolCall.toolCall;
        return describeToolCall(new AIToolCall(fromString(name), args ?? {}, id)) ?? [];
    });
}

function isRename(sourcePath: string, destinationPath: string): boolean {
    return dirname(sourcePath) === dirname(destinationPath);
}

function describePath(path: string): string {
    return `'${basename(path)}' at '${dirname(path)}'`;
}

function describeMove(sourcePath: string, destinationPath: string): string {
    if (isRename(sourcePath, destinationPath)) {
        return `'${basename(sourcePath)}' to '${basename(destinationPath)}'`;
    }
    if (basename(sourcePath) === basename(destinationPath)) {
        return `'${basename(sourcePath)}' to '${dirname(destinationPath)}'`;
    }
    return `'${basename(sourcePath)}' to '${destinationPath}'`;
}
