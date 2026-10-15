import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { FileSystemService } from "Services/FileSystemService";
import type { SettingsService } from "Services/SettingsService";
import {
  PlanningInstruction,
  PlanningInstructionMemoryUsage,
  PlanningInstructionWebSearchEnabled,
  PlanningInstructionWebSearchDisabled,
  PlanningInstructionWebViewerEnabled,
  PlanningInstructionWebViewerDisabled,
  PlanningInstructionAgentContinuity
} from "AIPrompts/PlanningPrompt";
import { ExecutionInstruction, ExecutionInstructionAgentContinuity } from "./ExecutionPrompt";
import {
  OrchestrationInstruction,
  OrchestrationInstructionMemoryUsage,
  OrchestrationInstructionWebToolsDisabled,
  OrchestrationInstructionAgentContinuity
} from "./OrchestrationPrompt";
import type { MemoriesService } from "Services/MemoriesService";
import { replaceCopy } from 'Helpers/Helpers';
import { Copy } from "Enums/Copy";
import { ChatMode } from "Enums/ChatMode";
import { AIProvider } from "Enums/ApiProvider";
import {
  SystemInstruction,
  SystemInstructionReadOnlyMode,
  SystemInstructionPlanningMode,
  SystemInstructionMemory,
  SystemInstructionMemoryUpdates,
  SystemInstructionMemoryReadOnly,
  SystemInstructionAgentContinuity,
  SystemInstructionWebSearchEnabled,
  SystemInstructionWebSearchDisabled,
  SystemInstructionWebViewer
} from "./SystemPrompt";

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
    return this.buildPrompt(SystemInstruction + this.buildSettingInstructions());
  }

  public async orchestrationInstruction(): Promise<string> {
    return this.buildPrompt(OrchestrationInstruction + this.buildOrchestrationSettingInstructions());
  }

  public async planningInstruction(): Promise<string> {
    return this.buildPrompt(PlanningInstruction + this.buildPlanningSettingInstructions());
  }

  public executionInstruction(): string {
    return this.settingsService.settings.enableAgentContinuity
      ? ExecutionInstruction + ExecutionInstructionAgentContinuity
      : ExecutionInstruction;
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

  private buildSettingInstructions(): string {
    const settings = this.settingsService.settings;
    const instructions: string[] = [];

    if (settings.chatMode === ChatMode.ReadOnly) {
      instructions.push(SystemInstructionReadOnlyMode);
    } else if (settings.chatMode === ChatMode.Planning) {
      instructions.push(SystemInstructionPlanningMode);
    }

    if (settings.enableMemories) {
      instructions.push(SystemInstructionMemory);
      instructions.push(settings.allowUpdatingMemories ? SystemInstructionMemoryUpdates : SystemInstructionMemoryReadOnly);
    }

    if (settings.enableAgentContinuity && settings.chatMode !== ChatMode.ReadOnly) {
      instructions.push(SystemInstructionAgentContinuity);
    }

    instructions.push(this.isWebSearchEnabled() ? SystemInstructionWebSearchEnabled : SystemInstructionWebSearchDisabled);

    if (settings.enableWebViewer) {
      instructions.push(SystemInstructionWebViewer);
    }

    return instructions.join("");
  }

  private buildPlanningSettingInstructions(): string {
    const settings = this.settingsService.settings;
    const instructions: string[] = [];

    if (settings.enableMemories) {
      instructions.push(SystemInstructionMemory, PlanningInstructionMemoryUsage);
    }

    instructions.push(this.isWebSearchEnabled() ? PlanningInstructionWebSearchEnabled : PlanningInstructionWebSearchDisabled);
    instructions.push(settings.enableWebViewer ? PlanningInstructionWebViewerEnabled : PlanningInstructionWebViewerDisabled);

    if (settings.enableAgentContinuity) {
      instructions.push(PlanningInstructionAgentContinuity);
    }

    return instructions.join("");
  }

  private buildOrchestrationSettingInstructions(): string {
    const settings = this.settingsService.settings;
    const instructions: string[] = [];

    if (settings.enableMemories) {
      instructions.push(SystemInstructionMemory, OrchestrationInstructionMemoryUsage);
    }

    if (!this.isWebSearchEnabled() || !settings.enableWebViewer) {
      instructions.push(OrchestrationInstructionWebToolsDisabled);
    }

    if (settings.enableAgentContinuity) {
      instructions.push(OrchestrationInstructionAgentContinuity);
    }

    return instructions.join("");
  }

  private isWebSearchEnabled(): boolean {
    const settings = this.settingsService.settings;
    return settings.enableWebSearch && settings.provider !== AIProvider.Local;
  }

  private buildActiveDirectives(): string {
    const s = this.settingsService.settings;

    const chatModeDirective = s.chatMode === ChatMode.ReadOnly
      ? Copy.DirectiveChatModeReadOnly
      : s.chatMode === ChatMode.Edit
      ? Copy.DirectiveChatModeEdit
      : Copy.DirectiveChatModePlanning;

    const memoriesDirective = !s.enableMemories
      ? Copy.DirectiveMemoriesDisabled
      : s.allowUpdatingMemories
        ? Copy.DirectiveMemoriesEnabled
        : Copy.DirectiveMemoriesReadOnly;

    const webSearchDirective = s.enableWebSearch && s.provider !== AIProvider.Local
      ? Copy.DirectiveWebSearchEnabled
      : Copy.DirectiveWebSearchDisabled;

    const webViewerDirective = s.enableWebViewer
      ? Copy.DirectiveWebViewerEnabled
      : Copy.DirectiveWebViewerDisabled;

    const agentContinuityDirective = s.enableAgentContinuity
      ? Copy.DirectiveAgentContinuityEnabled
      : Copy.DirectiveAgentContinuityDisabled;

    const directives = [chatModeDirective, memoriesDirective, webSearchDirective, webViewerDirective, agentContinuityDirective].join("\n");
    return replaceCopy(Copy.ActiveCapabilitiesHeader, [directives]);
  }

  public async userInstruction(): Promise<string> {
    const result = await this.fileSystemService.readFilePath(this.settingsService.settings.userInstruction, { allowAccessToPluginRoot: true });
    return result instanceof Error ? "" : result.content;
  }
}