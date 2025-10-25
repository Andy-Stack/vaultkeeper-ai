import type AIAgentPlugin from "main";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { VaultService } from "./VaultService";
import { FileEvent } from "Enums/FileEvent";
import { getAllTags, MetadataCache, TAbstractFile, TFile, TFolder } from "obsidian";
import { FileTagMapping } from "Helpers/FileTagMapping";
  
  export class VaultCacheService {
    private readonly plugin: AIAgentPlugin;
    private readonly vaultService: VaultService;
    private readonly metaDataCache: MetadataCache;
    
    private tags: Set<string> = new Set();
    private files: Map<string, TAbstractFile> = new Map();
    private mapping: FileTagMapping = new FileTagMapping();
  
    public constructor() {
      this.plugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
      this.vaultService = Resolve<VaultService>(Services.VaultService);
      this.metaDataCache = this.plugin.app.metadataCache;
      this.setupCaches();
      this.registerFileEvents();
    }
  
    private registerFileEvents() {
      this.vaultService.registerFileEvents((event, file, args) => {
        switch (event) {
          case FileEvent.Create:
            this.files.set(file.path, file);
            this.cacheTags(file);
            break;
            
          case FileEvent.Modify:
            const newTags = this.getTags(file);
            const removedTags = this.mapping.updateMapping(file.path, newTags);
            removedTags.forEach(tag => this.tags.delete(tag));
            this.cacheTags(file, newTags);
            break;
            
          case FileEvent.Rename:
            this.mapping.renameKey(args.oldPath, file.path);
            this.files.delete(args.oldPath);
            this.files.set(file.path, file);
            break;
            
          case FileEvent.Delete:
            this.files.delete(args.oldPath);
            const orphanedTags = this.mapping.deleteFromMapping(args.oldPath);
            orphanedTags.forEach(tag => this.tags.delete(tag));
            break;
        }
      });
    }
  
    private setupCaches() {
      this.vaultService.listVaultContents().forEach(file => {
        this.files.set(file.path, file);
        this.cacheTags(file);
      });
    }
  
    private cacheTags(file: TAbstractFile, fileTags?: string[]) {
      const tags = fileTags ?? this.getTags(file);
      tags.forEach(tag => this.tags.add(tag));
      this.mapping.set(file.path, tags);
    }
  
    private getTags(file: TAbstractFile): string[] {
      const metaData = this.metaDataCache.getCache(file.path);
      return metaData ? (getAllTags(metaData) ?? []) : [];
    }
  }