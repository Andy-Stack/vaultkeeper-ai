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

// Infer TypeScript types from schemas
export type SearchVaultFilesArgs = z.infer<typeof SearchVaultFilesArgsSchema>;
export type ReadVaultFilesArgs = z.infer<typeof ReadVaultFilesArgsSchema>;
export type WriteVaultFileArgs = z.infer<typeof WriteVaultFileArgsSchema>;
export type DeleteVaultFilesArgs = z.infer<typeof DeleteVaultFilesArgsSchema>;
export type MoveVaultFilesArgs = z.infer<typeof MoveVaultFilesArgsSchema>;
export type ListVaultFilesArgs = z.infer<typeof ListVaultFilesArgsSchema>;
