import { BaseAIClass } from "AIClasses/BaseAIClass";
import type { IStreamChunk } from "Services/StreamingService";
import type { Conversation } from "Conversations/Conversation";
import type { Attachment } from "Conversations/Attachment";
import { Role } from "Enums/Role";
import { AIProvider, AIProviderURL } from "Enums/ApiProvider";
import { AIToolCall } from "AIClasses/AIToolCall";
import { AITool, fromString as aiToolFromString } from "Enums/AITool";
import type { IAIToolDefinition } from "AIClasses/ToolDefinitions/IAIToolDefinition";
import type { ConversationContent } from "Conversations/ConversationContent";
import type { Candidate, Part, FunctionDeclaration } from "@google/genai";
import { FinishReason } from "@google/genai";
import { MimeType, toMimeType } from "Enums/MimeType";
import { isTextFile } from "Enums/FileType";
import { MimeTypeToFileTypes } from "Enums/FileTypeMimeTypeMapping";
import { Exception } from "Helpers/Exception";
import { ApiError, ApiErrorType } from "Types/ApiError";
import { parseToolCall, parseFunctionResponse } from "Helpers/ResponseHelper";
import type { GeminiRetryInfo, GeminiErrorResponse } from "./GeminiTypes";
import { AIToolUsageMode } from "Enums/AIToolUsageMode";
import { replaceCopy } from 'Helpers/Helpers';
import { Copy } from "Enums/Copy";

export class Gemini extends BaseAIClass {


  private readonly SUPPORTED_MIMETYPES = [
    // Common Text
    MimeType.TEXT_PLAIN,
    MimeType.TEXT_HTML,
    MimeType.TEXT_CSS,
    MimeType.TEXT_CSV,
    MimeType.TEXT_MD,
    MimeType.TEXT_MARKDOWN,
    MimeType.TEXT_XML,
    MimeType.APPLICATION_RTF,
    // Images
    MimeType.IMAGE_JPEG,
    MimeType.IMAGE_PNG,
    // PDF
    MimeType.APPLICATION_PDF,
    // Data Formats
    MimeType.APPLICATION_JSON,
    MimeType.APPLICATION_XML,
    // Scripting
    MimeType.TEXT_PYTHON,
    MimeType.APPLICATION_PYTHON_CODE,
    MimeType.TEXT_JAVASCRIPT,
    MimeType.APPLICATION_JAVASCRIPT,
    MimeType.TEXT_TYPESCRIPT,
    MimeType.APPLICATION_TYPESCRIPT,
    MimeType.TEXT_SH,
    MimeType.APPLICATION_SH,
    // C-Family
    MimeType.TEXT_C,
    MimeType.TEXT_CPP,
    MimeType.TEXT_CSRC,
    MimeType.TEXT_CPPSRC,
    MimeType.TEXT_CHDR,
    MimeType.TEXT_CPPHDR,
    // Java/JVM
    MimeType.TEXT_JAVA,
    MimeType.TEXT_JAVA_SOURCE,
    MimeType.TEXT_KOTLIN,
    MimeType.TEXT_SCALA,
    // Others
    MimeType.TEXT_GO,
    MimeType.TEXT_RUST,
    MimeType.TEXT_SWIFT,
    MimeType.TEXT_RUBY,
    MimeType.TEXT_PHP,
    MimeType.TEXT_YAML,
    MimeType.APPLICATION_YAML
  ];

  private accumulatedFunctionName: string | null = null;
  private accumulatedFunctionArgs: Record<string, unknown> = {};
  private accumulatedThoughtSignature: string | null = null;

  public constructor() {
    super(AIProvider.Gemini);
  }

