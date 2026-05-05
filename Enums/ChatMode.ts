export enum ChatMode {
    ReadOnly = "read_only",
    Edit = "edit",
    Planning = "planning"
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