export interface RemoteInfo {
    host: string;
    owner: string;
    repo: string;
}
export declare function parseRemoteUrl(url: string): RemoteInfo | null;
export declare function buildCommitUrl(remote: RemoteInfo, hash: string): string;
export declare function buildIssueUrl(remote: RemoteInfo, issue: string): string;
export declare function buildPullRequestUrl(remote: RemoteInfo, pr: string): string;
export declare function buildCompareUrl(remote: RemoteInfo, base: string, head: string): string;
export declare function buildReleaseUrl(remote: RemoteInfo, tag: string): string;
