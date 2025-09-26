import { AIProviderURL } from "Enums/ApiProvider";
import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IActioner } from "Actioner/IActioner";
import type { GeminiActionDefinitions } from "Actioner/Gemini/GeminiActionDefinitions";
import { create_file } from "Actioner/Actions";
import type { IAIClass } from "AIClasses/IAIClass";
import type { IPrompt } from "AIClasses/IPrompt";
import type { Part } from "@google/genai";
import { StreamingService, type StreamChunk } from "Services/StreamingService";

export class Gemini implements IAIClass {
  private readonly apiKey: string;
  private readonly aiPrompt: IPrompt;
  private readonly actionDefinitions: GeminiActionDefinitions;
  private readonly streamingService: StreamingService;

  public constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.aiPrompt = Resolve(Services.IPrompt);
    this.actionDefinitions = Resolve(Services.IActionDefinitions);
    this.streamingService = new StreamingService();
  }

  /**
   * Stream response from Gemini API
   */
  public async* streamRequest(
    userInput: string,
    actioner: IActioner
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const prompt = "The users prompt is: " + userInput;

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                this.aiPrompt.instructions() +
                "\n" +
                this.aiPrompt.responseFormat() +
                "\n" +
                this.aiPrompt.getDirectories() +
                "\n" +
                prompt +
                "\n" +
                this.aiPrompt.instructionsReminder(),
            },
          ],
        },
      ],
      tools: [
        {
          functionDeclarations: [this.actionDefinitions[create_file]],
        },
      ],
      // Add streaming-specific parameters
      generationConfig: {
        temperature: 0.9,
        //maxOutputTokens: 2048,
      },
    };

    yield* this.streamingService.streamGeminiRequest(this.apiKey, requestBody);
  }
}