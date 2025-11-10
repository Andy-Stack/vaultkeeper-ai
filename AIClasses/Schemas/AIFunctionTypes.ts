/** Shared type definitions for AI function calls and responses across all providers **/

// JSON Schema property definition supporting nested structures
// Used for defining function parameters in a provider-agnostic way
export type JSONSchemaProperty = {
	type?: string;
	description?: string;
	items?: JSONSchemaProperty;
	properties?: Record<string, JSONSchemaProperty>;
	required?: string[];
	enum?: string[];
	[key: string]: unknown;
};

//Stored function call format used across all AI providers
// This is the format saved to conversation history when a function is called
export interface StoredFunctionCall {
	functionCall: {
		id: string;
		name: string;
		args: Record<string, unknown>;
	};
}

// Stored function response format used across all AI providers
// This is the format saved to conversation history when a function returns
export interface StoredFunctionResponse {
	id: string;
	functionResponse: {
		name: string;
		response: unknown;
	};
}