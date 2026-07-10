import { Resolve } from "../DependencyService";
import { Services } from "../Services";
import type { FileSystemService } from "../FileSystemService";
import { AITool, fromString } from "Enums/AITool";
import { AIToolResponse } from "AIClasses/ToolDefinitions/AIToolResponse";
import { AIToolCall } from "AIClasses/AIToolCall";
import type { ISearchMatch } from "../../Types/SearchTypes";
import { AbortService } from "../AbortService";
import { arrayBufferToBase64, normalizePath, TAbstractFile, TFile } from "obsidian";
import { Exception } from "Helpers/Exception";
import { Copy } from "Enums/Copy";
import { pathExtname, replaceCopy } from "Helpers/Helpers";
import type { MemoriesService } from "Services/MemoriesService";
import type { SettingsService } from "Services/SettingsService";
import type { WebViewerService } from "Services/WebViewerService";
import { AIToolResponsePayload } from "AIClasses/ToolDefinitions/AIToolResponsePayload";
import { Attachment } from "Conversations/Attachment";
import { isDocumentMimeType, MimeType } from "Enums/MimeType";
import { isBinaryFile, isTextFile, toFileType } from "Enums/FileType";
import { FileTypeToMimeType } from "Enums/FileTypeMimeTypeMapping";
import { StringTools } from "Helpers/StringTools";
import { AIToolDefinitions } from "AIClasses/ToolDefinitions/AIToolDefinitions";
import { chatModeAllowsEdits } from "Enums/ChatMode";
import {
    SearchVaultFilesArgsSchema,
    ReadVaultFilesArgsSchema,
    WriteVaultFileArgsSchema,
    DeleteVaultFilesArgsSchema,
    MoveVaultFilesArgsSchema,
    ListVaultFilesArgsSchema,
    PatchVaultFileArgsSchema,
    ReadMemoriesArgsSchema,
    UpdateMemoriesArgsSchema,
    CreateVaultFolderArgsSchema,
    GetWebViewerContentArgsSchema,
    DeleteVaultFolderArgsSchema,
    MoveVaultFolderArgsSchema
} from "AIClasses/Schemas/AIToolSchemas";
import { Artifact } from "Conversations/Artifact";
import { extname } from "path-browserify";

export class AIToolService {

    private readonly fileSystemService: FileSystemService;
    private readonly memoriesService: MemoriesService;
    private readonly settingsService: SettingsService;
    private readonly webViewerService: WebViewerService;
    private readonly abortService: AbortService;

    private lastToolReadMemories: boolean = false;

    public constructor() {
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
        this.memoriesService = Resolve<MemoriesService>(Services.MemoriesService);
        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.webViewerService = Resolve<WebViewerService>(Services.WebViewerService);
        this.abortService = Resolve<AbortService>(Services.AbortService);
    }

    public async performAITool(toolCall: AIToolCall): Promise<AIToolResponse> {
        
        // This can happen if the agent hallucinates a legitimate tool call it doesn't currently have access to
        if (!chatModeAllowsEdits(this.settingsService.settings.chatMode) && AIToolDefinitions.requiresEditModeEnabled(toolCall.name)) {
            Exception.log(`Invalid tool call: ${toolCall.name}. Agent has hallucinated a legitimate tool call that requires edit mode`);
            return new AIToolResponse(
                toolCall.name,
                new AIToolResponsePayload({ error: `Invalid tool call: ${toolCall.name}. The user has not allowed edits to be made.` }),
                toolCall.toolId
            );
        }

        if (toolCall.name !== AITool.ReadMemories && toolCall.name !== AITool.UpdateMemories) {
            this.lastToolReadMemories = false;
        }

        return await this.abortService.abortableOperation(async () => {
            switch (toolCall.name) {
                case AITool.SearchVaultFiles: {
                    const parseResult = SearchVaultFilesArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.SearchVaultFiles}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.searchVaultFiles(parseResult.data.search_terms), toolCall.toolId);
                }
    
                case AITool.ReadVaultFiles: {
                    const parseResult = ReadVaultFilesArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.ReadVaultFiles}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.readVaultFiles(parseResult.data.file_paths), toolCall.toolId);
                }
    
