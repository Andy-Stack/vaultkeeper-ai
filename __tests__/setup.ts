/**
 * Test setup file - runs before all tests
 */

import { afterEach, vi } from 'vitest';

// Mock global window if needed
if (typeof global.window === 'undefined') {
	global.window = {} as any;
}

// Obsidian global aliases used in source code
if (typeof (global as any).activeWindow === 'undefined') {
	(global as any).activeWindow = {
		setTimeout: globalThis.setTimeout.bind(globalThis),
		clearTimeout: globalThis.clearTimeout.bind(globalThis),
		getSelection: () => (typeof document !== 'undefined' ? document.getSelection() : null),
		window: typeof window !== 'undefined' ? window : global.window,
		document: typeof document !== 'undefined' ? document : undefined,
	};
}
if (typeof (global as any).activeDocument === 'undefined') {
	(global as any).activeDocument = typeof document !== 'undefined' ? document : undefined;
}

// Note: Component class is now defined in __mocks__/obsidian.ts
// The vitest alias in vitest.config.ts handles mocking 'obsidian' imports

// Add Obsidian's DOM helpers (empty(), createDiv(), createEl(), createSpan(), createFragment())
// for testing. Obsidian patches these onto HTMLElement.prototype at runtime, and also
// exposes createDiv/createEl/createSpan/createFragment as bare globals.
if (typeof HTMLElement !== 'undefined') {
	HTMLElement.prototype.empty = function() {
		while (this.firstChild) {
			this.removeChild(this.firstChild);
		}
	};

	type DomElementInfo = {
		cls?: string | string[];
		text?: string | DocumentFragment;
		attr?: Record<string, string | number | boolean | null>;
		title?: string;
		parent?: Node;
		value?: string;
		type?: string;
		prepend?: boolean;
		placeholder?: string;
		href?: string;
	};

	function applyElementInfo(el: HTMLElement, options?: string | DomElementInfo): void {
		if (!options) return;
		const info: DomElementInfo = typeof options === 'string' ? { cls: options } : options;

		if (info.cls) {
			const classes = Array.isArray(info.cls) ? info.cls : [info.cls];
			el.classList.add(...classes.filter(Boolean));
		}
		if (info.text !== undefined) {
			if (info.text instanceof DocumentFragment) {
				el.appendChild(info.text);
			} else {
				el.textContent = info.text;
			}
		}
		if (info.title !== undefined) el.setAttribute('title', info.title);
		if (info.value !== undefined) el.setAttribute('value', info.value);
		if (info.type !== undefined) el.setAttribute('type', info.type);
		if (info.href !== undefined) el.setAttribute('href', info.href);
		if (info.placeholder !== undefined) el.setAttribute('placeholder', info.placeholder);
		if (info.attr) {
			for (const [key, value] of Object.entries(info.attr)) {
				if (value === null) continue;
				el.setAttribute(key, String(value));
			}
		}

		const parent = info.parent ?? el.parentNode;
		if (parent) {
			if (info.prepend) {
				parent.insertBefore(el, parent.firstChild);
			} else if (parent !== el.parentNode) {
				parent.appendChild(el);
			}
		}
	}

	function createElImpl<K extends keyof HTMLElementTagNameMap>(
		this: HTMLElement | void,
		tag: K,
		options?: string | DomElementInfo,
		callback?: (el: HTMLElementTagNameMap[K]) => void
	): HTMLElementTagNameMap[K] {
		const el = document.createElement(tag);
		applyElementInfo(el, options);
		if (this instanceof HTMLElement && el.parentNode !== this) {
			this.appendChild(el);
		}
		if (callback) callback(el);
		return el;
	}

	HTMLElement.prototype.createEl = function(tag: string, options?: string | DomElementInfo, callback?: (el: HTMLElement) => void) {
		return createElImpl.call(this, tag as keyof HTMLElementTagNameMap, options, callback as any);
	};
	HTMLElement.prototype.createDiv = function(options?: string | DomElementInfo, callback?: (el: HTMLDivElement) => void) {
		return this.createEl('div', options, callback as any);
	};
	HTMLElement.prototype.createSpan = function(options?: string | DomElementInfo, callback?: (el: HTMLSpanElement) => void) {
		return this.createEl('span', options, callback as any);
	};

	(global as any).createEl = (tag: string, options?: string | DomElementInfo, callback?: (el: HTMLElement) => void) =>
		createElImpl.call(undefined, tag as keyof HTMLElementTagNameMap, options, callback as any);
	(global as any).createDiv = (options?: string | DomElementInfo, callback?: (el: HTMLDivElement) => void) =>
		createElImpl.call(undefined, 'div', options, callback as any);
	(global as any).createSpan = (options?: string | DomElementInfo, callback?: (el: HTMLSpanElement) => void) =>
		createElImpl.call(undefined, 'span', options, callback as any);
	(global as any).createFragment = (callback?: (el: DocumentFragment) => void) => {
		const fragment = document.createDocumentFragment();
		if (callback) callback(fragment);
		return fragment;
	};
}

// Clean up after each test
afterEach(() => {
	vi.clearAllMocks();
});
