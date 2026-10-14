import { parseLinktext } from "obsidian";
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
    changePath: string; // the changed note the link is in, or the changed target an unchanged note links to
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

function linkingSourcePaths(plugin: VaultkeeperAIPlugin, targetPath: string): string[] {
    return Object.entries(plugin.app.metadataCache.resolvedLinks)
        .filter(([, linkedPaths]) => targetPath in linkedPaths)
        .map(([sourcePath]) => sourcePath);
}

// Links in new, modified or moved notes, plus links from unchanged notes into the target paths.
// A changed note's links are only taken from its new content, so nothing is reported twice.
export async function getLinksToCheck(plugin: VaultkeeperAIPlugin, temporaryVaultService: TemporaryVaultService, targetPaths: string[]): Promise<ILinkInContext[]> {
    const linksToCheck: ILinkInContext[] = [];

    for (const note of temporaryVaultService.changedNotes()) {
        const lines = splitLines(note.content);
        for (const link of extractWikilinks(note.content)) {
            linksToCheck.push({ link: { ...link, source: note.path }, lines, changePath: note.path });
        }
    }

    // Unchanged notes are parsed the same way as changed ones, so frontmatter links are found in both
    for (const targetPath of targetPaths) {
        for (const sourcePath of linkingSourcePaths(plugin, targetPath)) {
            if (temporaryVaultService.isChanged(sourcePath)) {
                continue;
            }

            // Excluded notes read as undefined, so their links are never reported
            const content = await temporaryVaultService.read(sourcePath);
            if (content === undefined) {
                continue;
            }

            const lines = splitLines(content);
            for (const link of extractWikilinks(content)) {
                if (plugin.app.metadataCache.getFirstLinkpathDest(link.linkpath, sourcePath)?.path === targetPath) {
                    linksToCheck.push({ link: { ...link, source: sourcePath }, lines, changePath: targetPath });
                }
            }
        }
    }

    return linksToCheck;
}
