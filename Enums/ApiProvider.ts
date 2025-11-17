import { Exception } from "Helpers/Exception";

export enum AIProvider {
    Claude = "Claude",
    Gemini = "Gemini",
    OpenAI = "OpenAI"
}

export function fromModel(model: string): AIProvider {
    if (model.startsWith("claude-")) {
        return AIProvider.Claude;
    } else if (model.startsWith("gemini-")) {
        return AIProvider.Gemini;
    } else if (model.startsWith("gpt-")) {
        return AIProvider.OpenAI;
    } else {
        Exception.throw("Invalid Model Selection!");
    }
}

export enum AIProviderModel {
    // Claude models
    ClaudeSonnet_4_5 = "claude-sonnet-4-5-20250929",
    ClaudeSonnet_4 = "claude-sonnet-4-20250514",
    ClaudeSonnet_3_7 = "claude-3-7-sonnet-20250219",
    ClaudeOpus_4_1 = "claude-opus-4-1-20250805",
    ClaudeOpus_4 = "claude-opus-4-20250514",
    ClaudeHaiku_4_5 = "claude-haiku-4-5-20251001",

    // Gemini models
    GeminiFlash_2_5_Lite = "gemini-2.5-flash-lite",
    GeminiFlash_2_5 = "gemini-2.5-flash",
    GeminiPro_2_5 = "gemini-2.5-pro",

    // OpenAI models
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
    OpenAINamer = GPT_4o_Mini,
}

export enum AIProviderURL {
    Claude = "https://api.anthropic.com/v1/messages",
    Gemini = "https://generativelanguage.googleapis.com/v1beta/models",
    OpenAI = "https://api.openai.com/v1/responses"
}