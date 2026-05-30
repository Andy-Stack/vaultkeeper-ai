import { Resolve } from "Services/DependencyService";
import { Services } from "Services/Services";
import type { SettingsService } from "Services/SettingsService";
import { AIProvider, AIProviderModel, MistralAgentEndpoint } from "Enums/ApiProvider";
import { Exception } from "Helpers/Exception";
import type {
    MistralAgentCreateRequest,
    MistralAgentCreateResponse,
    MistralAgentListResponse,
    MistralConversationRequest,
    MistralConversationResponse
} from "./MistralTypes";

/**
 * Performs a one-shot web search using the Mistral Agents API.
 * Creates and caches a search agent on first use, then reuses it for subsequent calls.
 */
export class MistralAgent {

    private readonly apiKey: string;
    private agentId: string | undefined;

    public constructor() {
        const settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.apiKey = settingsService.getApiKeyForProvider(AIProvider.Mistral);
    }

    public async search(query: string): Promise<string> {
        if (!this.agentId) {
            this.agentId = await this.getOrCreateAgent();
        }

        return await this.complete(this.agentId, query);
    }

    private async getOrCreateAgent(): Promise<string> {
        const listResponse = await fetch(MistralAgentEndpoint.Url, {
            headers: { "Authorization": `Bearer ${this.apiKey}` }
        });

        if (listResponse.ok) {
            const list = await listResponse.json() as MistralAgentListResponse;
            const existing = list.find(agent => agent.name === "VaultKeeper Web Search");
            if (existing) {
                return existing.id;
            }
        }

        return await this.createAgent();
    }

    private async createAgent(): Promise<string> {
        const requestBody: MistralAgentCreateRequest = {
            model: AIProviderModel.MistralSmall,
            name: "VaultKeeper Web Search",
            instructions: "You are a web search assistant. **Always** search the web to look up current information before responding and never answer from memory alone.",
            tools: [{ type: "web_search" }]
        };

        const response = await fetch(MistralAgentEndpoint.Url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            Exception.throw(`Mistral create agent failed: ${response.status} ${response.statusText} - ${await response.text()}`);
        }

        const data = await response.json() as MistralAgentCreateResponse;
        return data.id;
    }

    private async complete(agentId: string, query: string): Promise<string> {
        const requestBody: MistralConversationRequest = {
            agent_id: agentId,
            inputs: query,
            stream: false
        };

        const response = await fetch(MistralAgentEndpoint.ConversationsUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = `Mistral agent completion failed: ${response.status} ${response.statusText} - ${await response.text()}`;
            Exception.log(error);
            return error;
        }

        const data = await response.json() as MistralConversationResponse;
        const messageOutput = data.outputs?.find(output => output.type === "message.output");
        const content = messageOutput?.content;
        const textOutput = Array.isArray(content)
            ? content.filter(content => content.type === "text").map(content => content.text ?? "").join()
            : typeof content === "string" ? content : undefined;

        if (!textOutput) {
            const error = "Mistral web agent returned no content";
            Exception.log(error);
            return error;
        }

        return textOutput;
    }
}