import { Resolve } from "../DependencyService";
import { Services } from "../Services";
import type { FileSystemService } from "../FileSystemService";
import { AITool, fromString } from "Enums/AITool";
import { AIToolResponse } from "AIClasses/ToolDefinitions/AIToolResponse";
import { AIToolCall } from "AIClasses/AIToolCall";
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
import { Artifact } from "Conversations/Artifact";
import { basename, extname } from "path-browserify";
import { ArtifactAction } from "Enums/ArtifactAction";
import type { IVaultOptions } from "Services/VaultService";
import type { IVaultChangeRequest } from "Services/TemporaryVaultService";
import type { DiffService } from "Services/DiffService";
import type { SanitiserService } from "Services/SanitiserService";
import { FileEvent } from "Enums/FileEvent";
import { DiffState } from "Enums/DiffState";
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

export class AIToolService {

    private readonly diffService: DiffService;
    private readonly fileSystemService: FileSystemService;
    private readonly memoriesService: MemoriesService;
    private readonly settingsService: SettingsService;
    private readonly webViewerService: WebViewerService;
    private readonly abortService: AbortService;
    private readonly sanitiserService: SanitiserService;

    private lastToolReadMemories: boolean = false;

    public constructor() {
        this.diffService = Resolve<DiffService>(Services.DiffService);
        this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
        this.memoriesService = Resolve<MemoriesService>(Services.MemoriesService);
        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.webViewerService = Resolve<WebViewerService>(Services.WebViewerService);
        this.abortService = Resolve<AbortService>(Services.AbortService);
        this.sanitiserService = Resolve<SanitiserService>(Services.SanitiserService);
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
                    return new AIToolResponse(toolCall.name, await this.readVaultFiles(parseResult.data.files), toolCall.toolId);
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
                    return new AIToolResponse(toolCall.name, await this.patchVaultFile(parseResult.data.file_path, parseResult.data.edits), toolCall.toolId);
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
                    return new AIToolResponse(toolCall.name, await this.listVaultFiles(parseResult.data.path, parseResult.data.recursive, parseResult.data.index), toolCall.toolId);
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
                    return new AIToolResponse(toolCall.name, await this.getWebViewerContent(parseResult.data.format, parseResult.data.url_hint, parseResult.data.index ?? 0), toolCall.toolId);
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

    private async searchVaultFiles(searchTerms: { search_term: string, fileNamesIndex?: number, fileContentsIndex?: number }[]): Promise<AIToolResponsePayload> {
        const results: { searchTerm: string, fileNameMatches: string[], fileContentMatches: object[],
            nextFileNamesIndex: number | undefined, nextFileContentsIndex: number | undefined }[] = [];

        for (const term of searchTerms) {
            const options: IVaultOptions = { primaryIndex: term.fileNamesIndex, secondaryIndex: term.fileContentsIndex };
            const result = await this.fileSystemService.searchVaultFiles(term.search_term, options);
            if (result instanceof Error) {
                return new AIToolResponsePayload({ error: result });
            }
            results.push({
                searchTerm: term.search_term,
                fileNameMatches: result.fileNameMatches,
                fileContentMatches: result.fileContentMatches.map(match => ({
                    path: match.file.path,
                    snippets: match.snippets.map((snippet) => ({
                        text: snippet.text,
                        pageNumber: snippet.pageNumber,
                        matchPosition: snippet.matchIndex
                    }))
                })),
                nextFileNamesIndex: result.nextFileNamesIndex,
                nextFileContentsIndex: result.nextFileContentsIndex
            });
        }

        return new AIToolResponsePayload(results);
    }

    private async readVaultFiles(files: { file_path: string, index?: number }[]): Promise<AIToolResponsePayload> {
        const contextSizeLimit = this.settingsService.settings.contextSizeLimit;
        const chunkSize = files.length > 0 ? Math.floor(contextSizeLimit / files.length) : contextSizeLimit;

        const results = await Promise.all(
            files.map(async (file) => {
                const type = pathExtname(file.file_path);
                const result = await this.fileSystemService.readFilePath(file.file_path, {
                    primaryIndex: file.index ?? 0,
                    chunkSize,
                    limitResults: isTextFile(type)
                });
                if (result instanceof Error) {
                    return { path: file.file_path, error: result.message };
                }
                return {
                    type,
                    path: file.file_path,
                    contents: result.content,
                    nextIndex: isTextFile(type) ? result.nextIndex : undefined
                };
            })
        );

        const errorResults = results.filter(result => result.error);
        const successResults = results.filter(result => !result.error && result.type && result.contents !== undefined) as
            Array<{ type: string; path: string; contents: string; nextIndex: number | undefined }>;

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
        const file = this.fileSystemService.getFile(filePath);
    
        let oldContent: string | undefined;
        if (file instanceof TFile) {
            const currentContent = await this.fileSystemService.readFile(file, { limitResults: false });
            if (currentContent instanceof Error) {
                return new AIToolResponsePayload({ error: `Unable to read existing file, no changes have been made: ${Exception.messageFrom(currentContent)}` });
            }
            oldContent = currentContent.content;
        }
    
        return await this.asTrackedAction([{
            oldPath: file instanceof TFile ? filePath : undefined,
            newPath: filePath,
            oldContent: oldContent,
            newContent: content,
            file: file,
            changeType: file instanceof TFile ? FileEvent.Modify : FileEvent.Create,
            changeAction: async () => await this.fileSystemService.writeToFilePath(normalizePath(filePath), content),
            status: DiffState.None
        }]);
    }
    

    private async patchVaultFile(filePath: string, edits: { old_content: string; new_content: string; replace_all?: boolean | undefined; }[]): Promise<AIToolResponsePayload> {
        const file = this.fileSystemService.getFile(filePath);

        if (isBinaryFile(pathExtname(filePath))) {
            return new AIToolResponsePayload({ error: Exception.new(`Patching ${pathExtname(filePath)} files is not supported`) });
        }

        if (!(file instanceof TFile)) {
            return new AIToolResponsePayload({ error: `Patch failed, file does not exist: ${filePath}` }); 
        }

        const readResult = await this.fileSystemService.readFile(file, { limitResults: false });

        if (readResult instanceof Error) {
            return new AIToolResponsePayload({ error: Exception.messageFrom(readResult) }); 
        }

        const patchResult = StringTools.serialPatch(readResult.content, edits);

        if (!patchResult.patched) {
            return new AIToolResponsePayload({ error: `Content to replace was not found in the file, the old content must match exactly. No changes have been made. Unmatched content: "${patchResult.failure}"` });
        }

        return await this.asTrackedAction([{
            oldPath: filePath,
            newPath: filePath,
            oldContent: readResult instanceof Error ? undefined : readResult?.content,
            newContent: patchResult.result,
            file: file,
            changeType: FileEvent.Modify,
            changeAction: async () => await this.fileSystemService.writeToFilePath(normalizePath(filePath), patchResult.result),
            status: DiffState.None
        }]);
    }

    private async deleteVaultFiles(filePaths: string[], confirmation: boolean): Promise<AIToolResponsePayload> {
        if (!confirmation) {
            return new AIToolResponsePayload({ error: "Confirmation was false, no action taken" });
        }

        const { changeRequests, failures } = await this.createDeleteRequests(filePaths);
        return await this.asTrackedAction(changeRequests, failures);
    }

    private async createDeleteRequests(filePaths: string[]): Promise<{ changeRequests: IVaultChangeRequest<TFile>[], failures: object[] }> {
        const changeRequests: IVaultChangeRequest<TFile>[] = [];
        const failures: object[] = [];

        for (const filePath of filePaths) {
            const file = this.fileSystemService.getFile(filePath);
            if (!(file instanceof TFile)) {
                failures.push({ path: filePath, success: false, error: `File does not exist: ${filePath}` });
                continue;
            }
    
            const fileType = toFileType(extname(filePath));
            // Anything that isn't a note we will just store as a binary artifact
            const isBinary = isBinaryFile(fileType) || isDocumentMimeType(FileTypeToMimeType[fileType]);
            const currentContent = isBinary
                ? await this.fileSystemService.readBinaryFile(filePath)
                : await this.fileSystemService.readFile(file, { limitResults: false });

            if (currentContent instanceof Error) {
                failures.push({ path: filePath, success: false, error: `Unable to read file, it has not been deleted: ${Exception.messageFrom(currentContent)}` });
                continue;
            }

            changeRequests.push({
                oldPath: filePath,
                newPath: "",
                oldContent: currentContent instanceof ArrayBuffer ? `[Binary file: ${basename(filePath)}]` : currentContent.content,
                newContent: "",
                file: file,
                base64: currentContent instanceof ArrayBuffer ? arrayBufferToBase64(currentContent) : undefined,
                changeType: FileEvent.Delete,
                changeAction: async () => await this.fileSystemService.deleteFile(filePath),
                status: DiffState.None
            });
        }

        return { changeRequests, failures };
    }
    

    private async moveVaultFiles(sourcePaths: string[], destinationPaths: string[]): Promise<AIToolResponsePayload> {
        if (sourcePaths.length !== destinationPaths.length) {
            return new AIToolResponsePayload({ error: "Source paths array length does not equal destination paths array length" });
        }

        const moves = sourcePaths.map((source, index) => ({ source: source, destination: destinationPaths[index] }));
        const { changeRequests, failures } = await this.createMoveRequests(moves);
        return await this.asTrackedAction(changeRequests, failures);
    }

    private async createMoveRequests(moves: { source: string, destination: string }[]): Promise<{ changeRequests: IVaultChangeRequest<TFile>[], failures: object[] }> {
        const changeRequests: IVaultChangeRequest<TFile>[] = [];
        const failures: object[] = [];

        for (const { source, destination } of moves) {
            const file = this.fileSystemService.getFile(source);
            if (!(file instanceof TFile)) {
                failures.push({ path: destination, success: false, error: `Move failed as source does not exist: ${source}` });
                continue;
            }
            if (this.fileSystemService.isExclusion(destination)) {
                failures.push({ path: destination, success: false, error: `Operation failed. The destination path may be protected: ${destination}` });
                continue;
            }
            if (await this.fileSystemService.exists(destination)) {
                failures.push({ path: destination, success: false, error: `Move failed as destination already exists: ${destination}` });
                continue;
            }

            const fileType = toFileType(extname(source));
            let content = `[Binary file: ${basename(source)}]`;

            // Content is unchanged by a move so there is nothing to gain from reading binary data
            if (!(isBinaryFile(fileType) || isDocumentMimeType(FileTypeToMimeType[fileType]))) {
                const currentContent = await this.fileSystemService.readFile(file, { limitResults: false });
                if (currentContent instanceof Error) {
                    failures.push({ path: destination, success: false, error: `Unable to read file, it has not been moved: ${Exception.messageFrom(currentContent)}` });
                    continue;
                }
                content = currentContent.content;
            }

            changeRequests.push({
                oldPath: source,
                newPath: destination,
                oldContent: content,
                newContent: content,
                file: file,
                changeType: FileEvent.Rename,
                changeAction: async () => {
                    const result = await this.fileSystemService.moveFile(source, destination);
                    return result.error instanceof Error
                        ? { error: result.error }
                        : { result: this.fileSystemService.getFile(destination) };
                },
                status: DiffState.None
            });
        }

        return { changeRequests, failures };
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

        const protectedError = `Deletion failed. The folder or its contents may be protected: ${path}`;

        if (this.fileSystemService.isExclusion(path) || !(await this.fileSystemService.exists(path))) {
            return new AIToolResponsePayload({ path: path, success: false, error: `Folder does not exist or is protected: ${path}` });
        }

        // Protected files are hidden from listings, so refuse up front rather than trash them unseen with the folder
        if (this.fileSystemService.containsExclusions(path)) {
            return new AIToolResponsePayload({ path: path, success: false, error: protectedError });
        }

        const files = await this.fileSystemService.listFilesInDirectory(path, { recursive: true });
        const { changeRequests, failures } = await this.createDeleteRequests(files.map(file => file.path));
        const filesPayload = await this.asTrackedAction(changeRequests, failures);

        // Only remove the folder once every file inside it has been deleted, rejected files keep the folder alive
        const remainingFiles = await this.fileSystemService.listFilesInDirectory(path, { recursive: true });
        if (remainingFiles.length > 0) {
            return new AIToolResponsePayload({ ...filesPayload.response, folder: { path: path, success: false, error: protectedError } },
                filesPayload.artifacts);
        }

        const result = await this.fileSystemService.deleteFolder(path);
        const folderResult = result.error instanceof Error
            ? { path: path, success: false, error: result.error.message }
            : { path: path, success: true };

        return new AIToolResponsePayload({ ...filesPayload.response, folder: folderResult }, filesPayload.artifacts);
    }

    private async moveVaultFolder(sourcePath: string, destinationPath: string): Promise<AIToolResponsePayload> {
        // Paths are mapped by prefix below, so they must match the form Obsidian uses for file paths
        sourcePath = this.sanitiserService.sanitize(sourcePath);
        destinationPath = this.sanitiserService.sanitize(destinationPath);

        const protectedError = `Move failed. The folder or its contents may be protected: ${sourcePath}`;

        if (this.fileSystemService.isExclusion(sourcePath) || this.fileSystemService.isExclusion(destinationPath)) {
            return new AIToolResponsePayload({ path: destinationPath, success: false, error: protectedError });
        }
        if (sourcePath === "/") {
            return new AIToolResponsePayload({ path: destinationPath, success: false, error: "Move failed as the vault root cannot be moved" });
        }
        if (!this.fileSystemService.getFolder(sourcePath)) {
            return new AIToolResponsePayload({ path: destinationPath, success: false, error: `Move failed as source folder does not exist: ${sourcePath}` });
        }
        if (await this.fileSystemService.exists(destinationPath)) {
            return new AIToolResponsePayload({ path: destinationPath, success: false, error: `Move failed as destination already exists: ${destinationPath}` });
        }
        if (destinationPath === sourcePath || destinationPath.startsWith(`${sourcePath}/`)) {
            return new AIToolResponsePayload({ path: destinationPath, success: false, error: `Move failed as a folder cannot be moved inside itself: ${destinationPath}` });
        }
        // Protected files are hidden from listings and would be left behind or trashed with the source folder
        if (this.fileSystemService.containsExclusions(sourcePath)) {
            return new AIToolResponsePayload({ path: destinationPath, success: false, error: protectedError });
        }

        const toDestination = (path: string) => `${destinationPath}${path.slice(sourcePath.length)}`;

        // Moving files only carries over folders that contain files, so empty ones are recreated afterwards
        const emptyFolders = (await this.fileSystemService.listFoldersInDirectory(sourcePath, { recursive: true }))
            .filter(folder => folder.children.length === 0)
            .map(folder => toDestination(folder.path));

        const files = await this.fileSystemService.listFilesInDirectory(sourcePath, { recursive: true });
        const { changeRequests, failures } = await this.createMoveRequests(files.map(file => ({ source: file.path, destination: toDestination(file.path) })));
        const filesPayload = await this.asTrackedAction(changeRequests, failures);

        // Only remove the source once every file inside it has moved, rejected files keep the folder alive
        const remainingFiles = await this.fileSystemService.listFilesInDirectory(sourcePath, { recursive: true });
        if (remainingFiles.length > 0) {
            return new AIToolResponsePayload({ ...filesPayload.response, folder: { path: sourcePath, success: false, error: protectedError } },
                filesPayload.artifacts);
        }

        for (const folderPath of [destinationPath, ...emptyFolders]) {
            const createResult = await this.fileSystemService.createFolder(folderPath);
            if (createResult instanceof Error) {
                return new AIToolResponsePayload({ ...filesPayload.response, folder: { path: destinationPath, success: false, error: createResult.message } },
                    filesPayload.artifacts);
            }
        }

        const result = await this.fileSystemService.deleteFolder(sourcePath);
        const folderResult = result.error instanceof Error
            ? { path: destinationPath, success: false, error: result.error.message }
            : { path: destinationPath, success: true };

        return new AIToolResponsePayload({ ...filesPayload.response, folder: folderResult }, filesPayload.artifacts);
    }

    private async listVaultFiles(path: string, recursive: boolean, index: number | undefined): Promise<AIToolResponsePayload> {
        const options: IVaultOptions = { primaryIndex: index, recursive: recursive };
        const contents: { results: TAbstractFile[], nextIndex: number | undefined } = await this.fileSystemService.listDirectoryContents(path, options);
        return new AIToolResponsePayload({
            contents: contents.results.map(file => ({
                type: file instanceof TFile ? "file" : "directory",
                path: file.path
            })),
            nextIndex: contents.nextIndex
        });
    }

    private async getWebViewerContent(format: "text" | "screenshot", urlHint?: string, index: number = 0): Promise<AIToolResponsePayload> {
        if (format === "screenshot") {
            const screenshot = await this.webViewerService.takeScreenshot(urlHint, true);

            if (urlHint && !screenshot) {
                return new AIToolResponsePayload({ error: replaceCopy(Copy.WebViewerNoMatchingUrl, [urlHint]) });
            }
            if (!screenshot) {
                return new AIToolResponsePayload({ error: Copy.WebViewerNoOpenView });
            }

            return new AIToolResponsePayload({ success: true }, [], [new Attachment("screenshot.png", MimeType.IMAGE_PNG, screenshot)]);
        }

        const result = await this.webViewerService.getWebViewContent(urlHint, index);

        if (urlHint && !result) {
            return new AIToolResponsePayload({ error: replaceCopy(Copy.WebViewerNoMatchingUrl, [urlHint]) });
        }
        if (!result) {
            return new AIToolResponsePayload({ error: Copy.WebViewerNoOpenView });
        }

        return new AIToolResponsePayload({ content: result.content, nextIndex: result.nextIndex });
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

    /** Helpers **/

    private async asTrackedAction(changeRequests: IVaultChangeRequest<TFile>[], failures: object[] = []): Promise<AIToolResponsePayload> {
        if (changeRequests.length === 0) {
            return new AIToolResponsePayload({ results: failures });
        }
    
        const { results: changeResponses, report } = await this.diffService.proposeChanges(changeRequests);
    
        const results: object[] = [...failures];
        const artifacts: Artifact[] = [];

        for (const [index, changeRequest] of changeRequests.entries()) {
            const changeResponse = changeResponses[index];
            // Deletes have an empty newPath, so fall through on empty strings rather than just undefined
            const filePath = changeRequest.newPath || changeRequest.oldPath || changeRequest.file?.path || "";

            if (changeResponse.error instanceof Error) {
                results.push({ path: filePath, success: false, error: changeResponse.error.message });
                continue;
            }

            results.push({ path: filePath, success: true });

            const fileType = toFileType(extname(filePath));

            // File rename is a special case since we don't need to track file content in the artifact
            if (changeRequest.changeType === FileEvent.Rename) {
                artifacts.push(new Artifact(filePath, FileTypeToMimeType[fileType], this.toArtifactAction(changeRequest.changeType),
                    "", "", undefined, undefined, changeRequest.oldPath));
                continue;
            }

            // A deleted file is still returned as the result, but there is nothing left on disk to read
            const postActionReadResult = changeResponse.result instanceof TFile && changeRequest.changeType !== FileEvent.Delete
                ? await this.fileSystemService.readFile(changeResponse.result, { limitResults: false }) : undefined;
            const postActionContent = !postActionReadResult || postActionReadResult instanceof Error
                ? "" : postActionReadResult.content;

            artifacts.push(new Artifact(filePath, FileTypeToMimeType[fileType], this.toArtifactAction(changeRequest.changeType),
                changeRequest.base64 ? filePath : changeRequest.oldContent ?? "", postActionContent, changeRequest.base64));
        }

        return new AIToolResponsePayload({ results, ...(report && { continuityReport: report.toString() }) }, artifacts);
    }

    private toArtifactAction(changeType: FileEvent): ArtifactAction {
        switch (changeType) {
            case FileEvent.Create:
                return ArtifactAction.Create;
            case FileEvent.Delete:
                return ArtifactAction.Delete;
            case FileEvent.Modify:
                return ArtifactAction.Modify;
            case FileEvent.Rename:
                return ArtifactAction.Move;
        }
    }
}