import { Semaphore } from "Helpers/Semaphore";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { IAIClass } from "AIClasses/IAIClass";
import type { ConversationFileSystemService } from "./ConversationFileSystemService";
import type { AIFunctionService } from "./AIFunctionService";
import type { ConversationNamingService } from "./ConversationNamingService";
import type { ITokenService } from "AIClasses/ITokenService";
import type { IPrompt } from "AIClasses/IPrompt";
import type { StatusBarService } from "./StatusBarService";
import { Conversation } from "Conversations/Conversation";
import { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import type { AIFunctionCall } from "AIClasses/AIFunctionCall";

export interface ChatServiceCallbacks {
	onStreamingUpdate: (conversation: Conversation, streamingMessageId: string | null, isStreaming: boolean) => void;
	onThoughtUpdate: (thought: string | null) => void;
	onComplete: () => void;
}

export class ChatService {
	private ai: IAIClass | undefined;
	private conversationService: ConversationFileSystemService;
	private aiFunctionService: AIFunctionService;
	private namingService: ConversationNamingService;
	private tokenService: ITokenService | undefined;
	private prompt: IPrompt;
	private statusBarService: StatusBarService;

	private semaphore: Semaphore;
	private semaphoreHeld: boolean = false;
	private abortController: AbortController | null = null;

	constructor() {
		this.conversationService = Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService);
		this.aiFunctionService = Resolve<AIFunctionService>(Services.AIFunctionService);
		this.namingService = Resolve<ConversationNamingService>(Services.ConversationNamingService);
		this.prompt = Resolve<IPrompt>(Services.IPrompt);
		this.statusBarService = Resolve<StatusBarService>(Services.StatusBarService);
		this.semaphore = new Semaphore(1, false);
	}

	public onNameChanged: ((name: string) => void) | undefined = undefined;

	public resolveAIProvider() {
		this.ai = Resolve<IAIClass>(Services.IAIClass);
		this.tokenService = Resolve<ITokenService>(Services.ITokenService);
	}

	public async submit(conversation: Conversation, allowDestructiveActions: boolean, userRequest: string, callbacks: ChatServiceCallbacks): Promise<Conversation> {
		if (!await this.semaphore.wait()) {
			return conversation;
		}

		this.semaphoreHeld = true;

		try {
			if (userRequest.trim() === "") {
				return conversation;
			}

			this.abortController = new AbortController();

			// Add user message to conversation
			conversation.contents = [...conversation.contents, new ConversationContent(Role.User, userRequest)];
			await this.conversationService.saveConversation(conversation);

			if (conversation.contents.length === 1) {
				this.onNameChanged?.(conversation.title); // on change for initial conversation name
				this.namingService.requestName(conversation, userRequest, this.onNameChanged, this.abortController);
			}

			// Process AI responses and function calls
			let response = await this.streamRequestResponse(conversation, allowDestructiveActions, callbacks);
			while (response.functionCall || response.shouldContinue) {

				if (response.functionCall) {
					if ('user_message' in response.functionCall.arguments) {
						callbacks.onThoughtUpdate(response.functionCall.arguments.user_message);
					}

					conversation.contents = [...conversation.contents, new ConversationContent(
						Role.Assistant, response.functionCall.toConversationString(), new Date(), true)];
					await this.conversationService.saveConversation(conversation);

					const functionResponse = await this.aiFunctionService.performAIFunction(response.functionCall);
					conversation.contents = [...conversation.contents, new ConversationContent(
						Role.User, functionResponse.toConversationString(), new Date(), false, true)];
					await this.conversationService.saveConversation(conversation);
				}

				response = await this.streamRequestResponse(conversation, allowDestructiveActions, callbacks);
			}

			return conversation;
		} finally {
			callbacks.onThoughtUpdate(null);
			this.abortController = null;
			if (this.semaphoreHeld) {
				this.semaphoreHeld = false;
				this.semaphore.release();	
			}
			callbacks.onComplete();
		}
	}

	public stop(): void {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
		this.semaphore.release();
	}

	public async updateTokenDisplay(conversation: Conversation): Promise<void> {
		if (this.tokenService === undefined) {
			return;
		}

		const systemInstruction = this.prompt.systemInstruction();
		const userInstruction = await this.prompt.userInstruction();

		const inputMessages = conversation.contents
			.filter(msg => msg.role === Role.User && !msg.isFunctionCallResponse)
			.map(msg => msg.content)
			.join("\n");

		const outputMessages = conversation.contents
			.filter(msg => msg.role === Role.Assistant && !msg.isFunctionCall)
			.map(msg => msg.content)
			.join("\n");

		const inputText = systemInstruction + "\n" + userInstruction + "\n" + inputMessages;
		const inputTokens = await this.tokenService.countTokens(inputText);
		const outputTokens = await this.tokenService.countTokens(outputMessages);

		this.setStatusBarTokens(inputTokens, outputTokens);
	}

	public setStatusBarTokens(inputTokens: number, outputTokens: number): void {
		this.statusBarService.setStatusBarMessage(`Input Tokens: ${inputTokens} / Output Tokens: ${outputTokens}`);
	}

	private async streamRequestResponse(
		conversation: Conversation, allowDestructiveActions: boolean, callbacks: ChatServiceCallbacks
	): Promise<{ functionCall: AIFunctionCall | null, shouldContinue: boolean }> {
		// this should never happen
		if (!this.ai) {
			return { functionCall: null, shouldContinue: false };;
		}

		// Create AI message with stable ID
		const aiMessage = new ConversationContent(Role.Assistant, "");
		conversation.contents = [...conversation.contents, aiMessage];

		// Notify that streaming has started
		callbacks.onStreamingUpdate(conversation, aiMessage.id, true);

		let accumulatedContent = "";
		let capturedFunctionCall: AIFunctionCall | null = null;
		let capturedShouldContinue = false;

		for await (const chunk of this.ai.streamRequest(conversation, allowDestructiveActions, this.abortController?.signal)) {
			if (chunk.error) {
				console.error("Streaming error:", chunk.error);
				conversation.contents = conversation.contents.map((msg) =>
					msg.id === aiMessage.id
						? { ...msg, content: "Error: " + chunk.error }
						: msg
				);
				callbacks.onStreamingUpdate(conversation, null, false);
				await this.conversationService.saveConversation(conversation);
				break;
			}

			if (chunk.content) {
				callbacks.onThoughtUpdate(null);
				accumulatedContent += chunk.content;
				conversation.contents = conversation.contents.map((msg) =>
					msg.id === aiMessage.id
						? { ...msg, content: accumulatedContent }
						: msg
				);
				callbacks.onStreamingUpdate(conversation, aiMessage.id, true);
			}

			if (chunk.functionCall) {
				capturedFunctionCall = chunk.functionCall;
			}

			if (chunk.shouldContinue) {
				capturedShouldContinue = true;
			}

			if (chunk.isComplete) {
				callbacks.onStreamingUpdate(conversation, null, false);

				if (accumulatedContent.trim() !== "") {
					// We have content - always keep the message
					conversation.contents = conversation.contents.map((msg) =>
						msg.id === aiMessage.id
							? { ...msg, content: accumulatedContent }
							: msg
					);
				} else if (capturedFunctionCall) {
					// No content but there's a function call - remove the empty placeholder
					conversation.contents = conversation.contents.filter((msg) => msg.id !== aiMessage.id);
				} else {
					// No content and no function call - remove empty message
					conversation.contents = conversation.contents.filter((msg) => msg.id !== aiMessage.id);
				}
				await this.conversationService.saveConversation(conversation);
			}
		}

		return { functionCall: capturedFunctionCall, shouldContinue: capturedShouldContinue };
	}
}
