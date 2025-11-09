import type VaultAIPlugin from "main";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import { SystemInstruction } from "./SystemPrompt";
import type { FileSystemService } from "Services/FileSystemService";
import type { SettingsService } from "Services/SettingsService";

export interface IPrompt {
  systemInstruction(): string;
  userInstruction(): Promise<string>;
}

export class AIPrompt implements IPrompt {

  private readonly plugin: VaultAIPlugin;
  private readonly settingsService: SettingsService;
  private readonly fileSystemService: FileSystemService;

  public constructor() {
    this.plugin = Resolve<VaultAIPlugin>(Services.VaultAIPlugin);
    this.settingsService = Resolve<SettingsService>(Services.SettingsService);
    this.fileSystemService = Resolve<FileSystemService>(Services.FileSystemService);
  }

  public systemInstruction(): string {
    return SystemInstruction;
  }

  public async userInstruction(): Promise<string> {
    const userInstruction: string | null = await this.fileSystemService.readFile(this.settingsService.settings.userInstruction, true);
    return userInstruction ?? "";
  }
}