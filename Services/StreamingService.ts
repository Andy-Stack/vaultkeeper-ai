import type { AIFunctionCall } from "AIClasses/AIFunctionCall";
import { Selector } from "Enums/Selector";
import { Exception } from "Helpers/Exception";
import { ApiError, ApiErrorType } from "Types/ApiError";

export interface IStreamChunk {
  content: string;
  isComplete: boolean;
  error?: string;
  errorType?: ApiErrorType;
  functionCall?: AIFunctionCall;
  shouldContinue?: boolean;
}

export class StreamingService {

  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAYS = [1000, 2000, 4000]; // ms

  public async* streamRequest(url: string, requestBody: unknown, parseStreamChunk: (chunk: string) => IStreamChunk,
    abortSignal?: AbortSignal, additionalHeaders?: Record<string, string>): AsyncGenerator<IStreamChunk, void, unknown> {

      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= StreamingService.MAX_RETRIES; attempt++) {
        try {
          const response = await this.makeRequest(url, requestBody, additionalHeaders, abortSignal);

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
          lastError = error instanceof Error ? error : Exception.new(error);

          if (error instanceof Error && error.name === 'AbortError') {
            yield this.createErrorChunk(lastError, true);
            return;
          }

          if (!this.shouldRetry(error, attempt)) {
            Exception.log(lastError);
            yield this.createErrorChunk(lastError);
            return;
          }

          await this.sleep(StreamingService.RETRY_DELAYS[attempt]);
        }
      }

      if (lastError) {
        Exception.log(lastError);
        yield this.createErrorChunk(lastError);
      }
  }

  private async makeRequest(url: string, requestBody: unknown,
    additionalHeaders?: Record<string, string>, abortSignal?: AbortSignal): Promise<Response> {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...additionalHeaders,
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal,
      });

      if (!response.ok) {
        const responseBody = await response.text();
        throw ApiError.fromResponse(response.status, response.statusText, responseBody);
      }

      return response;
  }

  private async* processStream(reader: ReadableStreamDefaultReader<Uint8Array>,
    parseStreamChunk: (chunk: string) => IStreamChunk): AsyncGenerator<IStreamChunk, boolean, unknown> {
      
      let buffer = "";
      let lastChunkWasComplete = false;

      const decoder = new TextDecoder();

      while (true) {
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

  private createErrorChunk(error: Error | ApiError, isAborted = false): IStreamChunk {
    if (isAborted) {
      return {
        content: Selector.ApiRequestAborted,
        isComplete: true
      };
    }

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
    // Don't retry abort errors
    if (error instanceof Error && error.name === 'AbortError') {
      return false;
    }

    // Don't retry non-retryable errors
    if (error instanceof ApiError && !error.info.isRetryable) {
      return false;
    }

    return attempt < StreamingService.MAX_RETRIES;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}