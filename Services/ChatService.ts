import { Semaphore } from "Helpers/Semaphore";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { IAIClass } from "AIClasses/IAIClass";
import type { ConversationFileSystemService } from "./ConversationFileSystemService";
import type { AIFunctionService } from "./AIFunctionService";
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
	private abortController: AbortController | null = null;
	private semaphore: Semaphore;

	constructor() {
		this.conversationService = Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService);
		this.aiFunctionService = Resolve<AIFunctionService>(Services.AIFunctionService);
		this.semaphore = new Semaphore(1, false);
	}

	resolveAIProvider() {
		this.ai = Resolve<IAIClass>(Services.IAIClass);
	}

	async submit(conversation: Conversation, userRequest: string, callbacks: ChatServiceCallbacks): Promise<Conversation> {
		if (!await this.semaphore.wait()) {
			return conversation;
		}

		try {
			if (userRequest.trim() === "") {
				return conversation;
			}

			this.abortController = new AbortController();

			// Add user message to conversation
			conversation.contents = [...conversation.contents, new ConversationContent(Role.User, userRequest)];
			await this.conversationService.saveConversation(conversation);

			// Process AI responses and function calls
			let response = await this.streamRequestResponse(conversation, callbacks);
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

				response = await this.streamRequestResponse(conversation, callbacks);
			}

			return conversation;
		} finally {
			callbacks.onThoughtUpdate(null);
			this.abortController = null;
			this.semaphore.release();
			callbacks.onComplete();
		}
	}

	stop(): void {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
		this.semaphore.release();
	}

	private async streamRequestResponse(
		conversation: Conversation, callbacks: ChatServiceCallbacks
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

		for await (const chunk of this.ai.streamRequest(conversation, this.abortController?.signal)) {
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
