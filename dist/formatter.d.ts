import type { ConventionalCommit } from "./parser.js";
import type { RemoteInfo } from "./remote.js";
export interface TagChangelog {
    tag: string;
    displayTag: string;
    originalTag: string;
    date: string;
    commits: ConventionalCommit[];
}
export interface FormatOptions {
    remote?: RemoteInfo | null;
    verbose?: boolean;
}
export declare function formatChangelog(changelogs: TagChangelog[], options?: FormatOptions): string;