  public async* streamRequest(conversation: Conversation): AsyncGenerator<IStreamChunk, void, unknown> {
    // next request should use web search only (gemini api doesn't support custom tooling and grounding at the same time)
    const requestWebSearch = this.accumulatedFunctionName == AITool.RequestWebSearch;

    this.accumulatedFunctionName = null;
    this.accumulatedFunctionArgs = {};
    this.accumulatedThoughtSignature = null;

    // Refresh file cache only if conversation has attachments
    if (conversation.hasAttachments()) {
      await this.aiFileService.refreshCache();
    }

    const contents = await this.extractContents(conversation.contents);

    const tools = requestWebSearch ? { google_search: {} } : this.getTools()

    const requestBody: Record<string, unknown> = {
      system_instruction: {
        parts: [
          {
            text: this.systemPrompt
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
            text: this.userInstruction
          }
        ]
      },
      contents: contents,
      tools: [tools]
    };

    // Only include tool_config when actually sending function declarations (not for google_search)
    if (!requestWebSearch) {
      requestBody.tool_config = this.buildGeminiToolConfig();
    }

    yield* this.streamingService.streamRequest(
      `${AIProviderURL.Gemini}/${this.model()}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
      requestBody,
      (chunk: string) => this.parseStreamChunk(chunk),
      undefined,  // No additional headers
      (error) => this.extractRetryDelay(error)
    );
  }

  protected parseStreamChunk(chunk: string): IStreamChunk {
    try {
      const data = JSON.parse(chunk) as { candidates?: Candidate[] };

      let text = "";
      let toolCall: AIToolCall | undefined = undefined;
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
        toolCall = new AIToolCall(
          aiToolFromString(this.accumulatedFunctionName),
          this.accumulatedFunctionArgs,
          undefined,  // toolId not used by Gemini
          this.accumulatedThoughtSignature || undefined
        );
      }

      return {
        content: text,
        isComplete: isComplete,
        toolCall: toolCall,
        shouldContinue: shouldContinue,
      };
    } catch (error) {
      return this.createErrorChunk(error);
    }
  }

  protected async extractContents(conversationContent: ConversationContent[]): Promise<{ role: Role, parts: Part[] }[]> {
    const results = [];

    for (const content of this.filterConversationContents(conversationContent)) {
        const parts: Part[] = [];
        const contentToExtract = content.content ?? "";

        // Add text content if not a function call response or attachment
        if (contentToExtract.trim() !== "" && !content.functionResponse && (!content.attachments || content.attachments.length === 0)) {
          parts.push({ text: contentToExtract });
        }

        // Add function call if present
        if (content.toolCall) {
          const parsedContent = parseToolCall(content.toolCall);

          if (parsedContent) {
            // Check if this is a cross-provider function call (has toolId in the stored format)
            // Gemini never uses toolId, so presence of toolId indicates Claude/OpenAI origin
            const isCrossProvider = parsedContent.toolCall.id && parsedContent.toolCall.id.trim() !== "";

            if (isCrossProvider) {
              // Cross-provider function call (from Claude/OpenAI) - use legacy text format
              parts.push({
                text: this.convertToolCallToText(parsedContent)
              });
            } else {
              // Native Gemini function call - use proper function call format
              const part: Part = {
                functionCall: {
                  name: parsedContent.toolCall.name,
                  args: parsedContent.toolCall.args
                }
              };
              // Include thoughtSignature if present (optional Gemini feature)
              if (content.thoughtSignature && content.thoughtSignature.trim() !== "") {
                part.thoughtSignature = content.thoughtSignature;
              }
              parts.push(part);
            }
          } else {
            parts.push({
              text: "Error parsing function call"
            });
          }
        }

        // Add binary file attachments if present
        if (content.attachments && content.attachments.length > 0) {
          const { formattedParts, uploadErrors } = await this.processAttachments<Part>(
            content.attachments,
            (attachments) => this.formatBinaryFiles(attachments)
          );

          parts.push(...formattedParts);

          for (const uploadError of uploadErrors) {
            parts.push({
              text: Exception.messageFrom(uploadError)
            });
          }
        }

        // Add function response if present
        if (content.functionResponse) {
          const parsedContent = parseFunctionResponse(content.functionResponse);

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
              text: content.functionResponse
            });
          }
        }

      results.push({
        role: content.role === Role.User ? Role.User : Role.Model,
        parts: parts
      });
    }

    return results.filter(message => message.parts.length > 0);
  }

  protected mapFunctionDefinitions(aiToolDefinitions: IAIToolDefinition[]): FunctionDeclaration[] {
    return aiToolDefinitions.map((functionDefinition) => ({
      name: functionDefinition.name,
      description: functionDefinition.description,
      parameters: functionDefinition.parameters as FunctionDeclaration['parameters']
    }));
  }

  protected formatBinaryFiles(attachments: Attachment[]): string {
    const parts: unknown[] = [];

    for (const attachment of attachments) {
      const fileID = attachment.getFileID(this.provider);
      if (!fileID) {
        continue; // Skip - upload failed, error message added in extractContents()
      }

      const mimeType = toMimeType(attachment.getMimeType());

      let isPlainText = false;

      // This content can be sent up with the 'MimeType.TEXT_PLAIN' mime type
      if (MimeTypeToFileTypes[mimeType].some(fileType => isTextFile(fileType))) {
        isPlainText = true;
      }

      if (!isPlainText && !this.isSupportedMimeType(mimeType)) {
        parts.push({ text: `Unsupported mime type '${mimeType}': ${attachment.fileName}` });
        continue;
      }

      parts.push({ text: replaceCopy(Copy.AttachedFile, [attachment.fileName])});
      parts.push({
        fileData: {
          mimeType: mimeType,
          fileUri: fileID
        }
      });
    }

    return JSON.stringify(parts);
  }

  private getTools(): { functionDeclarations: FunctionDeclaration[] } {
      if (this.settingsService.settings.enableWebSearch) {
          return {
              functionDeclarations: [
                  {
                      name: AITool.RequestWebSearch,
                      description: `Use this function when you need to search the web for current
                          information, recent events, news, or facts that may have changed.
                          After calling this, you will be able to perform web searches.`,
                  },
                  ...this.mapFunctionDefinitions(this.aiToolDefinitions),
              ]
          };
      }
      return { functionDeclarations: this.mapFunctionDefinitions(this.aiToolDefinitions) };
  }

  private buildGeminiToolConfig(): { function_calling_config: { mode: string } } {
    // If no tools defined, fall back to auto
    if (this.aiToolDefinitions.length === 0) {
      return { function_calling_config: { mode: "AUTO" } };
    }

    switch (this.aiToolUsageMode) {
      case AIToolUsageMode.Auto:
        return { function_calling_config: { mode: "AUTO" } };
      case AIToolUsageMode.Enabled:
        return { function_calling_config: { mode: "ANY" } };
      case AIToolUsageMode.Disabled:
        return { function_calling_config: { mode: "NONE" } };
    }
  }

  private extractRetryDelay(error: ApiError): number | undefined {
    if (error.info.type !== ApiErrorType.RATE_LIMIT || !error.info.responseBody) {
      return undefined;
    }

    try {
      const parsed: unknown = JSON.parse(error.info.responseBody);

      // Handle root array quirk (some APIs wrap the response in an array)
      const responseObj: unknown = Array.isArray(parsed) ? parsed[0] : parsed;

      if (!this.isGeminiErrorResponse(responseObj)) {
        return undefined;
      }

      const details = responseObj.error?.details;
      if (!Array.isArray(details)) {
        return undefined;
      }

      // Find RetryInfo object - check for @type field or presence of retry delay fields
      const retryInfo = details.find((d: unknown): d is GeminiRetryInfo =>
        this.isRetryInfoDetail(d)
      );

      if (!retryInfo) {
        return undefined;
      }

      // Extract delay (support both camelCase and snake_case)
      const rawDelay: unknown = retryInfo.retry_delay ?? retryInfo.retryDelay;
      if (!rawDelay) {
        return undefined;
      }

      // Handle object format: { seconds: 10, nanos: 500000000 }
      if (typeof rawDelay === 'object' && rawDelay !== null && 'seconds' in rawDelay) {
        const seconds = (rawDelay).seconds;
        if (typeof seconds === 'number' || typeof seconds === 'string') {
          return Math.ceil(Number(seconds));
        }
        return undefined;
      }

      // Handle string format: "10s", "1.5s", "500ms"
      if (typeof rawDelay === 'string') {
        return this.parseGoogleDuration(rawDelay);
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  private isGeminiErrorResponse(obj: unknown): obj is GeminiErrorResponse {
    return typeof obj === 'object' &&
           obj !== null &&
           'error' in obj;
  }

  private isRetryInfoDetail(d: unknown): d is GeminiRetryInfo {
    if (typeof d !== 'object' || d === null) {
      return false;
    }
    const detail = d as Record<string, unknown>;
    return detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' ||
           detail.retryDelay !== undefined ||
           detail.retry_delay !== undefined;
  }
  
  private parseGoogleDuration(duration: string): number | undefined {
    const trimmed = duration.trim();
    const match = trimmed.match(/^(\d+\.?\d*)(s|ms)$/);
    
    if (!match) return undefined;
    
    const value = parseFloat(match[1]);
    if (Number.isNaN(value)) return undefined;
    
    const unit = match[2];
    return unit === 'ms' 
      ? Math.ceil(value / 1000) 
      : Math.ceil(value);
  }

  private isSupportedMimeType(mimeType: MimeType): boolean {
    return this.SUPPORTED_MIMETYPES.includes(mimeType);
  }
}