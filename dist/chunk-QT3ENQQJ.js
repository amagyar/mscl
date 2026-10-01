// src/writer.ts
import { writeFile } from "fs/promises";
async function writeOutput(content, filePath) {
  if (filePath) {
    await writeFile(filePath, content, "utf-8");
  } else {
    process.stdout.write(content);
  }
}

// src/git.ts
import { execFileSync } from "child_process";

// src/parser.ts
import semver from "semver";
var CONVENTIONAL_COMMIT_REGEX = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w-]+\))?!?:\s*(.+)$/i;
var BREAKING_CHANGE_REGEX = /^BREAKING[ -]CHANGE:\s*/im;
var VERSION_EXTRACT_REGEX = /(?:.*-)?v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/;
function extractVersion(tag) {
  const match = tag.match(VERSION_EXTRACT_REGEX);
  return match ? match[1] : null;
}
function normalizeTags(tags) {
  const versionMap = /* @__PURE__ */ new Map();
  for (const tag of tags) {
    const clean = extractVersion(tag);
    if (!clean) continue;
    const parsed = semver.parse(clean);
    if (!parsed) continue;
    if (!versionMap.has(clean)) {
      versionMap.set(clean, []);
    }
    const existing = versionMap.get(clean);
    existing.push({
      original: tag,
      clean,
      display: `v${clean}`
    });
  }
  const result = /* @__PURE__ */ new Map();
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
function isPreRelease(version) {
  const parsed = semver.parse(version);
  return parsed !== null && parsed.prerelease.length > 0;
}
function parseConventionalCommit(commit) {
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
    breaking: hasBang || hasBreakingFooter
  };
}

// src/git.ts
function isGitRepository(cwd) {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    return true;
  } catch {
    return false;
  }
}
function getTags(cwd) {
  const output = execFileSync("git", ["tag"], {
    cwd,
    encoding: "utf-8"
  });
  return output.trim().split("\n").filter((tag) => tag.length > 0);
}
function getCommits(tag, cwd) {
  const output = execFileSync("git", ["log", "-z", "--format=%H%x00%s%x00%b", "--no-merges", "--end-of-options", tag], {
    cwd,
    encoding: "utf-8"
  });
  return parseCommitOutput(output);
}
function parseCommitOutput(output) {
  const fields = output.split("\0");
  const commits = [];
  for (let i = 0; i + 2 < fields.length; i += 3) {
    const hash = fields[i]?.trim();
    const subject = fields[i + 1];
    const body = fields[i + 2];
    if (!hash || !subject || body === void 0 || !isValidHashStart(hash)) continue;
    commits.push({ hash, subject, body: body.trim() });
  }
  return commits;
}
function isValidHashStart(s) {
  return /^[a-f0-9]{4,40}$/i.test(s.trim());
}
function getRemoteUrl(cwd) {
  try {
    const output = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    return output.trim();
  } catch {
    return null;
  }
}
function getTagDate(tag, cwd) {
  try {
    const output = execFileSync("git", ["log", "-1", "--format=%as", "--end-of-options", tag], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    return output.trim();
  } catch {
    return "";
  }
}
function getLastTag(cwd) {
  let tags;
  try {
    tags = getTags(cwd);
  } catch {
    return null;
  }
  const reachableTags = tags.filter((tag) => {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", `refs/tags/${tag}`, "HEAD"], {
        cwd,
        stdio: "ignore"
      });
      return true;
    } catch {
      return false;
    }
  });
  const { versions, tags: tagMap } = normalizeTags(reachableTags);
  const latestVersion = versions.at(-1);
  return latestVersion ? tagMap.get(latestVersion).original : null;
}
function getCommitsSince(ref, cwd) {
  const output = execFileSync("git", ["log", "-z", "--format=%H%x00%s%x00%b", "--no-merges", "--end-of-options", `${ref}..HEAD`], {
    cwd,
    encoding: "utf-8"
  });
  return parseCommitOutput(output);
}

// src/dedup.ts
var DeduplicationSet = class {
  seen = /* @__PURE__ */ new Set();
  has(commit) {
    const key = this.getKey(commit);
    return this.seen.has(key);
  }
  add(commit) {
    const key = this.getKey(commit);
    this.seen.add(key);
  }
  getKey(commit) {
    return `${commit.type}:${commit.scope ?? ""}:${commit.subject}`.toLowerCase();
  }
};
function dedupeCommits(commits, seenSet) {
  const result = [];
  for (const commit of commits) {
    if (!seenSet.has(commit)) {
      seenSet.add(commit);
      result.push(commit);
    }
  }
  return result;
}

