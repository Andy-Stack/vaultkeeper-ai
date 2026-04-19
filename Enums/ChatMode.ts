export enum ChatMode {
    ReadOnly = 0,
    Edit = 1,
    Planning = 2
}

export function chatModeAllowsEdits(mode: ChatMode) {
    return mode === ChatMode.Edit || mode === ChatMode.Planning;
}

export function iconForChatMode(mode: ChatMode) {
    switch (mode) {
        case ChatMode.ReadOnly:
            return "eye";
        case ChatMode.Edit:
            return "pencil";
        case ChatMode.Planning:
            return "list-checks";
    }
}