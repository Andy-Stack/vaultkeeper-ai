import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IAIClass } from "AIClasses/IAIClass";
import type { IPrompt } from "AIClasses/IPrompt";
import { StreamingService, type StreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import { Role } from "Enums/Role";
import { AIProviderURL } from "Enums/ApiProvider";

export class Gemini implements IAIClass {
  private readonly apiKey: string;
  private readonly aiPrompt: IPrompt;
  private readonly streamingService: StreamingService;

  public constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.aiPrompt = Resolve(Services.IPrompt);
    this.streamingService = Resolve(Services.StreamingService);
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

    yield* this.streamingService.streamRequest(
      AIProviderURL.Gemini.replace("API_KEY", this.apiKey),
      requestBody,
      this.parseStreamChunk
    );
  }

  private parseStreamChunk(chunk: string): StreamChunk {
    try {
      const data = JSON.parse(chunk);
      
      let text = "";
      const candidate = data.candidates?.[0];

      if (candidate) {
          if (candidate.content?.parts?.[0]?.text) {
              text = candidate.content.parts[0].text;
          } else if (candidate.text) {
              text = candidate.text;
          }
      }
      
      const isComplete = !!candidate?.finishReason;
      
      return {
        content: text,
        isComplete: isComplete,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown parsing error";
      console.error("Failed to parse stream chunk:", message, "Chunk:", chunk);
      return { content: "", isComplete: false, error: `Failed to parse chunk: ${message}` };
    }
  }
}