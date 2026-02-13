import type { ConventionalCommit } from "./parser.js";

export class DeduplicationSet {
  private seen = new Set<string>();

  has(commit: ConventionalCommit): boolean {
    const key = this.getKey(commit);
    return this.seen.has(key);
  }

  add(commit: ConventionalCommit): void {
    const key = this.getKey(commit);
    this.seen.add(key);
  }

  private getKey(commit: ConventionalCommit): string {
    return `${commit.type}:${commit.scope ?? ""}:${commit.subject}`.toLowerCase();
  }
}

export function dedupeCommits(
  commits: ConventionalCommit[],
  seenSet: DeduplicationSet
): ConventionalCommit[] {
  const result: ConventionalCommit[] = [];

  for (const commit of commits) {
    if (!seenSet.has(commit)) {
      seenSet.add(commit);
      result.push(commit);
    }
  }

  return result;
}
