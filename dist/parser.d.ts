import type { RawCommit } from "./git.js";
export interface ConventionalCommit {
    hash: string;
    type: string;
    scope: string | null;
    subject: string;
    raw: string;
    breaking: boolean;
}
export declare const VISIBLE_TYPES: readonly ["feat", "fix", "perf", "revert"];
export declare const ALL_TYPES: readonly ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"];
export interface TagInfo {
    original: string;
    clean: string;
    display: string;
}
export interface TagMap {
    versions: string[];
    tags: Map<string, TagInfo>;
}
export declare function extractVersion(tag: string): string | null;
export declare function isValidVersion(tag: string): boolean;
export declare function normalizeTags(tags: string[]): TagMap;
export declare function isPreRelease(version: string): boolean;
export declare function sortTagsBySemver(tags: string[]): string[];
export declare function parseConventionalCommit(commit: RawCommit): ConventionalCommit | null;
export declare function normalizeCommit(commit: ConventionalCommit): string;
export declare function isVisibleType(type: string, verbose: boolean): boolean;
