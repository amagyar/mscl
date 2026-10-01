export interface RawCommit {
    hash: string;
    subject: string;
    body: string;
}
export declare function isGitRepository(cwd: string): boolean;
export declare function getTags(cwd: string): string[];
export declare function getCommits(tag: string, cwd: string): RawCommit[];
export declare function getRemoteUrl(cwd: string): string | null;
export declare function getTagDate(tag: string, cwd: string): string;
export declare function getLastTag(cwd: string): string | null;
export declare function getCommitsSince(ref: string, cwd: string): RawCommit[];
