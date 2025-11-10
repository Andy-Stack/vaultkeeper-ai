import type { AIFunctionCall } from "AIClasses/AIFunctionCall";
import { Selector } from "Enums/Selector";

export interface IStreamChunk {
  content: string;
  isComplete: boolean;
  error?: string;
  functionCall?: AIFunctionCall;
  shouldContinue?: boolean;
}

export class StreamingService {
  public async* streamRequest(
    url: string,
    requestBody: unknown,
    parseStreamChunk: (chunk: string) => IStreamChunk,
    abortSignal?: AbortSignal,
    additionalHeaders?: Record<string, string>
  ): AsyncGenerator<IStreamChunk, void, unknown> {
    try {
      const response = await fetch(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...additionalHeaders,
          },
          body: JSON.stringify(requestBody),
          signal: abortSignal,
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} - ${response.statusText} ${await response.text()}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let lastChunkWasComplete = false;

      while (true) {
        const { done, value } = await reader.read();

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep potentially incomplete line in buffer

        for (const line of lines) {
          if (line.trim().startsWith("data:")) {
            const jsonStr = line.trim().substring(5);
            const chunk = parseStreamChunk(jsonStr);
            lastChunkWasComplete = chunk.isComplete;
            yield chunk;
          }
        }

        if (done) {
          break;
        }
      }

      if (!lastChunkWasComplete) {
        yield { content: "", isComplete: true };
      }
    } catch (error) {
      // Don't log abort errors as they're intentional
      if (error instanceof Error && error.name === 'AbortError') {
        yield {
          content: Selector.ApiRequestAborted,
          isComplete: true
        };
      } else {
        yield {
          content: "",
          isComplete: true,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  }
}