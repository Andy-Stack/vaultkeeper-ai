/** Zod schemas for runtime validation of AI function arguments **/

import { z } from "zod";

// Zod schemas for AI function arguments
// These provide runtime validation of data received from AI providers

export const SearchVaultFilesArgsSchema = z.object({
	search_terms: z.array(z.string()),
	user_message: z.string()
});

export const ReadVaultFilesArgsSchema = z.object({
	file_paths: z.array(z.string()),
	user_message: z.string()
});

export const WriteVaultFileArgsSchema = z.object({
	file_path: z.string(),
	content: z.string(),
	user_message: z.string()
});

export const PatchVaultFileArgsSchema = z.object({
	file_path: z.string(),
	oldContent: z.string(),
	newContent: z.string(),
	user_message: z.string()
});

export const DeleteVaultFilesArgsSchema = z.object({
	file_paths: z.array(z.string()),
	user_message: z.string(),
	confirm_deletion: z.boolean()
});

export const MoveVaultFilesArgsSchema = z.object({
	source_paths: z.array(z.string()),
	destination_paths: z.array(z.string()),
	user_message: z.string()
});

export const ListVaultFilesArgsSchema = z.object({
	path: z.string(),
	recursive: z.boolean(),
	user_message: z.string()
});

export const ExecuteWorkflowArgsSchema = z.object({
	goal: z.string(),
	context: z.string().optional(),
	user_message: z.string()
});

export const ReplanArgsSchema = z.object({
	context: z.string()
});

export const AskUserQuestionPlanningArgsSchema = z.object({
	question: z.string(),
	user_message: z.string()
});

export const AskUserQuestionExecutionArgsSchema = z.object({
	question: z.string(),
	user_message: z.string()
});

export const ContinuePlanExecutionArgsSchema = z.object({
	confirm_continuation: z.boolean()
});

export const CancelPlanArgsSchema = z.object({
	context: z.string()
});

export const CompleteStepArgsSchema = z.object({
	context_for_next_step: z.string().optional(),
	confirm_completion: z.boolean()
});

export const CompleteTaskArgsSchema = z.object({
	success: z.boolean(),
	description: z.string(),
	context: z.string().optional()
});

export const SubmitPlanArgsSchema = z.object({
	steps: z.array(z.object({
		description: z.string(),
		instruction: z.string(),
		context: z.string().optional()
	}))
});

export const CompletePlanArgsSchema = z.object({
	confirm_completion: z.boolean()
});

// Infer TypeScript types from schemas
export type SearchVaultFilesArgs = z.infer<typeof SearchVaultFilesArgsSchema>;
export type ReadVaultFilesArgs = z.infer<typeof ReadVaultFilesArgsSchema>;
export type WriteVaultFileArgs = z.infer<typeof WriteVaultFileArgsSchema>;
export type PatchVaultFileArgs = z.infer<typeof PatchVaultFileArgsSchema>;
export type DeleteVaultFilesArgs = z.infer<typeof DeleteVaultFilesArgsSchema>;
export type MoveVaultFilesArgs = z.infer<typeof MoveVaultFilesArgsSchema>;
export type ListVaultFilesArgs = z.infer<typeof ListVaultFilesArgsSchema>;
export type ExecuteWorkflowArgs = z.infer<typeof ExecuteWorkflowArgsSchema>;
export type ReplanArgs = z.infer<typeof ReplanArgsSchema>;
export type AskUserQuestionPlanningArgs = z.infer<typeof AskUserQuestionPlanningArgsSchema>;
export type AskUserQuestionExecutionArgs = z.infer<typeof AskUserQuestionExecutionArgsSchema>;
export type ContinuePlanExecutionArgs = z.infer<typeof ContinuePlanExecutionArgsSchema>;
export type CancelPlanArgs = z.infer<typeof CancelPlanArgsSchema>;
export type CompleteStepArgs = z.infer<typeof CompleteStepArgsSchema>;
export type CompleteTaskArgs = z.infer<typeof CompleteTaskArgsSchema>;
export type SubmitPlanArgs = z.infer<typeof SubmitPlanArgsSchema>;
export type CompletePlanArgs = z.infer<typeof CompletePlanArgsSchema>;
