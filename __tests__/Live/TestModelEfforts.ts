/**
 * Sends a real request for every model/effort pair in EFFORT_BY_MODEL and reports any failures.
 * Fill in the keys below (do not commit them), then run: npm run test:efforts
 * Providers with a blank key are skipped.
**/

import { AIProvider, AIProviderModel, AIProviderURL, fromModel } from "Enums/ApiProvider";
import { AIEffort, EFFORT_BY_MODEL } from "Enums/AIEffort";

const CLAUDE_API_KEY = "";
const GEMINI_API_KEY = "";
const OPENAI_API_KEY = "";
const MISTRAL_API_KEY = "";

const PROMPT = "Reply with the single word: ok";

interface ProviderRequest {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
}

const API_KEY_BY_PROVIDER: Partial<Record<AIProvider, string>> = {
    [AIProvider.Claude]: CLAUDE_API_KEY,
    [AIProvider.Gemini]: GEMINI_API_KEY,
    [AIProvider.OpenAI]: OPENAI_API_KEY,
    [AIProvider.Mistral]: MISTRAL_API_KEY
};

function buildRequest(provider: AIProvider, model: AIProviderModel, effort: string, apiKey: string): ProviderRequest {
    switch (provider) {
        case AIProvider.Claude:
            return {
                url: AIProviderURL.Claude,
                headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
                body: {
                    model,
                    max_tokens: 2048,
                    messages: [{ role: "user", content: PROMPT }],
                    output_config: { effort }
                }
            };
        case AIProvider.Gemini:
            return {
                url: `${AIProviderURL.Gemini}/${model}:generateContent?key=${apiKey}`,
                headers: {},
                body: {
                    contents: [{ role: "user", parts: [{ text: PROMPT }] }],
                    generationConfig: { thinkingConfig: { thinkingLevel: effort } }
                }
            };
        case AIProvider.OpenAI:
            return {
                url: AIProviderURL.OpenAI,
                headers: { "Authorization": `Bearer ${apiKey}` },
                body: { model, input: PROMPT, reasoning: { effort } }
            };
        case AIProvider.Mistral:
            return {
                url: AIProviderURL.Mistral,
                headers: { "Authorization": `Bearer ${apiKey}` },
                body: {
                    model,
                    messages: [{ role: "user", content: PROMPT }],
                    reasoning_effort: effort
                }
            };
        case AIProvider.Local:
            throw new Error("Local models are not tested");
    }
}

async function testModelEffort(model: AIProviderModel, effortLevel: AIEffort, effort: string): Promise<boolean> {
    const provider = fromModel(model);
    const label = `${model} [${effortLevel} → ${effort}]`;
    const apiKey = API_KEY_BY_PROVIDER[provider];
    if (!apiKey) {
        console.log(`SKIP  ${label} (no ${provider} key)`);
        return true;
    }

    const request = buildRequest(provider, model, effort, apiKey);
    const startTime = Date.now();
    try {
        const response = await fetch(request.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...request.headers },
            body: JSON.stringify(request.body)
        });
        const seconds = ((Date.now() - startTime) / 1000).toFixed(1);
        if (!response.ok) {
            console.log(`FAIL  ${label} ${response.status} (${seconds}s)\n      ${await response.text()}`);
            return false;
        }
        console.log(`PASS  ${label} (${seconds}s)`);
        return true;
    } catch (error) {
        console.log(`FAIL  ${label}\n      ${String(error)}`);
        return false;
    }
}

const tests = Object.entries(EFFORT_BY_MODEL).flatMap(([model, efforts]) =>
    Object.entries(efforts).map(([effortLevel, effort]) =>
        testModelEffort(model as AIProviderModel, effortLevel as AIEffort, effort)
    )
);

const results = await Promise.all(tests);
const failureCount = results.filter(passed => !passed).length;
console.log(`\n${results.length - failureCount}/${results.length} passed`);
process.exit(failureCount > 0 ? 1 : 0);
