import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IAIClass } from "AIClasses/IAIClass";
import type { IPrompt } from "AIClasses/IPrompt";
import { StreamingService, type StreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import { Role } from "Enums/Role";

export class Gemini implements IAIClass {
  private readonly apiKey: string;
  private readonly aiPrompt: IPrompt;
  private readonly streamingService: StreamingService;

  public constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.aiPrompt = Resolve(Services.IPrompt);
    this.streamingService = new StreamingService();
  }

  public async* streamRequest(conversation: Conversation): AsyncGenerator<StreamChunk, void, unknown> {
    
    const contents = conversation.contents.map(content => ({
      role: content.role === Role.User ? "user" : "model",
      parts: [
        {
          text: content.content
        }
      ]
    }));

    const requestBody = {
      system_instruction: {
        parts: [
          {
            text: this.aiPrompt.systemInstruction()
          },
          {
            text: await this.aiPrompt.userInstruction()
          }
        ]
      },
      contents: contents,
      tools: [
        {
          google_search: {},
          functionDeclarations: [],
        },
      ]
    };

    yield* this.streamingService.streamGeminiRequest(this.apiKey, requestBody);
  }
}