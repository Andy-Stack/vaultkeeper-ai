import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import { SystemInstruction } from "./SystemPrompt";
import type { FileSystemService } from "Services/FileSystemService";
import type { SettingsService } from "Services/SettingsService";
import { PlanningPrompt } from "AIPrompts/PlanningPrompt";
import { ExecutionPrompt } from "./ExecutionPrompt";
import { OrchestrationPrompt } from "./OrchestrationPrompt";
import type { MemoriesService } from "Services/MemoriesService";
import { Copy, replaceCopy } from "Enums/Copy";

export interface IPrompt {
  systemInstruction(): Promise<string>;
  orchestrationInstruction(): string;
  planningInstruction(): string;
  executionInstruction(): string;
  userInstruction(): Promise<string>;
}

export class AIPrompt implements IPrompt {

  private readonly settingsService: SettingsService;
  private readonly memoriesService: MemoriesService;
  private readonly fileSystemService: FileSystemService;

  public constructor() {
    this.settingsService = Resolve<SettingsService>(Services.SettingsService);
    this.memoriesService = Resolve<MemoriesService>(Services.MemoriesService);
    this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
  }

  public async systemInstruction(): Promise<string> {
    let systemInstruction = SystemInstruction;
    
    if (!this.settingsService.settings.enableMemories) {
      return systemInstruction;
    }

    const memories = await this.memoriesService.readMemories();
    if (memories !== "") {
      systemInstruction = systemInstruction + replaceCopy(Copy.MemoriesInjectionHeader, [memories]);
    }
    if (!this.settingsService.settings.allowUpdatingMemories) {
      systemInstruction = systemInstruction + Copy.MemoriesReadOnly;
    }

    return systemInstruction;
  }

  public orchestrationInstruction(): string {
    return OrchestrationPrompt;
  }

  public planningInstruction(): string {
    return PlanningPrompt;
  }

  public executionInstruction(): string {
    return ExecutionPrompt;
  }

  public async userInstruction(): Promise<string> {
    const result = await this.fileSystemService.readFile(this.settingsService.settings.userInstruction, true);
    return result instanceof Error ? "" : result;
  }
}