import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InputService } from '../../Services/InputService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';

/**
 * UNIT TESTS
 *
 * These tests cover both simple methods and DOM/Selection API methods using JSDOM.
 * JSDOM provides the DOM environment needed for cursor manipulation and Range/Selection APIs.
 */

describe('InputService', () => {
	let service: InputService;
	let mockFileSystemService: any;

	beforeEach(() => {
		// Setup minimal mock for FileSystemService
		mockFileSystemService = {
			getFile: vi.fn(),
			readFile: vi.fn(),
			fileExists: vi.fn()
		};

		// Register dependency
		RegisterSingleton(Services.FileSystemService, mockFileSystemService);

		service = new InputService();
	});

	afterEach(() => {
		// Clear singleton registry to prevent memory leaks
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	describe('isPrintableKey', () => {
		it('should return true for single character keys', () => {
			expect(service.isPrintableKey('a')).toBe(true);
			expect(service.isPrintableKey('Z')).toBe(true);
			expect(service.isPrintableKey('5')).toBe(true);
			expect(service.isPrintableKey('!')).toBe(true);
			expect(service.isPrintableKey(' ')).toBe(true);
			expect(service.isPrintableKey('@')).toBe(true);
			expect(service.isPrintableKey('#')).toBe(true);
			expect(service.isPrintableKey('/')).toBe(true);
		});

		it('should return false for multi-character keys', () => {
			expect(service.isPrintableKey('Shift')).toBe(false);
			expect(service.isPrintableKey('Control')).toBe(false);
			expect(service.isPrintableKey('Alt')).toBe(false);
			expect(service.isPrintableKey('Escape')).toBe(false);
			expect(service.isPrintableKey('ArrowUp')).toBe(false);
			expect(service.isPrintableKey('ArrowDown')).toBe(false);
			expect(service.isPrintableKey('ArrowLeft')).toBe(false);
			expect(service.isPrintableKey('ArrowRight')).toBe(false);
			expect(service.isPrintableKey('Backspace')).toBe(false);
			expect(service.isPrintableKey('Delete')).toBe(false);
		});

		it('should return true for Enter key', () => {
			expect(service.isPrintableKey('Enter')).toBe(true);
		});

		it('should return true for Tab key', () => {
			expect(service.isPrintableKey('Tab')).toBe(true);
		});

		it('should return false when ctrl key is pressed', () => {
			expect(service.isPrintableKey('a', true, false)).toBe(false);
			expect(service.isPrintableKey('c', true, false)).toBe(false);
			expect(service.isPrintableKey('v', true, false)).toBe(false);
			expect(service.isPrintableKey('Enter', true, false)).toBe(false);
		});

		it('should return false when meta key is pressed', () => {
			expect(service.isPrintableKey('a', false, true)).toBe(false);
			expect(service.isPrintableKey('c', false, true)).toBe(false);
			expect(service.isPrintableKey('v', false, true)).toBe(false);
			expect(service.isPrintableKey('Enter', false, true)).toBe(false);
		});

		it('should return false when both ctrl and meta keys are pressed', () => {
			expect(service.isPrintableKey('a', true, true)).toBe(false);
			expect(service.isPrintableKey('Enter', true, true)).toBe(false);
		});

		it('should handle empty string', () => {
			expect(service.isPrintableKey('')).toBe(false);
		});

		it('should handle unicode characters', () => {
			expect(service.isPrintableKey('é')).toBe(true);
			expect(service.isPrintableKey('ñ')).toBe(true);
			// Emoji are typically 2+ characters (surrogate pairs), so they're not printable keys
			expect(service.isPrintableKey('🎉')).toBe(false);
		});

		it('should handle special function keys', () => {
			expect(service.isPrintableKey('F1')).toBe(false);
			expect(service.isPrintableKey('F12')).toBe(false);
		});

		it('should handle meta/control keys themselves', () => {
			expect(service.isPrintableKey('Meta')).toBe(false);
			expect(service.isPrintableKey('Control')).toBe(false);
		});
	});

	describe('isInSearchZone', () => {
		it('should return true when current position is greater than trigger position', () => {
			expect(service.isInSearchZone(5, 3)).toBe(true);
			expect(service.isInSearchZone(10, 0)).toBe(true);
			expect(service.isInSearchZone(100, 50)).toBe(true);
		});

		it('should return false when current position equals trigger position', () => {
			expect(service.isInSearchZone(5, 5)).toBe(false);
			expect(service.isInSearchZone(0, 0)).toBe(false);
			expect(service.isInSearchZone(100, 100)).toBe(false);
		});

		it('should return false when current position is less than trigger position', () => {
			expect(service.isInSearchZone(3, 5)).toBe(false);
			expect(service.isInSearchZone(0, 10)).toBe(false);
			expect(service.isInSearchZone(50, 100)).toBe(false);
		});

		it('should handle position 0', () => {
			expect(service.isInSearchZone(0, 0)).toBe(false);
			expect(service.isInSearchZone(1, 0)).toBe(true);
			expect(service.isInSearchZone(0, 1)).toBe(false);
		});

		it('should handle negative positions', () => {
			expect(service.isInSearchZone(-1, -2)).toBe(true);
			expect(service.isInSearchZone(-2, -1)).toBe(false);
			expect(service.isInSearchZone(0, -1)).toBe(true);
		});

		it('should handle large position values', () => {
			expect(service.isInSearchZone(1000000, 999999)).toBe(true);
			expect(service.isInSearchZone(999999, 1000000)).toBe(false);
		});

		it('should handle boundary case: consecutive positions', () => {
			expect(service.isInSearchZone(6, 5)).toBe(true);
			expect(service.isInSearchZone(5, 6)).toBe(false);
		});
	});


	describe('getTextFromDataTransfer', () => {
		it('should extract text/plain from DataTransfer', () => {
			const mockClipboardData = {
				getData: vi.fn((type: string) => {
					if (type === 'text/plain') return 'Plain text content';
					return '';
				})
			} as unknown as DataTransfer;

			const result = service.getTextFromDataTransfer(mockClipboardData);
			expect(result).toBe('Plain text content');
			expect(mockClipboardData.getData).toHaveBeenCalledWith('text/plain');
		});

		it('should return empty string for null clipboard', () => {
			const result = service.getTextFromDataTransfer(null);
			expect(result).toBe('');
		});

		it('should return empty string when getData returns empty', () => {
			const mockClipboardData = {
				getData: vi.fn(() => '')
			} as unknown as DataTransfer;

			const result = service.getTextFromDataTransfer(mockClipboardData);
			expect(result).toBe('');
		});

		it('should handle clipboard with no text/plain data', () => {
			const mockClipboardData = {
				getData: vi.fn(() => null)
			} as unknown as DataTransfer;

			const result = service.getTextFromDataTransfer(mockClipboardData);
			expect(result).toBe('');
		});
	});

	describe('hasUnauthorizedHTML', () => {
		let element: HTMLDivElement;

		beforeEach(() => {
			element = document.createElement('div');
			element.contentEditable = 'true';
		});

		it('should return false for text-only content', () => {
			element.textContent = 'Plain text content';
			expect(service.hasUnauthorizedHTML(element)).toBe(false);
		});

		it('should return false for BR tags (browser auto-insert)', () => {
			const br = document.createElement('br');
			element.appendChild(br);
			expect(service.hasUnauthorizedHTML(element)).toBe(false);
		});

		it('should return false for DIV with only text content', () => {
			const div = document.createElement('div');
			div.textContent = 'Text in div';
			element.appendChild(div);
			expect(service.hasUnauthorizedHTML(element)).toBe(false);
		});

		it('should return false for DIV with BR tags', () => {
			const div = document.createElement('div');
			div.textContent = 'Line 1';
			const br = document.createElement('br');
			div.appendChild(br);
			div.appendChild(document.createTextNode('Line 2'));
			element.appendChild(div);
			expect(service.hasUnauthorizedHTML(element)).toBe(false);
		});

		it('should return false for search trigger elements', () => {
			const trigger = document.createElement('span');
			trigger.className = 'search-trigger';
			trigger.textContent = '#tag';
			element.appendChild(trigger);
			expect(service.hasUnauthorizedHTML(element)).toBe(false);
		});

		it('should return false for mixed text, BR, DIV, and search triggers', () => {
			element.appendChild(document.createTextNode('Text '));
			const trigger = document.createElement('span');
			trigger.className = 'search-trigger';
			element.appendChild(trigger);
			element.appendChild(document.createTextNode(' more text'));
			const br = document.createElement('br');
			element.appendChild(br);
			const div = document.createElement('div');
			div.textContent = 'Div content';
			element.appendChild(div);

			expect(service.hasUnauthorizedHTML(element)).toBe(false);
		});

		it('should return true for SPAN tags (non-search-trigger)', () => {
			const span = document.createElement('span');
			span.textContent = 'Regular span';
			element.appendChild(span);
			expect(service.hasUnauthorizedHTML(element)).toBe(true);
		});

		it('should return true for STRONG tags', () => {
			const strong = document.createElement('strong');
			strong.textContent = 'Bold text';
			element.appendChild(strong);
			expect(service.hasUnauthorizedHTML(element)).toBe(true);
		});

		it('should return true for IMG tags', () => {
			const img = document.createElement('img');
			img.src = 'test.png';
			element.appendChild(img);
			expect(service.hasUnauthorizedHTML(element)).toBe(true);
		});

		it('should return true for SCRIPT tags', () => {
			const script = document.createElement('script');
			script.textContent = 'alert("test")';
			element.appendChild(script);
			expect(service.hasUnauthorizedHTML(element)).toBe(true);
		});

		it('should return true for A (anchor) tags', () => {
			const a = document.createElement('a');
			a.href = 'http://example.com';
			a.textContent = 'Link';
			element.appendChild(a);
			expect(service.hasUnauthorizedHTML(element)).toBe(true);
		});

		it('should detect unauthorized HTML in nested DIVs', () => {
			const div = document.createElement('div');
			const span = document.createElement('span');
			span.textContent = 'Nested span';
			div.appendChild(span);
			element.appendChild(div);
			expect(service.hasUnauthorizedHTML(element)).toBe(true);
		});

		it('should return true for deeply nested unauthorized elements', () => {
			const div1 = document.createElement('div');
			const div2 = document.createElement('div');
			const unauthorized = document.createElement('em');
			unauthorized.textContent = 'Italic';
			div2.appendChild(unauthorized);
			div1.appendChild(div2);
			element.appendChild(div1);
			expect(service.hasUnauthorizedHTML(element)).toBe(true);
		});

		it('should handle empty element', () => {
			expect(service.hasUnauthorizedHTML(element)).toBe(false);
		});

		it('should handle element with only whitespace', () => {
			element.textContent = '   \n   ';
			expect(service.hasUnauthorizedHTML(element)).toBe(false);
		});
	});

	describe('DOM Manipulation Methods', () => {
		let element: HTMLDivElement;

		beforeEach(() => {
			// Create a contentEditable element
			element = document.createElement('div');
			element.contentEditable = 'true';
			element.textContent = 'Hello World';
			document.body.appendChild(element);
		});

		afterEach(() => {
			document.body.removeChild(element);
		});

		describe('getCursorPosition', () => {
			it('should return -1 when no selection exists', () => {
				// Clear any existing selection
				const selection = window.getSelection();
				if (selection) {
					selection.removeAllRanges();
				}

				const position = service.getCursorPosition(element);
				expect(position).toBe(-1);
			});

			it('should return cursor position at start of text', () => {
				const range = document.createRange();
				const selection = window.getSelection();
				const textNode = element.firstChild as Text;

				range.setStart(textNode, 0);
				range.setEnd(textNode, 0);
				selection?.removeAllRanges();
				selection?.addRange(range);

				const position = service.getCursorPosition(element);
				expect(position).toBe(0);
			});

			it('should return cursor position in middle of text', () => {
				const range = document.createRange();
				const selection = window.getSelection();
				const textNode = element.firstChild as Text;

				range.setStart(textNode, 6); // After "Hello "
				range.setEnd(textNode, 6);
				selection?.removeAllRanges();
				selection?.addRange(range);

				const position = service.getCursorPosition(element);
				expect(position).toBe(6);
			});

			it('should return cursor position at end of text', () => {
				const range = document.createRange();
				const selection = window.getSelection();
				const textNode = element.firstChild as Text;

				range.setStart(textNode, 11); // After "Hello World"
				range.setEnd(textNode, 11);
				selection?.removeAllRanges();
				selection?.addRange(range);

				const position = service.getCursorPosition(element);
				expect(position).toBe(11);
			});

			it('should handle nested elements', () => {
				element.innerHTML = '';
				element.appendChild(document.createTextNode('Hello '));
				const span = document.createElement('span');
				span.textContent = 'World';
				element.appendChild(span);

				const range = document.createRange();
				const selection = window.getSelection();
				const spanTextNode = span.firstChild as Text;

				range.setStart(spanTextNode, 2); // "Wo" - position 8 overall
				range.setEnd(spanTextNode, 2);
				selection?.removeAllRanges();
				selection?.addRange(range);

				const position = service.getCursorPosition(element);
				expect(position).toBe(8);
			});
		});

		describe('setCursorPosition', () => {
			it('should return false for non-contentEditable element', () => {
				const nonEditable = document.createElement('div');
				nonEditable.textContent = 'Not editable';
				document.body.appendChild(nonEditable);

				const result = service.setCursorPosition(nonEditable, 5);
				expect(result).toBe(false);

				document.body.removeChild(nonEditable);
			});

			it('should set cursor at start of text', () => {
				const result = service.setCursorPosition(element, 0);
				expect(result).toBe(true);

				const position = service.getCursorPosition(element);
				expect(position).toBe(0);
			});

			it('should set cursor in middle of text', () => {
				const result = service.setCursorPosition(element, 6);
				expect(result).toBe(true);

				const position = service.getCursorPosition(element);
				expect(position).toBe(6);
			});

			it('should set cursor at end of text', () => {
				const result = service.setCursorPosition(element, 11);
				expect(result).toBe(true);

				const position = service.getCursorPosition(element);
				expect(position).toBe(11);
			});

			it('should clamp position beyond text length', () => {
				const result = service.setCursorPosition(element, 999);
				expect(result).toBe(true);

				const position = service.getCursorPosition(element);
				expect(position).toBe(11); // Max length
			});

			it('should set cursor from end with fromEnd=true', () => {
				const result = service.setCursorPosition(element, 5, true);
				expect(result).toBe(true);

				const position = service.getCursorPosition(element);
				expect(position).toBe(6); // 11 - 5 = 6
			});

			it('should set cursor at start when fromEnd position exceeds length', () => {
				const result = service.setCursorPosition(element, 999, true);
				expect(result).toBe(true);

				const position = service.getCursorPosition(element);
				expect(position).toBe(0);
			});

			it('should handle nested elements', () => {
				element.innerHTML = '';
				element.appendChild(document.createTextNode('Hello '));
				const span = document.createElement('span');
				span.textContent = 'World';
				element.appendChild(span);

				const result = service.setCursorPosition(element, 8);
				expect(result).toBe(true);

				const position = service.getCursorPosition(element);
				expect(position).toBe(8);
			});

			it('should focus the element when setting cursor', () => {
				const focusSpy = vi.spyOn(element, 'focus');
				service.setCursorPosition(element, 5);
				expect(focusSpy).toHaveBeenCalled();
			});
		});

		describe('insertTextAtCursor', () => {
			it('should insert text at cursor position', () => {
				service.setCursorPosition(element, 6); // After "Hello "
				service.insertTextAtCursor('Beautiful ', element);

				expect(element.textContent).toBe('Hello Beautiful World');
			});

			it('should replace selected text', () => {
				const range = document.createRange();
				const selection = window.getSelection();
				const textNode = element.firstChild as Text;

				range.setStart(textNode, 6);
				range.setEnd(textNode, 11); // Select "World"
				selection?.removeAllRanges();
				selection?.addRange(range);

				service.insertTextAtCursor('Universe', element);
				expect(element.textContent).toBe('Hello Universe');
			});

			it('should not insert when no selection exists', () => {
				const selection = window.getSelection();
				selection?.removeAllRanges();

				const originalText = element.textContent;
				service.insertTextAtCursor('Test', element);
				expect(element.textContent).toBe(originalText);
			});

			it('should warn and not insert for non-contentEditable element', () => {
				const nonEditable = document.createElement('div');
				nonEditable.textContent = 'Not editable';
				document.body.appendChild(nonEditable);

				const consoleSpy = vi.spyOn(console, 'warn');
				service.insertTextAtCursor('Test', nonEditable);

				expect(consoleSpy).toHaveBeenCalledWith('Element must be contenteditable');
				document.body.removeChild(nonEditable);
			});
		});

		describe('insertElementAtCursor', () => {
			it('should insert element at cursor position', () => {
				service.setCursorPosition(element, 6); // After "Hello "

				const span = document.createElement('span');
				span.textContent = 'Beautiful ';
				service.insertElementAtCursor(span, element);

				expect(element.textContent).toBe('Hello Beautiful World');
				expect(element.querySelector('span')).toBeTruthy();
			});

			it('should insert search trigger element', () => {
				service.setCursorPosition(element, 6);

				const trigger = document.createElement('span');
				trigger.className = 'search-trigger';
				trigger.textContent = '#tag';
				service.insertElementAtCursor(trigger, element);

				expect(element.textContent).toBe('Hello #tagWorld');
				expect(element.querySelector('.search-trigger')).toBeTruthy();
			});

			it('should replace selected text with element', () => {
				const range = document.createRange();
				const selection = window.getSelection();
				const textNode = element.firstChild as Text;

				range.setStart(textNode, 6);
				range.setEnd(textNode, 11); // Select "World"
				selection?.removeAllRanges();
				selection?.addRange(range);

				const span = document.createElement('span');
				span.textContent = 'Universe';
				service.insertElementAtCursor(span, element);

				expect(element.textContent).toBe('Hello Universe');
			});

			it('should not insert when no selection exists', () => {
				const selection = window.getSelection();
				selection?.removeAllRanges();

				const childrenBefore = element.childNodes.length;
				const span = document.createElement('span');
				service.insertElementAtCursor(span, element);
				expect(element.childNodes.length).toBe(childrenBefore);
			});

			it('should warn and not insert for non-contentEditable element', () => {
				const nonEditable = document.createElement('div');
				nonEditable.textContent = 'Not editable';
				document.body.appendChild(nonEditable);

				const consoleSpy = vi.spyOn(console, 'warn');
				const span = document.createElement('span');
				service.insertElementAtCursor(span, nonEditable);

				expect(consoleSpy).toHaveBeenCalledWith('Element must be contenteditable');
				document.body.removeChild(nonEditable);
			});
		});

		describe('deleteTextRange', () => {
			it('should delete text range in middle', () => {
				service.deleteTextRange(6, 11, element); // Delete "World"
				expect(element.textContent).toBe('Hello ');
			});

			it('should delete from start', () => {
				service.deleteTextRange(0, 6, element); // Delete "Hello "
				expect(element.textContent).toBe('World');
			});

			it('should delete entire content', () => {
				service.deleteTextRange(0, 11, element);
				expect(element.textContent).toBe('');
			});

			it('should delete single character', () => {
				service.deleteTextRange(5, 6, element); // Delete space
				expect(element.textContent).toBe('HelloWorld');
			});

			it('should set cursor position after deletion', () => {
				service.deleteTextRange(6, 11, element); // Delete "World"
				const cursorPos = service.getCursorPosition(element);
				expect(cursorPos).toBe(6);
			});

			it('should handle nested elements', () => {
				element.innerHTML = '';
				element.appendChild(document.createTextNode('Hello '));
				const span = document.createElement('span');
				span.textContent = 'World';
				element.appendChild(span);

				service.deleteTextRange(6, 9, element); // Delete "Wor"
				expect(element.textContent).toBe('Hello ld');
			});

			it('should warn for non-contentEditable element', () => {
				const nonEditable = document.createElement('div');
				nonEditable.textContent = 'Not editable';
				document.body.appendChild(nonEditable);

				const consoleSpy = vi.spyOn(console, 'warn');
				service.deleteTextRange(0, 3, nonEditable);

				expect(consoleSpy).toHaveBeenCalledWith('Element must be contenteditable');
				expect(nonEditable.textContent).toBe('Not editable'); // Unchanged
				document.body.removeChild(nonEditable);
			});

			it('should handle invalid range gracefully', () => {
				const originalText = element.textContent;
				const consoleErrorSpy = vi.spyOn(console, 'error');

				// Try to delete with reversed positions (though implementation may handle this)
				service.deleteTextRange(999, 1000, element);

				// Text should either be unchanged or empty depending on implementation
				// We just verify it doesn't crash
				expect(consoleErrorSpy).not.toHaveBeenCalled();
			});
		});

		describe('sanitizeToPlainText', () => {
			it('should remove all HTML and keep plain text', () => {
				element.innerHTML = 'Hello <strong>World</strong>';
				service.setCursorPosition(element, 5);

				service.sanitizeToPlainText(element);

				expect(element.textContent).toBe('Hello World');
				expect(element.innerHTML).toBe('Hello World');
			});

			it('should preserve cursor position after sanitization', () => {
				element.innerHTML = 'Hello <strong>Bold</strong> World';
				service.setCursorPosition(element, 11); // After "Hello Bold "

				service.sanitizeToPlainText(element);

				const cursorPos = service.getCursorPosition(element);
				expect(cursorPos).toBe(11);
			});

			it('should handle cursor at start', () => {
				element.innerHTML = '<em>Italic</em> text';
				service.setCursorPosition(element, 0);

				service.sanitizeToPlainText(element);

				expect(element.textContent).toBe('Italic text');
				const cursorPos = service.getCursorPosition(element);
				expect(cursorPos).toBe(0);
			});

			it('should handle cursor at end', () => {
				element.innerHTML = 'Text <span>with span</span>';
				const textLength = element.textContent?.length || 0;
				service.setCursorPosition(element, textLength);

				service.sanitizeToPlainText(element);

				expect(element.textContent).toBe('Text with span');
				const cursorPos = service.getCursorPosition(element);
				expect(cursorPos).toBe(14);
			});

			it('should handle empty element', () => {
				element.innerHTML = '';
				service.sanitizeToPlainText(element);

				expect(element.textContent).toBe('');
			});

			it('should handle element with only HTML tags', () => {
				element.innerHTML = '<br><br>';
				service.sanitizeToPlainText(element);

				expect(element.innerHTML).toBe('');
			});

			it('should remove search trigger elements but keep text', () => {
				element.innerHTML = 'Query ';
				const trigger = document.createElement('span');
				trigger.className = 'search-trigger';
				trigger.textContent = '#tag';
				element.appendChild(trigger);
				element.appendChild(document.createTextNode(' text'));

				service.sanitizeToPlainText(element);

				expect(element.textContent).toBe('Query #tag text');
				expect(element.querySelector('.search-trigger')).toBeNull();
			});

			it('should handle nested HTML structures', () => {
				element.innerHTML = '<div><p>Nested <strong>content</strong></p></div>';
				service.setCursorPosition(element, 7); // After "Nested "

				service.sanitizeToPlainText(element);

				expect(element.textContent).toBe('Nested content');
				const cursorPos = service.getCursorPosition(element);
				expect(cursorPos).toBe(7);
			});
		});
	});
});
