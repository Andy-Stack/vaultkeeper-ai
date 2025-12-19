import { StringTools } from "Helpers/StringTools";
import { ConversationContent } from "./ConversationContent";
import { Attachment } from "./Attachment";
import type { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import { Role } from "Enums/Role";
import { AIFunction } from "Enums/AIFunction";
import { isTextFile, FileType, getImageMimeType, isFileType } from "Enums/FileType";
import { Exception } from "Helpers/Exception";

export class Conversation {

    title: string;
    created: Date;
    updated: Date;
    path: string;

    contents: ConversationContent[] = [];

    constructor() {
        this.created = new Date();
        this.updated = new Date();
        this.title = `${StringTools.dateToString(this.created)}`;
    }

    public addFunctionResponse(functionResponse: AIFunctionResponse): void {
        if (functionResponse.name !== AIFunction.ReadVaultFiles) {
            const functionResponseString = functionResponse.toConversationString();
            this.contents.push(new ConversationContent({
                role: Role.User,
                functionResponse: functionResponseString,
                shouldDisplayContent: false,
                toolId: functionResponse.toolId
            }));
            return;
        }

        const results = (functionResponse.response as
            {results: Array<{type: string, path: string, contents: string}>}).results;

        const textResults = results.filter(result => isTextFile(result.type));
        const binaryResults = results.filter(result => !isTextFile(result.type));

        // 1. Function response with text files (or success message if none)
        let functionResponseData;
        if (textResults.length > 0) {
            // Include text file contents in function response
            functionResponseData = {
                id: functionResponse.toolId,
                functionResponse: {
                    name: functionResponse.name,
                    response: {
                        results: textResults,
                        ...(binaryResults.length > 0 && {message: "Binary files follow in next message"})
                    }
                }
            };
        } else {
            // No text files - just acknowledge success
            functionResponseData = {
                id: functionResponse.toolId,
                functionResponse: {
                    name: functionResponse.name,
                    response: {
                        message: "Files retrieved successfully. Binary content follows in next message.",
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
            const attachments = binaryResults.map(file => {
                // Extract filename from path
                const fileName = file.path.split('/').pop() || file.path;

                // Determine mimeType based on file.type
                let mimeType: string;
                if (isFileType(file.type, FileType.PDF)) {
                    mimeType = "application/pdf";
                } else {
                    // For images, derive from extension
                    const extension = fileName.split('.').pop()?.toLowerCase() || '';
                    try {
                        mimeType = getImageMimeType(extension);
                    } catch (error) {
                        Exception.log(error);
                        Exception.throw(error);
                    }
                }

                return new Attachment(
                    fileName,
                    mimeType,
                    file.contents,  // base64 string
                    {}              // empty fileID map (phase 2 feature)
                );
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