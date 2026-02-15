import type { AIToolCall } from "AIClasses/AIToolCall";
import { Event } from "Enums/Event";
import { Exception } from "Helpers/Exception";
import { ApiError, ApiErrorType } from "Types/ApiError";
import { AbortService } from "./AbortService";
import { Resolve } from "./DependencyService";
import { EventService } from "./EventService";
import { Services } from "./Services";
import { sleep } from "Helpers/Helpers";

export interface IStreamChunk {
  content: string;
  isComplete: boolean;
  error?: string;
  errorType?: ApiErrorType;
  toolCall?: AIToolCall;
  shouldContinue?: boolean;
}

export class StreamingService {

  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAYS = [1000, 2000, 4000]; // ms

  private readonly abortService: AbortService;
  private readonly eventService: EventService;

  public constructor() {
    this.abortService = Resolve<AbortService>(Services.AbortService);
    this.eventService = Resolve<EventService>(Services.EventService);
  }

  public async* streamRequest(url: string, requestBody: unknown, parseStreamChunk: (chunk: string) => IStreamChunk,
    additionalHeaders?: Record<string, string>, extractRetryDelay?: (error: ApiError) => number | undefined): AsyncGenerator<IStreamChunk, void, unknown> {

      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= StreamingService.MAX_RETRIES; attempt++) {
        try {
          const response = await this.makeRequest(url, requestBody, additionalHeaders);

          const reader = response.body?.getReader();
          if (!reader) {
            Exception.throw("Response body is not readable");
          }

          const streamCompleted = yield* this.processStream(reader, parseStreamChunk);

          if (!streamCompleted) {
            yield { content: "", isComplete: true };
          }

          return;

        } catch (error) {
          lastError = Exception.new(error);

          if (AbortService.isAbortError(error)) {
            throw error;
          }

          if (!this.shouldRetry(error, attempt)) {
            Exception.log(error);
            yield this.createErrorChunk(Exception.new(error));
            return;
          }

          const delayMs = this.calculateRetryDelay(error, attempt, extractRetryDelay);
          Exception.warn(`Rate limit exceeded, waiting for ${delayMs}ms...`);
          await sleep(delayMs);
        }
      }

      if (lastError) {
        Exception.log(lastError);
        yield this.createErrorChunk(lastError);
      }
  }

  private async makeRequest(url: string, requestBody: unknown,
    additionalHeaders?: Record<string, string>): Promise<Response> {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...additionalHeaders,
          },
          body: JSON.stringify(requestBody),
          signal: this.abortService.signal(),
        });

        if (!response.ok) {
          const responseBody = await response.text();
          throw ApiError.fromResponse(response.status, response.statusText, responseBody, response.headers);
        }

        return response;
      } catch (error) {
        if (ApiError.isApiError(error) || AbortService.isAbortError(error)) {
          throw error;
        }
        throw ApiError.fromNetworkError(Exception.new(error));
      }
  }

  private async* processStream(reader: ReadableStreamDefaultReader<Uint8Array>,
    parseStreamChunk: (chunk: string) => IStreamChunk): AsyncGenerator<IStreamChunk, boolean, unknown> {
      let buffer = "";
      let lastChunkWasComplete = false;

      const decoder = new TextDecoder();

      while (true) {
        if (this.abortService.signal().aborted) {
          this.abortService.throw();
        }

        const { done, value } = await reader.read();

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep potentially incomplete line in buffer

        for (const line of lines) {
          if (line.trim().startsWith("data:")) {
            const jsonStr = line.trim().substring(5);
            try {
              const chunk = parseStreamChunk(jsonStr);
              lastChunkWasComplete = chunk.isComplete;
              yield chunk;
            } catch (error) {
              if (AbortService.isAbortError(error) || ApiError.isApiError(error)) {
                throw error;
              }

              Exception.log(error);
              
              yield {
                content: "",
                isComplete: true,
                error: Exception.messageFrom(error),
                errorType: ApiErrorType.UNKNOWN
              };
            }
          }
        }

        if (done) {
          break;
        }
      }

      return lastChunkWasComplete;
  }

  private createErrorChunk(error: Error | ApiError): IStreamChunk {
    if (error instanceof ApiError) {
      return {
        content: "",
        isComplete: true,
        error: error.info.userMessage,
        errorType: error.info.type
      };
    }

    return {
      content: "",
      isComplete: true,
      error: Exception.messageFrom(error),
      errorType: ApiErrorType.UNKNOWN
    };
  }

  private shouldRetry(error: unknown, attempt: number): boolean {
    if (AbortService.isAbortError(error)) {
      return false; // Don't retry abort errors
    }

    if (error instanceof ApiError && !error.info.isRetryable) {
      return false; // Don't retry non-retryable errors
    }

    return attempt < StreamingService.MAX_RETRIES;
  }

  private calculateRetryDelay(error: unknown, attempt: number,
    extractRetryDelay?: (error: ApiError) => number | undefined
  ): number {
    // Only use provider-specific delay for 429 rate limits
    if (error instanceof ApiError && error.info.type === ApiErrorType.RATE_LIMIT && extractRetryDelay) {
      const providerDelaySeconds = extractRetryDelay(error);
      if (providerDelaySeconds !== undefined) {
        const delayMs = providerDelaySeconds * 1000;
        this.eventService.trigger(Event.RateLimitCountdown, delayMs);
        return delayMs;
      }
    }

    // Fall back to exponential backoff
    return StreamingService.RETRY_DELAYS[attempt];
  }

}