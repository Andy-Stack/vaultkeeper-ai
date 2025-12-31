export enum ApiErrorType {
    RATE_LIMIT = "RATE_LIMIT",
    OVERLOADED = "OVERLOADED",
    SERVER_ERROR = "SERVER_ERROR",
    AUTH_ERROR = "AUTH_ERROR",
    BAD_REQUEST = "BAD_REQUEST",
    NETWORK_ERROR = "NETWORK_ERROR",
    UNKNOWN = "UNKNOWN"
}

export interface ApiErrorInfo {
    type: ApiErrorType;
    statusCode?: number;
    message: string;
    userMessage: string;
    isRetryable: boolean;
    responseHeaders?: Headers;
    responseBody?: string;
}

export class ApiError extends Error {
    constructor(public info: ApiErrorInfo) {
        super(info.message);
        this.name = "ApiError";
    }

    static isApiError(error: unknown): error is ApiError {
        return error instanceof ApiError;
    }

    static fromResponse(status: number, statusText: string, responseBody: string, headers?: Headers): ApiError {
        let type: ApiErrorType;
        let userMessage: string;
        let isRetryable: boolean;

        // Parse response body for provider-specific messages
        let providerMessage = "";
        try {
            const parsed = JSON.parse(responseBody) as { error?: { message?: string }; message?: string };
            providerMessage = parsed.error?.message || parsed.message || "";
        } catch {
            providerMessage = responseBody;
        }

        switch (status) {
            case 429:
                type = ApiErrorType.RATE_LIMIT;
                userMessage = "Rate limit exceeded.";
                isRetryable = true;
                break;
            case 503:
                type = ApiErrorType.OVERLOADED;
                userMessage = "Service overloaded.";
                isRetryable = true;
                break;
            case 500:
            case 502:
            case 504:
                type = ApiErrorType.SERVER_ERROR;
                userMessage = "Server error.";
                isRetryable = true;
                break;
            case 401:
            case 403:
                type = ApiErrorType.AUTH_ERROR;
                userMessage = "Authentication failed. Please check your API key in settings.";
                isRetryable = false;
                break;
            case 400:
                type = ApiErrorType.BAD_REQUEST;
                userMessage = providerMessage || "Invalid request.";
                isRetryable = false;
                break;
            default:
                type = ApiErrorType.UNKNOWN;
                userMessage = providerMessage || `Request failed with status ${status}`;
                isRetryable = false;
        }

        const message = `API request failed: ${status} - ${statusText} ${providerMessage ? `${providerMessage}` : ""}`;

        return new ApiError({
            type,
            statusCode: status,
            message,
            userMessage,
            isRetryable,
            responseHeaders: headers,
            responseBody: responseBody
        });
    }

    static fromNetworkError(error: Error): ApiError {
        return new ApiError({
            type: ApiErrorType.NETWORK_ERROR,
            message: `Network error: ${error.message}`,
            userMessage: "Network error. Please check your connection.",
            isRetryable: true
        });
    }
}
