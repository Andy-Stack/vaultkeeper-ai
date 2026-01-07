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
import type { AIControllerService } from "./AIControllerService";
import type { ExecutionPlan } from "Types/ExecutionPlan";

export interface IChatServiceCallbacks {
	onSubmit: () => void;
	onStreamingUpdate: (streamingMessageId: string | null) => void;
	onThoughtUpdate: (thought: string | null) => void;
	onPlanningStarted: () => void;
	onPlanningFinished: () => void;
	onUserQuestion: (question: string) => Promise<string>;
	onPlanUpdate: (executionPlan: ExecutionPlan) => void;
	onPlanStepUpdate: () => void;
	onPlanReset: () => void;
	onComplete: () => void;
}

export class ChatService {

	private aiControllerService: AIControllerService;
	private conversationService: ConversationFileSystemService;
	private namingService: ConversationNamingService;
	private workSpaceService: WorkSpaceService;
	private eventService: EventService;
	private abortService: AbortService;

	private semaphore: Semaphore;
	private semaphoreHeld: boolean = false;

	constructor() {
		this.aiControllerService = Resolve<AIControllerService>(Services.AIControllerService);
		this.conversationService = Resolve<ConversationFileSystemService>(Services.ConversationFileSystemService);
		this.namingService = Resolve<ConversationNamingService>(Services.ConversationNamingService);
		this.workSpaceService = Resolve<WorkSpaceService>(Services.WorkSpaceService);
		this.eventService = Resolve<EventService>(Services.EventService);
		this.abortService = Resolve<AbortService>(Services.AbortService);
		this.semaphore = new Semaphore(1, false);

		this.aiControllerService.setSaveCallback(async (conversation) => {
			await this.saveConversation(conversation);
		});
	}

	public onNameChanged: ((name: string) => void) | undefined = undefined;

	public async submit(conversation: Conversation, allowDestructiveActions: boolean, planningMode: boolean, userRequest: string, formattedRequest: string, attachments: Attachment[], callbacks: IChatServiceCallbacks) {
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

				if (firstMessage) {
					this.onNameChanged?.(conversation.title); // on change for initial conversation name
					void this.namingService.requestName(conversation, formattedRequest, this.onNameChanged)
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

				await this.aiControllerService.runMainAgent(conversation, allowDestructiveActions, planningMode, callbacks);
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
