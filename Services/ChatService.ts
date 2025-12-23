import { Semaphore } from "Helpers/Semaphore";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { IAIClass } from "AIClasses/IAIClass";
import type { ConversationFileSystemService } from "./ConversationFileSystemService";
import type { AIFunctionService } from "./AIFunctionService";
import type { ConversationNamingService } from "./ConversationNamingService";
import { Conversation } from "Conversations/Conversation";
import { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import type { AIFunctionCall } from "AIClasses/AIFunctionCall";
import { Notice } from "obsidian";
import type { EventService } from "./EventService";
import { Event } from "Enums/Event";
import { AbortService } from "./AbortService";
import { Exception } from "Helpers/Exception";
import { Copy } from "Enums/Copy";
import type { Attachment } from "Conversations/Attachment";
import { Reference } from "Conversations/Reference";
import type { WorkSpaceService } from "./WorkSpaceService";

export interface IChatServiceCallbacks {
	onSubmit: () => void;
	onStreamingUpdate: (streamingMessageId: string | null) => void;
	onThoughtUpdate: (thought: string | null) => void;
	onComplete: () => void;
	onCancel: () => void;
}

export class ChatService {
	private ai: IAIClass | undefined;
	private conversationService: ConversationFileSystemService;
	private aiFunctionService: AIFunctionService;
	private namingService: ConversationNamingService;
	private workSpaceService: WorkSpaceService;
	private eventService: EventService;
	private abortService: AbortService;

	private semaphore: Semaphore;
	private semaphoreHeld: boolean = false;

	constructor() {
		this.conversationService = Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService);
		this.aiFunctionService = Resolve<AIFunctionService>(Services.AIFunctionService);
		this.namingService = Resolve<ConversationNamingService>(Services.ConversationNamingService);
		this.workSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);
		this.eventService = Resolve<EventService>(Services.EventService);
		this.abortService = Resolve<AbortService>(Services.AbortService);
		this.semaphore = new Semaphore(1, false);
	}

	public onNameChanged: ((name: string) => void) | undefined = undefined;

	public resolveAIProvider() {
		this.ai = Resolve<IAIClass>(Services.IAIClass);
	}

	public async submit(conversation: Conversation, allowDestructiveActions: boolean, userRequest: string, formattedRequest: string, attachments: Attachment[], callbacks: IChatServiceCallbacks) {
		if (!await this.semaphore.wait()) {
			return;
		}

		this.semaphoreHeld = true;

		try {
			if (userRequest.trim() === "") {
				return;
			}

			this.abortService.initialiseAbortController();

			await this.abortService.abortableOperation(async () => {
				const firstMessage = conversation.contents.length === 0;

				const conversationContent = new ConversationContent({
					role: Role.User,
					content: this.requestWithContext(formattedRequest),
					displayContent: userRequest
				});
				conversation.contents.push(conversationContent);

				if (attachments.length > 0) {
					// Add any attachments that came from paste / drop
					conversation.contents.push(new ConversationContent({
						role: Role.User,
						attachments: attachments,
						shouldDisplayContent: false
					}));

					conversationContent.references = attachments.map(attachment => 
						new Reference(attachment.fileName, attachment.approximateFileSizeMB()));
				}
				await this.saveConversation(conversation);

				callbacks.onSubmit();
				callbacks.onStreamingUpdate(null);

				if (firstMessage) {
					this.onNameChanged?.(conversation.title); // on change for initial conversation name
					await this.namingService.requestName(conversation, formattedRequest, this.onNameChanged);
				}

				// Process AI responses and function calls
				let response = await this.streamRequestResponse(this.ensureCorrectConversationStructure(conversation), allowDestructiveActions, callbacks);
				while (response.functionCall || response.shouldContinue) {
					if (response.functionCall) {
						const userMessage = response.functionCall.arguments.user_message;
						if (userMessage && typeof userMessage === "string") {
							callbacks.onThoughtUpdate(userMessage);
						}

						const functionResponse = await this.aiFunctionService.performAIFunction(response.functionCall);
						conversation.addFunctionResponse(functionResponse);
					} else {
						callbacks.onThoughtUpdate(Copy.AIThoughtMessage);
					}

					response = await this.streamRequestResponse(this.ensureCorrectConversationStructure(conversation), allowDestructiveActions, callbacks);
				}
			});
		} catch (error) {
			if (AbortService.isAbortError(error)) {
				callbacks.onCancel();
			} else {
				Exception.log(error);
				new Notice("Vaultkeeper AI encountered an error");
			}
		} finally {
			this.eventService.trigger(Event.DiffClosed);
			await this.saveConversation(conversation);
			if (this.semaphoreHeld) {
				this.semaphoreHeld = false;
				this.semaphore.release();	
			}
			callbacks.onThoughtUpdate(null);
			callbacks.onComplete();
		}
	}

	public stop() {
		this.abortService.abort("User requested cancellation");
		this.eventService.trigger(Event.DiffClosed);
	}

	private async saveConversation(conversation: Conversation) {
		const result = await this.conversationService.saveConversation(conversation);
		if (result instanceof Error) {
			new Notice(`Failed to save conversation data for '${conversation.title}'`);
		}
	}

	private ensureCorrectConversationStructure(conversation: Conversation): Conversation {
		// Check if the last message is from the assistant to prevent assistant-to-assistant structure
		// This can happen when the assistant's last message had no function call and the user sends a new request
		if (conversation.contents.length > 0) {
			const lastMessage = conversation.contents[conversation.contents.length - 1];
			if (lastMessage.role === Role.Assistant) {
				// Insert a hidden "Continue" message to maintain proper conversation structure
				conversation.contents.push(ConversationContent.safeContinue());
			}
		}
		return conversation;
	}

	private async streamRequestResponse(
		conversation: Conversation, allowDestructiveActions: boolean, callbacks: IChatServiceCallbacks
	): Promise<{ functionCall: AIFunctionCall | null, shouldContinue: boolean }> {
		if (!this.ai) { // this should never happen
			return { functionCall: null, shouldContinue: false };;
		}

		const conversationContent = new ConversationContent({ role: Role.Assistant });
		conversation.contents.push(conversationContent);

		let accumulatedContent = "";
		let capturedFunctionCall: AIFunctionCall | null = null;
		let capturedShouldContinue = false;

		for await (const chunk of this.ai.streamRequest(conversation, allowDestructiveActions)) {
			if (chunk.error && chunk.errorType) {
				conversationContent.content = chunk.error;
				conversationContent.errorType = chunk.errorType;
				callbacks.onStreamingUpdate(null);
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

				conversationContent.content = accumulatedContent;
				if (accumulatedContent.trim() !== "") {
					callbacks.onThoughtUpdate(null);
				}
			}

			if (chunk.isComplete) {
				const sanitizedContent = this.sanitizeFunctionCallContent(accumulatedContent, capturedFunctionCall);

				if (sanitizedContent.trim() === "" && !capturedFunctionCall) {
					conversation.contents.pop();
				} else {
					conversationContent.content = sanitizedContent;
					if (capturedFunctionCall) {
						conversationContent.functionCall = capturedFunctionCall.toConversationString();
						if (capturedFunctionCall.thoughtSignature) {
							conversationContent.thoughtSignature = capturedFunctionCall.thoughtSignature;
						}
					}
				}
			}

			if (conversationContent.content?.trim() !== "") {
				callbacks.onStreamingUpdate(conversationContent.timestamp.getTime().toString());
			}
		}

		callbacks.onStreamingUpdate(null);

		return { functionCall: capturedFunctionCall, shouldContinue: capturedShouldContinue };
	}

	// handle the rare event where a function call is also included in content (gemini sometimes does this)
	private sanitizeFunctionCallContent(content: string, functionCall: AIFunctionCall | null): string {
		// Early returns for simple cases
		if (!functionCall || !content.trim()) {
			return content;
		}
	
		// If content has no JSON-like characters, return as-is
		if (!content.includes('{') || !content.includes('}')) {
			return content;
		}
	
		const functionCallString = functionCall.toConversationString();
		let sanitized = content;
	
		// Step 1: Remove markdown code blocks that might contain the function call
		// Pattern matches ```json\n...\n``` or ```\n...\n```
		sanitized = sanitized.replace(/```(?:json)?\s*\n?([\s\S]*?)\n?```/g, (match: string, codeContent: string) => {
			// If the code block contains our function call, remove it entirely
			if (codeContent.trim() === functionCallString.trim()) {
				return '';
			}
			// Otherwise keep the code block
			return match;
		});
	
		// Step 2: Remove exact JSON match (handles compact JSON)
		sanitized = sanitized.replace(functionCallString, '').trim();
	
		// Step 3: Handle pretty-printed variations by normalizing both strings
		try {
			const functionCallObj: unknown = JSON.parse(functionCallString);
			const normalizedTarget = JSON.stringify(functionCallObj);
			
			// Find and remove any JSON that matches when normalized
			// This regex finds JSON objects/arrays in the text
			const jsonPattern = /\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}|\[(?:[^[\]]|(?:\[(?:[^[\]]|(?:\[[^[\]]*\]))*\]))*\]/g;
			
			sanitized = sanitized.replace(jsonPattern, (match) => {
				try {
					const parsedMatch: unknown = JSON.parse(match);
					const normalizedMatch = JSON.stringify(parsedMatch);
					// Remove if it matches our function call when normalized
					return normalizedMatch === normalizedTarget ? '' : match;
				} catch {
					// If it's not valid JSON, keep it
					return match;
				}
			});
		} catch {
			// If function call string isn't valid JSON, we've done what we can
		}
	
		// Step 4: Clean up multiple consecutive whitespace/newlines left by removals
		sanitized = sanitized.replace(/\n{3,}/g, '\n\n').trim();
	
		return sanitized;
	}

	private requestWithContext(request: string) {
		const activeFile = this.workSpaceService.getActiveFile();
		return activeFile ? `${request}\nUser current active file: "${activeFile.path}"` : request;
	}
}
