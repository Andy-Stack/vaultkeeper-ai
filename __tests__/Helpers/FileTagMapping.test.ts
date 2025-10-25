import { describe, it, expect, beforeEach } from 'vitest';
import { FileTagMapping } from '../../Helpers/FileTagMapping';

describe('FileTagMapping', () => {
	let mapping: FileTagMapping;

	beforeEach(() => {
		mapping = new FileTagMapping();
	});

	describe('set', () => {
		it('should set key-value pairs', () => {
			mapping.set('file1.md', ['tag1', 'tag2']);
			mapping.set('file2.md', ['tag3']);

			// Verify by checking updateMapping behavior
			const removed = mapping.updateMapping('file1.md', ['tag1']);
			expect(removed).toEqual(['tag2']);
		});

		it('should overwrite existing values for same key', () => {
			mapping.set('file.md', ['tag1', 'tag2']);
			mapping.set('file.md', ['tag3']);

			const removed = mapping.updateMapping('file.md', []);
			expect(removed).toEqual(['tag3']);
		});

		it('should handle empty tag arrays', () => {
			mapping.set('file.md', []);

			const removed = mapping.updateMapping('file.md', ['tag1']);
			expect(removed).toEqual([]);
		});
	});

	describe('updateMapping', () => {
		it('should return truly orphaned tags when updating', () => {
			mapping.set('file1.md', ['tag1', 'tag2', 'tag3']);
			mapping.set('file2.md', ['tag2', 'tag4']);

			// Remove tag2 and tag3 from file1
			// tag2 should NOT be returned as orphaned because file2 still has it
			// tag3 should be returned as orphaned
			const removed = mapping.updateMapping('file1.md', ['tag1']);

			expect(removed).toEqual(['tag3']);
		});

		it('should return all removed tags when they are truly orphaned', () => {
			mapping.set('file.md', ['tag1', 'tag2', 'tag3']);

			const removed = mapping.updateMapping('file.md', ['tag1']);

			expect(removed).toHaveLength(2);
			expect(removed).toContain('tag2');
			expect(removed).toContain('tag3');
		});

		it('should return empty array when no tags are removed', () => {
			mapping.set('file.md', ['tag1', 'tag2']);

			const removed = mapping.updateMapping('file.md', ['tag1', 'tag2', 'tag3']);

			expect(removed).toEqual([]);
		});

		it('should return empty array when new tags are superset of old tags', () => {
			mapping.set('file.md', ['tag1']);

			const removed = mapping.updateMapping('file.md', ['tag1', 'tag2']);

			expect(removed).toEqual([]);
		});

		it('should handle updating non-existent key', () => {
			const removed = mapping.updateMapping('nonexistent.md', ['tag1']);

			expect(removed).toEqual([]);
		});

		it('should update the mapping with new tags', () => {
			mapping.set('file.md', ['tag1', 'tag2']);
			mapping.updateMapping('file.md', ['tag3', 'tag4']);

			// Verify update by checking subsequent update
			const removed = mapping.updateMapping('file.md', []);
			expect(removed).toEqual(expect.arrayContaining(['tag3', 'tag4']));
		});
	});

	describe('deleteFromMapping', () => {
		it('should return truly orphaned tags when deleting', () => {
			mapping.set('file1.md', ['tag1', 'tag2']);
			mapping.set('file2.md', ['tag2', 'tag3']);

			const orphaned = mapping.deleteFromMapping('file1.md');

			// tag1 should be orphaned, tag2 should not (file2 still has it)
			expect(orphaned).toEqual(['tag1']);
		});

		it('should return all tags when deleting the only file with those tags', () => {
			mapping.set('file.md', ['tag1', 'tag2', 'tag3']);

			const orphaned = mapping.deleteFromMapping('file.md');

			expect(orphaned).toHaveLength(3);
			expect(orphaned).toContain('tag1');
			expect(orphaned).toContain('tag2');
			expect(orphaned).toContain('tag3');
		});

		it('should return empty array when deleting non-existent key', () => {
			const orphaned = mapping.deleteFromMapping('nonexistent.md');

			expect(orphaned).toEqual([]);
		});

		it('should not return tags shared by multiple files', () => {
			mapping.set('file1.md', ['shared', 'unique1']);
			mapping.set('file2.md', ['shared', 'unique2']);
			mapping.set('file3.md', ['shared']);

			const orphaned = mapping.deleteFromMapping('file1.md');

			// Only unique1 should be orphaned
			expect(orphaned).toEqual(['unique1']);
			expect(orphaned).not.toContain('shared');
		});

		it('should actually remove the key from mapping', () => {
			mapping.set('file.md', ['tag1']);
			mapping.deleteFromMapping('file.md');

			// Deleting again should return empty array
			const secondDelete = mapping.deleteFromMapping('file.md');
			expect(secondDelete).toEqual([]);
		});
	});

	describe('renameKey', () => {
		it('should rename key while preserving tags', () => {
			mapping.set('old.md', ['tag1', 'tag2']);
			mapping.renameKey('old.md', 'new.md');

			// Verify rename by deleting new key
			const orphaned = mapping.deleteFromMapping('new.md');
			expect(orphaned).toEqual(expect.arrayContaining(['tag1', 'tag2']));
		});

		it('should remove old key after rename', () => {
			mapping.set('old.md', ['tag1']);
			mapping.renameKey('old.md', 'new.md');

			// Deleting old key should return nothing
			const orphaned = mapping.deleteFromMapping('old.md');
			expect(orphaned).toEqual([]);
		});

		it('should handle renaming non-existent key', () => {
			// Should not throw error
			mapping.renameKey('nonexistent.md', 'new.md');

			const orphaned = mapping.deleteFromMapping('new.md');
			expect(orphaned).toEqual([]);
		});

		it('should overwrite destination key if it exists', () => {
			mapping.set('old.md', ['tag1']);
			mapping.set('new.md', ['tag2']);

			mapping.renameKey('old.md', 'new.md');

			// new.md should now have tag1, tag2 should be orphaned
			const orphaned = mapping.deleteFromMapping('new.md');
			expect(orphaned).toEqual(['tag1']);
		});
	});

	describe('complex scenarios', () => {
		it('should handle multiple files sharing all tags', () => {
			mapping.set('file1.md', ['tag1', 'tag2']);
			mapping.set('file2.md', ['tag1', 'tag2']);
			mapping.set('file3.md', ['tag1', 'tag2']);

			const orphaned1 = mapping.deleteFromMapping('file1.md');
			expect(orphaned1).toEqual([]);

			const orphaned2 = mapping.deleteFromMapping('file2.md');
			expect(orphaned2).toEqual([]);

			const orphaned3 = mapping.deleteFromMapping('file3.md');
			expect(orphaned3).toEqual(expect.arrayContaining(['tag1', 'tag2']));
		});

		it('should handle updating to same tags', () => {
			mapping.set('file.md', ['tag1', 'tag2']);

			const removed = mapping.updateMapping('file.md', ['tag1', 'tag2']);

			expect(removed).toEqual([]);
		});

		it('should handle empty tag arrays throughout lifecycle', () => {
			mapping.set('file.md', []);

			const updated = mapping.updateMapping('file.md', []);
			expect(updated).toEqual([]);

			const orphaned = mapping.deleteFromMapping('file.md');
			expect(orphaned).toEqual([]);
		});

		it('should correctly track tags across renames and updates', () => {
			mapping.set('file1.md', ['tag1', 'tag2']);
			mapping.set('file2.md', ['tag2', 'tag3']);

			// Rename file1 to file3
			mapping.renameKey('file1.md', 'file3.md');

			// Update file2 to remove tag2
			const removed = mapping.updateMapping('file2.md', ['tag3']);

			// tag2 should not be orphaned because file3 still has it
			expect(removed).toEqual([]);

			// Delete file3
			const orphaned = mapping.deleteFromMapping('file3.md');

			// tag1 and tag2 should now be orphaned
			expect(orphaned).toEqual(expect.arrayContaining(['tag1', 'tag2']));
		});
	});
});
