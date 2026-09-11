import type VaultkeeperAIPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { VaultService } from "./VaultService";
import { FileEvent } from "Enums/FileEvent";
import { getAllTags, MetadataCache, TFile, TFolder } from "obsidian";
import { FileTagMapping } from "Helpers/FileTagMapping";
import * as fuzzysort from "fuzzysort";
import { Path } from "Enums/Path";
import { WikiLinks } from "Helpers/WikiLinks";
import { onMetaDataCacheReady } from "Helpers/ObsidianInternals";
import { IndexSet } from "Types/IndexSet";

// Note that 'files' actually refers to both directories and files (Obsidian naming)

export class VaultCacheService {

  public tags: Set<string> = new Set();
  public wikiLinks: WikiLinks = new WikiLinks();

  private readonly fuzzysortOptions = {
    limit: 10,
    all: false,
    key: "prepared"
  };

  private readonly plugin: VaultkeeperAIPlugin;
  private readonly vaultService: VaultService;
  private readonly metaDataCache: MetadataCache;

  private files: Map<string, TFile> = new Map();
  private folders: Map<string, TFolder> = new Map();
  private mapping: FileTagMapping = new FileTagMapping();

  private preparedTags: IndexSet<string, { prepared: fuzzysort.Prepared, tag: string }> = new IndexSet();
  private preparedFiles: IndexSet<string, { prepared: fuzzysort.Prepared, file: TFile }> = new IndexSet();
  private preparedFolders: IndexSet<string, { prepared: fuzzysort.Prepared, folder: TFolder }> = new IndexSet();

  public constructor() {
    this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
    this.vaultService = Resolve<VaultService>(Services.VaultService);
    this.metaDataCache = this.plugin.app.metadataCache;

    this.plugin.app.workspace.onLayoutReady(() => {
      onMetaDataCacheReady(this.plugin, () => this.setupCaches());
      this.registerFileEvents();
    });
  }

  public matchTag(input: string): fuzzysort.KeyResults<{ prepared: fuzzysort.Prepared, tag: string }> {
    return fuzzysort.go(input.toLowerCase(), this.preparedTags.allElements, this.fuzzysortOptions);
  }

  public matchFile(input: string): fuzzysort.KeyResults<{ prepared: fuzzysort.Prepared, file: TFile }> {
    return fuzzysort.go(input.toLowerCase(), this.preparedFiles.allElements, this.fuzzysortOptions);
  }

  public matchFolder(input: string): fuzzysort.KeyResults<{ prepared: fuzzysort.Prepared, folder: TFolder }> {
    return fuzzysort.go(input.toLowerCase(), this.preparedFolders.allElements, this.fuzzysortOptions);
  }

  private registerFileEvents() {
    this.vaultService.registerFileEvents((event, file, args) => {
      const shouldCacheNewPath = this.shouldBeCached(file.path);
      const shouldCacheOldPath = args.oldPath ? this.shouldBeCached(args.oldPath) : false;

      if (!shouldCacheNewPath && !shouldCacheOldPath) {
        return;
      }

      if (file instanceof TFile) {
        switch (event) {
          case FileEvent.Create:
            if (shouldCacheNewPath) {
              this.wikiLinks.addWikiLink(file);
              this.files.set(file.path, file);
              this.prepareFile(file);
              this.cacheTags(file);
            }
            break;

          case FileEvent.Modify:
            if (shouldCacheNewPath) {
              const newTags = this.getTags(file);
              const removedTags = this.mapping.updateMapping(file.path, newTags);
              removedTags.forEach(tag => this.removeTag(tag));
              this.cacheTags(file, newTags);
            }
            break;

          case FileEvent.Rename:
            if (shouldCacheOldPath) {
              this.wikiLinks.removeWikiLink(args.oldPath);
              this.files.delete(args.oldPath);
              this.preparedFiles.delete(args.oldPath);
              const orphanedTags = this.mapping.deleteFromMapping(args.oldPath);
              orphanedTags.forEach(tag => this.removeTag(tag));
            }
            if (shouldCacheNewPath) {
              this.wikiLinks.addWikiLink(file);
              this.mapping.renameKey(args.oldPath, file.path);
              this.files.set(file.path, file);
              this.prepareFile(file);
              this.cacheTags(file);
            }
            break;

          case FileEvent.Delete:
            this.wikiLinks.removeWikiLink(file);
            this.files.delete(file.path);
            this.preparedFiles.delete(file.path);
            this.mapping.deleteFromMapping(file.path).forEach(tag => this.removeTag(tag));
            break;
        }
      } else if (file instanceof TFolder) {
        switch (event) {
          case FileEvent.Create:
            if (shouldCacheNewPath) {
              this.folders.set(file.path, file);
              this.prepareFolder(file);
            }
            break;

          case FileEvent.Rename:
            if (shouldCacheOldPath) {
              this.folders.delete(args.oldPath);
              this.preparedFolders.delete(args.oldPath);
            }
            if (shouldCacheNewPath) {
              this.folders.set(file.path, file);
              this.prepareFolder(file);
            }
            break;

          case FileEvent.Delete:
            this.folders.delete(file.path);
            this.preparedFolders.delete(file.path);
            break;

          case FileEvent.Modify:
            break; // ignore modifications for folders
        }
      }
    });
  }

  private async setupCaches() {
    (await this.vaultService.listDirectoryContents(Path.Root)).forEach(file => {
      if (file instanceof TFile) {
        this.wikiLinks.addWikiLink(file);
        this.files.set(file.path, file);
        this.cacheTags(file);
      } else if (file instanceof TFolder) {
        this.folders.set(file.path, file);
      }
    });
    this.fuzzySortPrepareTags();
    this.fuzzySortPrepareFiles();
    this.fuzzySortPrepareFolders();
  }

  private cacheTags(file: TFile, fileTags?: string[]) {
    const tags = fileTags ?? this.getTags(file);
    tags.forEach(tag => this.addTag(tag));
    this.mapping.set(file.path, tags);
  }

  private addTag(tag: string) {
    if (this.tags.has(tag)) {
      return;
    }
    this.tags.add(tag);
    this.prepareTag(tag);
  }

  private removeTag(tag: string) {
    this.tags.delete(tag);
    this.preparedTags.delete(tag);
  }

  private getTags(file: TFile): string[] {
    const metaData = this.metaDataCache.getCache(file.path);
    return metaData ? (getAllTags(metaData) ?? []) : [];
  }

  private fuzzySortPrepareTags() {
    this.preparedTags.clear();
    this.tags.forEach(tag => {
      this.prepareTag(tag);
    });
  }

  private fuzzySortPrepareFiles() {
    this.preparedFiles.clear();
    this.files.forEach(file => {
      this.prepareFile(file);
    });
  }

  private fuzzySortPrepareFolders() {
    this.preparedFolders.clear();
    this.folders.forEach(folder => {
      this.prepareFolder(folder);
    });
  }

  private prepareTag(tag: string) {
    this.preparedTags.set(tag, { prepared: fuzzysort.prepare(tag), tag: tag });
  }

  private prepareFile(file: TFile) {
    this.preparedFiles.set(file.path, { prepared: fuzzysort.prepare(file.basename), file: file });
  }

  private prepareFolder(folder: TFolder) {
    this.preparedFolders.set(folder.path, { prepared: fuzzysort.prepare(folder.path), folder: folder });
  }

  private shouldBeCached(path: string) {
    return !this.vaultService.isExclusion(path, false);
  }
}