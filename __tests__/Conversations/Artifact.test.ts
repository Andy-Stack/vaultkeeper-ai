import { describe, it, expect } from 'vitest';
import { Artifact } from '../../Conversations/Artifact';
import { ArtifactAction } from '../../Enums/ArtifactAction';

/**
 * UNIT TESTS - Artifact
 *
 * Tests the Artifact class that tracks file modifications made by the
 * AI agent during a conversation turn (write/patch/delete tracking).
 */

describe('Artifact', () => {
	describe('constructor', () => {
		it('should create an artifact with required fields', () => {
			const artifact = new Artifact('notes/test.md', 'text/markdown', ArtifactAction.Modify, 'old content', 'new content');

			expect(artifact.filePath).toBe('notes/test.md');
			expect(artifact.mimeType).toBe('text/markdown');
			expect(artifact.action).toBe(ArtifactAction.Modify);
			expect(artifact.originalContent).toBe('old content');
			expect(artifact.updatedContent).toBe('new content');
			expect(artifact.base64).toBeUndefined();
			expect(artifact.artifactPath).toBeUndefined();
		});

		it('should create an artifact with optional base64 and artifactPath', () => {
			const artifact = new Artifact(
				'image.png',
				'image/png',
				ArtifactAction.Modify,
				'',
				'',
				'base64data==',
				'Artifacts/hash123.bin'
			);

			expect(artifact.base64).toBe('base64data==');
			expect(artifact.artifactPath).toBe('Artifacts/hash123.bin');
		});

		it('should allow empty originalContent for newly created files', () => {
			const artifact = new Artifact('new-file.md', 'text/markdown', ArtifactAction.Create, '', 'Some new content');

			expect(artifact.originalContent).toBe('');
			expect(artifact.updatedContent).toBe('Some new content');
		});

		it('should allow empty updatedContent for deleted files', () => {
			const artifact = new Artifact('deleted-file.md', 'text/markdown', ArtifactAction.Delete, 'Content before deletion', '');

			expect(artifact.originalContent).toBe('Content before deletion');
			expect(artifact.updatedContent).toBe('');
		});
	});

	describe('getStoragePath / setStoragePath', () => {
		it('should return undefined when no storage path has been set', () => {
			const artifact = new Artifact('test.md', 'text/markdown', ArtifactAction.Modify, 'a', 'b');

			expect(artifact.getStoragePath()).toBeUndefined();
		});

		it('should return the artifactPath passed to the constructor', () => {
			const artifact = new Artifact('test.md', 'text/markdown', ArtifactAction.Modify, 'a', 'b', 'base64', 'Artifacts/existing.bin');

			expect(artifact.getStoragePath()).toBe('Artifacts/existing.bin');
		});

		it('should update the storage path when set', () => {
			const artifact = new Artifact('test.md', 'text/markdown', ArtifactAction.Modify, 'a', 'b');

			artifact.setStoragePath('Artifacts/newly-saved.bin');

			expect(artifact.getStoragePath()).toBe('Artifacts/newly-saved.bin');
			expect(artifact.artifactPath).toBe('Artifacts/newly-saved.bin');
		});

		it('should overwrite an existing storage path', () => {
			const artifact = new Artifact('test.md', 'text/markdown', ArtifactAction.Modify, 'a', 'b', undefined, 'Artifacts/old.bin');

			artifact.setStoragePath('Artifacts/new.bin');

			expect(artifact.getStoragePath()).toBe('Artifacts/new.bin');
		});
	});

	describe('isArtifactData', () => {
		it('should return true for valid minimal artifact data', () => {
			const data = {
				filePath: 'test.md',
				mimeType: 'text/markdown',
				action: ArtifactAction.Modify,
				originalContent: 'old',
				updatedContent: 'new'
			};

			expect(Artifact.isArtifactData(data)).toBe(true);
		});

		it('should return true for valid artifact data with optional fields', () => {
			const data = {
				filePath: 'test.md',
				mimeType: 'text/markdown',
				action: ArtifactAction.Modify,
				originalContent: 'old',
				updatedContent: 'new',
				base64: 'YWJj',
				artifactPath: 'Artifacts/hash.bin'
			};

			expect(Artifact.isArtifactData(data)).toBe(true);
		});

		it('should return false for null', () => {
			expect(Artifact.isArtifactData(null)).toBe(false);
		});

		it('should return false for non-object values', () => {
			expect(Artifact.isArtifactData('a string')).toBe(false);
			expect(Artifact.isArtifactData(42)).toBe(false);
			expect(Artifact.isArtifactData(undefined)).toBe(false);
		});

		it('should return false when filePath is missing', () => {
			const data = {
				mimeType: 'text/markdown',
				originalContent: 'old',
				updatedContent: 'new'
			};

			expect(Artifact.isArtifactData(data)).toBe(false);
		});

		it('should return false when mimeType is missing', () => {
			const data = {
				filePath: 'test.md',
				action: ArtifactAction.Modify,
				originalContent: 'old',
				updatedContent: 'new'
			};

			expect(Artifact.isArtifactData(data)).toBe(false);
		});

		it('should return false when action is missing', () => {
			const data = {
				filePath: 'test.md',
				mimeType: 'text/markdown',
				originalContent: 'old',
				updatedContent: 'new'
			};

			expect(Artifact.isArtifactData(data)).toBe(false);
		});

		it('should return false when action is not a valid ArtifactAction', () => {
			const data = {
				filePath: 'test.md',
				mimeType: 'text/markdown',
				action: 'not-a-valid-action',
				originalContent: 'old',
				updatedContent: 'new'
			};

			expect(Artifact.isArtifactData(data)).toBe(false);
		});

		it('should return false when originalContent is missing', () => {
			const data = {
				filePath: 'test.md',
				mimeType: 'text/markdown',
				action: ArtifactAction.Modify,
				updatedContent: 'new'
			};

			expect(Artifact.isArtifactData(data)).toBe(false);
		});

		it('should return false when updatedContent is missing', () => {
			const data = {
				filePath: 'test.md',
				mimeType: 'text/markdown',
				action: ArtifactAction.Modify,
				originalContent: 'old'
			};

			expect(Artifact.isArtifactData(data)).toBe(false);
		});

		it('should return false when filePath has wrong type', () => {
			const data = {
				filePath: 123,
				mimeType: 'text/markdown',
				action: ArtifactAction.Modify,
				originalContent: 'old',
				updatedContent: 'new'
			};

			expect(Artifact.isArtifactData(data)).toBe(false);
		});

		it('should return false when base64 has wrong type', () => {
			const data = {
				filePath: 'test.md',
				mimeType: 'text/markdown',
				action: ArtifactAction.Modify,
				originalContent: 'old',
				updatedContent: 'new',
				base64: 12345
			};

			expect(Artifact.isArtifactData(data)).toBe(false);
		});

		it('should return false when artifactPath has wrong type', () => {
			const data = {
				filePath: 'test.md',
				mimeType: 'text/markdown',
				action: ArtifactAction.Modify,
				originalContent: 'old',
				updatedContent: 'new',
				artifactPath: true
			};

			expect(Artifact.isArtifactData(data)).toBe(false);
		});

		it('should allow empty string content fields', () => {
			const data = {
				filePath: 'new-file.md',
				mimeType: 'text/markdown',
				action: ArtifactAction.Create,
				originalContent: '',
				updatedContent: ''
			};

			expect(Artifact.isArtifactData(data)).toBe(true);
		});
	});
});
