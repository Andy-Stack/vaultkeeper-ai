import { describe, it, expect, vi } from 'vitest';
import { openPluginSettings, closePluginSettings } from '../../Helpers/ObsidianInternals';

describe('ObsidianInternals', () => {
	describe('openPluginSettings', () => {
		it('should call app.setting.open and openTabById', () => {
			const mockPlugin = {
				app: {
					setting: {
						open: vi.fn(),
						openTabById: vi.fn()
					}
				},
				manifest: {
					id: 'test-plugin-id'
				}
			} as any;

			openPluginSettings(mockPlugin);

			expect(mockPlugin.app.setting.open).toHaveBeenCalledOnce();
			expect(mockPlugin.app.setting.openTabById).toHaveBeenCalledWith('test-plugin-id');
		});

		it('should open settings tab with correct plugin id', () => {
			const pluginId = 'ai-agent-plugin';
			const mockPlugin = {
				app: {
					setting: {
						open: vi.fn(),
						openTabById: vi.fn()
					}
				},
				manifest: {
					id: pluginId
				}
			} as any;

			openPluginSettings(mockPlugin);

			expect(mockPlugin.app.setting.openTabById).toHaveBeenCalledWith(pluginId);
		});

		it('should do nothing when app.setting is missing', () => {
			const mockPlugin = {
				app: {},
				manifest: {
					id: 'test-plugin-id'
				}
			} as any;

			expect(() => openPluginSettings(mockPlugin)).not.toThrow();
		});
	});

	describe('closePluginSettings', () => {
		it('should call app.setting.close', () => {
			const mockPlugin = {
				app: {
					setting: {
						close: vi.fn()
					}
				},
				manifest: {
					id: 'test-plugin-id'
				}
			} as any;

			closePluginSettings(mockPlugin);

			expect(mockPlugin.app.setting.close).toHaveBeenCalledOnce();
		});

		it('should do nothing when app.setting is missing', () => {
			const mockPlugin = {
				app: {},
				manifest: {
					id: 'test-plugin-id'
				}
			} as any;

			expect(() => closePluginSettings(mockPlugin)).not.toThrow();
		});
	});
});
