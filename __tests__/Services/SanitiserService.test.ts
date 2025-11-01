import { describe, it, expect, beforeEach } from 'vitest';
import { SanitiserService, type SanitizeOptions } from '../../Services/SanitiserService';

describe('SanitiserService', () => {
	let service: SanitiserService;

	beforeEach(() => {
		service = new SanitiserService();
	});

	describe('sanitize - basic functionality', () => {
		it('should return unchanged string when no illegal characters present', () => {
			const result = service.sanitize('normal-filename.md');
			expect(result).toBe('normal-filename.md');
		});

		it('should remove illegal characters by default', () => {
			const result = service.sanitize('file<name>with?illegal*chars.md');
			expect(result).toBe('filenamewithillegalchars.md');
		});

		it('should replace illegal characters with custom replacement', () => {
			const result = service.sanitize('file<name>.md', { replacement: '_' });
			expect(result).toBe('file_name_.md');
		});

		it('should throw error when input is not a string', () => {
			expect(() => service.sanitize(123 as any)).toThrow('Input must be a string');
			expect(() => service.sanitize(null as any)).toThrow('Input must be a string');
			expect(() => service.sanitize(undefined as any)).toThrow('Input must be a string');
		});

		it('should normalize empty string to vault root', () => {
			const result = service.sanitize('');
			expect(result).toBe('/');
		});

		it('should normalize whitespace-only string to vault root', () => {
			const result = service.sanitize('   ');
			expect(result).toBe('/');
		});
	});

	describe('sanitize - illegal characters', () => {
		it('should remove question marks', () => {
			const result = service.sanitize('what?.md');
			expect(result).toBe('what.md');
		});

		it('should remove angle brackets', () => {
			const result = service.sanitize('file<test>.md');
			expect(result).toBe('filetest.md');
		});

		it('should remove backslashes in filenames (when not path separators)', () => {
			const result = service.sanitize('folder/file\\name.md');
			// Backslash is treated as a path separator, so this becomes folder/file/name.md
			expect(result).toBe('folder/file/name.md');
		});

		it('should remove colons (except in Windows drive letters)', () => {
			const result = service.sanitize('time:12:30.md');
			expect(result).toBe('time1230.md');
		});

		it('should remove asterisks', () => {
			const result = service.sanitize('file*.md');
			expect(result).toBe('file.md');
		});

		it('should remove pipes', () => {
			const result = service.sanitize('file|name.md');
			expect(result).toBe('filename.md');
		});

		it('should remove double quotes', () => {
			const result = service.sanitize('file"name".md');
			expect(result).toBe('filename.md');
		});

		it('should remove all illegal characters at once', () => {
			const result = service.sanitize('?<>\\:*|"test.md');
			// Backslash creates a path separator, leading to an empty first segment which becomes 'unnamed'
			expect(result).toBe('unnamed/test.md');
		});
	});

	describe('sanitize - control characters', () => {
		it('should remove null bytes', () => {
			const result = service.sanitize('file\x00name.md');
			expect(result).toBe('filename.md');
		});

		it('should remove various control characters', () => {
			const result = service.sanitize('file\x01\x02\x1fname.md');
			expect(result).toBe('filename.md');
		});

		it('should remove high control characters', () => {
			const result = service.sanitize('file\x80\x9fname.md');
			expect(result).toBe('filename.md');
		});
	});

	describe('sanitize - Windows reserved names', () => {
		it('should replace CON', () => {
			const result = service.sanitize('CON');
			expect(result).toBe('unnamed');
		});

		it('should replace PRN', () => {
			const result = service.sanitize('PRN.txt');
			expect(result).toBe('unnamed');
		});

		it('should replace AUX', () => {
			const result = service.sanitize('AUX.md');
			expect(result).toBe('unnamed');
		});

		it('should replace NUL', () => {
			const result = service.sanitize('NUL');
			expect(result).toBe('unnamed');
		});

		it('should replace COM1 through COM9', () => {
			expect(service.sanitize('COM1')).toBe('unnamed');
			expect(service.sanitize('COM5.txt')).toBe('unnamed');
			expect(service.sanitize('COM9.md')).toBe('unnamed');
		});

		it('should replace LPT1 through LPT9', () => {
			expect(service.sanitize('LPT1')).toBe('unnamed');
			expect(service.sanitize('LPT5.txt')).toBe('unnamed');
			expect(service.sanitize('LPT9.md')).toBe('unnamed');
		});

		it('should be case-insensitive for Windows reserved names', () => {
			expect(service.sanitize('con')).toBe('unnamed');
			expect(service.sanitize('Con')).toBe('unnamed');
			expect(service.sanitize('CoN.txt')).toBe('unnamed');
		});

		it('should not replace reserved names in the middle of words', () => {
			const result = service.sanitize('conference.md');
			expect(result).toBe('conference.md');
		});

		it('should handle reserved names in paths correctly', () => {
			const result = service.sanitize('folder/CON.txt');
			expect(result).toBe('folder/unnamed');
		});
	});

	describe('sanitize - reserved patterns', () => {
		it('should replace single dot', () => {
			const result = service.sanitize('.');
			expect(result).toBe('unnamed');
		});

		it('should replace double dots', () => {
			const result = service.sanitize('..');
			expect(result).toBe('unnamed');
		});

		it('should replace multiple dots', () => {
			const result = service.sanitize('...');
			expect(result).toBe('unnamed');
		});

		it('should not replace dots in filenames', () => {
			const result = service.sanitize('file.name.md');
			expect(result).toBe('file.name.md');
		});
	});

	describe('sanitize - Windows trailing characters', () => {
		it('should remove trailing spaces', () => {
			const result = service.sanitize('filename   ');
			expect(result).toBe('filename');
		});

		it('should remove trailing dots', () => {
			const result = service.sanitize('filename...');
			expect(result).toBe('filename');
		});

		it('should remove trailing spaces and dots', () => {
			const result = service.sanitize('filename. . .');
			expect(result).toBe('filename');
		});

		it('should handle trailing characters in path segments', () => {
			const result = service.sanitize('folder /file. .md');
			// The trailing regex only matches at the end of each segment, not within the segment
			expect(result).toBe('folder/file. .md');
		});
	});

	describe('sanitize - path handling', () => {
		it('should sanitize each path segment independently', () => {
			const result = service.sanitize('folder<1>/folder?2/file*.md');
			expect(result).toBe('folder1/folder2/file.md');
		});

		it('should handle multiple consecutive slashes', () => {
			const result = service.sanitize('folder///subfolder//file.md');
			expect(result).toBe('folder/subfolder/file.md');
		});

		it('should treat backslashes as path separators', () => {
			const result = service.sanitize('folder\\subfolder\\file.md');
			expect(result).toBe('folder/subfolder/file.md');
		});

		it('should handle mixed forward and backslashes', () => {
			const result = service.sanitize('folder\\subfolder/file.md');
			expect(result).toBe('folder/subfolder/file.md');
		});

		it('should use custom separator when specified', () => {
			const result = service.sanitize('folder/subfolder/file.md', { separator: '\\' });
			expect(result).toBe('folder\\subfolder\\file.md');
		});
	});

	describe('sanitize - absolute paths', () => {
		it('should preserve leading slash for Unix absolute paths', () => {
			const result = service.sanitize('/home/user/file.md');
			expect(result).toBe('/home/user/file.md');
		});

		it('should handle absolute path with illegal characters', () => {
			const result = service.sanitize('/home/user/file*.md');
			expect(result).toBe('/home/user/file.md');
		});

		it('should preserve Windows drive letter', () => {
			const result = service.sanitize('C:\\Users\\file.md');
			expect(result).toBe('C/Users/file.md');
		});

		it('should handle Windows drive letter with forward slashes', () => {
			const result = service.sanitize('C:/Users/file.md');
			expect(result).toBe('C/Users/file.md');
		});

		it('should handle different drive letters', () => {
			expect(service.sanitize('D:\\folder\\file.md')).toBe('D/folder/file.md');
			expect(service.sanitize('E:/folder/file.md')).toBe('E/folder/file.md');
		});

		it('should sanitize Windows paths with illegal characters', () => {
			const result = service.sanitize('C:\\Users\\file?.md');
			expect(result).toBe('C/Users/file.md');
		});

		it('should preserve drive letter case', () => {
			const result = service.sanitize('c:\\users\\file.md');
			expect(result).toBe('c/users/file.md');
		});
	});

	describe('sanitize - UTF-8 truncation', () => {
		it('should not truncate filenames under 255 bytes', () => {
			const shortName = 'a'.repeat(200) + '.md';
			const result = service.sanitize(shortName);
			expect(result).toBe(shortName);
		});

		it('should truncate ASCII filenames over 255 bytes', () => {
			const longName = 'a'.repeat(300) + '.md';
			const result = service.sanitize(longName);

			const encoder = new TextEncoder();
			const bytes = encoder.encode(result);
			expect(bytes.length).toBeLessThanOrEqual(255);
		});

		it('should truncate at UTF-8 character boundaries', () => {
			// Create a string with multi-byte characters that would exceed 255 bytes
			const emoji = '😀'; // 4 bytes in UTF-8
			const longName = emoji.repeat(70) + '.md'; // ~280 bytes + 3 for .md
			const result = service.sanitize(longName);

			const encoder = new TextEncoder();
			const bytes = encoder.encode(result);
			expect(bytes.length).toBeLessThanOrEqual(255);

			// Ensure the result is valid UTF-8 (no broken emoji)
			const decoder = new TextDecoder('utf-8', { fatal: true });
			expect(() => decoder.decode(encoder.encode(result))).not.toThrow();
		});

		it('should truncate filenames with mixed ASCII and multi-byte characters', () => {
			const mixed = 'file' + '日本語'.repeat(50) + '.md'; // Japanese characters are 3 bytes each
			const result = service.sanitize(mixed);

			const encoder = new TextEncoder();
			const bytes = encoder.encode(result);
			expect(bytes.length).toBeLessThanOrEqual(255);
		});

		it('should only truncate filename, not directory path', () => {
			const longFilename = 'a'.repeat(300) + '.md';
			const path = 'folder/subfolder/' + longFilename;
			const result = service.sanitize(path);

			// Directory should remain intact
			expect(result.startsWith('folder/subfolder/')).toBe(true);

			// But filename should be truncated
			const filename = result.split('/').pop()!;
			const encoder = new TextEncoder();
			expect(encoder.encode(filename).length).toBeLessThanOrEqual(255);
		});

		it('should handle truncation when entire input is a filename (no path)', () => {
			const longFilename = 'a'.repeat(300) + '.md';
			const result = service.sanitize(longFilename);

			const encoder = new TextEncoder();
			expect(encoder.encode(result).length).toBeLessThanOrEqual(255);
		});
	});

	describe('sanitize - edge cases', () => {
		it('should handle filename with only illegal characters', () => {
			const result = service.sanitize('???***');
			expect(result).toBe('unnamed');
		});

		it('should handle empty segments in paths', () => {
			const result = service.sanitize('folder//file.md');
			expect(result).toBe('folder/file.md');
		});

		it('should handle path ending with slash', () => {
			const result = service.sanitize('folder/subfolder/');
			expect(result).toBe('folder/subfolder');
		});

		it('should handle complex real-world filename', () => {
			const result = service.sanitize('Meeting Notes (2024-01-01) - Project "Alpha".md');
			expect(result).toBe('Meeting Notes (2024-01-01) - Project Alpha.md');
		});

		it('should handle filename with parentheses and hyphens', () => {
			const result = service.sanitize('file(1)-copy.md');
			expect(result).toBe('file(1)-copy.md');
		});

		it('should handle underscores and other safe special characters', () => {
			const result = service.sanitize('file_name-v2.0.md');
			expect(result).toBe('file_name-v2.0.md');
		});

		it('should replace segment that becomes empty after sanitization', () => {
			const result = service.sanitize('folder/???/file.md');
			expect(result).toBe('folder/unnamed/file.md');
		});

		it('should handle very deep nesting', () => {
			const deepPath = 'a/b/c/d/e/f/g/h/i/j/k/file.md';
			const result = service.sanitize(deepPath);
			expect(result).toBe(deepPath);
		});
	});

	describe('sanitize - Unicode and internationalization', () => {
		it('should preserve valid Unicode characters', () => {
			const result = service.sanitize('日本語.md');
			expect(result).toBe('日本語.md');
		});

		it('should preserve emoji', () => {
			const result = service.sanitize('📝 notes.md');
			expect(result).toBe('📝 notes.md');
		});

		it('should preserve Arabic characters', () => {
			const result = service.sanitize('ملف.md');
			expect(result).toBe('ملف.md');
		});

		it('should preserve Cyrillic characters', () => {
			const result = service.sanitize('файл.md');
			expect(result).toBe('файл.md');
		});

		it('should handle mixed scripts', () => {
			const result = service.sanitize('file-ファイル-文件.md');
			expect(result).toBe('file-ファイル-文件.md');
		});
	});

	describe('sanitize - options handling', () => {
		it('should use empty string as default replacement', () => {
			const result = service.sanitize('file*name.md');
			expect(result).toBe('filename.md');
		});

		it('should use custom replacement character', () => {
			const result = service.sanitize('file*name.md', { replacement: '-' });
			expect(result).toBe('file-name.md');
		});

		it('should use forward slash as default separator', () => {
			const result = service.sanitize('folder\\file.md');
			expect(result).toBe('folder/file.md');
		});

		it('should use custom separator', () => {
			const result = service.sanitize('folder/file.md', { separator: '|' });
			expect(result).toBe('folder|file.md');
		});

		it('should apply both custom replacement and separator', () => {
			const result = service.sanitize('folder\\file*name.md', {
				replacement: '_',
				separator: '\\'
			});
			expect(result).toBe('folder\\file_name.md');
		});

		it('should handle empty replacement option', () => {
			const result = service.sanitize('file*name.md', { replacement: '' });
			expect(result).toBe('filename.md');
		});
	});

	describe('sanitize - regression tests', () => {
		it('should handle whitespace correctly', () => {
			const result = service.sanitize('my file name.md');
			expect(result).toBe('my file name.md');
		});

		it('should handle tabs', () => {
			const result = service.sanitize('file\tname.md');
			expect(result).toBe('filename.md'); // Tabs are control characters
		});

		it('should handle newlines', () => {
			const result = service.sanitize('file\nname.md');
			expect(result).toBe('filename.md'); // Newlines are control characters
		});

		it('should preserve extension', () => {
			const result = service.sanitize('dangerous?.md');
			expect(result).toBe('dangerous.md');
		});

		it('should handle multiple extensions', () => {
			const result = service.sanitize('file.tar.gz');
			expect(result).toBe('file.tar.gz');
		});

		it('should handle files without extension', () => {
			const result = service.sanitize('README');
			expect(result).toBe('README');
		});

		it('should handle hidden files (starting with dot)', () => {
			const result = service.sanitize('.gitignore');
			expect(result).toBe('.gitignore');
		});
	});
});
