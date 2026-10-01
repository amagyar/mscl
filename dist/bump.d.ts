import type { RawCommit } from "./git.js";
export interface BumpResult {
    currentVersion: string;
    nextVersion: string;
    bumpType: "major" | "minor" | "patch" | "none";
    hasBreaking: boolean;
    hasFeatures: boolean;
    hasFixes: boolean;
}
export declare function suggestNextVersion(commits: RawCommit[], lastTag: string | null): BumpResult;
export declare function getNextPrereleaseVersion(baseVersion: string, suffix: string, allTags: string[]): string;