                case AITool.WriteVaultFile: {
                    const parseResult = WriteVaultFileArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.WriteVaultFile}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.writeVaultFile(parseResult.data.file_path, parseResult.data.content), toolCall.toolId);
                }

                case AITool.PatchVaultFile: {
                    const parseResult = PatchVaultFileArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.PatchVaultFile}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.patchVaultFile(parseResult.data.file_path, parseResult.data.oldContent, parseResult.data.newContent), toolCall.toolId);
                }
    
                case AITool.DeleteVaultFiles: {
                    const parseResult = DeleteVaultFilesArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.DeleteVaultFiles}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.deleteVaultFiles(parseResult.data.file_paths, parseResult.data.confirm_deletion), toolCall.toolId);
                }
    
                case AITool.MoveVaultFiles: {
                    const parseResult = MoveVaultFilesArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.MoveVaultFiles}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.moveVaultFiles(parseResult.data.source_paths, parseResult.data.destination_paths), toolCall.toolId);
                }

                case AITool.CreateVaultFolder: {
                    const parseResult = CreateVaultFolderArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.CreateVaultFolder}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.createVaultFolder(parseResult.data.path), toolCall.toolId);
                }

                case AITool.DeleteVaultFolder: {
                    const parseResult = DeleteVaultFolderArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.DeleteVaultFolder}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.deleteVaultFolder(parseResult.data.path, parseResult.data.confirm_deletion), toolCall.toolId);
                }

                case AITool.MoveVaultFolder: {
                    const parseResult = MoveVaultFolderArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.MoveVaultFolder}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.moveVaultFolder(parseResult.data.source_path, parseResult.data.destination_path), toolCall.toolId);
                }
    
                case AITool.ListVaultFiles: {
                    const parseResult = ListVaultFilesArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.ListVaultFiles}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.listVaultFiles(parseResult.data.path, parseResult.data.recursive), toolCall.toolId);
                }

                case AITool.GetWebViewerContent: {
                    const parseResult = GetWebViewerContentArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.GetWebViewerContent}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.getWebViewerContent(parseResult.data.format, parseResult.data.url_hint), toolCall.toolId);
                }

                case AITool.ReadMemories: {
                    const parseResult = ReadMemoriesArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.ReadMemories}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.readMemories(), toolCall.toolId);
                }

                case AITool.UpdateMemories: {
                    const parseResult = UpdateMemoriesArgsSchema.safeParse(toolCall.arguments);
                    if (!parseResult.success) {
                        return new AIToolResponse(
                            toolCall.name,
                            new AIToolResponsePayload({ error: `Invalid arguments for ${AITool.UpdateMemories}: ${parseResult.error.message}` }),
                            toolCall.toolId
                        );
                    }
                    return new AIToolResponse(toolCall.name, await this.updateMemories(parseResult.data.content), toolCall.toolId);
                }
    
                // This is only used by gemini
                case AITool.RequestWebSearch: {
                    return new AIToolResponse(toolCall.name, new AIToolResponsePayload({}), toolCall.toolId);
                }

                // Multi-agent functions are handled elsewhere - this shouldn't really ever get hit
                case AITool.ExecuteWorkflow:
                case AITool.ContinuePlanExecution:
                case AITool.SubmitPlan:
                case AITool.AskUserQuestionPlanning:
                case AITool.AskUserQuestionExecution:
                case AITool.CompleteTask:
                case AITool.CompleteStep:
                case AITool.SkipStep:
                case AITool.ReviseStep:
                case AITool.RevisePlan:
                case AITool.CompletePlan:
                case AITool.CancelPlan: {
                    Exception.log(`Multi-agent function ${toolCall.name} should not be handled by AIToolService`);
                    return new AIToolResponse(
                        toolCall.name,
                        new AIToolResponsePayload({ error: `Failed to execute ${toolCall.name}.` }),
                        toolCall.toolId
                    );
                }

                case AITool.Unknown:
                default: {
                    const toolCallName = fromString(toolCall.name);
                    const error = `Unknown function request ${toolCallName}`
                    Exception.log(error);
                    return new AIToolResponse(
                        toolCallName,
                        new AIToolResponsePayload({ error: error }),
                        toolCall.toolId
                    );
                }
            }
        });
    }

    private async searchVaultFiles(searchTerms: string[]): Promise<AIToolResponsePayload> {
        const results: { searchTerm: string, results: object[] }[] = [];

        for (const searchTerm of searchTerms) {
            const matches: ISearchMatch[] = await this.fileSystemService.searchVaultFiles(searchTerm);
            results.push({
                searchTerm: searchTerm,
                results: matches.map(match => ({
                    path: match.file.path,
                    snippets: match.snippets.map((snippet) => ({
                        text: snippet.text,
                        pageNumber: snippet.pageNumber,
                        matchPosition: snippet.matchIndex
                    }))
                }))
            });
        }

        return new AIToolResponsePayload(results);
    }

    private async readVaultFiles(filePaths: string[]): Promise<AIToolResponsePayload> {
        const results = await Promise.all(
            filePaths.map(async (filePath) => {
                const result = await this.fileSystemService.readFilePath(filePath);
                if (result instanceof Error) {
                    return { path: filePath, error: result.message };
                }
                return {
                    type: pathExtname(filePath),
                    path: filePath,
                    contents: result
                };
            })
        );

        const errorResults = results.filter(result => result.error);
        const successResults = results.filter(result => !result.error && result.type && result.contents !== undefined) as
            Array<{ type: string; path: string; contents: string }>;

        const textResults = successResults.filter(result => isTextFile(result.type));
        const binaryResults = successResults.filter(result => !isTextFile(result.type));

        const attachments = binaryResults.map(file => {
            const fileName = file.path.split('/').pop() || file.path;
            let mimeType = FileTypeToMimeType[toFileType(file.type)];
            if (isDocumentMimeType(mimeType)) {
                mimeType = MimeType.TEXT_PLAIN;
                return new Attachment(fileName, mimeType, StringTools.toBase64(file.contents));
            }
            return new Attachment(fileName, mimeType, file.contents);
        });

        const binaryMessage = "The requested file(s) have been attached to the conversation immediately after this result. " +
            "This IS the content of the file(s) you read from the vault — PDFs, images, and documents are provided as attachments, " +
            "not as text in this response. Read the attached content directly to answer the user. You do NOT need to read or fetch this file again.";

        const response = textResults.length > 0 || errorResults.length > 0
            ? {
                results: [...textResults, ...errorResults],
                ...(binaryResults.length > 0 && { message: binaryMessage })
            }
            : {
                message: binaryMessage,
                count: binaryResults.length
            };

        return new AIToolResponsePayload(response, [], attachments);
    }

    private async writeVaultFile(filePath: string, content: string): Promise<AIToolResponsePayload> {
        return await this.asTrackedAction(filePath, async () => {
            return await this.fileSystemService.writeToFilePath(normalizePath(filePath), content);
        });
    }

    private async patchVaultFile(filePath: string, oldContent: string[], newContent: string[]): Promise<AIToolResponsePayload> {
        return await this.asTrackedAction(filePath, async () => {
            return await this.fileSystemService.patchFileAtPath(normalizePath(filePath), oldContent, newContent);
        });
    }

    private async deleteVaultFiles(filePaths: string[], confirmation: boolean): Promise<AIToolResponsePayload> {
        if (!confirmation) {
            return new AIToolResponsePayload({ error: "Confirmation was false, no action taken" });
        }

        const results: object[] = [];
        const artifacts = await this.collectDeletionCandidatesArtifacts(filePaths);

        for (const filePath of filePaths) {
            const deleteResult = await this.fileSystemService.deleteFile(filePath);
            if (deleteResult instanceof Error) {
                results.push({ path: filePath, success: false, error: deleteResult.message });
                continue;
            }
            results.push({ path: filePath, success: true });
        }

        return new AIToolResponsePayload({ results }, artifacts);
    }

    private async moveVaultFiles(sourcePaths: string[], destinationPaths: string[]): Promise<AIToolResponsePayload> {
        if (sourcePaths.length !== destinationPaths.length) {
            return new AIToolResponsePayload({ error: "Source paths array length does not equal destination paths array length" });
        }

        const results = await Promise.all(sourcePaths.map(async (sourcePath, index) => {
            const destinationPath = destinationPaths[index];
            const result = await this.fileSystemService.moveFile(sourcePath, destinationPath);
            if (result instanceof Error) {
                return { path: destinationPath, success: false, error: result.message };
            }
            return { path: destinationPath, success: true };
        }));

        return new AIToolResponsePayload({ results });
    }

    private async createVaultFolder(path: string): Promise<AIToolResponsePayload> {
        const result = await this.fileSystemService.createFolder(path);
        if (result instanceof Error) {
            return new AIToolResponsePayload({ path: path, success: false, error: result.message });
        }
        return new AIToolResponsePayload({ path: path, success: true });
    }

    private async deleteVaultFolder(path: string, confirmation: boolean): Promise<AIToolResponsePayload> {
        if (!confirmation) {
            return new AIToolResponsePayload({ error: "Confirmation was false, no action taken" });
        }

        const contents = await this.fileSystemService.listDirectoryContents(path, true);
        const filePaths = contents.filter(content => content instanceof TFile).map(file => file.path);

        const artifacts = await this.collectDeletionCandidatesArtifacts(filePaths);
        const result = await this.fileSystemService.deleteFolder(path);

        return result instanceof Error
            ? new AIToolResponsePayload({ path: path, success: false, error: result.message }, artifacts)
            : new AIToolResponsePayload({ path: path, success: true }, artifacts);
    }

    private async collectDeletionCandidatesArtifacts(filePaths: string[]): Promise<Artifact[]> {
        const artifacts: Artifact[] = [];

        for (const filePath of filePaths) {
            const fileType = toFileType(extname(filePath));
            // Anything that isn't a note we will just store as a binary artifact
            if (isBinaryFile(fileType) || isDocumentMimeType(FileTypeToMimeType[fileType])) {
                const result = await this.fileSystemService.readBinaryFile(filePath);
                if (result instanceof ArrayBuffer) {
                    artifacts.push(new Artifact(filePath, FileTypeToMimeType[fileType], "", "", arrayBufferToBase64(result)));
                }
            } else {
                const result = await this.fileSystemService.readFilePath(filePath);
                if (typeof result === "string") {
                    artifacts.push(new Artifact(filePath, FileTypeToMimeType[fileType], result, ""));
                }
            }
        }

        return artifacts;
    }

    private async moveVaultFolder(sourcePath: string, destinationPath: string): Promise<AIToolResponsePayload> {
        const result = await this.fileSystemService.moveFile(sourcePath, destinationPath);
        if (result instanceof Error) {
            return new AIToolResponsePayload({ path: destinationPath, success: false, error: result.message });
        }
        return new AIToolResponsePayload({ path: destinationPath, success: true });
    }

    private async listVaultFiles(path: string, recursive: boolean): Promise<AIToolResponsePayload> {
        const files: TAbstractFile[] = await this.fileSystemService.listDirectoryContents(path, recursive);
        return new AIToolResponsePayload(files.map(file => ({
            type: file instanceof TFile ? "file" : "directory",
            path: file.path
        })));
    }

    private async getWebViewerContent(format: "text" | "screenshot", urlHint?: string): Promise<AIToolResponsePayload> {
        const result = format === "text" 
            ? await this.webViewerService.getWebViewContent(urlHint)
            : await this.webViewerService.takeScreenshot(urlHint, true);
        
        if (urlHint && !result) {
            return new AIToolResponsePayload({ error: replaceCopy(Copy.WebViewerNoMatchingUrl, [urlHint]) });
        }
        if (!result) {
            return new AIToolResponsePayload({ error: Copy.WebViewerNoOpenView });
        }

        return format === "text"
            ? new AIToolResponsePayload({ content: result })
            : new AIToolResponsePayload({ success: true }, [], [new Attachment("screenshot.png", MimeType.IMAGE_PNG, result)]);
    }

    private async readMemories(): Promise<AIToolResponsePayload> {
        if (!this.settingsService.settings.enableMemories) {
            return new AIToolResponsePayload({ error: Copy.MemoriesDisabledError });
        }
        this.lastToolReadMemories = true;
        return new AIToolResponsePayload({ memories: await this.memoriesService.readMemories() });
    }

    private async updateMemories(content: string): Promise<AIToolResponsePayload> {
        if (!this.settingsService.settings.allowUpdatingMemories) {
            return new AIToolResponsePayload({ error: Copy.MemoriesUpdatingDisabledError });
        }

        if (!this.lastToolReadMemories) {
            return new AIToolResponsePayload({ error: Copy.UpdateMemoriesWithoutReadError });
        }
        this.lastToolReadMemories = false;

        return new AIToolResponsePayload({ result: await this.memoriesService.updateMemories(content) });
    }

    private async asTrackedAction(filePath: string, action: () => Promise<TFile|Error|void>): Promise<AIToolResponsePayload> {
        let preActionResult = await this.fileSystemService.readFilePath(filePath);
        if (preActionResult instanceof Error) {
            preActionResult = ""; // The file does not exist yet
        }
        const actionResult = await action();
        if (actionResult instanceof Error) {
            return new AIToolResponsePayload({ success: false, error: actionResult.message });
        }
        let postActionResult = actionResult ? await this.fileSystemService.readFile(actionResult) : "";
        if (postActionResult instanceof Error) {
            postActionResult = ""; // The file has been deleted
        }

        const fileType = toFileType(extname(filePath));

        return new AIToolResponsePayload({ success: true },
            [new Artifact(filePath, FileTypeToMimeType[fileType], preActionResult, postActionResult)]);
    }
}