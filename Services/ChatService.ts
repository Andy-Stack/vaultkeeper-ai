import { Semaphore } from "Helpers/Semaphore";
import { Resolve } from "./DependencyService";
import { Services } from "./Services";
import type { ConversationFileSystemService } from "./ConversationFileSystemService";
import type { ConversationNamingService } from "./ConversationNamingService";
import { Conversation } from "Conversations/Conversation";
import { ConversationContent } from "Conversations/ConversationContent";
import { Role } from "Enums/Role";
import { Notice } from "obsidian";
import type { EventService } from "./EventService";
import { Event } from "Enums/Event";
import { AbortService } from "./AbortService";
import { Exception } from "Helpers/Exception";
import type { Attachment } from "Conversations/Attachment";
import { Reference } from "Conversations/Reference";
import type { WorkSpaceService } from "./WorkSpaceService";
import type { ExecutionPlan } from "Types/ExecutionPlan";
import type { MainAgent } from "./AIServices/MainAgent";
import type { ChatMode } from "Enums/ChatMode";

export interface IChatServiceCallbacks {
	onSubmit: () => void;
	onStreamingUpdate: (streamingMessageId: string | null) => void;
	onThoughtUpdate: (thought: string | null) => void;
	onToolCallStarted: (toolName: string) => void;
	onPlanningStarted: () => void;
	onPlanningFinished: () => void;
	onUserQuestion: (question: string) => Promise<string>;
	onPlanUpdate: (executionPlan: ExecutionPlan) => void;
	onPlanStepUpdate: (currentStepIndex: number) => void;
	onPlanReset: () => void;
	onComplete: () => void;
}

export class ChatService {

	private mainAgent: MainAgent;
	private conversationService: ConversationFileSystemService;
	private namingService: ConversationNamingService;
	private workSpaceService: WorkSpaceService;
	private eventService: EventService;
	private abortService: AbortService;

	private semaphore: Semaphore;
	private semaphoreHeld: boolean = false;

	constructor() {
		this.mainAgent = Resolve<MainAgent>(Services.MainAgent);
		this.conversationService = Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService);
		this.namingService = Resolve<ConversationNamingService>(Services.ConversationNamingService);
		this.workSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);
		this.eventService = Resolve<EventService>(Services.EventService);
		this.abortService = Resolve<AbortService>(Services.AbortService);
		this.semaphore = new Semaphore(1, false);

		this.mainAgent.setSaveCallback(async (conversation) => {
			await this.saveConversation(conversation);
		});
	}

	public onNameChanged: ((name: string) => void) | undefined = undefined;

	public async submit(conversation: Conversation, chatMode: ChatMode, userRequest: string, formattedRequest: string, attachments: Attachment[], callbacks: IChatServiceCallbacks) {
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
				
				await this.saveConversation(conversation);
				callbacks.onStreamingUpdate(conversationContent.timestamp.getTime().toString());

				let namingPromise: Promise<void> | undefined;
				if (firstMessage) {
					this.onNameChanged?.(conversation.title); // on change for initial conversation name
					namingPromise = this.namingService.requestName(conversation, formattedRequest, this.onNameChanged);
				}

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

				await this.mainAgent.runMainAgent(conversation, chatMode, callbacks);

				if (namingPromise) {
					const timeout = new Promise<void>(resolve => activeWindow.setTimeout(resolve, 5000));
					await Promise.race([namingPromise, timeout]);
				}
			});
		} catch (error) {
			if (!AbortService.isAbortError(error)) {
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

	private requestWithContext(request: string) {
		const activeFile = this.workSpaceService.getActiveFile();
		return activeFile ? `${request}\nUser current active file: "${activeFile.path}"` : request;
	}

	private async saveConversation(conversation: Conversation) {
		const result = await this.conversationService.saveConversation(conversation);
		if (result instanceof Error) {
			new Notice(`Failed to save conversation data for '${conversation.title}'`);
		}
	}
}
