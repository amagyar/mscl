import { describe, it, expect } from "vitest";
import { DeduplicationSet, dedupeCommits } from "../src/dedup.js";
import type { ConventionalCommit } from "../src/parser.js";

function createCommit(
  type: string,
  subject: string,
  scope?: string,
  hash = "abc123",
  breaking = false
): ConventionalCommit {
  return {
    hash,
    type,
    scope: scope ?? null,
    subject,
    raw: `${type}${scope ? `(${scope})` : ""}: ${subject}`,
    breaking,
  };
}

describe("DeduplicationSet", () => {
  it("detects duplicate commits with same type and subject", () => {
    const set = new DeduplicationSet();
    const commit1 = createCommit("feat", "add button");
    const commit2 = createCommit("feat", "add button", undefined, "def456");

    expect(set.has(commit1)).toBe(false);
    set.add(commit1);
    expect(set.has(commit2)).toBe(true);
  });

  it("detects duplicates case-insensitively", () => {
    const set = new DeduplicationSet();
    const commit1 = createCommit("feat", "Add Button");
    const commit2 = createCommit("FEAT", "add button", undefined, "xyz");

    set.add(commit1);
    expect(set.has(commit2)).toBe(true);
  });

  it("considers scope in deduplication", () => {
    const set = new DeduplicationSet();
    const commit1 = createCommit("fix", "resolve issue", "ui");
    const commit2 = createCommit("fix", "resolve issue", "api");
    const commit3 = createCommit("fix", "resolve issue");

    set.add(commit1);
    expect(set.has(commit2)).toBe(false);
    expect(set.has(commit3)).toBe(false);
  });

  it("allows commits with same subject but different types", () => {
    const set = new DeduplicationSet();
    const featCommit = createCommit("feat", "add button");
    const fixCommit = createCommit("fix", "add button");

    set.add(featCommit);
    expect(set.has(fixCommit)).toBe(false);
  });
});

describe("dedupeCommits", () => {
  it("removes duplicate commits from a list", () => {
    const seenSet = new DeduplicationSet();
    const commits = [
      createCommit("feat", "add button", undefined, "hash1"),
      createCommit("feat", "add button", undefined, "hash2"),
      createCommit("fix", "resolve bug", undefined, "hash3"),
    ];

    const result = dedupeCommits(commits, seenSet);

    expect(result).toHaveLength(2);
    expect(result[0].hash).toBe("hash1");
    expect(result[1].hash).toBe("hash3");
  });

  it("filters against previously seen commits", () => {
    const seenSet = new DeduplicationSet();
    seenSet.add(createCommit("feat", "add button"));

    const commits = [
      createCommit("feat", "add button", undefined, "hash2"),
      createCommit("fix", "resolve bug", undefined, "hash3"),
    ];

    const result = dedupeCommits(commits, seenSet);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("fix");
  });

  it("returns empty array for all duplicates", () => {
    const seenSet = new DeduplicationSet();
    seenSet.add(createCommit("feat", "add button"));

    const commits = [createCommit("feat", "add button", undefined, "hash2")];

    const result = dedupeCommits(commits, seenSet);

    expect(result).toHaveLength(0);
  });

  it("preserves order of unique commits", () => {
    const seenSet = new DeduplicationSet();
    const commits = [
      createCommit("feat", "feature a", undefined, "h1"),
      createCommit("fix", "bug b", undefined, "h2"),
      createCommit("feat", "feature c", undefined, "h3"),
    ];

    const result = dedupeCommits(commits, seenSet);

    expect(result.map((c) => c.subject)).toEqual([
      "feature a",
      "bug b",
      "feature c",
    ]);
  });
});
