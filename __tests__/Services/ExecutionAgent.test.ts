import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExecutionAgent } from '../../Services/AIServices/ExecutionAgent';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { AITool } from '../../Enums/AITool';
import { AIToolCall } from '../../AIClasses/AIToolCall';
import { AIToolResponse } from '../../AIClasses/ToolDefinitions/AIToolResponse';
import { AIToolResponsePayload } from '../../AIClasses/ToolDefinitions/AIToolResponsePayload';
import type { ExecutionStep } from '../../Types/ExecutionStep';

/**
 * UNIT TESTS - ExecutionAgent
 *
 * Tests the execution agent that:
 * - Executes individual steps via CompleteTask
 * - Calls AI functions during execution
 * - Retries when CompleteTask is not called
 * - Respects max depth limits
 * - Uses step context during execution
 */

describe('ExecutionAgent - Unit Tests', () => {
	let service: ExecutionAgent;
	let mockAI: any;
	let mockPrompt: any;
	let mockAIToolService: any;

	const createMockCallbacks = () => ({
		onSubmit: vi.fn(),
		onStreamingUpdate: vi.fn(),
		onThoughtUpdate: vi.fn(),
		onToolCallStarted: vi.fn(),
		onArtifactProduced: vi.fn(),
		onPlanningStarted: vi.fn(),
		onPlanningFinished: vi.fn(),
		onUserQuestion: vi.fn().mockResolvedValue('User answer'),
		onPlanApprovalRequest: vi.fn(),
		onPlanUpdate: vi.fn(),
		onPlanStepUpdate: vi.fn(),
		onPlanReset: vi.fn(),
		onComplete: vi.fn(),
		onCancel: vi.fn()
	});

	beforeEach(() => {
		// Mock IPrompt
		mockPrompt = {
			systemInstruction: vi.fn().mockReturnValue('System instruction'),
			userInstruction: vi.fn().mockResolvedValue('User instruction'),
			executionInstruction: vi.fn().mockReturnValue('Execution instruction')
		};
		RegisterSingleton(Services.IPrompt, mockPrompt);

		// Mock AIToolService
		mockAIToolService = {
			performAITool: vi.fn().mockResolvedValue(
				new AIToolResponse(AITool.SearchVaultFiles, new AIToolResponsePayload({ results: [] }), 'test-tool-id')
			)
		};
		RegisterSingleton(Services.AIToolService, mockAIToolService);

		// Mock IAIClass
		mockAI = {
			systemPrompt: '',
			userInstruction: '',
			toolDefinitions: [],
			agentType: undefined,
			streamRequest: vi.fn()
		};
		RegisterSingleton(Services.IAIClass, mockAI);

		// Mock SettingsService
		RegisterSingleton(Services.SettingsService, {
			settings: { enableMemories: false, allowUpdatingMemories: false }
		});

		// Create service
		service = new ExecutionAgent();
	});

	afterEach(() => {
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	describe('CompleteTask success', () => {
		it('should complete task successfully', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Search for files',
				instruction: 'Search the vault for markdown files'
			};

			mockAI.streamRequest.mockImplementation(async function* () {
				yield {
					content: 'Task completed',
					toolCall: new AIToolCall(
						AITool.CompleteTask,
						{
							success: true,
							description: 'Found 10 markdown files'
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeDefined();
			expect(result?.success).toBe(true);
			expect(result?.description).toBe('Found 10 markdown files');
		});

		it('should complete task with context', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Process files',
				instruction: 'Process the found files'
			};

			mockAI.streamRequest.mockImplementation(async function* () {
				yield {
					content: 'Task completed',
					toolCall: new AIToolCall(
						AITool.CompleteTask,
						{
							success: true,
							description: 'Processed 5 files',
							context: 'File names: note1.md, note2.md, note3.md, note4.md, note5.md'
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeDefined();
			expect(result?.success).toBe(true);
			expect(result?.context).toContain('File names');
		});

		it('should handle multiple steps independently', async () => {
			const callbacks = createMockCallbacks();

			const step1: ExecutionStep = {
				description: 'Step 1',
				instruction: 'First task'
			};

			const step2: ExecutionStep = {
				description: 'Step 2',
				instruction: 'Second task'
			};

			mockAI.streamRequest.mockImplementation(async function* () {
				yield {
					content: 'Done',
					toolCall: new AIToolCall(
						AITool.CompleteTask,
						{
							success: true,
							description: 'Completed'
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result1 = await service.runExecutionAgent(step1, callbacks);

			// Create new agent for second step
			const service2 = new ExecutionAgent();
			service2.resolveAIProvider();
			const result2 = await service2.runExecutionAgent(step2, callbacks);

			expect(result1).toBeDefined();
			expect(result2).toBeDefined();
			expect(result1?.success).toBe(true);
			expect(result2?.success).toBe(true);
		});
	});

	describe('CompleteTask failure', () => {
		it('should handle task failure', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Delete files',
				instruction: 'Delete temporary files'
			};

			mockAI.streamRequest.mockImplementation(async function* () {
				yield {
					content: 'Task failed',
					toolCall: new AIToolCall(
						AITool.CompleteTask,
						{
							success: false,
							description: 'No temporary files found'
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeDefined();
			expect(result?.success).toBe(false);
			expect(result?.description).toBe('No temporary files found');
		});

		it('should handle task failure with error details', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Write file',
				instruction: 'Write content to file'
			};

			mockAI.streamRequest.mockImplementation(async function* () {
				yield {
					content: 'Failed',
					toolCall: new AIToolCall(
						AITool.CompleteTask,
						{
							success: false,
							description: 'Permission denied: cannot write to /protected/file.md',
							context: 'The target directory is read-only'
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeDefined();
			expect(result?.success).toBe(false);
			expect(result?.description).toContain('Permission denied');
			expect(result?.context).toContain('read-only');
		});
	});

	describe('Function execution', () => {
		it('should call SearchVaultFiles during execution', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Find files',
				instruction: 'Search for files with tag #important'
			};

			let toolCallCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				toolCallCount++;
				if (toolCallCount === 1) {
					// Call search function
					yield {
						content: 'Searching',
						toolCall: new AIToolCall(
							AITool.SearchVaultFiles,
							{
								search_terms: ['#important'],
								user_message: 'Searching for tagged files'
							},
							'tool-1'
						),
						isComplete: true
					};
				} else {
					// Complete task
					yield {
						content: 'Done',
						toolCall: new AIToolCall(
							AITool.CompleteTask,
							{
								success: true,
								description: 'Found 3 files with #important tag'
							},
							'tool-2'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(mockAIToolService.performAITool).toHaveBeenCalled();
			expect(result?.success).toBe(true);
			expect(toolCallCount).toBe(2);
		});

		it('should call ReadVaultFiles during execution', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Read files',
				instruction: 'Read contents of note.md'
			};

			let toolCallCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				toolCallCount++;
				if (toolCallCount === 1) {
					yield {
						content: 'Reading',
						toolCall: new AIToolCall(
							AITool.ReadVaultFiles,
							{
								file_paths: ['note.md'],
								user_message: 'Reading file'
							},
							'tool-1'
						),
						isComplete: true
					};
				} else {
					yield {
						content: 'Done',
						toolCall: new AIToolCall(
							AITool.CompleteTask,
							{
								success: true,
								description: 'File read successfully'
							},
							'tool-2'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(mockAIToolService.performAITool).toHaveBeenCalled();
			expect(result?.success).toBe(true);
		});

		it('should call WriteVaultFile during execution', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Write file',
				instruction: 'Create new file with content'
			};

			let toolCallCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				toolCallCount++;
				if (toolCallCount === 1) {
					yield {
						content: 'Writing',
						toolCall: new AIToolCall(
							AITool.WriteVaultFile,
							{
								file_path: 'new-note.md',
								content: '# New Note\n\nContent here',
								user_message: 'Creating file'
							},
							'tool-1'
						),
						isComplete: true
					};
				} else {
					yield {
						content: 'Done',
						toolCall: new AIToolCall(
							AITool.CompleteTask,
							{
								success: true,
								description: 'File created successfully'
							},
							'tool-2'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(mockAIToolService.performAITool).toHaveBeenCalled();
			expect(result?.success).toBe(true);
		});

		it('should call multiple functions in sequence', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Update files',
				instruction: 'Search, read, and update files'
			};

			let toolCallCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				toolCallCount++;
				if (toolCallCount === 1) {
					yield {
						content: 'Searching',
						toolCall: new AIToolCall(
							AITool.SearchVaultFiles,
							{
								search_terms: ['TODO'],
								user_message: 'Searching'
							},
							'tool-1'
						),
						isComplete: true
					};
				} else if (toolCallCount === 2) {
					yield {
						content: 'Reading',
						toolCall: new AIToolCall(
							AITool.ReadVaultFiles,
							{
								file_paths: ['found.md'],
								user_message: 'Reading'
							},
							'tool-2'
						),
						isComplete: true
					};
				} else if (toolCallCount === 3) {
					yield {
						content: 'Writing',
						toolCall: new AIToolCall(
							AITool.PatchVaultFile,
							{
								file_path: 'found.md',
								patch_operations: [],
								user_message: 'Updating'
							},
							'tool-3'
						),
						isComplete: true
					};
				} else {
					yield {
						content: 'Done',
						toolCall: new AIToolCall(
							AITool.CompleteTask,
							{
								success: true,
								description: 'Updated 1 file'
							},
							'tool-4'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(mockAIToolService.performAITool).toHaveBeenCalledTimes(3);
			expect(result?.success).toBe(true);
		});
	});

	describe('Recursive retry', () => {
		it('should retry when CompleteTask is not called', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Process files',
				instruction: 'Process files'
			};

			let attemptCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				if (attemptCount === 1) {
					// No CompleteTask
					yield {
						content: 'Working on it...',
						isComplete: true
					};
				} else {
					// Complete on retry
					yield {
						content: 'Done',
						toolCall: new AIToolCall(
							AITool.CompleteTask,
							{
								success: true,
								description: 'Completed'
							},
							'tool-1'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeDefined();
			expect(attemptCount).toBe(2);
		});

		it('should retry multiple times before completing', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Complex task',
				instruction: 'Do complex task'
			};

			let attemptCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				if (attemptCount < 3) {
					// No completion on first two attempts
					yield {
						content: 'Still processing...',
						isComplete: true
					};
				} else {
					// Complete on third attempt
					yield {
						content: 'Done',
						toolCall: new AIToolCall(
							AITool.CompleteTask,
							{
								success: true,
								description: 'Finally completed'
							},
							'tool-1'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeDefined();
			expect(attemptCount).toBe(3);
		});

		it('should maintain conversation across retries', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Task',
				instruction: 'Do task'
			};

			let attemptCount = 0;
			let conversationGrows = false;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;

				// Check if conversation has retry message
				if (attemptCount > 1) {
					const conversation = mockAI.streamRequest.mock.calls[mockAI.streamRequest.mock.calls.length - 1][0];
					conversationGrows = conversation.contents.length > 2; // Initial + retries
				}

				if (attemptCount < 2) {
					yield {
						content: 'Not done',
						isComplete: true
					};
				} else {
					yield {
						content: 'Done',
						toolCall: new AIToolCall(
							AITool.CompleteTask,
							{
								success: true,
								description: 'Completed'
							},
							'tool-1'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			await service.runExecutionAgent(step, callbacks);

			expect(conversationGrows).toBe(true);
		});
	});

	describe('Max depth protection', () => {
		it('should return undefined when max execution depth is exceeded', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Impossible task',
				instruction: 'Task that never completes'
			};

			let attemptCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				// Never complete task, force retries
				yield {
					content: 'Still working...',
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeUndefined();
			expect(attemptCount).toBe(3); // MAX_AGENT_DEPTH
		});

		it('should complete just before max depth', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Almost failing task',
				instruction: 'Task that completes at last moment'
			};

			let attemptCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				if (attemptCount < 3) {
					yield {
						content: 'Retrying...',
						isComplete: true
					};
				} else {
					// Complete on third attempt (max depth)
					yield {
						content: 'Done',
						toolCall: new AIToolCall(
							AITool.CompleteTask,
							{
								success: true,
								description: 'Barely made it'
							},
							'tool-1'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeDefined();
			expect(result?.success).toBe(true);
			expect(attemptCount).toBe(3);
		});
	});

	describe('Step context usage', () => {
		it('should include step context in execution', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Process files',
				instruction: 'Process the files',
				context: 'Files found: note1.md, note2.md, note3.md'
			};

			let contextWasIncluded = false;

			mockAI.streamRequest.mockImplementation(async function* () {
				const conversation = mockAI.streamRequest.mock.calls[mockAI.streamRequest.mock.calls.length - 1][0];
				const firstMessage = conversation.contents[0];
				contextWasIncluded = firstMessage.content.includes('note1.md');

				yield {
					content: 'Done',
					toolCall: new AIToolCall(
						AITool.CompleteTask,
						{
							success: true,
							description: 'Processed files from context'
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeDefined();
			expect(contextWasIncluded).toBe(true);
		});

		it('should work without context', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Simple task',
				instruction: 'Do simple task'
				// No context
			};

			mockAI.streamRequest.mockImplementation(async function* () {
				yield {
					content: 'Done',
					toolCall: new AIToolCall(
						AITool.CompleteTask,
						{
							success: true,
							description: 'Task completed without context'
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeDefined();
			expect(result?.success).toBe(true);
		});

		it('should handle long context', async () => {
			const callbacks = createMockCallbacks();
			const longContext = 'File list: ' + Array.from({ length: 100 }, (_, i) => `file${i}.md`).join(', ');
			const step: ExecutionStep = {
				description: 'Process many files',
				instruction: 'Process all files',
				context: longContext
			};

			let contextLength = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				const conversation = mockAI.streamRequest.mock.calls[mockAI.streamRequest.mock.calls.length - 1][0];
				const firstMessage = conversation.contents[0];
				contextLength = firstMessage.content.length;

				yield {
					content: 'Done',
					toolCall: new AIToolCall(
						AITool.CompleteTask,
						{
							success: true,
							description: 'Processed all files'
						},
						'tool-1'
					),
					isComplete: true
				};
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeDefined();
			expect(contextLength).toBeGreaterThan(longContext.length);
		});
	});

	describe('Invalid CompleteTask arguments', () => {
		it('should reject CompleteTask with invalid arguments', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Task',
				instruction: 'Do task'
			};

			let attemptCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				if (attemptCount === 1) {
					// Invalid: missing description
					yield {
						content: 'Done',
						toolCall: new AIToolCall(
							AITool.CompleteTask,
							{
								success: true
								// Missing description field
							},
							'tool-1'
						),
						isComplete: true
					};
				} else {
					// Valid completion
					yield {
						content: 'Done',
						toolCall: new AIToolCall(
							AITool.CompleteTask,
							{
								success: true,
								description: 'Valid completion'
							},
							'tool-2'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeDefined();
			expect(attemptCount).toBeGreaterThan(1);
		});

		it('should reject CompleteTask with wrong type', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Task',
				instruction: 'Do task'
			};

			let attemptCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				attemptCount++;
				if (attemptCount === 1) {
					// Invalid: success is not boolean
					yield {
						content: 'Done',
						toolCall: new AIToolCall(
							AITool.CompleteTask,
							{
								success: 'yes',
								description: 'Done'
							},
							'tool-1'
						),
						isComplete: true
					};
				} else {
					// Valid
					yield {
						content: 'Done',
						toolCall: new AIToolCall(
							AITool.CompleteTask,
							{
								success: true,
								description: 'Done properly'
							},
							'tool-2'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			const result = await service.runExecutionAgent(step, callbacks);

			expect(result).toBeDefined();
			expect(attemptCount).toBeGreaterThan(1);
		});
	});

	describe('Thought updates', () => {
		it('should update thought callback during function calls', async () => {
			const callbacks = createMockCallbacks();
			const step: ExecutionStep = {
				description: 'Task',
				instruction: 'Do task with updates'
			};

			let toolCallCount = 0;

			mockAI.streamRequest.mockImplementation(async function* () {
				toolCallCount++;
				if (toolCallCount === 1) {
					yield {
						content: 'Searching',
						toolCall: new AIToolCall(
							AITool.SearchVaultFiles,
							{
								search_terms: ['test'],
								user_message: 'Searching for files'
							},
							'tool-1'
						),
						isComplete: true
					};
				} else {
					yield {
						content: 'Done',
						toolCall: new AIToolCall(
							AITool.CompleteTask,
							{
								success: true,
								description: 'Completed'
							},
							'tool-2'
						),
						isComplete: true
					};
				}
			});

			service.resolveAIProvider();
			await service.runExecutionAgent(step, callbacks);

			expect(callbacks.onThoughtUpdate).toHaveBeenCalledWith('Searching for files');
		});
	});
});
