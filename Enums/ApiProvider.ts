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
    } else if (isMistralModel(model)) {
        return AIProvider.Mistral;
    } else {
        Exception.throw("Invalid model selection");
    }
}

export function isValidProviderModel(model: string): model is AIProviderModel {
    return Object.values(AIProviderModel).includes(model as AIProviderModel);
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

function isMistralModel(model: string): boolean {
    return isValidProviderModel(model) && model.startsWith("mistral-");
}

export enum AIProvider {
    Claude = "Claude",
    Gemini = "Gemini",
    OpenAI = "OpenAI",
    Mistral = "Mistral"
}

export enum AIProviderModel {
    // Claude models
    ClaudeSonnet_4_6 = "claude-sonnet-4-6",
    ClaudeSonnet_4_5 = "claude-sonnet-4-5-20250929",
    ClaudeSonnet_4 = "claude-sonnet-4-20250514",
    ClaudeOpus_4_6 = "claude-opus-4-6",
    ClaudeOpus_4_5 = "claude-opus-4-5-20251101",
    ClaudeOpus_4_1 = "claude-opus-4-1-20250805",
    ClaudeOpus_4 = "claude-opus-4-20250514",
    ClaudeHaiku_4_5 = "claude-haiku-4-5-20251001",

    // Gemini models
    GeminiFlash_2_5_Lite = "gemini-2.5-flash-lite",
    GeminiFlash_2_5 = "gemini-2.5-flash",
    GeminiPro_2_5 = "gemini-2.5-pro",
    GeminiFlash_3_Preview = "gemini-3-flash-preview",
    GeminiPro_3_1_Preview = "gemini-3.1-pro-preview",

    // OpenAI models
    GPT_5_2_Instant = "gpt-5.2-chat-latest",
    GPT_5_2_Thinking = "gpt-5.2",
    GPT_5_2_Pro = "gpt-5.2-pro",
    GPT_5_1 = "gpt-5.1",
    GPT_5 = "gpt-5",
    GPT_5_Mini = "gpt-5-mini",
    GPT_5_Nano = "gpt-5-nano",

    // Mistral models
    MistralLarge_3 = "mistral-large-latest",
    MistralMedium_3_1 = "mistral-medium-latest",
    MistralSmall_3_2 = "mistral-small-latest",

    // Conversation naming models (aliases to existing models)
    ClaudeNamer = ClaudeHaiku_4_5,
    GeminiNamer = GeminiFlash_2_5_Lite,
    OpenAINamer = GPT_5_2_Instant,
    MistralNamer = MistralSmall_3_2,
}

export enum AIProviderURL {
    Claude = "https://api.anthropic.com/v1/messages",
    Gemini = "https://generativelanguage.googleapis.com/v1beta/models",
    OpenAI = "https://api.openai.com/v1/responses",
    Mistral = "https://api.mistral.ai/v1/chat/completions"
}

export enum AIFileServiceURL {
    Claude = "https://api.anthropic.com/v1/files",
    Gemini = "https://generativelanguage.googleapis.com/v1beta",
    GeminiUpload = "https://generativelanguage.googleapis.com/upload/v1beta",
    OpenAI = "https://api.openai.com/v1/files",
    Mistral = "https://api.mistral.ai/v1/files",
}