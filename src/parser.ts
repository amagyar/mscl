import semver from "semver";
import type { RawCommit } from "./git.js";

export interface ConventionalCommit {
  hash: string;
  type: string;
  scope: string | null;
  subject: string;
  raw: string;
  breaking: boolean;
}

const CONVENTIONAL_COMMIT_REGEX =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w-]+\))?!?:\s*(.+)$/i;

const BREAKING_CHANGE_REGEX = /^BREAKING[ -]CHANGE:\s*/im;

export const VISIBLE_TYPES = ["feat", "fix", "perf", "revert"] as const;
export const ALL_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
] as const;

const VERSION_EXTRACT_REGEX = /(?:.*-)?v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/;

export interface TagInfo {
  original: string;
  clean: string;
  display: string;
}

export interface TagMap {
  versions: string[];
  tags: Map<string, TagInfo>;
}

export function extractVersion(tag: string): string | null {
  const match = tag.match(VERSION_EXTRACT_REGEX);
  return match ? match[1] : null;
}

export function isValidVersion(tag: string): boolean {
  const extracted = extractVersion(tag);
  return extracted !== null && semver.valid(extracted) !== null;
}

export function normalizeTags(tags: string[]): TagMap {
  const versionMap = new Map<string, TagInfo[]>();

  for (const tag of tags) {
    const clean = extractVersion(tag);
    if (!clean) continue;

    const parsed = semver.parse(clean);
    if (!parsed) continue;

    if (!versionMap.has(clean)) {
      versionMap.set(clean, []);
    }

    const existing = versionMap.get(clean)!;
    existing.push({
      original: tag,
      clean,
      display: `v${clean}`,
    });
  }

  const result = new Map<string, TagInfo>();

  for (const [clean, infos] of versionMap) {
    const sorted = infos.sort((a, b) => {
      const aIsVPrefixed = a.original.match(/^v\d/);
      const bIsVPrefixed = b.original.match(/^v\d/);

      if (aIsVPrefixed && !bIsVPrefixed) return -1;
      if (!aIsVPrefixed && bIsVPrefixed) return 1;

      return a.original.length - b.original.length;
    });

    result.set(clean, sorted[0]);
  }

  const versions = Array.from(result.keys()).sort((a, b) => semver.compare(a, b));

  return { versions, tags: result };
}

export function isPreRelease(version: string): boolean {
  const parsed = semver.parse(version);
  return parsed !== null && parsed.prerelease.length > 0;
}

export function sortTagsBySemver(tags: string[]): string[] {
  const { versions, tags: tagMap } = normalizeTags(tags);
  return versions.map((v) => tagMap.get(v)!.original);
}

export function parseConventionalCommit(commit: RawCommit): ConventionalCommit | null {
  const match = commit.subject.match(CONVENTIONAL_COMMIT_REGEX);
  if (!match) return null;

  const [, type, scopeRaw, subject] = match;
  const scope = scopeRaw ? scopeRaw.slice(1, -1) : null;

  const hasBang = /(?:\))?!:/.test(commit.subject);

  const hasBreakingFooter = BREAKING_CHANGE_REGEX.test(commit.body);

  return {
    hash: commit.hash,
    type: type.toLowerCase(),
    scope,
    subject: subject.trim(),
    raw: commit.subject,
    breaking: hasBang || hasBreakingFooter,
  };
}

export function normalizeCommit(commit: ConventionalCommit): string {
  return `${commit.type}${commit.scope ? `(${commit.scope})` : ""}: ${commit.subject}`.toLowerCase().trim();
}

export function isVisibleType(type: string, verbose: boolean): boolean {
  if (verbose) return true;
  return VISIBLE_TYPES.includes(type as (typeof VISIBLE_TYPES)[number]);
}
