import { parseLinktext, TFile } from "obsidian";
import type VaultkeeperAIPlugin from "main";
import type { TemporaryVaultService } from "Services/TemporaryVaultService";
import { maskCode, splitLines } from "./MarkdownStructureHelper";

const WIKILINK = /!?\[\[([^[\]]+?)\]\]/g;

export interface IWikilink {
    line: number; // 0-based
    column: number;
    original: string; // e.g. "[[My Note|alias]]"
    linkpath: string; // e.g. "My Note"
    subpath: string; // e.g. "#Heading" or "#^blockId"
    isEmbed: boolean;
}

export interface IBacklink extends IWikilink {
    source: string;
}

export interface ILinkInContext {
    link: IBacklink;
    lines: string[]; // the source note's lines, as they will be once the changes are applied
}

export function parseWikilink(original: string): Pick<IWikilink, "linkpath" | "subpath" | "isEmbed"> {
    const inner = original.replace(/^!?\[\[/, "").replace(/\]\]$/, "");
    // Tables escape the alias pipe as \|, which leaves a trailing backslash on the link text
    const linktext = inner.split("|")[0].replace(/\\$/, "");
    const { path, subpath } = parseLinktext(linktext);

    return { linkpath: path.trim(), subpath: subpath.trim(), isEmbed: original.startsWith("!") };
}

export function extractWikilinks(content: string): IWikilink[] {
    const links: IWikilink[] = [];

    maskCode(content).forEach((line, lineIndex) => {
        for (const match of line.matchAll(WIKILINK)) {
            links.push({ line: lineIndex, column: match.index, original: match[0], ...parseWikilink(match[0]) });
        }
    });

    return links;
}

export function getBacklinksWithLines(plugin: VaultkeeperAIPlugin, targetPath: string): IBacklink[] {
    const { metadataCache, vault } = plugin.app;
    const backlinks: IBacklink[] = [];

    for (const [sourcePath, linkedPaths] of Object.entries(metadataCache.resolvedLinks)) {
        if (!(targetPath in linkedPaths)) {
            continue;
        }

        const sourceFile = vault.getAbstractFileByPath(sourcePath);
        if (!(sourceFile instanceof TFile)) {
            continue;
        }

        const fileCache = metadataCache.getFileCache(sourceFile);
        if (!fileCache) {
            continue;
        }

        const linkReferences = [...(fileCache.links ?? []), ...(fileCache.embeds ?? [])];
        for (const linkReference of linkReferences) {
            const parsedLink = parseWikilink(linkReference.original);
            const linkedFile = metadataCache.getFirstLinkpathDest(parsedLink.linkpath, sourcePath);
            if (linkedFile?.path === targetPath) {
                backlinks.push({
                    source: sourcePath,
                    line: linkReference.position.start.line,
                    column: linkReference.position.start.col,
                    original: linkReference.original,
                    ...parsedLink,
                });
            }
        }
    }
    return backlinks;
}

// Links in new, modified or moved notes, plus links from unchanged notes into the target paths.
// A changed note's links are only taken from its new content, so nothing is reported twice.
export async function getLinksToCheck(plugin: VaultkeeperAIPlugin, temporaryVaultService: TemporaryVaultService, targetPaths: string[]): Promise<ILinkInContext[]> {
    const linksToCheck: ILinkInContext[] = [];

    for (const note of temporaryVaultService.changedNotes()) {
        const lines = splitLines(note.content);
        for (const link of extractWikilinks(note.content)) {
            linksToCheck.push({ link: { ...link, source: note.path }, lines });
        }
    }

    for (const targetPath of targetPaths) {
        for (const backlink of getBacklinksWithLines(plugin, targetPath)) {
            if (temporaryVaultService.isChanged(backlink.source)) {
                continue;
            }
            const content = await temporaryVaultService.read(backlink.source);
            linksToCheck.push({ link: backlink, lines: splitLines(content ?? "") });
        }
    }

    return linksToCheck;
}
