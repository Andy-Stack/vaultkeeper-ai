import { describe, it, expect, vi, afterEach } from 'vitest';
import { DocumentReport } from '../../DocumentValidation/DocumentReport';
import { DocumentValidationService } from '../../Services/DocumentValidationService';
import type { IDocumentValidationResult } from '../../DocumentValidation/IDocumentValidationResult';
import type { IValidationIssue } from '../../DocumentValidation/IValidationIssue';
import type { IValidationStage } from '../../DocumentValidation/IValidationStage';
import type { IVaultChange } from '../../Services/TemporaryVaultService';
import { createChange, deleteChange } from './fakeVault';

function makeResult(issues: IValidationIssue[], description: string): IDocumentValidationResult {
	return {
		issueCount: () => issues.length,
		issuesFor: (vaultChange: IVaultChange) => issues.filter(issue => issue.changePath === (vaultChange.newPath || vaultChange.oldPath)),
		toString: () => description
	};
}

describe('DocumentReport', () => {
	it('should total the issues across every validation result', () => {
		const report = new DocumentReport([
			makeResult([{ changePath: 'a.md' }, { changePath: 'b.md' }], 'first'),
			makeResult([{ changePath: 'a.md' }], 'second')
		]);

		expect(report.issueCount()).toBe(3);
	});

	it('should have no issues when there are no results', () => {
		expect(new DocumentReport([]).issueCount()).toBe(0);
	});

	it('should count the issues caused by a single vault change', () => {
		const report = new DocumentReport([
			makeResult([{ changePath: 'a.md' }, { changePath: 'b.md' }], 'first'),
			makeResult([{ changePath: 'a.md' }], 'second')
		]);

		expect(report.issueCountFor(createChange('a.md', ''))).toBe(2);
		expect(report.issueCountFor(createChange('b.md', ''))).toBe(1);
		expect(report.issueCountFor(createChange('c.md', ''))).toBe(0);
	});

	it('should join the result descriptions line by line', () => {
		const report = new DocumentReport([makeResult([], 'first'), makeResult([], 'second')]);

		expect(report.toString()).toBe('first\nsecond');
	});
});

describe('DocumentValidationService', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	function stage(result: IDocumentValidationResult): IValidationStage & { validate: ReturnType<typeof vi.fn> } {
		return { validate: vi.fn().mockResolvedValue(result) };
	}

	it('should have no report or issues before one is generated', () => {
		const service = new DocumentValidationService();

		expect(service.documentReport).toBeUndefined();
		expect(service.issueCount()).toBe(0);
	});

	it('should run every stage and combine the results into a report', async () => {
		const service = new DocumentValidationService();
		const first = stage(makeResult([{ changePath: 'a.md' }], 'links'));
		const second = stage(makeResult([{ changePath: 'b.md' }, { changePath: 'b.md' }], 'quotes'));
		service.stages.push(first, second);

		await service.generateReport();

		expect(first.validate).toHaveBeenCalledTimes(1);
		expect(second.validate).toHaveBeenCalledTimes(1);
		expect(service.issueCount()).toBe(3);
		expect(service.documentReport?.toString()).toBe('links\nquotes');
	});

	it('should run the stages one after another in order', async () => {
		const service = new DocumentValidationService();
		const order: string[] = [];
		const makeStage = (name: string): IValidationStage => ({
			validate: async () => {
				order.push(`${name}:start`);
				await Promise.resolve();
				order.push(`${name}:end`);
				return makeResult([], name);
			}
		});
		service.stages.push(makeStage('one'), makeStage('two'));

		await service.generateReport();

		expect(order).toEqual(['one:start', 'one:end', 'two:start', 'two:end']);
	});

	it('should replace the previous report when generated again', async () => {
		const service = new DocumentValidationService();
		service.stages.push(stage(makeResult([{ changePath: 'a.md' }], 'links')));
		await service.generateReport();
		const firstReport = service.documentReport;

		service.stages.length = 0;
		await service.generateReport();

		expect(service.documentReport).not.toBe(firstReport);
		expect(service.issueCount()).toBe(0);
	});

	describe('assignContinuityIssuesToVaultChanges', () => {
		it('should do nothing before a report exists', () => {
			const service = new DocumentValidationService();
			const change = createChange('a.md', '');

			service.assignContinuityIssuesToVaultChanges([change]);

			expect(change.continuityIssueCount).toBeUndefined();
			expect(change.continuityIssues).toBeUndefined();
		});

		it('should attach to each change the issues it caused', async () => {
			const service = new DocumentValidationService();
			const linkIssue = { changePath: 'a.md' };
			const otherIssue = { changePath: 'b.md' };
			service.stages.push(
				stage(makeResult([linkIssue, otherIssue], 'links')),
				stage(makeResult([{ changePath: 'a.md' }], 'quotes'))
			);
			await service.generateReport();
			const changeA = createChange('a.md', '');
			const changeB = deleteChange('b.md', '');
			const changeC = createChange('c.md', '');

			service.assignContinuityIssuesToVaultChanges([changeA, changeB, changeC]);

			expect(changeA.continuityIssueCount).toBe(2);
			expect(changeA.continuityIssues).toHaveLength(2);
			expect(changeA.continuityIssues![0]).toBe(linkIssue);
			expect(changeB.continuityIssueCount).toBe(1);
			expect(changeB.continuityIssues).toEqual([otherIssue]);
			expect(changeC.continuityIssueCount).toBe(0);
			expect(changeC.continuityIssues).toEqual([]);
		});
	});
});
