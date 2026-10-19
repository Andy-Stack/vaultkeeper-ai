import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LegacyConversationMigration } from '../../Helpers/LegacyConversationMigration';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { Path } from '../../Enums/Path';
import { Exception } from '../../Helpers/Exception';

describe('LegacyConversationMigration', () => {
	let conversations: Map<string, any>;
	let mockFileSystemService: any;

	beforeEach(() => {
		conversations = new Map();
		mockFileSystemService = {
			listFilesInDirectory: vi.fn(async () => [...conversations.keys()].map(path => ({ path }))),
			readObjectFromFile: vi.fn(async (path: string) => {
				const conversation = conversations.get(path);
				return conversation instanceof Error ? conversation : structuredClone(conversation);
			}),
			writeObjectToFile: vi.fn(async (path: string, data: object) => {
				conversations.set(path, data);
				return {};
			})
		};
		RegisterSingleton(Services.FileSystemService, mockFileSystemService);
		vi.spyOn(Exception, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		DeregisterAllServices();
		vi.restoreAllMocks();
	});

	const legacyCall = (extra: object = {}) => JSON.stringify({ toolCall: { name: 'search_vault_files', args: { q: 'x' }, ...extra } });

	it('should list the conversations folder non-recursively with plugin root access', async () => {
		await LegacyConversationMigration.migrate();

		expect(mockFileSystemService.listFilesInDirectory).toHaveBeenCalledWith(Path.Conversations, { recursive: false, allowAccessToPluginRoot: true });
	});

	it('should convert a legacy single call into a one item toolCalls array', async () => {
		conversations.set('a.json', { contents: [{ role: 'assistant', toolCall: legacyCall({ id: 'call_1' }), toolId: 'call_1' }] });

		await LegacyConversationMigration.migrate();

		const [content] = conversations.get('a.json').contents;
		expect(content).not.toHaveProperty('toolCall');
		expect(content).not.toHaveProperty('toolId');
		expect(JSON.parse(content.toolCalls)).toEqual([{ toolCall: { id: 'call_1', name: 'search_vault_files', args: { q: 'x' } } }]);
		expect(mockFileSystemService.writeObjectToFile).toHaveBeenCalledWith('a.json', expect.anything(), { allowAccessToPluginRoot: true });
	});

	it('should take the call id from the content toolId when the call has none', async () => {
		conversations.set('a.json', { contents: [{ role: 'assistant', toolCall: legacyCall(), toolId: 'from_content' }] });

		await LegacyConversationMigration.migrate();

		expect(JSON.parse(conversations.get('a.json').contents[0].toolCalls)[0].toolCall.id).toBe('from_content');
	});

	it('should use an empty id when neither the call nor the content has one', async () => {
		conversations.set('a.json', { contents: [{ role: 'assistant', toolCall: legacyCall() }] });

		await LegacyConversationMigration.migrate();

		expect(JSON.parse(conversations.get('a.json').contents[0].toolCalls)[0].toolCall.id).toBe('');
	});

	it('should move the content thought signature onto the call', async () => {
		conversations.set('a.json', { contents: [{ role: 'assistant', toolCall: legacyCall(), thoughtSignature: 'sig==' }] });

		await LegacyConversationMigration.migrate();

		const [content] = conversations.get('a.json').contents;
		expect(content).not.toHaveProperty('thoughtSignature');
		expect(JSON.parse(content.toolCalls)[0].toolCall.thoughtSignature).toBe('sig==');
	});

	it('should keep a signature already on the call', async () => {
		conversations.set('a.json', { contents: [{ role: 'assistant', toolCall: legacyCall({ thoughtSignature: 'own==' }), thoughtSignature: 'other==' }] });

		await LegacyConversationMigration.migrate();

		expect(JSON.parse(conversations.get('a.json').contents[0].toolCalls)[0].toolCall.thoughtSignature).toBe('own==');
	});

	it('should drop an unreadable legacy call but still remove the legacy fields', async () => {
		conversations.set('a.json', { contents: [{ role: 'assistant', toolCall: 'not json {', thoughtSignature: 'sig==' }] });

		await LegacyConversationMigration.migrate();

		const [content] = conversations.get('a.json').contents;
		expect(content).not.toHaveProperty('toolCall');
		expect(content).not.toHaveProperty('toolCalls');
		expect(content).not.toHaveProperty('thoughtSignature');
		expect(Exception.log).toHaveBeenCalled();
	});

	it('should remove legacy fields that hold no call', async () => {
		conversations.set('a.json', { contents: [{ role: 'user', toolCall: '', thoughtSignature: '' }] });

		await LegacyConversationMigration.migrate();

		const [content] = conversations.get('a.json').contents;
		expect(content).toEqual({ role: 'user' });
	});

	it('should leave functionResponse toolIds alone', async () => {
		conversations.set('a.json', { contents: [
			{ role: 'assistant', toolCall: legacyCall({ id: 'c1' }), toolId: 'c1' },
			{ role: 'user', functionResponse: '{}', toolId: 'c1' }
		] });

		await LegacyConversationMigration.migrate();

		expect(conversations.get('a.json').contents[1].toolId).toBe('c1');
	});

	it('should not rewrite conversations that are already current', async () => {
		conversations.set('a.json', { contents: [{ role: 'assistant', toolCalls: JSON.stringify([{ toolCall: { id: 'x', name: 'n', args: {} } }]) }] });

		await LegacyConversationMigration.migrate();

		expect(mockFileSystemService.writeObjectToFile).not.toHaveBeenCalled();
	});

	it('should only rewrite the files that contained legacy content', async () => {
		conversations.set('current.json', { contents: [{ role: 'user', content: 'hi' }] });
		conversations.set('legacy.json', { contents: [{ role: 'assistant', toolCall: legacyCall({ id: 'a' }) }] });

		await LegacyConversationMigration.migrate();

		expect(mockFileSystemService.writeObjectToFile).toHaveBeenCalledTimes(1);
		expect(mockFileSystemService.writeObjectToFile.mock.calls[0][0]).toBe('legacy.json');
	});

	it('should skip files that cannot be read or have no contents array', async () => {
		conversations.set('error.json', new Error('unreadable'));
		conversations.set('shape.json', { contents: 'nope' });
		conversations.set('legacy.json', { contents: [{ role: 'assistant', toolCall: legacyCall({ id: 'a' }) }] });

		await LegacyConversationMigration.migrate();

		expect(mockFileSystemService.writeObjectToFile).toHaveBeenCalledTimes(1);
	});

	it('should log and continue when one file fails to migrate', async () => {
		conversations.set('bad.json', { contents: [{ role: 'assistant', toolCall: legacyCall({ id: 'a' }) }] });
		conversations.set('good.json', { contents: [{ role: 'assistant', toolCall: legacyCall({ id: 'b' }) }] });
		mockFileSystemService.writeObjectToFile.mockImplementationOnce(async () => { throw new Error('disk full'); });

		await LegacyConversationMigration.migrate();

		expect(Exception.log).toHaveBeenCalledWith(expect.stringContaining('Failed to migrate conversation bad.json: disk full'));
		expect(conversations.get('good.json').contents[0]).toHaveProperty('toolCalls');
	});

	it('should be idempotent', async () => {
		conversations.set('a.json', { contents: [{ role: 'assistant', toolCall: legacyCall({ id: 'a' }) }] });

		await LegacyConversationMigration.migrate();
		mockFileSystemService.writeObjectToFile.mockClear();
		await LegacyConversationMigration.migrate();

		expect(mockFileSystemService.writeObjectToFile).not.toHaveBeenCalled();
	});
});
