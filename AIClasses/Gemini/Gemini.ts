import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IAIClass } from "AIClasses/IAIClass";
import type { IPrompt } from "AIClasses/IPrompt";
import { StreamingService, type StreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import { Role } from "Enums/Role";
import { AIProviderURL } from "Enums/ApiProvider";
import { AIFunctionCall } from "AIClasses/AIFunctionCall";
import type { AIFunctionDefinitions } from "AIClasses/FunctionDefinitions/AIFunctionDefinitions";
import type { IAIFunctionDefinition } from "AIClasses/FunctionDefinitions/IAIFunctionDefinition";

export class Gemini implements IAIClass {
  private readonly REQUEST_WEB_SEARCH: string = "request_web_search";

  private readonly apiKey: string;
  private readonly aiPrompt: IPrompt;
  private readonly streamingService: StreamingService;
  private readonly aiFunctionDefinitions: AIFunctionDefinitions;
  private accumulatedFunctionName: string | null = null;
  private accumulatedFunctionArgs: Record<string, any> = {};

  public constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.aiPrompt = Resolve(Services.IPrompt);
    this.streamingService = Resolve(Services.StreamingService);
    this.aiFunctionDefinitions = Resolve(Services.AIFunctionDefinitions);
  }

  public async* streamRequest(conversation: Conversation): AsyncGenerator<StreamChunk, void, unknown> {
    // next request should use web search only (gemini api doesn't support custom tooling and grounding at the same time)
    let requestWebSearch = this.accumulatedFunctionName == this.REQUEST_WEB_SEARCH;

    // Reset function call accumulation state for new request
    this.accumulatedFunctionName = null;
    this.accumulatedFunctionArgs = {};

    const contents = conversation.contents.map(content => ({
      role: content.role === Role.User ? "user" : "model",
      parts: (content.isFunctionCall || content.isFunctionCallResponse)
        ? [JSON.parse(content.content)] : [{ text: content.content }]
    }));

    const tools = requestWebSearch ? { google_search: {} } :
    {
      functionDeclarations: [
        {
          name: "request_web_search",
          description: `Use this function when you need to search the web for current
                        information, recent events, news, or facts that may have changed.
                        After calling this, you will be able to perform web searches.`,
          parameters: {
            type: "object",
            properties: {
              reasoning: {
                type: "string",
                description: "Brief explanation of why web search is needed"
              }
            },
            required: ["reasoning"]
          }
        },
        ...this.mapFunctionDefinitions(this.aiFunctionDefinitions.getQueryActions()),
      ]
    }

    const requestBody = {
      system_instruction: {
        parts: [
          {
            text: this.aiPrompt.systemInstruction()
          },
          {
            text: `IMPORTANT: When you need current information from the web (recent events, news, current prices, weather, etc.), you should:
                   1. First call the 'request_web_search' function to indicate you need web access
                   2. After that, you'll be given access to Google Search
                   3. Once you have the information from the search, you can answer the user's question
                   4. Subsequent communication will return to providing custom function calls`
          },
          {
            text: await this.aiPrompt.userInstruction()
          }
        ]
      },
      contents: contents,
      tools: [tools]
    };

    console.log(requestBody);

    yield* this.streamingService.streamRequest(
      AIProviderURL.Gemini.replace("API_KEY", this.apiKey),
      requestBody,
      this.parseStreamChunk.bind(this)
    );
  }

  private parseStreamChunk(chunk: string): StreamChunk {
    try {
      const data = JSON.parse(chunk);

      let text = "";
      let functionCall: AIFunctionCall | undefined = undefined;
      const candidate = data.candidates?.[0];

      if (candidate) {
        // Check for text content
        if (candidate.content?.parts?.[0]?.text) {
          text = candidate.content.parts[0].text;
        } else if (candidate.text) {
          text = candidate.text;
        }

        // Check for function call and accumulate
        const parts = candidate.content?.parts || [];
        for (const part of parts) {
          if (part.functionCall) {
            // Accumulate function name
            if (part.functionCall.name) {
              this.accumulatedFunctionName = part.functionCall.name;
            }

            // Accumulate function arguments (merge with existing)
            if (part.functionCall.args) {
              this.accumulatedFunctionArgs = {
                ...this.accumulatedFunctionArgs,
                ...part.functionCall.args
              };
            }
            break; // Only handle first function call per chunk
          }
        }
      }

      const isComplete = !!candidate?.finishReason;

      // If streaming is complete and we have accumulated a function call, return it
      if (isComplete && this.accumulatedFunctionName) {
        functionCall = new AIFunctionCall(
          this.accumulatedFunctionName,
          this.accumulatedFunctionArgs
        );
      }

      return {
        content: text,
        isComplete: isComplete,
        functionCall: functionCall,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown parsing error";
      console.error("Failed to parse stream chunk:", message, "Chunk:", chunk);
      return { content: "", isComplete: false, error: `Failed to parse chunk: ${message}` };
    }
  }

  private mapFunctionDefinitions(aiFunctionDefinitions: IAIFunctionDefinition[]): object[] {
    return aiFunctionDefinitions.map((functionDefinition) => ({
      name: functionDefinition.name,
      description: functionDefinition.description,
      parameters: functionDefinition.parameters
    }));
  }
}