// src/remote.ts
function parseRemoteUrl(url) {
  let host;
  let path;
  if (url.startsWith("git@")) {
    const match = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
    if (!match) return null;
    host = match[1];
    path = match[2];
  } else if (url.startsWith("https://") || url.startsWith("http://")) {
    const urlObj = new URL(url);
    host = urlObj.host;
    path = urlObj.pathname.slice(1).replace(/\.git$/, "");
  } else {
    return null;
  }
  const [owner, ...repoParts] = path.split("/");
  const repo = repoParts.join("/");
  if (!owner || !repo) return null;
  return { host, owner, repo };
}
function buildCommitUrl(remote, hash) {
  const prefix = isGitLab(remote) ? "-/" : "";
  return `${getBaseUrl(remote)}/${prefix}commit/${hash}`;
}
function buildIssueUrl(remote, issue) {
  const prefix = isGitLab(remote) ? "-/" : "";
  return `${getBaseUrl(remote)}/${prefix}issues/${issue}`;
}
function buildCompareUrl(remote, base, head) {
  const path = isGitLab(remote) ? "-/compare" : "compare";
  return `${getBaseUrl(remote)}/${path}/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;
}
function buildReleaseUrl(remote, tag) {
  const path = isGitLab(remote) ? "-/tags" : "releases/tag";
  return `${getBaseUrl(remote)}/${path}/${encodeURIComponent(tag)}`;
}
function getBaseUrl(remote) {
  const encodedPath = [remote.owner, ...remote.repo.split("/")].map(encodeURIComponent).join("/");
  return `https://${remote.host}/${encodedPath}`;
}
function isGitLab(remote) {
  return remote.host === "gitlab.com" || remote.host.toLowerCase().includes("gitlab");
}

