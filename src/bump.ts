import semver from "semver";
import type { RawCommit } from "./git.js";
import { extractVersion, parseConventionalCommit } from "./parser.js";

export interface BumpResult {
  currentVersion: string;
  nextVersion: string;
  bumpType: "major" | "minor" | "patch" | "none";
  hasBreaking: boolean;
  hasFeatures: boolean;
  hasFixes: boolean;
}

export function suggestNextVersion(commits: RawCommit[], lastTag: string | null): BumpResult {
  const currentVersion = lastTag ? extractVersionFromTag(lastTag) : "0.0.0";
  const isPrerelease = (semver.parse(currentVersion)?.prerelease.length ?? 0) > 0;
  const conventionalCommits = commits
    .map(parseConventionalCommit)
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const hasBreaking = conventionalCommits.some((c) => c.breaking);
  const hasFeatures = conventionalCommits.some((c) => c.type === "feat");
  const hasFixes = conventionalCommits.some((c) => c.type === "fix" || c.type === "perf");

  let bumpType: "major" | "minor" | "patch" | "none" = "none";

  if (hasBreaking) {
    const parsed = semver.parse(currentVersion);
    if (parsed && parsed.major === 0) {
      bumpType = "minor";
    } else {
      bumpType = "major";
    }
  } else if (hasFeatures) {
    bumpType = "minor";
  } else if (hasFixes) {
    bumpType = "patch";
  }

  let nextVersion: string;
  
  const parsedVersion = semver.parse(currentVersion);
  const stableVersion = parsedVersion
    ? `${parsedVersion.major}.${parsedVersion.minor}.${parsedVersion.patch}`
    : currentVersion;

  if (isPrerelease && bumpType === "patch") {
    nextVersion = stableVersion;
  } else if (bumpType === "none") {
    nextVersion = currentVersion;
  } else {
    nextVersion = semver.inc(isPrerelease ? stableVersion : currentVersion, bumpType) || currentVersion;
  }

  return {
    currentVersion,
    nextVersion,
    bumpType,
    hasBreaking,
    hasFeatures,
    hasFixes,
  };
}

export function getNextPrereleaseVersion(
  baseVersion: string,
  suffix: string,
  allTags: string[]
): string {
  const suffixBase = suffix.replace(/^\-/, "").replace(/\.\d+$/, "");
  const pattern = new RegExp(`^v?${escapeRegex(baseVersion)}-${escapeRegex(suffixBase)}\\.(\\d+)$`);

  let maxNum = 0;
  for (const tag of allTags) {
    const match = tag.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `${baseVersion}-${suffixBase}.${maxNum + 1}`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractVersionFromTag(tag: string): string {
  return extractVersion(tag) ?? "0.0.0";
}
