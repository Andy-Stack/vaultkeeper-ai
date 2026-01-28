import { DebugColor } from "Enums/DebugColor";

declare global {
    interface Window {
        debugServiceLog: (level: string, message: string) => void;
    }
}

export class DebugService {

    private debugColor: DebugColor = DebugColor.WHITE;

    public constructor() {
        window.debugServiceLog = (level: string, message: string) => {
            console.log(`%c${level}: ${message}`, `color:${this.debugColor};`);
        };
    }

    public setDebugColor(debugColor: DebugColor): void {
        this.debugColor = debugColor;
    }

    public log(level: string, message: string): void {
        window.debugServiceLog(level, message);
    }

}