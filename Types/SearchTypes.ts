import { TFile } from "obsidian";

/**
 * Represents text content read from a file with the page number
 */
export interface IPageText {
    text: string;
    pageNumber: number;
}

/**
 * Represents a single snippet of matched content from a file
 */
export interface ISearchSnippet {
    text: string;
    matchIndex: number;
    matchLength: number;
    pageNumber: number;
}

/**
 * Represents all matches found in a single file
 */
export interface ISearchMatch {
    file: TFile;
    snippets: ISearchSnippet[];
}
