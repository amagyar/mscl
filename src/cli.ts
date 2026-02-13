import { program } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getTags, getCommits, isGitRepository, getRemoteUrl, getTagDate, getLastTag, getCommitsSince } from "./git.js";
import {
  normalizeTags,
  parseConventionalCommit,
  isPreRelease,
} from "./parser.js";
import { DeduplicationSet, dedupeCommits } from "./dedup.js";
import { formatChangelog, type TagChangelog } from "./formatter.js";
import { writeOutput } from "./writer.js";
import { parseRemoteUrl } from "./remote.js";
import { suggestNextVersion, getNextPrereleaseVersion } from "./bump.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  const pkgPath = join(__dirname, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  return pkg.version;
}

export async function run(): Promise<void> {
  program
    .name("mscl")
    .description("Generate changelogs from Git tags using Conventional Commits")
    .version(getVersion(), "-v, --version", "output the current version")
    .option("-f, --file <path>", "output file path (defaults to stdout)")
    .option("-a, --all", "include all commit types (not just feat/fix/perf/revert)")
    .option("-b, --bump", "suggest next version based on unreleased commits")
    .option("--prefix <prefix>", "prefix for bump output (e.g., 'v' for v1.2.3)")
    .option("--suffix <suffix>", "suffix for bump output (e.g., '-rc.1')")
    .action(async (options) => {
      const cwd = process.cwd();
      const verbose = options.all || false;

      if (!isGitRepository(cwd)) {
        console.error("Error: Current directory is not a Git repository");
        process.exit(1);
      }

      if (options.bump) {
        const lastTag = getLastTag(cwd);
        const commits = lastTag ? getCommitsSince(lastTag, cwd) : getCommits("HEAD", cwd);
        const result = suggestNextVersion(commits, lastTag);
        const prefix = options.prefix || "";
        const suffix = options.suffix || "";

        let version = result.nextVersion;
        if (suffix) {
          const allTags = getTags(cwd);
          version = getNextPrereleaseVersion(result.nextVersion, suffix, allTags);
        }

        console.log(`${prefix}${version}`);
        return;
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
      await writeOutput(markdown, options.file);
    });

  program.parse();
}
