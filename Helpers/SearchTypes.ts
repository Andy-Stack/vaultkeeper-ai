import { TFile } from "obsidian";

/**
 * Represents a single snippet of matched content from a file
 */
export interface SearchSnippet {
    text: string;
    matchIndex: number;
    matchLength: number;
}

/**
 * Represents all matches found in a single file
 */
export interface SearchMatch {
    file: TFile;
    snippets: SearchSnippet[];
}
