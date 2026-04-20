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
  orchestrationInstruction(): Promise<string>;
  planningInstruction(): Promise<string>;
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
    return this.buildPrompt(SystemInstruction);
  }

  public async orchestrationInstruction(): Promise<string> {
    return this.buildPrompt(OrchestrationPrompt);
  }

  public async planningInstruction(): Promise<string> {
    return this.buildPrompt(PlanningPrompt);
  }

  public executionInstruction(): string {
    return ExecutionPrompt;
  }

  private async buildPrompt(basePrompt: string): Promise<string> {
    let prompt = basePrompt;

    if (this.settingsService.settings.enableMemories) {
      const memories = await this.memoriesService.readMemories();
      if (memories !== "") {
        prompt = prompt + replaceCopy(Copy.MemoriesInjectionHeader, [memories]);
      }
    }

    prompt = prompt + this.buildActiveDirectives();

    return prompt;
  }

  private buildActiveDirectives(): string {
    const s = this.settingsService.settings;

    const memoriesDirective = !s.enableMemories
      ? Copy.DirectiveMemoriesDisabled
      : s.allowUpdatingMemories
        ? Copy.DirectiveMemoriesEnabled
        : Copy.DirectiveMemoriesReadOnly;

    const webSearchDirective = s.enableWebSearch
      ? Copy.DirectiveWebSearchEnabled
      : Copy.DirectiveWebSearchDisabled;

    const webViewerDirective = s.enableWebViewer
      ? Copy.DirectiveWebViewerEnabled
      : Copy.DirectiveWebViewerDisabled;

    const directives = [memoriesDirective, webSearchDirective, webViewerDirective].join("\n");
    return replaceCopy(Copy.ActiveCapabilitiesHeader, [directives]);
  }

  public async userInstruction(): Promise<string> {
    const result = await this.fileSystemService.readFilePath(this.settingsService.settings.userInstruction, true);
    return result instanceof Error ? "" : result;
  }
}