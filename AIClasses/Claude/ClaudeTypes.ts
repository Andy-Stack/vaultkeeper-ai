import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { Role } from "Enums/Role";

export interface ClaudeMessage {
    role: Role;
    content: ContentBlockParam[];
}

export interface ClaudeFile {
    id: string;
    type: "file";
    filename: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
    downloadable: boolean;
}

export interface ClaudeListFilesResponse {
    data: ClaudeFile[];
    has_more: boolean;
    first_id?: string;
    last_id?: string;
}

export interface ClaudeInputTransformation {
    type: string;
    path: string;
    reason: string;
}
