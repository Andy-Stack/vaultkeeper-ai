import * as Diff from 'diff';
import type VaultkeeperAIPlugin from 'main';
import { Resolve } from './DependencyService';
import { Services } from './Services';
import type { EventService } from './EventService';
import { Event } from 'Enums/Event';
import type { Diff2HtmlUIConfig } from 'diff2html/lib/ui/js/diff2html-ui-base';
import { ColorSchemeType } from 'diff2html/lib/types';
import { Component } from 'obsidian';
import { AbortService } from './AbortService';
import type { Artifact } from 'Conversations/Artifact';
import type { IDocumentReport } from '../DocumentValidation/IDocumentReport';
import type { IVaultChange, IVaultChangeRequest, TemporaryVaultService } from './TemporaryVaultService';
import type { IVaultChangeResponse } from './VaultService';
import { Exception } from 'Helpers/Exception';
import { basename } from 'path-browserify';
import { DiffState } from 'Enums/DiffState';
import { AIToolResponse } from 'AIClasses/ToolDefinitions/AIToolResponse';
import type { SettingsService } from './SettingsService';
import type { DocumentValidationService } from './DocumentValidationService';

export class DiffService extends Component {

    private readonly plugin: VaultkeeperAIPlugin;
    private readonly eventService: EventService;
    private readonly abortService: AbortService;
    private readonly settingsService: SettingsService;
    private readonly temporaryVaultService: TemporaryVaultService;
    private readonly documentValidationService: DocumentValidationService;

    private diffResolve?: () => void;

    private ongoingDiff: boolean = false;

    private readonly config: Diff2HtmlUIConfig = {
        drawFileList: false,
        matching: "words",
        outputFormat: "line-by-line",
        highlight: false,
        fileListToggle: false,
        fileContentToggle: false,
        synchronisedScroll: true,
        colorScheme: ColorSchemeType.AUTO
    };

    public constructor() {
        super();
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.eventService = Resolve<EventService>(Services.EventService);
        this.abortService = Resolve<AbortService>(Services.AbortService);
        this.settingsService = Resolve<SettingsService>(Services.SettingsService);
        this.temporaryVaultService = Resolve<TemporaryVaultService>(Services.TemporaryVaultService);
        this.documentValidationService = Resolve<DocumentValidationService>(Services.DocumentValidationService);

        this.registerEvent(this.eventService.on(Event.DiffClosed, () => this.onDiffClosed()));
    }

    public async proposeChanges<T>(vaultChangeRequests: IVaultChangeRequest<T>[]): Promise<{results: IVaultChangeResponse<T>[], report?: IDocumentReport}> {
        try {
            this.temporaryVaultService.reset();
            this.temporaryVaultService.addAll(vaultChangeRequests);

            if (this.settingsService.settings.freeEdit) {
                vaultChangeRequests.forEach(request => request.status = DiffState.Accepted);
            } else {
                await this.processDiffRequest(vaultChangeRequests);
            }
            
            const results: IVaultChangeResponse<T>[] = [];

            for (const vaultChangeRequest of vaultChangeRequests) {
                if (vaultChangeRequest.status === DiffState.Accepted) {
                    results.push(await vaultChangeRequest.changeAction());
                } else if (vaultChangeRequest.status === DiffState.Suggestion) {
                    const suggestion = vaultChangeRequest.suggestion?.trim();
                    const message = suggestion ? `${AIToolResponse.UserSuggestionMessage}\n${suggestion}` : AIToolResponse.UserEmptySuggestionMessage;
                    results.push({ error: Exception.new(message) });
                } else {
                    results.push({ error: Exception.new(AIToolResponse.UserRejectionMessage) });
                }
            }

            if (this.settingsService.settings.enableAgentContinuity) {
                return { results: results, report: this.documentValidationService.documentReport }
            }

            return { results: results };
        } catch (error) {
            if (AbortService.isAbortError(error)) {
                throw error;
            }
            this.eventService.trigger(Event.DiffClosed);
            Exception.log(error);

            return { results: vaultChangeRequests.map(() => ({ error: Exception.new(error) })) };
        }
    }

    public showArtifactDiff(artifact: Artifact): void {
        const diffString = this.createDiffString(artifact.filePath,
            artifact.filePath, artifact.originalContent, artifact.updatedContent);
        void this.plugin.activateArtifactView(artifact, diffString, this.config);
    }

    private processDiffRequest(vaultChanges: IVaultChange[]): Promise<void> {
        const signal = this.abortService.signal();

        for (const vaultChange of vaultChanges) {
            // diff2html needs a filename on both sides; /dev/null marks a created or deleted file
            vaultChange.diffString = this.createDiffString(
                vaultChange.oldPath ? basename(vaultChange.oldPath) : "/dev/null",
                vaultChange.newPath ? basename(vaultChange.newPath) : "/dev/null",
                vaultChange.oldContent ?? "",
                vaultChange.newContent ?? ""
            );
        }
    
        return new Promise<void>((resolve, reject) => {
            if (signal.aborted) {
                reject(this.abortService.reason());
                return;
            }
    
            const abortHandler = () => {
                this.diffResolve = undefined;
                this.ongoingDiff = false;
                this.eventService.trigger(Event.DiffClosed); // close the view
                reject(this.abortService.reason());
            };
            signal.addEventListener("abort", abortHandler, { once: true });
    
            this.diffResolve = () => {
                signal.removeEventListener("abort", abortHandler);
                resolve();
            };
    
            this.ongoingDiff = true;
            void this.plugin.activateDiffView(this.config);
            this.eventService.trigger(Event.DiffOpened);
        });
    }

    private createDiffString(oldFileName: string, newFileName: string, oldContent: string, newContent: string): string {
        return Diff.createTwoFilesPatch(oldFileName, newFileName, oldContent, newContent, undefined, undefined, { context: Infinity });
    }
    
    private onDiffClosed() {
        if (!this.ongoingDiff) {
            return;
        }
        this.ongoingDiff = false;
        const resolve = this.diffResolve;
        this.diffResolve = undefined;
        resolve?.();
    }

}

// private async proposeChange<T>(oldFileName: string, newFileName: string, oldContent: string, newContent: string,
//     options: IVaultOptions, performChange: () => Promise<T>): Promise<IVaultChangeResponse<T>> {
//         try {
//             if (!options.requiresConfirmation) {
//                 return { result: await performChange() };
//             }

//             const report = this.settingsService.settings.enableContinuity 
//                 ? this.documentValidationService.generateReport()
//                 : undefined;

//             if (this.settingsService.settings.freeEdit) {
//                 if (this.settingsService.settings.enableAgentContinuity) {
//                     return { result: await performChange(), report: report };
//                 } else {
//                     return { result: await performChange() };
//                 }
//             }

//             const result = !options.requiresConfirmation ? { accepted: true } :
//                 await this.diffService.requestDiff(oldFileName, newFileName, oldContent, newContent, report);

//             if (result.accepted) {
//                 if (this.settingsService.settings.enableAgentContinuity) {
//                     return { result: await performChange(), report: report };
//                 } else {
//                     return { result: await performChange() };
//                 }
//             }

//             let response = AIToolResponse.UserRejectionMessage;
//             if (result.suggestion) {
//                 response = `${AIToolResponse.UserSuggestionMessage}\n${result.suggestion}`;
//             }
//             return { error: Exception.new(response), report: report };
//         } catch (error) {
//             if (AbortService.isAbortError(error)) {
//                 throw error;
//             }
//             this.eventService.trigger(Event.DiffClosed);
//             Exception.log(error);

//             return { error: Exception.new(error) };
//         }
// }