import { TFile } from 'obsidian';
import { RegisterSingleton } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { TemporaryVaultService, type IVaultChange } from '../../Services/TemporaryVaultService';
import { extractWikilinks } from '../../Helpers/WikilinkHelper';
import { FileEvent } from '../../Enums/FileEvent';
import { DiffState } from '../../Enums/DiffState';

function makeFile(path: string): TFile {
	const file = new TFile();
	const name = path.split('/').pop() ?? path;
	file.path = path;
	file.name = name;
	file.extension = name.includes('.') ? name.split('.').pop() ?? '' : '';
	file.basename = name.replace(/\.[^.]+$/, '');
	return file;
}

// Registers a plugin, VaultService and TemporaryVaultService backed by an in-memory vault
export function registerFakeVault(files: Record<string, string>, alwaysUpdateLinks = false, excludedPaths: string[] = []): TemporaryVaultService {
	const filesByPath = new Map(Object.keys(files).map(path => [path, makeFile(path)]));

	const getFirstLinkpathDest = (linkpath: string, sourcePath: string): TFile | null => {
		if (!linkpath) {
			return filesByPath.get(sourcePath) ?? null;
		}
		const target = linkpath.toLowerCase();
		for (const [path, file] of filesByPath) {
			const lowerPath = path.toLowerCase();
			if ([target, `${target}.md`].some(candidate => lowerPath === candidate || lowerPath.endsWith(`/${candidate}`))) {
				return file;
			}
		}
		return null;
	};

	const resolvedLinks: Record<string, Record<string, number>> = {};

	for (const [sourcePath, content] of Object.entries(files)) {
		if (!sourcePath.endsWith('.md')) {
			continue;
		}

		resolvedLinks[sourcePath] = {};
		for (const link of extractWikilinks(content)) {
			const destination = getFirstLinkpathDest(link.linkpath, sourcePath);
			if (destination) {
				resolvedLinks[sourcePath][destination.path] = (resolvedLinks[sourcePath][destination.path] ?? 0) + 1;
			}
		}
	}

	const plugin = {
		app: {
			vault: {
				getFiles: () => [...filesByPath.values()],
				getAbstractFileByPath: (path: string) => filesByPath.get(path) ?? null,
				getConfig: (key: string) => key === 'alwaysUpdateLinks' ? alwaysUpdateLinks : undefined
			},
			metadataCache: {
				resolvedLinks,
				getFirstLinkpathDest
			}
		}
	};

	// Like the real VaultService, excluded files can't be found or read
	const vaultService = {
		getAbstractFileByPath: (path: string) => excludedPaths.includes(path) ? null : filesByPath.get(path) ?? null,
		read: (file: TFile) => Promise.resolve(excludedPaths.includes(file.path)
			? new Error(`File does not exist: ${file.path}`)
			: { content: files[file.path], nextIndex: undefined })
	};

	RegisterSingleton(Services.VaultkeeperAIPlugin, plugin);
	RegisterSingleton(Services.VaultService, vaultService);

	const temporaryVaultService = new TemporaryVaultService();
	RegisterSingleton(Services.TemporaryVaultService, temporaryVaultService);
	return temporaryVaultService;
}

export function createChange(path: string, content: string): IVaultChange {
	return { changeType: FileEvent.Create, status: DiffState.None, newPath: path, newContent: content };
}

export function modifyChange(path: string, oldContent: string, newContent: string): IVaultChange {
	return { changeType: FileEvent.Modify, status: DiffState.None, oldPath: path, newPath: path, oldContent, newContent };
}

export function renameChange(oldPath: string, newPath: string, content: string): IVaultChange {
	return { changeType: FileEvent.Rename, status: DiffState.None, oldPath, newPath, newContent: content };
}

export function deleteChange(path: string, content: string): IVaultChange {
	return { changeType: FileEvent.Delete, status: DiffState.None, oldPath: path, newPath: '', oldContent: content };
}
