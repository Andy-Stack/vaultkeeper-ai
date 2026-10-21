import { AIProviderModel } from "Enums/ApiProvider";

export enum AIEffort {
    Fast = "fast",
    Thinking = "thinking"
}

export function isValidEffort(value: string): value is AIEffort {
    return Object.values(AIEffort).includes(value as AIEffort);
}

export function iconForEffort(effort: AIEffort) {
    switch (effort) {
        case AIEffort.Fast:
            return "zap";
        case AIEffort.Thinking:
            return "brain";
    }
}

// Fast is each model's lowest accepted level, Thinking its middle one (Mistral has no middle level).
// Opted not to include 'high' or 'max' as they are painfully slow which feels unhelpful for a vault plugin.
export const EFFORT_BY_MODEL: Partial<Record<AIProviderModel, Record<AIEffort, string>>> = {
    [AIProviderModel.ClaudeFable_5_1]:       { [AIEffort.Fast]: "low",     [AIEffort.Thinking]: "medium" },
    [AIProviderModel.ClaudeSonnet_5_5]:      { [AIEffort.Fast]: "low",     [AIEffort.Thinking]: "medium" },
    [AIProviderModel.ClaudeOpus_5_5]:        { [AIEffort.Fast]: "low",     [AIEffort.Thinking]: "medium" },
    [AIProviderModel.ClaudeHaiku_5_5]:       { [AIEffort.Fast]: "low",     [AIEffort.Thinking]: "medium" },

    [AIProviderModel.GeminiFlash_3_5_Lite]:  { [AIEffort.Fast]: "minimal", [AIEffort.Thinking]: "medium" },
    [AIProviderModel.GeminiFlash_3_8_Flash]: { [AIEffort.Fast]: "low",     [AIEffort.Thinking]: "medium" },
    [AIProviderModel.GeminiPro_3_1_Preview]: { [AIEffort.Fast]: "low",     [AIEffort.Thinking]: "medium" },
    [AIProviderModel.GeminiArgon_4]:         { [AIEffort.Fast]: "low",     [AIEffort.Thinking]: "medium" },

    [AIProviderModel.GPT_6_1_Sol]:           { [AIEffort.Fast]: "low",     [AIEffort.Thinking]: "medium" },
    [AIProviderModel.GPT_6_Luna]:            { [AIEffort.Fast]: "none",    [AIEffort.Thinking]: "medium" },
    [AIProviderModel.GPT_6_Astra]:           { [AIEffort.Fast]: "low",     [AIEffort.Thinking]: "medium" },

    [AIProviderModel.MistralLarge]:          { [AIEffort.Fast]: "none",    [AIEffort.Thinking]: "high" },
    [AIProviderModel.MistralMedium]:         { [AIEffort.Fast]: "none",    [AIEffort.Thinking]: "high" },
    [AIProviderModel.MistralSmall]:          { [AIEffort.Fast]: "none",    [AIEffort.Thinking]: "high" }
};
