/**
 * Interface for the top-level Gemini API response.
 */
interface GeminiApiResponse {
  candidates: Candidate[];
  usageMetadata: UsageMetadata;
  modelVersion: string;
  responseId: string;
}

/**
 * Interface for a single candidate in the response.
 */
interface Candidate {
  content: Content;
  finishReason: string;
  index: number;
  citationMetadata: CitationMetadata;
}

/**
 * Interface for the content of a candidate.
 */
interface Content {
  parts: Part[];
  role: string;
}

/**
 * Interface for a single part of the content.
 * The `text` property contains a JSON string, which needs to be parsed.
 */
interface Part {
  text: string;
  functionCall: FunctionCall;
}

/**
 * Interface for a single function call.
 */
interface FunctionCall {
  name: string;
  args: object;
}

/**
 * Interface for the metadata about citations.
 */
interface CitationMetadata {
  citationSources: CitationSource[];
}

/**
 * Interface for a single citation source.
 */
interface CitationSource {
  startIndex: number;
  endIndex: number;
  uri: string;
  license: string;
}

/**
 * Interface for the usage metadata of the API call.
 */
interface UsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  promptTokensDetails: PromptTokensDetails[];
  thoughtsTokenCount: number;
}

/**
 * Interface for the details of prompt tokens.
 */
interface PromptTokensDetails {
  modality: string;
  tokenCount: number;
}