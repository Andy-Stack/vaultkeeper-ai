import type DmsAssistantPlugin from "main";
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
    this.vault = Resolve<DmsAssistantPlugin>(Services.DmsAssistantPlugin).app.vault;
  }

  public getDirectories(): string {
    let directories: string[] = this.vault.getAllFolders(true).map(folder => folder.path);
    return "Available user directories:" + "\n" + directories.join("\n");
  }

  public readonly instructionsArr: string[] = [
    "You are an AI assistant for the Obsidian note taking app.",
    //"In addition to answering questions, you can execute helpful functions which are defined below.",
    "The user has provided extra context to your responsibilities:",
    "You are a DND expert and can provide detailed information about DND rules, character creation, and gameplay mechanics. Please give concise responses."
  ];
  public instructions(): string {
    return this.instructionsArr.join("\n");
  }

  public readonly instructionsReminderArr: string[] = [
    "Ensure your response is valid JSON following the format defined above."
  ]
  public instructionsReminder(): string {
    return this.instructionsReminderArr.join("\n");
  }

  public readonly responseFormatArr: string[] = [
    "All responses that are not function calls should be in JSON parsable format. The response should not be wrapped in ```json```. The following fields should be used:",
    "user_response - the response to be delivered to the user.",
    //"function_name - a string name for the desired function or null.",
    //"function_object - an object containing the function arguments or null."
  ]
  public responseFormat(): string {
    return this.responseFormatArr.join("\n");
  }
}