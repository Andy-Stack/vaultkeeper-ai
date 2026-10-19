import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { describeToolCall, describeMessageSteps } from '../../Helpers/ToolCallThoughtHelper';
import { AIToolCall } from '../../AIClasses/AIToolCall';
import { AITool } from '../../Enums/AITool';
import { ConversationContent } from '../../Conversations/ConversationContent';
import { Role } from '../../Enums/Role';
import { Exception } from '../../Helpers/Exception';

describe('ToolCallThoughtHelper', () => {
	beforeEach(() => {
		vi.spyOn(Exception, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('describeToolCall', () => {
		it.each([
			[AITool.ReadMemories, {}, 'Read memories'],
			[AITool.UpdateMemories, { content: 'x' }, 'Update memories'],
			[AITool.ListVaultFiles, { path: 'notes', recursive: true }, "List files in 'notes'"],
			[AITool.SearchVaultFiles, { search_terms: [{ search_term: 'cats' }, { search_term: 'dogs' }] }, "Search vault for 'cats', 'dogs'"],
			[AITool.ReadVaultFiles, { files: [{ file_path: 'a/one.md' }] }, "Read file 'one.md'"],
			[AITool.ReadVaultFiles, { files: [{ file_path: 'a/one.md' }, { file_path: 'b/two.md' }] }, "Read files 'one.md', 'two.md'"],
			[AITool.GetWebViewerContent, { format: 'screenshot' }, 'Get web viewer content as screenshot'],
			[AITool.CreateVaultFolder, { path: 'projects/new' }, "Create folder 'new' at 'projects'"],
			[AITool.WriteVaultFile, { file_path: 'notes/idea.md', content: 'x' }, "Write file 'idea.md' at 'notes'"],
			[AITool.PatchVaultFile, { file_path: 'notes/idea.md', edits: [] }, "Patch file 'idea.md' at 'notes'"],
			[AITool.DeleteVaultFiles, { file_paths: ['a/x.md'], confirm_deletion: true }, "Delete file 'x.md'"],
			[AITool.DeleteVaultFiles, { file_paths: ['a/x.md', 'b/y.md'], confirm_deletion: true }, "Delete files 'x.md', 'y.md'"],
			[AITool.DeleteVaultFolder, { path: 'old/stuff', confirm_deletion: true }, "Delete folder 'stuff' at 'old'"]
		])('should describe %s', (tool, args, expected) => {
			expect(describeToolCall(new AIToolCall(tool, args))).toBe(expected);
		});

		describe('MoveVaultFiles', () => {
			it('should describe a rename within the same folder', () => {
				const call = new AIToolCall(AITool.MoveVaultFiles, { source_paths: ['notes/a.md'], destination_paths: ['notes/b.md'] });

				expect(describeToolCall(call)).toBe("Rename file 'a.md' to 'b.md'");
			});

			it('should describe a move into another folder keeping the file name', () => {
				const call = new AIToolCall(AITool.MoveVaultFiles, { source_paths: ['notes/a.md'], destination_paths: ['archive/a.md'] });

				expect(describeToolCall(call)).toBe("Move file 'a.md' to 'archive'");
			});

			it('should describe a move that also renames the file', () => {
				const call = new AIToolCall(AITool.MoveVaultFiles, { source_paths: ['notes/a.md'], destination_paths: ['archive/b.md'] });

				expect(describeToolCall(call)).toBe("Move file 'a.md' to 'archive/b.md'");
			});

			it('should describe a mix of renames and moves', () => {
				const call = new AIToolCall(AITool.MoveVaultFiles, {
					source_paths: ['notes/a.md', 'notes/b.md'],
					destination_paths: ['notes/c.md', 'archive/b.md']
				});

				expect(describeToolCall(call)).toBe("Move / Rename files 'a.md' to 'c.md', 'b.md' to 'archive'");
			});
		});

		describe('MoveVaultFolder', () => {
			it('should describe renaming a folder', () => {
				const call = new AIToolCall(AITool.MoveVaultFolder, { source_path: 'projects/old', destination_path: 'projects/new' });

				expect(describeToolCall(call)).toBe("Rename folder 'old' to 'new'");
			});

			it('should describe moving a folder', () => {
				const call = new AIToolCall(AITool.MoveVaultFolder, { source_path: 'projects/old', destination_path: 'archive/old' });

				expect(describeToolCall(call)).toBe("Move folder 'old' to 'archive'");
			});
		});

		it('should describe a workflow by its title', () => {
			const call = new AIToolCall(AITool.ExecuteWorkflow, { title: 'Tidy inbox', goal: 'sort notes' });

			expect(describeToolCall(call)).toBe("Ran workflow 'Tidy inbox'");
		});

		it.each([
			AITool.SearchVaultFiles, AITool.ReadVaultFiles, AITool.WriteVaultFile, AITool.PatchVaultFile,
			AITool.DeleteVaultFiles, AITool.MoveVaultFiles, AITool.ListVaultFiles, AITool.DeleteVaultFolder,
			AITool.MoveVaultFolder, AITool.CreateVaultFolder, AITool.GetWebViewerContent, AITool.ExecuteWorkflow
		])('should not describe %s when its arguments are invalid', (tool) => {
			expect(describeToolCall(new AIToolCall(tool, { unexpected: true }))).toBeUndefined();
		});

		it.each([
			AITool.RequestWebSearch, AITool.SubmitPlan, AITool.CompleteTask, AITool.CompleteStep, AITool.SkipStep,
			AITool.ReviseStep, AITool.RevisePlan, AITool.CompletePlan, AITool.CancelPlan,
			AITool.AskUserQuestionPlanning, AITool.AskUserQuestionExecution, AITool.Unknown
		])('should not show %s as a step', (tool) => {
			expect(describeToolCall(new AIToolCall(tool, {}))).toBeUndefined();
		});
	});

	describe('describeMessageSteps', () => {
		it('should describe every call stored on an assistant message in order', () => {
			const message = new ConversationContent({
				role: Role.Assistant,
				toolCalls: AIToolCall.toConversationString([
					new AIToolCall(AITool.ListVaultFiles, { path: 'notes', recursive: false }, 'a'),
					new AIToolCall(AITool.WriteVaultFile, { file_path: 'notes/x.md', content: '' }, 'b')
				])
			});

			expect(describeMessageSteps(message)).toEqual(["List files in 'notes'", "Write file 'x.md' at 'notes'"]);
		});

		it('should leave out calls that are not shown as steps', () => {
			const message = new ConversationContent({
				role: Role.Assistant,
				toolCalls: AIToolCall.toConversationString([
					new AIToolCall(AITool.CompleteTask, { success: true, description: 'done' }, 'a'),
					new AIToolCall(AITool.ReadMemories, {}, 'b')
				])
			});

			expect(describeMessageSteps(message)).toEqual(['Read memories']);
		});

		it('should return nothing for a message without tool calls', () => {
			expect(describeMessageSteps(new ConversationContent({ role: Role.Assistant, content: 'hi' }))).toEqual([]);
		});

		it('should return nothing for a user message', () => {
			const message = new ConversationContent({
				role: Role.User,
				toolCalls: AIToolCall.toConversationString([new AIToolCall(AITool.ReadMemories, {}, 'a')])
			});

			expect(describeMessageSteps(message)).toEqual([]);
		});

		it('should return nothing when the stored tool calls are invalid JSON', () => {
			const message = new ConversationContent({ role: Role.Assistant, toolCalls: 'not json' });

			expect(describeMessageSteps(message)).toEqual([]);
		});
	});
});
