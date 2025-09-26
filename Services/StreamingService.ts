import { AIProviderURL } from "Enums/ApiProvider";

export interface StreamChunk {
    content: string;
    isComplete: boolean;
    error?: string;
  }
  
  export class StreamingService {
    /**
     * Fetches data from Gemini API with streaming support
     * Since Obsidian's request() doesn't support streaming, we use native fetch
     */
    public async* streamGeminiRequest(
      apiKey: string,
      requestBody: unknown
    ): AsyncGenerator<StreamChunk, void, unknown> {
      try {
        const response = await fetch(
          AIProviderURL.Gemini.replace("API_KEY", apiKey),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          }
        );
  
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed: ${response.status} - ${errorText}`);
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
              const chunk = this.parseStreamChunk(jsonStr);
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
        console.error("Stream request error:", error);
        yield {
          content: "",
          isComplete: true,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
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