import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import { SystemInstruction } from "./SystemPrompt";
import type { FileSystemService } from "Services/FileSystemService";
import type { SettingsService } from "Services/SettingsService";
import { Notice } from "obsidian";

export interface IPrompt {
  systemInstruction(): string;
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

  public async userInstruction(): Promise<string> {
    const result = await this.fileSystemService.readFile(this.settingsService.settings.userInstruction, true);
    if (result instanceof Error) {
      new Notice("Failed to load user instructions!");
      return "";
    }
    return result;
  }
}