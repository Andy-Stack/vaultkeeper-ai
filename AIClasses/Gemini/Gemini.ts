import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { IAIClass } from "AIClasses/IAIClass";
import type { IPrompt } from "AIClasses/IPrompt";
import { StreamingService, type IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import { Role } from "Enums/Role";
import { AIProvider, AIProviderURL } from "Enums/ApiProvider";
import { AIFunctionCall } from "AIClasses/AIFunctionCall";
import type { IAIFunctionDefinition } from "AIClasses/FunctionDefinitions/IAIFunctionDefinition";
import type AIAgentPlugin from "main";
import type { AIFunctionDefinitions } from "AIClasses/FunctionDefinitions/AIFunctionDefinitions";
import { isValidJson } from "Helpers/Helpers";
import type { ConversationContent } from "Conversations/ConversationContent";
import type { SettingsService } from "Services/SettingsService";

export class Gemini implements IAIClass {

  private readonly REQUEST_WEB_SEARCH: string = "request_web_search";
  private readonly STOP_REASON_STOP: string = "STOP";

  private readonly apiKey: string;
  private readonly aiPrompt: IPrompt = Resolve<IPrompt>(Services.IPrompt);
  private readonly plugin: AIAgentPlugin = Resolve<AIAgentPlugin>(Services.AIAgentPlugin);
  private readonly settingsService: SettingsService = Resolve<SettingsService>(Services.SettingsService);
  private readonly streamingService: StreamingService = Resolve<StreamingService>(Services.StreamingService);
  private readonly aiFunctionDefinitions: AIFunctionDefinitions = Resolve<AIFunctionDefinitions>(Services.AIFunctionDefinitions);
  private accumulatedFunctionName: string | null = null;
  private accumulatedFunctionArgs: Record<string, any> = {};

  public constructor() {
    this.apiKey = this.settingsService.getApiKeyForProvider(AIProvider.Gemini);
  }

  public async* streamRequest(
    conversation: Conversation, allowDestructiveActions: boolean, abortSignal?: AbortSignal
  ): AsyncGenerator<IStreamChunk, void, unknown> {
    // next request should use web search only (gemini api doesn't support custom tooling and grounding at the same time)
    const requestWebSearch = this.accumulatedFunctionName == this.REQUEST_WEB_SEARCH;

    this.accumulatedFunctionName = null;
    this.accumulatedFunctionArgs = {};

    const contents = this.extractContents(conversation.contents);

    const tools = requestWebSearch ? { google_search: {} } :
      {
        functionDeclarations: [
          {
            name: "request_web_search",
            description: `Use this function when you need to search the web for current
                        information, recent events, news, or facts that may have changed.
                        After calling this, you will be able to perform web searches.`,
          },
          ...this.mapFunctionDefinitions(this.aiFunctionDefinitions.getQueryActions(allowDestructiveActions)),
        ]
      }

    const requestBody = {
      system_instruction: {
        parts: [
          {
            text: this.aiPrompt.systemInstruction()
          },
          {
            text: `## IMPORTANT: Web Search Directive
                   **You *must* proactively use the web search tool whenever a user's query requires current, real-time, or frequently changing information.** This includes, but is not limited to:
                   - Current date or time.
                   - Current weather conditions or forecasts.
                   - Recent news, events, or happenings.
                   - Up-to-date prices, statistics, or factual data that is dynamic.
                   - Any information where "current," "latest," or "today's" is implied or explicitly requested.
                   
                   When you need current information from the web, you *must* follow these steps:
                   1. First call the \`request_web_search\` function with a clear and concise \`reasoning\` explaining why web search is needed.
                   2. After calling this, you will be given access to Google Search.
                   3. Once you have obtained the necessary information from the search results, use it to formulate your complete and accurate answer.
                   4. Subsequent interactions will revert to standard function calls or general assistance as appropriate.`
          },
          {
            text: await this.aiPrompt.userInstruction()
          }
        ]
      },
      contents: contents,
      tools: [tools]
    };

    yield* this.streamingService.streamRequest(
      `${AIProviderURL.Gemini}/${this.settingsService.settings.model}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
      requestBody,
      this.parseStreamChunk.bind(this),
      abortSignal
    );
  }

  private parseStreamChunk(chunk: string): IStreamChunk {
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
      const finishReason = candidate?.finishReason;

      const shouldContinue = isComplete && finishReason !== this.STOP_REASON_STOP;

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
        shouldContinue: shouldContinue,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown parsing error";
      console.error("Failed to parse stream chunk:", message, "Chunk:", chunk);
      return { content: "", isComplete: false, error: `Failed to parse chunk: ${message}` };
    }
  }

  private extractContents(conversationContent: ConversationContent[]): { role: Role, parts: any[] }[] {
    return conversationContent.filter(content => content.content.trim() !== "" || content.functionCall.trim() !== "")
      .map(content => {
        const parts: any[] = [];
        const contentToExtract = content.role == Role.User ? content.promptContent : content.content;

        if (contentToExtract.trim() !== "") {
          if (content.isFunctionCallResponse) {
            if (isValidJson(contentToExtract)) {
              try {
                const parsedContent = JSON.parse(contentToExtract);
                if (parsedContent.functionResponse) {
                  parts.push({
                    functionResponse: parsedContent.functionResponse
                  });
                } else {
                  parts.push({ text: contentToExtract });
                }
              } catch (error) {
                console.error("Failed to parse function response:", error);
                parts.push({ text: contentToExtract });
              }
            } else {
              console.error("Invalid JSON in function response content");
              parts.push({ text: contentToExtract });
            }
          } else {
            parts.push({ text: contentToExtract });
          }
        }

        if (content.isFunctionCall && content.functionCall.trim() !== "") {
          if (isValidJson(content.functionCall)) {
            try {
              const parsedContent = JSON.parse(content.functionCall);
              if (parsedContent.functionCall) {
                parts.push({
                  functionCall: {
                    name: parsedContent.functionCall.name,
                    args: parsedContent.functionCall.args
                  }
                });
              }
            } catch (error) {
              console.error("Failed to parse function call:", error);
            }
          } else {
            console.error("Invalid JSON in functionCall field");
          }
        }

        return {
          role: content.role === Role.User ? Role.User : Role.Model,
          parts: parts.length > 0 ? parts : [{ text: "" }]
        };
      });
  }

  private mapFunctionDefinitions(aiFunctionDefinitions: IAIFunctionDefinition[]): object[] {
    return aiFunctionDefinitions.map((functionDefinition) => ({
      name: functionDefinition.name,
      description: functionDefinition.description,
      parameters: functionDefinition.parameters
    }));
  }
}