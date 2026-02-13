#!/usr/bin/env node
import { run } from "./cli.js";
import { getTags, getCommits, isGitRepository, getRemoteUrl, getTagDate } from "./git.js";
import { normalizeTags, parseConventionalCommit, isPreRelease } from "./parser.js";
import { DeduplicationSet, dedupeCommits } from "./dedup.js";
import { formatChangelog } from "./formatter.js";
import type { TagChangelog } from "./formatter.js";
import { writeOutput } from "./writer.js";
import { parseRemoteUrl } from "./remote.js";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";

const isGitHubAction = process.env.GITHUB_ACTIONS === "true";

if (isGitHubAction) {
  runAction().catch((error) => {
    console.error("Unexpected error:", error.message);
    process.exit(1);
  });
} else {
  run().catch((error) => {
    console.error("Unexpected error:", error.message);
    process.exit(1);
  });
}

async function runAction(): Promise<void> {
  const file = process.env.INPUT_FILE || "CHANGELOG.md";
  const verbose = process.env.INPUT_VERBOSE === "true";
  const workingDirectory = process.env.INPUT_WORKING_DIRECTORY || ".";
  const outputFile = process.env.GITHUB_OUTPUT;

  const cwd = resolve(workingDirectory);

  if (!isGitRepository(cwd)) {
    console.error("Error: Current directory is not a Git repository");
    process.exit(1);
  }

  const remoteUrl = getRemoteUrl(cwd);
  const remote = remoteUrl ? parseRemoteUrl(remoteUrl) : null;

  const allTags = getTags(cwd);
  const tagMap = normalizeTags(allTags);

  if (tagMap.versions.length === 0) {
    console.error("Error: No valid semver tags found in repository");
    process.exit(1);
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
      .filter((c): c is NonNullable<typeof c> => c !== null);

    const uniqueCommits = dedupeCommits(conventionalCommits, seenSet);

    if (isPreRelease(version)) {
      pendingCommits = [...pendingCommits, ...uniqueCommits];
      if (!pendingTagInfo) {
        pendingTagInfo = {
          display: tagInfo.display,
          original: tagInfo.original,
          date,
        };
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

  const markdown = formatChangelog(changelogs, { remote, verbose });
  await writeOutput(markdown, file);

  console.log(`Changelog generated: ${file}`);

  if (outputFile) {
    appendFileSync(outputFile, `changelog=${file}\n`);
  }
}
