import type { AIProvider } from "Enums/ApiProvider";
import { Exception } from "Helpers/Exception";
import { StringTools } from "Helpers/StringTools";

// A turn exactly as the provider sent it, so the same provider can be receive it back unchanged
export type ProviderContent = {
    provider: AIProvider;
    blocks: unknown[];
};

export function providerContentToConversationString(providerContent: ProviderContent): string {
    return JSON.stringify(providerContent);
}

export function parseProviderContent(providerContentJson: string): ProviderContent | undefined {
    if (!StringTools.isValidJson(providerContentJson)) {
        Exception.log(`Invalid JSON in providerContent field:\n${providerContentJson}`);
        return undefined;
    }
    try {
        const providerContent = JSON.parse(providerContentJson) as Partial<ProviderContent>;
        return typeof providerContent.provider === "string" && Array.isArray(providerContent.blocks)
            ? providerContent as ProviderContent
            : undefined;
    } catch (error) {
        Exception.log(error);
        return undefined;
    }
}
