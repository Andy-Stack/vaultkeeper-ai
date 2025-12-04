/**
 * Test setup file - runs before all tests
 */

import { afterEach, vi } from 'vitest';

// Mock global window if needed
if (typeof global.window === 'undefined') {
	global.window = {} as any;
}

// Mock Obsidian's Component class
vi.mock('obsidian', async () => {
	const actual = await vi.importActual('obsidian');
	return {
		...actual,
		Component: class Component {
			public load() {}
			public onload() {}
			public unload() {}
			public onunload() {}
			public addChild<T extends Component>(component: T): T {
				return component;
			}
			public removeChild<T extends Component>(component: T): T {
				return component;
			}
			public register(_cb: () => any): void {}
			public registerEvent(_eventRef: any): void {}
			public registerDomEvent(_el: any, _type: any, _callback: any, _options?: any): void {}
			public registerInterval(id: number): number {
				return id;
			}
		}
	};
});

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
