// Type definitions for OpenAI API responses

export interface OpenAIStreamResponse {
	choices?: OpenAIChoice[];
}

export interface OpenAIChoice {
	delta?: OpenAIDelta;
	finish_reason?: string;
}

export interface OpenAIDelta {
	content?: string;
	tool_calls?: OpenAIToolCallDelta[];
}

export interface OpenAIToolCallDelta {
	index: number;
	id?: string;
	function?: {
		name?: string;
		arguments?: string;
	};
}

export interface OpenAITool {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: {
			type: string;
			properties: Record<string, unknown>;
			required?: string[];
		};
	};
}
