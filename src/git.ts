import { execSync } from "node:child_process";

export interface RawCommit {
  hash: string;
  subject: string;
  body: string;
}

export function isGitRepository(cwd: string): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
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
  const output = execSync("git tag", {
    cwd,
    encoding: "utf-8",
  });
  return output
    .trim()
    .split("\n")
    .filter((tag) => tag.length > 0);
}

export function getCommits(tag: string, cwd: string): RawCommit[] {
  const output = execSync(`git log ${tag} --format="%H|%s|%b" --no-merges`, {
    cwd,
    encoding: "utf-8",
  });
  return parseCommitOutput(output);
}

function parseCommitOutput(output: string): RawCommit[] {
  const lines = output.trim().split("\n");
  const commits: RawCommit[] = [];
  let currentHash = "";
  let currentSubject = "";
  let currentBody = "";

  for (const line of lines) {
    if (line.includes("|") && isValidHashStart(line.split("|")[0] || "")) {
      if (currentHash) {
        commits.push({
          hash: currentHash,
          subject: currentSubject,
          body: currentBody.trim(),
        });
      }
      const [hash, ...rest] = line.split("|");
      currentHash = hash || "";
      const remaining = rest.join("|");
      const separatorIndex = remaining.lastIndexOf("|");
      if (separatorIndex > -1) {
        currentSubject = remaining.slice(0, separatorIndex);
        currentBody = remaining.slice(separatorIndex + 1);
      } else {
        currentSubject = remaining;
        currentBody = "";
      }
    } else if (currentHash) {
      currentBody += (currentBody ? "\n" : "") + line;
    }
  }

  if (currentHash) {
    commits.push({
      hash: currentHash,
      subject: currentSubject,
      body: currentBody.trim(),
    });
  }

  return commits;
}

function isValidHashStart(s: string): boolean {
  return /^[a-f0-9]{4,40}$/i.test(s.trim());
}

export function getRemoteUrl(cwd: string): string | null {
  try {
    const output = execSync("git remote get-url origin", {
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
    const output = execSync(`git log -1 --format=%as ${tag}`, {
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
  try {
    const output = execSync("git describe --tags --abbrev=0", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output.trim() || null;
  } catch {
    return null;
  }
}

export function getCommitsSince(ref: string, cwd: string): RawCommit[] {
  const output = execSync(`git log ${ref}..HEAD --format="%H|%s|%b" --no-merges`, {
    cwd,
    encoding: "utf-8",
  });
  return parseCommitOutput(output);
}
