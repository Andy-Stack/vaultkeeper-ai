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

export function isvalidProvider(value: string): value is AIProvider {
    return Object.values(AIProvider).includes(value as AIProvider);
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

export function modelMatchesProvider(model: AIProviderModel, provider: AIProvider): boolean {
    switch (provider) {
        case AIProvider.Claude:
            return isClaudeModel(model);
        case AIProvider.Gemini:
            return isGeminiModel(model);
        case AIProvider.OpenAI:
            return isOpenAIModel(model);
        case AIProvider.Mistral:
            return isMistralModel(model);
    }
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
    ClaudeOpus_4_8 = "claude-opus-4-8",
    ClaudeHaiku_4_5 = "claude-haiku-4-5-20251001",

    // Gemini models
    GeminiFlash_3_1_Lite = "gemini-3.1-flash-lite",
    GeminiFlash_3_Flash = "gemini-3-flash-preview",
    GeminiFlash_3_5_Flash = "gemini-3.5-flash",
    GeminiPro_3_1_Preview = "gemini-3.1-pro-preview",

    // OpenAI models
    GPT_5_5 = "gpt-5.5",
    GPT_5_4_Mini = "gpt-5.4-mini",
    GPT_5_4_Nano = "gpt-5.4-nano",

    // Mistral models
    MistralMedium = "mistral-medium-3-5",
    MistralSmall = "mistral-small-2603",

    // Conversation naming models (aliases to existing models)
    ClaudeNamer = ClaudeHaiku_4_5,
    GeminiNamer = GeminiFlash_3_1_Lite,
    OpenAINamer = GPT_5_4_Nano,
    MistralNamer = MistralSmall
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

export enum MistralAgentEndpoint {
    Url = "https://api.mistral.ai/v1/agents",
    ConversationsUrl = "https://api.mistral.ai/v1/conversations"
}

export const DEFAULT_QUICK_MODEL_BY_PROVIDER: Record<AIProvider, AIProviderModel> = {
    [AIProvider.Claude]:  AIProviderModel.ClaudeHaiku_4_5,
    [AIProvider.Gemini]:  AIProviderModel.GeminiFlash_3_1_Lite,
    [AIProvider.OpenAI]:  AIProviderModel.GPT_5_4_Nano,
    [AIProvider.Mistral]: AIProviderModel.MistralSmall,
}

export const DEFAULT_MODEL_BY_PROVIDER: Record<AIProvider, AIProviderModel> = {
    [AIProvider.Claude]:  AIProviderModel.ClaudeSonnet_4_6,
    [AIProvider.Gemini]:  AIProviderModel.GeminiFlash_3_5_Flash,
    [AIProvider.OpenAI]:  AIProviderModel.GPT_5_5,
    [AIProvider.Mistral]: AIProviderModel.MistralMedium,
}

export const DEFAULT_PLANNING_MODEL_BY_PROVIDER: Record<AIProvider, AIProviderModel> = {
    [AIProvider.Claude]:  AIProviderModel.ClaudeOpus_4_8,
    [AIProvider.Gemini]:  AIProviderModel.GeminiFlash_3_5_Flash,
    [AIProvider.OpenAI]:  AIProviderModel.GPT_5_5,
    [AIProvider.Mistral]: AIProviderModel.MistralMedium,
}