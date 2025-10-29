import { TFile } from "obsidian";

/**
 * Represents a single snippet of matched content from a file
 */
export interface ISearchSnippet {
    text: string;
    matchIndex: number;
    matchLength: number;
}

/**
 * Represents all matches found in a single file
 */
export interface ISearchMatch {
    file: TFile;
    snippets: ISearchSnippet[];
}
