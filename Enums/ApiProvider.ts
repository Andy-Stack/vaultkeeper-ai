import { Exception } from "Helpers/Exception";

export function fromModel(model: string): AIProvider {
    if (!isValidProviderModel(model)) {
        Exception.throw(`Invalid model: ${model}`);
    }
    if (isClaudeModel(model)) {
        return AIProvider.Claude;
    } else if (isGeminiModel(model)) {
        return AIProvider.Gemini;
    } else if (isOpenAIModel(model)) {
        return AIProvider.OpenAI;
    } else {
        Exception.throw("Invalid model selection");
    }
}

function isClaudeModel(model: string): boolean {
    return isValidProviderModel(model) && model.startsWith("claude-");
}

function isGeminiModel(model: string): boolean {
    return isValidProviderModel(model) && model.startsWith("gemini-");
}

function isOpenAIModel(model: string): boolean {
    return isValidProviderModel(model) && model.startsWith("gpt-");
}

function isValidProviderModel(model: string): model is AIProviderModel {
    return Object.values(AIProviderModel).includes(model as AIProviderModel);
}

export enum AIProvider {
    Claude = "Claude",
    Gemini = "Gemini",
    OpenAI = "OpenAI"
}

export enum AIProviderModel {
    // Claude models
    ClaudeSonnet_4_5 = "claude-sonnet-4-5-20250929",
    ClaudeSonnet_4 = "claude-sonnet-4-20250514",
    ClaudeSonnet_3_7 = "claude-3-7-sonnet-20250219",
    ClaudeOpus_4_5 = "claude-opus-4-5-20251101",
    ClaudeOpus_4_1 = "claude-opus-4-1-20250805",
    ClaudeOpus_4 = "claude-opus-4-20250514",
    ClaudeHaiku_4_5 = "claude-haiku-4-5-20251001",

    // Gemini models
    GeminiFlash_2_5_Lite = "gemini-2.5-flash-lite",
    GeminiFlash_2_5 = "gemini-2.5-flash",
    GeminiPro_2_5 = "gemini-2.5-pro",
    GeminiFlash_3_Preview = "gemini-3-flash-preview",
    GeminiPro_3_Preview = "gemini-3-pro-preview",

    // OpenAI models
    GPT_5_2_Instant = "gpt-5.2-chat-latest",
    GPT_5_2_Thinking = "gpt-5.2",
    GPT_5_2_Pro = "gpt-5.2-pro",
    GPT_5_1 = "gpt-5.1",
    GPT_5 = "gpt-5",
    GPT_5_Mini = "gpt-5-mini",
    GPT_5_Nano = "gpt-5-nano",
    GPT_5_Pro = "gpt-5-pro",
    GPT_4o = "gpt-4o",
    GPT_4o_Mini = "gpt-4o-mini",
    GPT_4_1 = "gpt-4.1",
    GPT_4_1_Mini = "gpt-4.1-mini",

    // Conversation naming models (aliases to existing models)
    ClaudeNamer = ClaudeHaiku_4_5,
    GeminiNamer = GeminiFlash_2_5_Lite,
    OpenAINamer = GPT_5_2_Instant,
}

export enum AIProviderURL {
    Claude = "https://api.anthropic.com/v1/messages",
    Gemini = "https://generativelanguage.googleapis.com/v1beta/models",
    OpenAI = "https://api.openai.com/v1/responses"
}

export enum AIFileServiceURL {
    Claude = "https://api.anthropic.com/v1/files",
    Gemini = "https://generativelanguage.googleapis.com/v1beta",
    GeminiUpload = "https://generativelanguage.googleapis.com/upload/v1beta",
    OpenAI = "https://api.openai.com/v1/files",
}