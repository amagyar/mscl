import { getTags, getCommits, isGitRepository, getRemoteUrl, getTagDate, getLastTag, getCommitsSince } from "./git.js";
import { normalizeTags, parseConventionalCommit, isPreRelease } from "./parser.js";
import { DeduplicationSet, dedupeCommits } from "./dedup.js";
import { formatChangelog, type TagChangelog } from "./formatter.js";
import { parseRemoteUrl } from "./remote.js";
import { suggestNextVersion, getNextPrereleaseVersion } from "./bump.js";

export function generateChangelog(cwd: string, verbose = false): string {
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
  const changelogs: TagChangelog[] = [];
  let pendingCommits: ReturnType<typeof dedupeCommits> = [];
  let pendingTagInfo: { display: string; original: string; date: string } | null = null;

  for (const version of tagMap.versions) {
    const tagInfo = tagMap.tags.get(version)!;
    const date = getTagDate(tagInfo.original, cwd);
    const rawCommits = getCommits(tagInfo.original, cwd);
    const conventionalCommits = rawCommits
      .map(parseConventionalCommit)
      .filter((commit): commit is NonNullable<typeof commit> => commit !== null);
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
        commits: pendingCommits,
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
      commits: pendingCommits,
    });
  }

  return formatChangelog(changelogs, { remote, verbose });
}

export function suggestVersion(cwd: string, prefix = "", suffix = ""): string {
  if (!isGitRepository(cwd)) {
    throw new Error("Current directory is not a Git repository");
  }

  const lastTag = getLastTag(cwd);
  const commits = lastTag ? getCommitsSince(lastTag, cwd) : getCommits("HEAD", cwd);
  const result = suggestNextVersion(commits, lastTag);
  const version = suffix
    ? getNextPrereleaseVersion(result.nextVersion, suffix, getTags(cwd))
    : result.nextVersion;

  return `${prefix}${version}`;
}
