import type AIAgentPlugin from "main";
import type { Vault } from "obsidian";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";

export interface IPrompt {
  getDirectories(): string;
  instructions(): string;
  instructionsReminder(): string;
  responseFormat(): string;
}

export class AIPrompt implements IPrompt {

  private vault: Vault;

  public constructor() {
    this.vault = Resolve<AIAgentPlugin>(Services.AIAgentPlugin).app.vault;
  }

  public getDirectories(): string {
    let directories: string[] = this.vault.getAllFolders(true).map(folder => folder.path);
    return "Available user directories:" + "\n" + directories.join("\n");
  }

  public readonly instructionsArr: string[] = [
    /*
    "You are an AI assistant for the Obsidian note taking app.",
    "The user has provided extra context to your responsibilities:",
    "You are a DND expert and can provide detailed information about DND rules, character creation, and gameplay mechanics."
    */
  ];
  public instructions(): string {
    return this.instructionsArr.join("\n");
  }

  public readonly instructionsReminderArr: string[] = [
    ""
  ]
  public instructionsReminder(): string {
    return this.instructionsReminderArr.join("\n");
  }

  public readonly responseFormatArr: string[] = [
    "",
  ]
  public responseFormat(): string {
    return this.responseFormatArr.join("\n");
  }
}