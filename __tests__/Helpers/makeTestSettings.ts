import { DEFAULT_SETTINGS, type IVaultkeeperAISettings } from 'Services/SettingsService';

/**
 * Builds a complete IVaultkeeperAISettings for tests, starting from the real
 * DEFAULT_SETTINGS so the mock can never drift from the production shape. Adding
 * a new required setting only requires updating DEFAULT_SETTINGS, not every test.
 */
export function makeTestSettings(
    overrides: Partial<IVaultkeeperAISettings> = {}
): IVaultkeeperAISettings {
    return structuredClone({ ...DEFAULT_SETTINGS, ...overrides });
}
