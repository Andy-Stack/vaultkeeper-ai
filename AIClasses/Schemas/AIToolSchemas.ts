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
	oldContent: z.array(z.string()),
	newContent: z.array(z.string()),
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

export const CreateVaultFolderArgsSchema = z.object({
	path: z.string(),
	user_message: z.string()
});

export const DeleteVaultFolderArgsSchema = z.object({
	path: z.string(),
	user_message: z.string(),
	confirm_deletion: z.boolean()
});

export const MoveVaultFolderArgsSchema = z.object({
	source_path: z.string(),
	destination_path: z.string(),
	user_message: z.string()
});

export const ListVaultFilesArgsSchema = z.object({
	path: z.string(),
	recursive: z.boolean(),
	user_message: z.string()
});

export const GetWebViewerContentArgsSchema = z.object({
	url_hint: z.string().optional(),
	format: z.enum(["text", "screenshot"]),
	user_message: z.string()
});

export const ExecuteWorkflowArgsSchema = z.object({
	goal: z.string(),
	context: z.string().optional(),
	user_message: z.string()
});

export const AskUserQuestionPlanningArgsSchema = z.object({
	question: z.string(),
	user_message: z.string()
});

export const AskUserQuestionExecutionArgsSchema = z.object({
	question: z.string(),
	user_message: z.string()
});

export const CompleteTaskArgsSchema = z.object({
	success: z.boolean(),
	description: z.string(),
	context: z.string().optional()
});

export const CompleteStepArgsSchema = z.object({
	context_for_next_step: z.string().optional(),
	confirm_completion: z.boolean()
});

export const SkipStepArgsSchema = z.object({
	reason: z.string(),
	user_message: z.string().optional()
});

export const ReviseStepArgsSchema = z.object({
	revised_description: z.string(),
	revised_instruction: z.string(),
	revised_context: z.string().optional(),
	user_message: z.string()
});

export const RevisePlanArgsSchema = z.object({
	steps: z.array(z.object({
		description: z.string(),
		instruction: z.string(),
		context: z.string().optional()
	})),
	user_message: z.string().optional()
});

export const ContinuePlanExecutionArgsSchema = z.object({
	confirm_continuation: z.boolean()
});

export const CancelPlanArgsSchema = z.object({
	context: z.string()
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

export const ReadMemoriesArgsSchema = z.object({
	user_message: z.string()
});

export const UpdateMemoriesArgsSchema = z.object({
	content: z.string(),
	user_message: z.string()
});

// Infer TypeScript types from schemas
export type SearchVaultFilesArgs = z.infer<typeof SearchVaultFilesArgsSchema>;
export type ReadVaultFilesArgs = z.infer<typeof ReadVaultFilesArgsSchema>;
export type WriteVaultFileArgs = z.infer<typeof WriteVaultFileArgsSchema>;
export type PatchVaultFileArgs = z.infer<typeof PatchVaultFileArgsSchema>;
export type DeleteVaultFilesArgs = z.infer<typeof DeleteVaultFilesArgsSchema>;
export type MoveVaultFilesArgs = z.infer<typeof MoveVaultFilesArgsSchema>;
export type CreateVaultFolderArgs = z.infer<typeof CreateVaultFolderArgsSchema>;
export type DeleteVaultFolderArgs = z.infer<typeof DeleteVaultFolderArgsSchema>;
export type MoveVaultFolderArgs = z.infer<typeof MoveVaultFolderArgsSchema>;
export type ListVaultFilesArgs = z.infer<typeof ListVaultFilesArgsSchema>;
export type GetWebViewerContentArgs = z.infer<typeof GetWebViewerContentArgsSchema>;
export type ExecuteWorkflowArgs = z.infer<typeof ExecuteWorkflowArgsSchema>;
export type AskUserQuestionPlanningArgs = z.infer<typeof AskUserQuestionPlanningArgsSchema>;
export type AskUserQuestionExecutionArgs = z.infer<typeof AskUserQuestionExecutionArgsSchema>;
export type ContinuePlanExecutionArgs = z.infer<typeof ContinuePlanExecutionArgsSchema>;
export type CancelPlanArgs = z.infer<typeof CancelPlanArgsSchema>;
export type CompleteTaskArgs = z.infer<typeof CompleteTaskArgsSchema>;
export type CompleteStepArgs = z.infer<typeof CompleteStepArgsSchema>;
export type SkipStepArgs = z.infer<typeof SkipStepArgsSchema>;
export type ReviseStepArgs = z.infer<typeof ReviseStepArgsSchema>;
export type RevisePlanArgs = z.infer<typeof RevisePlanArgsSchema>;
export type SubmitPlanArgs = z.infer<typeof SubmitPlanArgsSchema>;
export type CompletePlanArgs = z.infer<typeof CompletePlanArgsSchema>;
export type ReadMemoriesArgs = z.infer<typeof ReadMemoriesArgsSchema>;
export type UpdateMemoriesArgs = z.infer<typeof UpdateMemoriesArgsSchema>;