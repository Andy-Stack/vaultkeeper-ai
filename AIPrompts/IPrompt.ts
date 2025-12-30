import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import { SystemInstruction } from "./SystemPrompt";
import type { FileSystemService } from "Services/FileSystemService";
import type { SettingsService } from "Services/SettingsService";
import { PlanningAgentSystemPrompt } from "AIPrompts/PlanningAgentSystemPrompt";

export interface IPrompt {
  systemInstruction(): string;
  planningInstruction(): string;
  userInstruction(): Promise<string>;
}

export class AIPrompt implements IPrompt {

  private readonly settingsService: SettingsService;
  private readonly fileSystemService: FileSystemService;

  public constructor() {
    this.settingsService = Resolve<SettingsService>(Services.SettingsService);
    this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
  }

  public systemInstruction(): string {
    return SystemInstruction;
  }

  public planningInstruction(): string {
    return PlanningAgentSystemPrompt;
  }

  public async userInstruction(): Promise<string> {
    const result = await this.fileSystemService.readFile(this.settingsService.settings.userInstruction, true);
    return result instanceof Error ? "" : result;
  }
}