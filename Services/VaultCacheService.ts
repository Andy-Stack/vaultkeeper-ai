import type VaultAIPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { VaultService } from "./VaultService";
import { FileEvent } from "Enums/FileEvent";
import { getAllTags, MetadataCache, TFile, TFolder } from "obsidian";
import { FileTagMapping } from "Helpers/FileTagMapping";
import * as fuzzysort from "fuzzysort";
import { Path } from "Enums/Path";

// Note that 'files' actually refers to both directories and files (Obsidian naming)

export class VaultCacheService {
  private readonly fuzzysortOptions = {
    limit: 10,
    all: false,
    key: "prepared"
  };

  private readonly plugin: VaultAIPlugin;
  private readonly vaultService: VaultService;
  private readonly metaDataCache: MetadataCache;

  private tags: Set<string> = new Set();
  private files: Map<string, TFile> = new Map();
  private folders: Map<string, TFolder> = new Map();
  private mapping: FileTagMapping = new FileTagMapping();

  private preparedTags: { prepared: Fuzzysort.Prepared, tag: string }[] = [];
  private preparedFiles: { prepared: Fuzzysort.Prepared, file: TFile }[] = [];
  private preparedFolders: { prepared: Fuzzysort.Prepared, folder: TFolder }[] = [];

  private initialised = false;

  public constructor() {
    this.plugin = Resolve<VaultAIPlugin>(Services.VaultAIPlugin);
    this.vaultService = Resolve<VaultService>(Services.VaultService);
    this.metaDataCache = this.plugin.app.metadataCache;
    this.registerFileEvents();

    this.plugin.app.metadataCache.on("resolved", async () => {
      if (!this.initialised) {
        await this.setupCaches();
        this.initialised = true;
      }
    });
  }

  public matchTag(input: string): Fuzzysort.KeyResults<{ prepared: Fuzzysort.Prepared, tag: string }> {
    return fuzzysort.go(input.toLowerCase(), this.preparedTags, this.fuzzysortOptions);
  }

  public matchFile(input: string): Fuzzysort.KeyResults<{ prepared: Fuzzysort.Prepared, file: TFile }> {
    return fuzzysort.go(input.toLowerCase(), this.preparedFiles, this.fuzzysortOptions);
  }

  public matchFolder(input: string): Fuzzysort.KeyResults<{ prepared: Fuzzysort.Prepared, folder: TFolder }> {
    return fuzzysort.go(input.toLowerCase(), this.preparedFolders, this.fuzzysortOptions);
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
              this.files.set(file.path, file);
              this.cacheTags(file);
            }
            break;

          case FileEvent.Modify:
            if (shouldCacheNewPath) {
              const newTags = this.getTags(file);
              const removedTags = this.mapping.updateMapping(file.path, newTags);
              removedTags.forEach(tag => this.tags.delete(tag));
              this.cacheTags(file, newTags);
            }
            break;

          case FileEvent.Rename:
            if (shouldCacheOldPath) {
              this.files.delete(args.oldPath);
              const orphanedTags = this.mapping.deleteFromMapping(args.oldPath);
              orphanedTags.forEach(tag => this.tags.delete(tag));
            }
            if (shouldCacheNewPath) {
              this.mapping.renameKey(args.oldPath, file.path);
              this.files.set(file.path, file);
              this.cacheTags(file);
            }
            break;

          case FileEvent.Delete:
            if (shouldCacheOldPath) {
              this.files.delete(args.oldPath);
              const orphanedTags = this.mapping.deleteFromMapping(args.oldPath);
              orphanedTags.forEach(tag => this.tags.delete(tag));
            }
            break;
        }
        this.fuzzySortPrepareTags();
        this.fuzzySortPrepareFiles();
      } else if (file instanceof TFolder) {
        switch (event) {
          case FileEvent.Create:
            if (shouldCacheNewPath) {
              this.folders.set(file.path, file);
            }
            break;

          case FileEvent.Rename:
            if (shouldCacheOldPath) {
              this.folders.delete(args.oldPath);
            }
            if (shouldCacheNewPath) {
              this.folders.set(file.path, file);
            }
            break;

          case FileEvent.Delete:
            if (shouldCacheOldPath) {
              this.folders.delete(args.oldPath);
            }
            break;
        }
        this.fuzzySortPrepareFolders();
      }
    });
  }

  private async setupCaches() {
    (await this.vaultService.listDirectoryContents(Path.Root)).forEach(file => {
      if (file instanceof TFile) {
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
    tags.forEach(tag => this.tags.add(tag));
    this.mapping.set(file.path, tags);
  }

  private getTags(file: TFile): string[] {
    const metaData = this.metaDataCache.getCache(file.path);
    return metaData ? (getAllTags(metaData) ?? []) : [];
  }

  private fuzzySortPrepareTags() {
    this.preparedTags = [];
    this.tags.forEach(tag => {
      this.preparedTags.push({ prepared: fuzzysort.prepare(tag), tag: tag });
    });
  }

  private fuzzySortPrepareFiles() {
    this.preparedFiles = [];
    this.files.forEach(file => {
      this.preparedFiles.push({ prepared: fuzzysort.prepare(file.basename), file: file });
    });
  }

  private fuzzySortPrepareFolders() {
    this.preparedFolders = [];
    this.folders.forEach(folder => {
      this.preparedFolders.push({ prepared: fuzzysort.prepare(folder.path), folder: folder });
    });
  }

  private shouldBeCached(path: string) {
    return !this.vaultService.isExclusion(path, false);
  }
}