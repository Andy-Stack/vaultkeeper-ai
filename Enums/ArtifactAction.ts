import { Copy } from "Enums/Copy";

export enum ArtifactAction {
    Create = "create",
    Modify = "modify",
    Delete = "delete"
}

export const ARTIFACT_ACTION_RANK = {
    [ArtifactAction.Create]: 0,
    [ArtifactAction.Modify]: 1,
    [ArtifactAction.Delete]: 2,
};

export function isArtifactAction(value: string): value is ArtifactAction {
    return Object.values(ArtifactAction).includes(value as ArtifactAction);
}

export function artifactActionToCopy(artifactAction: ArtifactAction): string {
    switch (artifactAction) {
        case ArtifactAction.Create:
            return Copy.ArtifactActionCreated;
        case ArtifactAction.Modify:
            return Copy.ArtifactActionModified;
        case ArtifactAction.Delete:
            return Copy.ArtifactActionDeleted;
    }
}