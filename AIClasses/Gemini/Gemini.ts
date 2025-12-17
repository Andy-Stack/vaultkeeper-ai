import { BaseAIClass } from "AIClasses/BaseAIClass";
import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import { Role } from "Enums/Role";
import { AIProvider, AIProviderURL } from "Enums/ApiProvider";
import { AIFunctionCall } from "AIClasses/AIFunctionCall";
import { fromString as aiFunctionFromString } from "Enums/AIFunction";
import type { IAIFunctionDefinition } from "AIClasses/FunctionDefinitions/IAIFunctionDefinition";
import type { ConversationContent } from "Conversations/ConversationContent";
import type { Candidate, Part, FunctionDeclaration } from "@google/genai";
import { FinishReason } from "@google/genai";
import * as path from "path-browserify";
import { FileType, getImageMimeType, isFileType } from "Enums/FileType";
import { Exception } from "Helpers/Exception";

export class Gemini extends BaseAIClass {

  private readonly REQUEST_WEB_SEARCH: string = "request_web_search";
  private readonly SUPPORTED_IMAGE_TYPES: string[] = ["image/jpeg", "image/png"];

  private accumulatedFunctionName: string | null = null;
  private accumulatedFunctionArgs: Record<string, unknown> = {};
  private accumulatedThoughtSignature: string | null = null;

  public constructor() {
    super(AIProvider.Gemini);
  }

  public async* streamRequest(
    conversation: Conversation, allowDestructiveActions: boolean
  ): AsyncGenerator<IStreamChunk, void, unknown> {
    // next request should use web search only (gemini api doesn't support custom tooling and grounding at the same time)
    const requestWebSearch = this.accumulatedFunctionName == this.REQUEST_WEB_SEARCH;

    this.accumulatedFunctionName = null;
    this.accumulatedFunctionArgs = {};
    this.accumulatedThoughtSignature = null;

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
      (chunk: string) => this.parseStreamChunk(chunk)
    );
  }

  protected parseStreamChunk(chunk: string): IStreamChunk {
    try {
      const data = JSON.parse(chunk) as { candidates?: Candidate[] };

      let text = "";
      let functionCall: AIFunctionCall | undefined = undefined;
      const candidate = data.candidates?.[0];

      if (candidate) {
        // Check for text content
        if (candidate.content?.parts?.[0]?.text) {
          text = candidate.content.parts[0].text;
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

            // Accumulate thought signature (sibling property on Part)
            if (part.thoughtSignature) {
              this.accumulatedThoughtSignature = part.thoughtSignature;
            }
            break; // Only handle first function call per chunk
          }
        }
      }

      const isComplete = !!candidate?.finishReason;
      const finishReason = candidate?.finishReason;

      const shouldContinue = isComplete && finishReason !== FinishReason.STOP;

      // If streaming is complete and we have accumulated a function call, return it
      if (isComplete && this.accumulatedFunctionName) {
        functionCall = new AIFunctionCall(
          aiFunctionFromString(this.accumulatedFunctionName),
          this.accumulatedFunctionArgs as Record<string, object>,
          undefined,  // toolId not used by Gemini
          this.accumulatedThoughtSignature || undefined
        );
      }

      return {
        content: text,
        isComplete: isComplete,
        functionCall: functionCall,
        shouldContinue: shouldContinue,
      };
    } catch (error) {
      return this.createErrorChunk(error);
    }
  }

  protected extractContents(conversationContent: ConversationContent[]): { role: Role, parts: Part[] }[] {
    return this.filterConversationContents(conversationContent)
      .map(content => {
        const parts: Part[] = [];
        const contentToExtract = this.getContentToExtract(content);

        // Add text content if not a function call response or provider-specific content
        if (contentToExtract.trim() !== "" && !content.isFunctionCallResponse && !content.isProviderSpecificContent) {
          parts.push({ text: contentToExtract });
        }

        // Add function call if present
        if (content.isFunctionCall && content.functionCall.trim() !== "") {
          const parsedContent = this.parseFunctionCall(content.functionCall);

          if (parsedContent) {
            if (content.thoughtSignature && content.thoughtSignature.trim() !== "") {
              // Has signature - use proper function call format
              const part: Part = {
                functionCall: {
                  name: parsedContent.functionCall.name,
                  args: parsedContent.functionCall.args
                },
                thoughtSignature: content.thoughtSignature
              };
              parts.push(part);
            } else {
              // No signature (cross-provider scenario) - use legacy text format
              parts.push({
                text: this.convertFunctionCallToText(parsedContent)
              });
            }
          } else if (contentToExtract.trim() === "") {
            // Fall back to treating as text
            parts.push({
              text: "Error parsing function call"
            });
          }
        }

        // Add provider-specific content if present (e.g., binary files)
        if (content.isProviderSpecificContent && contentToExtract.trim() !== "") {
          const rawContent = JSON.parse(contentToExtract) as Part[];
          parts.push(...rawContent);
        }

        // Add function response if present
        if (content.isFunctionCallResponse && contentToExtract.trim() !== "") {
          const parsedContent = this.parseFunctionResponse(contentToExtract);

          if (parsedContent) {
            if (parsedContent.id && parsedContent.id.trim() !== "") {
              // Has ID - use proper function response format
              parts.push({
                functionResponse: {
                  name: parsedContent.functionResponse.name,
                  response: parsedContent.functionResponse.response as Record<string, unknown>
                }
              });
            } else {
              // No ID (cross-provider scenario) - use legacy text format
              parts.push({
                text: this.convertFunctionResponseToText(parsedContent)
              });
            }
          } else {
            // Fall back to text content
            parts.push({
              text: contentToExtract
            });
          }
        }

        return {
          role: content.role === Role.User ? Role.User : Role.Model,
          parts: parts
        };
      })
      .filter(message => message.parts.length > 0);
  }

  protected mapFunctionDefinitions(aiFunctionDefinitions: IAIFunctionDefinition[]): FunctionDeclaration[] {
    return aiFunctionDefinitions.map((functionDefinition) => ({
      name: functionDefinition.name,
      description: functionDefinition.description,
      parameters: functionDefinition.parameters as FunctionDeclaration['parameters']
    }));
  }

  public formatBinaryFiles(files: Array<{type: string, path: string, contents: string}>): string {
    const parts: unknown[] = [];

    for (const file of files) {
      const extension = path.extname(file.path).substring(1).toLowerCase();

      let mimeType: string;

      if (isFileType(file.type, FileType.PDF)) {
        mimeType = "application/pdf";
      } else {
        try {
          mimeType = getImageMimeType(extension);

          if (!this.SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
            parts.push({
              text: `Unsupported image format: ${path.basename(file.path)}`
            });
            continue;
          }
        } catch (error) {
          parts.push({
            text: Exception.messageFrom(error)
          });
          continue;
        }
      }

      parts.push({text: path.basename(file.path)});
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: file.contents
        }
      });
    }

    return JSON.stringify(parts);
  }
}