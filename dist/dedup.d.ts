import type { ConventionalCommit } from "./parser.js";
export declare class DeduplicationSet {
    private seen;
    has(commit: ConventionalCommit): boolean;
    add(commit: ConventionalCommit): void;
    private getKey;
}
export declare function dedupeCommits(commits: ConventionalCommit[], seenSet: DeduplicationSet): ConventionalCommit[];
