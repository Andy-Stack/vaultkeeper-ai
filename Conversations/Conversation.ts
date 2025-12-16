import { StringTools } from "Helpers/StringTools";
import { ConversationContent } from "./ConversationContent";
import type { AIFunctionResponse } from "AIClasses/FunctionDefinitions/AIFunctionResponse";
import { Role } from "Enums/Role";
import { AIFunction } from "Enums/AIFunction";
import { isTextFile } from "Enums/FileType";

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

    public addFunctionResponse(
        functionResponse: AIFunctionResponse,
        formatBinaryFiles?: (files: Array<{type: string, path: string, contents: string}>) => string
    ): void {
        if (functionResponse.name !== AIFunction.ReadVaultFiles) {
            const functionResponseString = functionResponse.toConversationString();
            this.contents.push(new ConversationContent(
                Role.User,
                functionResponseString,
                functionResponseString,
                "",
                new Date(),
                false,
                true,
                false,
                functionResponse.toolId
            ));
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

        this.contents.push(new ConversationContent(
            Role.User,
            JSON.stringify(functionResponseData),
            JSON.stringify(functionResponseData),
            "",
            new Date(),
            false,
            true,
            false,
            functionResponse.toolId
        ));

        // 2. If there are non-text files, add follow-up user message
        if (binaryResults.length > 0 && formatBinaryFiles) {
            const providerContent = formatBinaryFiles(binaryResults);

            this.contents.push(new ConversationContent(
                Role.User,
                providerContent,
                providerContent,
                "",
                new Date(),
                false,
                false,
                true
            ));
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