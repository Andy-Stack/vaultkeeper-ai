import { vi } from 'vitest';
import { parse as parseYamlImpl } from 'yaml';

export function parseYaml(content: string): unknown {
	return parseYamlImpl(content);
}

export class Component {
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
	public register(cb: () => void): void { void cb; }
	public registerEvent(eventRef: { unload: () => void }): void { void eventRef; }
	public registerDomEvent(el: HTMLElement, type: string, callback: EventListener, options?: AddEventListenerOptions): void { void el; void type; void callback; void options; }
	public registerInterval(id: number): number {
		return id;
	}
}

export class Plugin {
	app: unknown;
	manifest: unknown;
	constructor() {
		this.app = {};
		this.manifest = {};
	}
	addCommand() {}
	addRibbonIcon() {}
	addSettingTab() {}
	loadData() { return Promise.resolve({}); }
	saveData() { return Promise.resolve(); }
	registerView() {}
}

export class PluginSettingTab {
	app: unknown;
	plugin: unknown;
	containerEl: unknown;
	constructor(app: unknown, plugin: unknown) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = { createEl: vi.fn(), empty: vi.fn() };
	}
	display() {}
	hide() {}
}

export class ItemView {
	app: unknown;
	leaf: unknown;
	containerEl: unknown = { createEl: vi.fn(), empty: vi.fn() };
	constructor() {
		this.app = {};
		this.leaf = {};
	}
	getViewType() { return 'test-view'; }
	getDisplayText() { return 'Test view'; }
	onOpen() { return Promise.resolve(); }
	onClose() { return Promise.resolve(); }
}

export class Modal {
	app: unknown;
	containerEl: unknown;
	titleEl: unknown;
	contentEl: unknown;
	constructor(app: unknown) {
		this.app = app;
		this.containerEl = { createEl: vi.fn(), empty: vi.fn() };
		this.titleEl = { createEl: vi.fn(), empty: vi.fn() };
		this.contentEl = { createEl: vi.fn(), empty: vi.fn() };
	}
	open() {}
	close() {}
}

export class Notice {
	constructor() {}
	hide() {}
}

export class TFile {
	path: string = '';
	name: string = '';
	basename: string = '';
	extension: string = '';
	stat: { ctime: number; mtime: number; size: number } = { ctime: Date.now(), mtime: Date.now(), size: 0 };
	parent: unknown = null;
	vault: unknown;
}

export class TFolder {
	path: string = '';
	name: string = '';
	children: unknown[] = [];
	parent: unknown = null;
	vault: unknown;
}

export interface TAbstractFile {
	vault: unknown;
	path: string;
	name: string;
	parent: TFolder | null;
}

export function normalizePath(path: string): string {
	return path.replace(/\\/g, '/');
}

export const requestUrl = vi.fn(() => Promise.resolve({
	status: 200,
	text: '',
	json: {},
	arrayBuffer: new ArrayBuffer(0),
	headers: {}
}));

export const setIcon = vi.fn();

export class Vault {
	adapter: unknown;

	constructor() {
		this.adapter = {
			exists: vi.fn(() => Promise.resolve(false)),
			read: vi.fn(() => Promise.resolve('')),
			write: vi.fn(() => Promise.resolve()),
			remove: vi.fn(() => Promise.resolve()),
			mkdir: vi.fn(() => Promise.resolve())
		};
	}

	getMarkdownFiles() { return []; }
	getAbstractFileByPath() { return null; }
	create() { return Promise.resolve(); }
	modify() { return Promise.resolve(); }
	process() { return Promise.resolve(); }
	read() { return Promise.resolve(''); }
	cachedRead() { return Promise.resolve(''); }
	delete() { return Promise.resolve(); }
	rename() { return Promise.resolve(); }
	createFolder() { return Promise.resolve(); }
}

export class FileManager {
	renameFile = vi.fn(() => Promise.resolve());
}

export class WorkspaceLeaf {
	view: unknown;
	getViewState() { return {}; }
	setViewState() { return Promise.resolve(); }
}

export class Setting {
	settingEl: unknown;

	constructor() {
		this.settingEl = { createEl: vi.fn(), empty: vi.fn() };
	}

	setName() { return this; }
	setDesc() { return this; }
	addText() { return this; }
	addToggle() { return this; }
	addDropdown() { return this; }
	addButton() { return this; }
	addTextArea() { return this; }
	addSlider() { return this; }
	then() { return this; }
}

export class Events {
	private events: Map<string, Array<(...data: unknown[]) => unknown>> = new Map();

	on(name: string, callback: (...data: unknown[]) => unknown, ctx?: unknown): { unload: () => void } {
		if (!this.events.has(name)) {
			this.events.set(name, []);
		}
		const boundCallback: (...data: unknown[]) => unknown = ctx
			? (...args: unknown[]) => callback.apply(ctx, args)
			: callback;
		this.events.get(name)!.push(boundCallback);
		return {
			unload: () => this.off(name, boundCallback)
		};
	}

	off(name: string, callback: (...data: unknown[]) => unknown): void {
		const callbacks = this.events.get(name);
		if (callbacks) {
			const index = callbacks.indexOf(callback);
			if (index > -1) {
				callbacks.splice(index, 1);
			}
		}
	}

	offref(ref: { unload: () => void }): void {
		ref.unload();
	}

	trigger(name: string, ...data: unknown[]): void {
		const callbacks = this.events.get(name);
		if (callbacks) {
			for (const callback of callbacks) {
				callback(...data);
			}
		}
	}

	tryTrigger(name: string, ...data: unknown[]): void {
		this.trigger(name, ...data);
	}
}
