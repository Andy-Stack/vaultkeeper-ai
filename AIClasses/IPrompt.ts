import type AIAgentPlugin from "main";
import type { TAbstractFile, TFile, Vault } from "obsidian";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import { SystemInstruction } from "./SystemPrompt";
import { Path } from "Enums/Path";

export interface IPrompt {
  systemInstruction(): string;
  userInstruction(): Promise<string>;
}

export class AIPrompt implements IPrompt {

  private vault: Vault;

  public constructor() {
    this.vault = Resolve<AIAgentPlugin>(Services.AIAgentPlugin).app.vault;
  }

  public systemInstruction(): string {
    return SystemInstruction;
  }

  public async userInstruction(): Promise<string> {
    const userInstruction: TFile | null = this.vault.getFileByPath(Path.UserInstruction);
    return userInstruction ? await this.vault.read(userInstruction) : "";
  }
}