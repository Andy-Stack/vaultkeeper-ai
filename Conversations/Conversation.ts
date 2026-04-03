import { StringTools } from "Helpers/StringTools";
import { ConversationContent } from "./ConversationContent";
import { Attachment } from "./Attachment";
import type { AIToolResponse } from "AIClasses/ToolDefinitions/AIToolResponse";
import { Role } from "Enums/Role";
import { AITool } from "Enums/AITool";
import { isTextFile, toFileType } from "Enums/FileType";
import { FileTypeToMimeType } from "Enums/FileTypeMimeTypeMapping";
import { isDocumentMimeType, MimeType } from "Enums/MimeType";

export class Conversation {

    title: string;
    created: Date;
    updated: Date;

    contents: ConversationContent[] = [];

    constructor() {
        const timestamp = new Date();
        this.created = timestamp;
        this.updated = timestamp;
        this.title = `${StringTools.dateToString(this.created)}`;
    }

    public hasAttachments(): boolean {
        return this.contents.some(c => c.attachments.length > 0);
    }

    public addFunctionResponse(functionResponse: AIToolResponse): void {
        if (functionResponse.name !== AITool.ReadVaultFiles) {
            const functionResponseString = functionResponse.toConversationString();
            this.contents.push(new ConversationContent({
                role: Role.User,
                functionResponse: functionResponseString,
                shouldDisplayContent: false,
                toolId: functionResponse.toolId
            }));
            return;
        }

        const responseData = functionResponse.response as
            {results?: Array<{type?: string, path: string, contents?: string, error?: string}>};
        const results = responseData.results;

        if (!results) {
            // Handle case where results array is missing (general error response)
            const functionResponseString = functionResponse.toConversationString();
            this.contents.push(new ConversationContent({
                role: Role.User,
                functionResponse: functionResponseString,
                shouldDisplayContent: false,
                toolId: functionResponse.toolId
            }));
            return;
        }

        // Separate error results from successful file reads
        const errorResults = results.filter(result => result.error);
        const successResults = results.filter(result => !result.error && result.type && result.contents !== undefined);

        const textResults = successResults.filter(result => isTextFile(result.type!));
        const binaryResults = successResults.filter(result => !isTextFile(result.type!));

        // 1. Function response with text files and/or errors
        let functionResponseData;
        if (textResults.length > 0 || errorResults.length > 0) {
            // Include text file contents and any errors in function response
            const responseResults = [...textResults, ...errorResults];
            functionResponseData = {
                id: functionResponse.toolId,
                functionResponse: {
                    name: functionResponse.name,
                    response: {
                        results: responseResults,
                        ...(binaryResults.length > 0 && {message: "The contents of the files are included below."})
                    }
                }
            };
        } else {
            // No text files or errors - just binary files
            functionResponseData = {
                id: functionResponse.toolId,
                functionResponse: {
                    name: functionResponse.name,
                    response: {
                        message: "Files retrieved successfully. The contents of the files are included below.",
                        count: binaryResults.length
                    }
                }
            };
        }

        this.contents.push(new ConversationContent({
            role: Role.User,
            functionResponse: JSON.stringify(functionResponseData),
            shouldDisplayContent: false,
            toolId: functionResponse.toolId
        }));

        // 2. If there are binary files, create Attachments and add to conversation
        if (binaryResults.length > 0) {
            const attachments = binaryResults
                .filter(file => file.type && file.contents !== undefined)
                .map(file => {
                    const fileName = file.path.split('/').pop() || file.path;
                    let mimeType = FileTypeToMimeType[toFileType(file.type as string)];

                    if (isDocumentMimeType(mimeType)) {
                        mimeType = MimeType.TEXT_PLAIN;
                        return new Attachment(fileName, mimeType, StringTools.toBase64(file.contents as string));
                    }

                    return new Attachment(fileName, mimeType, file.contents as string);
                });

            this.contents.push(new ConversationContent({
                role: Role.User,
                attachments: attachments,
                shouldDisplayContent: false
            }));
        }
    }
    
    public static isConversationData(data: unknown): data is { title: string; created: string; updated: string; contents: ConversationContent[] } {
        return (
            typeof data === "object" &&
            data !== null &&
            "title" in data &&
            "created" in data &&
            "updated" in data &&
            "contents" in data &&
            typeof data.title === "string" &&
            typeof data.created === "string" &&
            typeof data.updated === "string" &&
            Array.isArray(data.contents) &&
            data.contents.every(ConversationContent.isConversationContentData)
        );
    }
}