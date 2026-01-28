import { DebugColor } from "Enums/DebugColor";

export class DebugService {

    private debugColor: DebugColor = DebugColor.WHITE;

    public setDebugColor(debugColor: DebugColor): void {
        this.debugColor = debugColor;
    }

    public log(level: string, message: string): void {
        console.log(`%c${level}: ${message}`, `color:${this.debugColor};`);
    }

}