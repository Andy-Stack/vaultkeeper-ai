/**
 * Test setup file - runs before all tests
 */

import { afterEach, vi } from 'vitest';

// Mock global window if needed
if (typeof global.window === 'undefined') {
	global.window = {} as any;
}

// Add Obsidian's .empty() method to HTMLElement prototype for testing
if (typeof HTMLElement !== 'undefined') {
	HTMLElement.prototype.empty = function() {
		while (this.firstChild) {
			this.removeChild(this.firstChild);
		}
	};
}

// Clean up after each test
afterEach(() => {
	vi.clearAllMocks();
});
