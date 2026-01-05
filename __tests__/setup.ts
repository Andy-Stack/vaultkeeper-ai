/**
 * Test setup file - runs before all tests
 */

import { afterEach, vi } from 'vitest';

// Mock global window if needed
if (typeof global.window === 'undefined') {
	global.window = {} as any;
}

// Note: Component class is now defined in __mocks__/obsidian.ts
// The vitest alias in vitest.config.ts handles mocking 'obsidian' imports

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
