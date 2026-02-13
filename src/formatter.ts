import type { ConventionalCommit } from "./parser.js";
import type { RemoteInfo } from "./remote.js";
import { buildCommitUrl } from "./remote.js";

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

const TYPE_LABELS: Record<string, string> = {
  feat: "Features",
  fix: "Bug Fixes",
  docs: "Documentation",
  style: "Styles",
  refactor: "Code Refactoring",
  perf: "Performance Improvements",
  test: "Tests",
  build: "Build System",
  ci: "Continuous Integration",
  chore: "Chores",
  revert: "Reverts",
};

const TYPE_ORDER = [
  "feat",
  "fix",
  "perf",
  "refactor",
  "docs",
  "style",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
];

const VISIBLE_TYPES = new Set(["feat", "fix", "perf", "revert"]);

const ISSUE_REGEX = /#(\d+)/g;

export function formatChangelog(
  changelogs: TagChangelog[],
  options: FormatOptions = {}
): string {
  const lines: string[] = ["# Changelog", ""];
  const { remote, verbose = false } = options;

  const sortedChangelogs = [...changelogs].reverse();

  for (let i = 0; i < sortedChangelogs.length; i++) {
    const entry = sortedChangelogs[i];
    if (!entry) continue;

    const { tag, displayTag, originalTag, date, commits } = entry;
    if (commits.length === 0) continue;

    const filteredCommits = verbose
      ? commits
      : commits.filter((c) => VISIBLE_TYPES.has(c.type));

    if (filteredCommits.length === 0) continue;

    const headerUrl = buildHeaderUrl(sortedChangelogs, i, remote);
    const header = formatHeader(displayTag, date, headerUrl);
    lines.push(header, "");

    const breakingCommits = filteredCommits.filter((c) => c.breaking);
    if (breakingCommits.length > 0) {
      lines.push("### ⚠ BREAKING CHANGES", "");
      for (const commit of breakingCommits) {
        const scope = commit.scope ? `**${commit.scope}**: ` : "";
        const subject = linkifyReferences(commit.subject, remote);
        const hashLink = formatHashLink(commit.hash, remote);
        lines.push(`- ${scope}${subject} ${hashLink}`);
      }
      lines.push("");
    }

    const grouped = groupByType(filteredCommits);

    for (const type of TYPE_ORDER) {
      const typeCommits = grouped[type];
      if (!typeCommits || typeCommits.length === 0) continue;

      const label = TYPE_LABELS[type] || type;
      lines.push(`### ${label}`, "");

      for (const commit of typeCommits) {
        const scope = commit.scope ? `**${commit.scope}**: ` : "";
        const subject = linkifyReferences(commit.subject, remote);
        const hashLink = formatHashLink(commit.hash, remote);
        lines.push(`- ${scope}${subject} ${hashLink}`);
      }

      lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

function formatHeader(displayTag: string, date: string, url: string | null): string {
  const version = displayTag.replace(/^v/, "");
  if (url) {
    return date ? `## [${version}](${url}) (${date})` : `## [${version}](${url})`;
  }
  return date ? `## ${displayTag} (${date})` : `## ${displayTag}`;
}

function buildHeaderUrl(
  changelogs: TagChangelog[],
  currentIndex: number,
  remote?: RemoteInfo | null
): string | null {
  if (!remote) return null;

  const current = changelogs[currentIndex];
  if (!current) return null;

  const baseUrl = `https://${remote.host}/${remote.owner}/${remote.repo}`;

  const prevIndex = currentIndex + 1;
  const prev = changelogs[prevIndex];

  if (!prev) {
    return `${baseUrl}/releases/tag/${encodeURIComponent(current.originalTag)}`;
  }

  return `${baseUrl}/compare/${encodeURIComponent(prev.originalTag)}...${encodeURIComponent(current.originalTag)}`;
}

function groupByType(commits: ConventionalCommit[]): Record<string, ConventionalCommit[]> {
  const grouped: Record<string, ConventionalCommit[]> = {};

  for (const commit of commits) {
    if (!grouped[commit.type]) {
      grouped[commit.type] = [];
    }
    grouped[commit.type].push(commit);
  }

  return grouped;
}

function formatHashLink(hash: string, remote?: RemoteInfo | null): string {
  const shortHash = hash.slice(0, 7);
  if (remote) {
    const url = buildCommitUrl(remote, hash);
    return `([${shortHash}](${url}))`;
  }
  return `(${shortHash})`;
}

function linkifyReferences(text: string, remote?: RemoteInfo | null): string {
  if (!remote) return text;

  return text.replace(ISSUE_REGEX, (match, num) => {
    const url = `https://${remote.host}/${remote.owner}/${remote.repo}/issues/${num}`;
    return `[#${num}](${url})`;
  });
}