// src/formatter.ts
var TYPE_LABELS = {
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
  revert: "Reverts"
};
var TYPE_ORDER = [
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
  "revert"
];
var VISIBLE_TYPES = /* @__PURE__ */ new Set(["feat", "fix", "perf", "revert"]);
var ISSUE_REGEX = /#(\d+)/g;
function formatChangelog(changelogs, options = {}) {
  const lines = ["# Changelog", ""];
  const { remote, verbose = false } = options;
  const sortedChangelogs = [...changelogs].reverse();
  for (let i = 0; i < sortedChangelogs.length; i++) {
    const entry = sortedChangelogs[i];
    if (!entry) continue;
    const { tag, displayTag, originalTag, date, commits } = entry;
    if (commits.length === 0) continue;
    const filteredCommits = verbose ? commits : commits.filter((c) => VISIBLE_TYPES.has(c.type));
    if (filteredCommits.length === 0) continue;
    const headerUrl = buildHeaderUrl(sortedChangelogs, i, remote);
    const header = formatHeader(displayTag, date, headerUrl);
    lines.push(header, "");
    const breakingCommits = filteredCommits.filter((c) => c.breaking);
    if (breakingCommits.length > 0) {
      lines.push("### \u26A0 BREAKING CHANGES", "");
      for (const commit of breakingCommits) {
        const scope = commit.scope ? `**${escapeMarkdown(commit.scope)}**: ` : "";
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
        const scope = commit.scope ? `**${escapeMarkdown(commit.scope)}**: ` : "";
        const subject = linkifyReferences(commit.subject, remote);
        const hashLink = formatHashLink(commit.hash, remote);
        lines.push(`- ${scope}${subject} ${hashLink}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n").trimEnd() + "\n";
}
function formatHeader(displayTag, date, url) {
  const version = displayTag.replace(/^v/, "");
  if (url) {
    return date ? `## [${version}](${url}) (${date})` : `## [${version}](${url})`;
  }
  return date ? `## ${displayTag} (${date})` : `## ${displayTag}`;
}
function buildHeaderUrl(changelogs, currentIndex, remote) {
  if (!remote) return null;
  const current = changelogs[currentIndex];
  if (!current) return null;
  const prevIndex = currentIndex + 1;
  const prev = changelogs[prevIndex];
  if (!prev) {
    return buildReleaseUrl(remote, current.originalTag);
  }
  return buildCompareUrl(remote, prev.originalTag, current.originalTag);
}
function groupByType(commits) {
  const grouped = {};
  for (const commit of commits) {
    if (!grouped[commit.type]) {
      grouped[commit.type] = [];
    }
    grouped[commit.type].push(commit);
  }
  return grouped;
}
function formatHashLink(hash, remote) {
  const shortHash = hash.slice(0, 7);
  if (remote) {
    const url = buildCommitUrl(remote, hash);
    return `([${shortHash}](${url}))`;
  }
  return `(${shortHash})`;
}
function linkifyReferences(text, remote) {
  if (!remote) return escapeMarkdown(text);
  let lastIndex = 0;
  let result = "";
  for (const match of text.matchAll(ISSUE_REGEX)) {
    const index = match.index;
    const issue = match[1];
    result += escapeMarkdown(text.slice(lastIndex, index));
    result += `[#${issue}](${buildIssueUrl(remote, issue)})`;
    lastIndex = index + match[0].length;
  }
  return result + escapeMarkdown(text.slice(lastIndex));
}
function escapeMarkdown(text) {
  return text.replace(/([\\`*_{}\[\]()!|<>])/g, "\\$1");
}

// src/bump.ts
import semver2 from "semver";
function suggestNextVersion(commits, lastTag) {
  const currentVersion = lastTag ? extractVersionFromTag(lastTag) : "0.0.0";
  const isPrerelease = (semver2.parse(currentVersion)?.prerelease.length ?? 0) > 0;
  const conventionalCommits = commits.map(parseConventionalCommit).filter((c) => c !== null);
  const hasBreaking = conventionalCommits.some((c) => c.breaking);
  const hasFeatures = conventionalCommits.some((c) => c.type === "feat");
  const hasFixes = conventionalCommits.some((c) => c.type === "fix" || c.type === "perf");
  let bumpType = "none";
  if (hasBreaking) {
    const parsed = semver2.parse(currentVersion);
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
  let nextVersion;
  const parsedVersion = semver2.parse(currentVersion);
  const stableVersion = parsedVersion ? `${parsedVersion.major}.${parsedVersion.minor}.${parsedVersion.patch}` : currentVersion;
  if (isPrerelease && bumpType === "patch") {
    nextVersion = stableVersion;
  } else if (bumpType === "none") {
    nextVersion = currentVersion;
  } else {
    nextVersion = semver2.inc(isPrerelease ? stableVersion : currentVersion, bumpType) || currentVersion;
  }
  return {
    currentVersion,
    nextVersion,
    bumpType,
    hasBreaking,
    hasFeatures,
    hasFixes
  };
}
function getNextPrereleaseVersion(baseVersion, suffix, allTags) {
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
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function extractVersionFromTag(tag) {
  return extractVersion(tag) ?? "0.0.0";
}

// src/core.ts
function generateChangelog(cwd, verbose = false) {
  if (!isGitRepository(cwd)) {
    throw new Error("Current directory is not a Git repository");
  }
  const remoteUrl = getRemoteUrl(cwd);
  const remote = remoteUrl ? parseRemoteUrl(remoteUrl) : null;
  const tagMap = normalizeTags(getTags(cwd));
  if (tagMap.versions.length === 0) {
    throw new Error("No valid semver tags found in repository");
  }
  const seenSet = new DeduplicationSet();
  const changelogs = [];
  let pendingCommits = [];
  let pendingTagInfo = null;
  for (const version of tagMap.versions) {
    const tagInfo = tagMap.tags.get(version);
    const date = getTagDate(tagInfo.original, cwd);
    const rawCommits = getCommits(tagInfo.original, cwd);
    const conventionalCommits = rawCommits.map(parseConventionalCommit).filter((commit) => commit !== null);
    const uniqueCommits = dedupeCommits(conventionalCommits, seenSet);
    if (isPreRelease(version)) {
      pendingCommits = [...pendingCommits, ...uniqueCommits];
      if (!pendingTagInfo) {
        pendingTagInfo = { display: tagInfo.display, original: tagInfo.original, date };
      }
    } else {
      pendingCommits = [...pendingCommits, ...uniqueCommits];
      changelogs.push({
        tag: version,
        displayTag: tagInfo.display,
        originalTag: tagInfo.original,
        date,
        commits: pendingCommits
      });
      pendingCommits = [];
      pendingTagInfo = null;
    }
  }
  if (pendingCommits.length > 0 && pendingTagInfo) {
    changelogs.push({
      tag: pendingTagInfo.display.replace(/^v/, ""),
      displayTag: pendingTagInfo.display,
      originalTag: pendingTagInfo.original,
      date: pendingTagInfo.date,
      commits: pendingCommits
    });
  }
  return formatChangelog(changelogs, { remote, verbose });
}
function suggestVersion(cwd, prefix = "", suffix = "") {
  if (!isGitRepository(cwd)) {
    throw new Error("Current directory is not a Git repository");
  }
  const lastTag = getLastTag(cwd);
  const commits = lastTag ? getCommitsSince(lastTag, cwd) : getCommits("HEAD", cwd);
  const result = suggestNextVersion(commits, lastTag);
  const version = suffix ? getNextPrereleaseVersion(result.nextVersion, suffix, getTags(cwd)) : result.nextVersion;
  return `${prefix}${version}`;
}

export {
  writeOutput,
  generateChangelog,
  suggestVersion
};
//# sourceMappingURL=chunk-QT3ENQQJ.js.map