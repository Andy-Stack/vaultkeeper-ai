import * as Diff from 'diff';
import type VaultkeeperAIPlugin from 'main';
import { Resolve } from './DependencyService';
import { Services } from './Services';
import type { EventService } from './EventService';
import { Event } from 'Enums/Event';
import type { Diff2HtmlUIConfig } from 'diff2html/lib/ui/js/diff2html-ui-base';
import { ColorSchemeType, OutputFormatType } from 'diff2html/lib/types';
import { Component } from 'obsidian';
import { AbortService } from './AbortService';

interface DiffResult {
    accepted: boolean;
    suggestion?: string;
}

export class DiffService extends Component {

    private readonly plugin: VaultkeeperAIPlugin;
    private readonly eventService: EventService;
    private readonly abortService: AbortService;

    private diffResolve?: (result: DiffResult) => void;

    private ongoingDiff: boolean = false;

    public constructor() {
        super();
        this.plugin = Resolve<VaultkeeperAIPlugin>(Services.VaultkeeperAIPlugin);
        this.eventService = Resolve<EventService>(Services.EventService);
        this.abortService = Resolve<AbortService>(Services.AbortService);

        this.registerEvent(this.eventService.on(Event.DiffClosed, () => {
            this.cancelPendingDiff();
        }));
    }

    public async requestDiff(oldFileName: string, newFileName: string, oldContent: string, newContent: string): Promise<DiffResult> {
        const diffString = this.createDiffString(oldFileName, newFileName, oldContent, newContent);

        const outputFormat: OutputFormatType = "line-by-line";

        const config: Diff2HtmlUIConfig = {
            drawFileList: false,
            matching: "words",
            outputFormat: outputFormat,
            highlight: false,
            fileListToggle: false,
            fileContentToggle: false,
            synchronisedScroll: true,
            colorScheme: ColorSchemeType.AUTO
        };

        this.ongoingDiff = true;

        const signal = this.abortService.signal();
        return new Promise<DiffResult>((resolve, reject) => {
            if (signal.aborted) {
                this.finishDiff();
                reject(this.abortService.reason());
                return;
            }

            const abortHandler = () => {
                this.finishDiff();
                reject(this.abortService.reason());
            };
            signal.addEventListener("abort", abortHandler, { once: true });

            this.diffResolve = (result: DiffResult) => {
                signal.removeEventListener("abort", abortHandler);
                resolve(result);
            };

            void this.plugin.activateDiffView(diffString, config);
            this.eventService.trigger(Event.DiffOpened);
        });
    }

    public onAccept() {
        if (this.diffResolve) {
            this.diffResolve({ accepted: true });
        }
        this.finishDiff();
    }

    public onReject() {
        if (this.diffResolve) {
            this.diffResolve({ accepted: false });
        }
        this.finishDiff();
    }

    public onSuggest(suggestion: string) {
        if (this.diffResolve) {
            this.diffResolve({ accepted: false, suggestion: suggestion });
        }
        this.finishDiff();
    }

    private cancelPendingDiff() {
        if (this.ongoingDiff) {
            if (this.diffResolve) {
                this.diffResolve({ accepted: false });
            }
            this.finishDiff();
        }
    }

    private createDiffString(oldFileName: string, newFileName: string, oldContent: string, newContent: string): string {
        return Diff.createTwoFilesPatch(oldFileName, newFileName, oldContent, newContent, undefined, undefined, { context: Infinity });
    }

    private finishDiff() {
        this.ongoingDiff = false;
        this.diffResolve = undefined;
        this.eventService.trigger(Event.DiffClosed);
    }

}