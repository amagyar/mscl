import { execFileSync } from "node:child_process";
import { normalizeTags } from "./parser.js";

export interface RawCommit {
  hash: string;
  subject: string;
  body: string;
}

export function isGitRepository(cwd: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

export function getTags(cwd: string): string[] {
  const output = execFileSync("git", ["tag"], {
    cwd,
    encoding: "utf-8",
  });
  return output
    .trim()
    .split("\n")
    .filter((tag) => tag.length > 0);
}

export function getCommits(tag: string, cwd: string): RawCommit[] {
  const output = execFileSync("git", ["log", "-z", "--format=%H%x00%s%x00%b", "--no-merges", "--end-of-options", tag], {
    cwd,
    encoding: "utf-8",
  });
  return parseCommitOutput(output);
}

function parseCommitOutput(output: string): RawCommit[] {
  const fields = output.split("\0");
  const commits: RawCommit[] = [];

  for (let i = 0; i + 2 < fields.length; i += 3) {
    const hash = fields[i]?.trim();
    const subject = fields[i + 1];
    const body = fields[i + 2];
    if (!hash || !subject || body === undefined || !isValidHashStart(hash)) continue;

    commits.push({ hash, subject, body: body.trim() });
  }

  return commits;
}

function isValidHashStart(s: string): boolean {
  return /^[a-f0-9]{4,40}$/i.test(s.trim());
}

export function getRemoteUrl(cwd: string): string | null {
  try {
    const output = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output.trim();
  } catch {
    return null;
  }
}

export function getTagDate(tag: string, cwd: string): string {
  try {
    const output = execFileSync("git", ["log", "-1", "--format=%as", "--end-of-options", tag], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output.trim();
  } catch {
    return "";
  }
}

export function getLastTag(cwd: string): string | null {
  let tags: string[];
  try {
    tags = getTags(cwd);
  } catch {
    return null;
  }
  const reachableTags = tags.filter((tag) => {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", `refs/tags/${tag}`, "HEAD"], {
        cwd,
        stdio: "ignore",
      });
      return true;
    } catch {
      return false;
    }
  });

  const { versions, tags: tagMap } = normalizeTags(reachableTags);
  const latestVersion = versions.at(-1);
  return latestVersion ? tagMap.get(latestVersion)!.original : null;
}

export function getCommitsSince(ref: string, cwd: string): RawCommit[] {
  const output = execFileSync("git", ["log", "-z", "--format=%H%x00%s%x00%b", "--no-merges", "--end-of-options", `${ref}..HEAD`], {
    cwd,
    encoding: "utf-8",
  });
  return parseCommitOutput(output);
}
