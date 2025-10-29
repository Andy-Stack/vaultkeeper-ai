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

export interface IChatServiceCallbacks {
	onSubmit: () => void;
	onStreamingUpdate: (streamingMessageId: string | null) => void;
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

	public async submit(conversation: Conversation, allowDestructiveActions: boolean, userRequest: string, formattedRequest: string, callbacks: IChatServiceCallbacks): Promise<void> {
		if (!await this.semaphore.wait()) {
			return;
		}

		this.semaphoreHeld = true;

		try {
			if (userRequest.trim() === "") {
				return;
			}

			this.abortController = new AbortController();

			conversation.contents.push(new ConversationContent(Role.User, userRequest));
			this.conversationService.saveConversation(conversation);

			callbacks.onSubmit();
			callbacks.onStreamingUpdate(null);

			if (conversation.contents.length === 1) {
				this.onNameChanged?.(conversation.title); // on change for initial conversation name
				this.namingService.requestName(conversation, userRequest, this.onNameChanged, this.abortController);
			}

			// Process AI responses and function calls
			let response = await this.streamRequestResponse(conversation, allowDestructiveActions, callbacks);
			while (response.functionCall || response.shouldContinue) {
				if (response.functionCall) {
					if (response.functionCall.arguments.user_message) {
						callbacks.onThoughtUpdate(response.functionCall.arguments.user_message);
					}

					const functionResponse = await this.aiFunctionService.performAIFunction(response.functionCall);

					conversation.contents.push(new ConversationContent(
						Role.User, functionResponse.toConversationString(), "", "", new Date(), false, true, functionResponse.toolId
					));
				}

				response = await this.streamRequestResponse(conversation, allowDestructiveActions, callbacks);
			}
		} finally {
			this.conversationService.saveConversation(conversation);
			this.abortController = null;
			if (this.semaphoreHeld) {
				this.semaphoreHeld = false;
				this.semaphore.release();	
			}
			callbacks.onThoughtUpdate(null);
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
			.filter(message => message.role === Role.User && !message.isFunctionCallResponse)
			.map(message => message.content)
			.join("\n");

		const outputMessages = conversation.contents
			.filter(message => message.role === Role.Assistant && !message.isFunctionCall)
			.map(message => message.content)
			.join("\n");

		const inputText = systemInstruction + "\n" + userInstruction + "\n" + inputMessages;
		const inputTokens = await this.tokenService.countTokens(inputText);
		const outputTokens = await this.tokenService.countTokens(outputMessages);

		this.setStatusBarTokens(inputTokens, outputTokens);
	}

	public setStatusBarTokens(inputTokens: number, outputTokens: number): void {
		this.statusBarService.animateTokens(inputTokens, outputTokens);
	}

	private async streamRequestResponse(
		conversation: Conversation, allowDestructiveActions: boolean, callbacks: IChatServiceCallbacks
	): Promise<{ functionCall: AIFunctionCall | null, shouldContinue: boolean }> {
		// this should never happen
		if (!this.ai) {
			return { functionCall: null, shouldContinue: false };;
		}

		const aiMessage = new ConversationContent(Role.Assistant);
		conversation.contents.push(aiMessage);
		callbacks.onStreamingUpdate(aiMessage.timestamp.getTime().toString());

		let accumulatedContent = "";
		let capturedFunctionCall: AIFunctionCall | null = null;
		let capturedShouldContinue = false;

		for await (const chunk of this.ai.streamRequest(conversation, allowDestructiveActions, this.abortController?.signal)) {
			if (chunk.error) {
				console.error("Streaming error:", chunk.error);
				conversation.setMostRecentContent(`Error: ${chunk.error}`);
				callbacks.onStreamingUpdate(aiMessage.timestamp.getTime().toString());
				break;
			}

			if (chunk.functionCall) {
				capturedFunctionCall = chunk.functionCall;
			}

			if (chunk.shouldContinue) {
				capturedShouldContinue = true;
			}

			if (chunk.content) {
				accumulatedContent += chunk.content;
				conversation.setMostRecentContent(accumulatedContent);
				callbacks.onThoughtUpdate(null);
			}

			if (chunk.isComplete) {
				// No content and no function call - remove empty message
				if (accumulatedContent.trim() == "" && !capturedFunctionCall) {
					conversation.contents.pop();
				}

				conversation.setMostRecentContent(accumulatedContent);
				if (capturedFunctionCall) {
					conversation.setMostRecentFunctionCall(capturedFunctionCall?.toConversationString());
				}
			}
			callbacks.onStreamingUpdate(aiMessage.timestamp.getTime().toString());
		}

		callbacks.onStreamingUpdate(null);

		return { functionCall: capturedFunctionCall, shouldContinue: capturedShouldContinue };
	}
}
