// Type definitions for Google Gemini API responses

export interface GeminiCandidate {
	content?: {
		parts?: GeminiPart[];
	};
	text?: string;
	finishReason?: string;
}

export interface GeminiPart {
	text?: string;
	functionCall?: {
		name?: string;
		args?: Record<string, unknown>;
	};
}

export interface GeminiStreamResponse {
	candidates?: GeminiCandidate[];
}

export interface GeminiFunctionDeclaration {
	name: string;
	description: string;
	parameters: {
		type: string;
		properties: Record<string, unknown>;
		required?: string[];
	};
}

export interface GeminiContentPart {
	text?: string;
	functionCall?: {
		name: string;
		args: Record<string, unknown>;
	};
	functionResponse?: {
		response: unknown;
	};
}
