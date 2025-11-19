export enum Selector {
    MarkDownLink = "vaultkeeper-ai-internal-markdown-link",
    AIExclusionsInput = "ai-exclusions-input",
    ApiKeySettingOk = "api-key-setting-ok",
    ApiKeySettingError = "api-key-setting-error",
    ConversationHistoryModal =  "conversation-history-modal",
    HelpModal = "help-modal",
    ContextSettingItemDescription = "context-setting-item-description",

    ApiRequestAborted = "api-request-aborted",
    APIRequestError = "api-request-error",

    ErrorSelector = "error-selector"
}

export function isErrorSelector(selector: Selector) {
    return selector === Selector.ApiRequestAborted || selector === Selector.APIRequestError;
}