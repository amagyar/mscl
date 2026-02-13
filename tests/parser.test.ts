import { describe, it, expect } from "vitest";
import {
  parseConventionalCommit,
  sortTagsBySemver,
  isValidVersion,
  isPreRelease,
  extractVersion,
  normalizeTags,
  normalizeCommit,
  isVisibleType,
} from "../src/parser.js";
import type { RawCommit } from "../src/git.js";

function createRawCommit(subject: string, hash = "abc123", body = ""): RawCommit {
  return { hash, subject, body };
}

describe("parseConventionalCommit", () => {
  it("parses commit without scope", () => {
    const commit = createRawCommit("feat: add button");
    const result = parseConventionalCommit(commit);

    expect(result).toEqual({
      hash: "abc123",
      type: "feat",
      scope: null,
      subject: "add button",
      raw: "feat: add button",
      breaking: false,
    });
  });

  it("parses commit with scope", () => {
    const commit = createRawCommit("fix(ui): resolve overlap");
    const result = parseConventionalCommit(commit);

    expect(result).toEqual({
      hash: "abc123",
      type: "fix",
      scope: "ui",
      subject: "resolve overlap",
      raw: "fix(ui): resolve overlap",
      breaking: false,
    });
  });

  it("handles trailing spaces", () => {
    const commit = createRawCommit("feat(api): add endpoint   ");
    const result = parseConventionalCommit(commit);

    expect(result?.subject).toBe("add endpoint");
  });

  it("handles mixed case type (normalizes to lowercase)", () => {
    const commit = createRawCommit("FEAT: uppercase type");
    const result = parseConventionalCommit(commit);

    expect(result?.type).toBe("feat");
  });

  it("returns null for invalid commits", () => {
    const invalidSubjects = [
      "updated readme",
      "fix typo",
      "random message",
      "Merge pull request #123",
    ];

    for (const subject of invalidSubjects) {
      expect(parseConventionalCommit(createRawCommit(subject))).toBeNull();
    }
  });

  it("parses all conventional commit types", () => {
    const types = [
      "feat",
      "fix",
      "docs",
      "style",
      "refactor",
      "perf",
      "test",
      "build",
      "ci",
      "chore",
      "revert",
    ];

    for (const type of types) {
      const commit = createRawCommit(`${type}: some message`);
      const result = parseConventionalCommit(commit);
      expect(result?.type).toBe(type);
    }
  });

  it("detects breaking change with bang syntax", () => {
    const commit = createRawCommit("feat!: breaking change");
    const result = parseConventionalCommit(commit);

    expect(result?.breaking).toBe(true);
    expect(result?.type).toBe("feat");
  });

  it("detects breaking change with scoped bang syntax", () => {
    const commit = createRawCommit("feat(api)!: breaking change");
    const result = parseConventionalCommit(commit);

    expect(result?.breaking).toBe(true);
    expect(result?.scope).toBe("api");
  });

  it("detects breaking change from footer", () => {
    const commit = createRawCommit(
      "feat: rewrite api",
      "abc123",
      "BREAKING CHANGE: this breaks the old API"
    );
    const result = parseConventionalCommit(commit);

    expect(result?.breaking).toBe(true);
  });

  it("detects breaking change with hyphen variant", () => {
    const commit = createRawCommit(
      "fix: update config",
      "abc123",
      "BREAKING-CHANGE: config format changed"
    );
    const result = parseConventionalCommit(commit);

    expect(result?.breaking).toBe(true);
  });
});

describe("extractVersion", () => {
  it("extracts version from clean v-prefixed tag", () => {
    expect(extractVersion("v1.0.0")).toBe("1.0.0");
    expect(extractVersion("v2.3.4")).toBe("2.3.4");
  });

  it("extracts version from tag without v prefix", () => {
    expect(extractVersion("1.0.0")).toBe("1.0.0");
  });

  it("extracts version from prefixed dirty tags", () => {
    expect(extractVersion("older-prefix-v1.0.0")).toBe("1.0.0");
    expect(extractVersion("old-prefix-v1.40.0")).toBe("1.40.0");
  });

  it("extracts version from pre-release tags", () => {
    expect(extractVersion("v1.0.0-alpha")).toBe("1.0.0-alpha");
    expect(extractVersion("v1.0.0-beta.1")).toBe("1.0.0-beta.1");
    expect(extractVersion("older-prefix-v2.0.0-rc.1")).toBe("2.0.0-rc.1");
  });

  it("returns null for invalid tags", () => {
    expect(extractVersion("feature-branch")).toBeNull();
    expect(extractVersion("latest")).toBeNull();
    expect(extractVersion("release-2024")).toBeNull();
  });
});

describe("isValidVersion", () => {
  it("returns true for valid semver tags", () => {
    expect(isValidVersion("v1.0.0")).toBe(true);
    expect(isValidVersion("1.0.0")).toBe(true);
    expect(isValidVersion("v2.3.4")).toBe(true);
    expect(isValidVersion("v1.0.0-alpha")).toBe(true);
    expect(isValidVersion("v1.0.0-beta.1")).toBe(true);
  });

  it("returns true for dirty tags with valid semver", () => {
    expect(isValidVersion("older-prefix-v1.0.0")).toBe(true);
    expect(isValidVersion("old-prefix-v1.40.0")).toBe(true);
    expect(isValidVersion("some-prefix-v2.0.0")).toBe(true);
  });

  it("returns false for invalid semver tags", () => {
    expect(isValidVersion("feature-branch")).toBe(false);
    expect(isValidVersion("latest")).toBe(false);
    expect(isValidVersion("v1")).toBe(false);
    expect(isValidVersion("release-2024")).toBe(false);
  });
});

describe("normalizeTags", () => {
  it("creates version map from tags", () => {
    const tags = ["v1.0.0", "v1.1.0", "v2.0.0"];
    const result = normalizeTags(tags);

    expect(result.versions).toEqual(["1.0.0", "1.1.0", "2.0.0"]);
    expect(result.tags.size).toBe(3);
  });

  it("normalizes dirty tags", () => {
    const tags = ["older-prefix-v1.0.0", "old-prefix-v1.40.0"];
    const result = normalizeTags(tags);

    expect(result.versions).toEqual(["1.0.0", "1.40.0"]);
    expect(result.tags.get("1.0.0")?.original).toBe("older-prefix-v1.0.0");
    expect(result.tags.get("1.0.0")?.display).toBe("v1.0.0");
  });

  it("handles duplicate versions by preferring cleaner tag", () => {
    const tags = ["old-prefix-v1.40.0", "v1.40.0"];
    const result = normalizeTags(tags);

    expect(result.versions).toEqual(["1.40.0"]);
    expect(result.tags.get("1.40.0")?.original).toBe("v1.40.0");
  });

  it("prefers shorter tag when neither has v prefix", () => {
    const tags = ["some-long-prefix-v1.0.0", "short-v1.0.0"];
    const result = normalizeTags(tags);

    expect(result.tags.get("1.0.0")?.original).toBe("short-v1.0.0");
  });

  it("sorts versions in semver order", () => {
    const tags = ["v2.0.0", "v1.0.0", "v1.1.0", "v1.0.1"];
    const result = normalizeTags(tags);

    expect(result.versions).toEqual(["1.0.0", "1.0.1", "1.1.0", "2.0.0"]);
  });

  it("handles pre-release versions", () => {
    const tags = ["v1.0.0-alpha", "v1.0.0", "v1.0.0-beta"];
    const result = normalizeTags(tags);

    expect(result.versions).toEqual(["1.0.0-alpha", "1.0.0-beta", "1.0.0"]);
  });

  it("filters out invalid tags", () => {
    const tags = ["v1.0.0", "invalid", "v2.0.0", "feature-branch"];
    const result = normalizeTags(tags);

    expect(result.versions).toEqual(["1.0.0", "2.0.0"]);
  });
});

describe("sortTagsBySemver", () => {
  it("sorts tags in ascending order", () => {
    const tags = ["v1.0.1", "v1.0.0", "v1.1.0", "v0.9.0"];
    const sorted = sortTagsBySemver(tags);

    expect(sorted).toEqual(["v0.9.0", "v1.0.0", "v1.0.1", "v1.1.0"]);
  });

  it("handles tags without v prefix", () => {
    const tags = ["1.0.1", "1.0.0", "2.0.0"];
    const sorted = sortTagsBySemver(tags);

    expect(sorted).toEqual(["1.0.0", "1.0.1", "2.0.0"]);
  });

  it("handles mixed v prefix and no prefix", () => {
    const tags = ["v1.0.0", "2.0.0", "v1.1.0"];
    const sorted = sortTagsBySemver(tags);

    expect(sorted).toEqual(["v1.0.0", "v1.1.0", "2.0.0"]);
  });

  it("handles pre-release versions", () => {
    const tags = ["v1.0.0-alpha", "v1.0.0", "v1.0.0-beta", "v1.0.0-rc.1"];
    const sorted = sortTagsBySemver(tags);

    expect(sorted).toEqual(["v1.0.0-alpha", "v1.0.0-beta", "v1.0.0-rc.1", "v1.0.0"]);
  });

  it("does not mutate original array", () => {
    const tags = ["v1.0.1", "v1.0.0"];
    const originalOrder = [...tags];
    sortTagsBySemver(tags);

    expect(tags).toEqual(originalOrder);
  });

  it("handles dirty tags", () => {
    const tags = ["old-prefix-v1.40.0", "older-prefix-v1.0.0"];
    const sorted = sortTagsBySemver(tags);

    expect(sorted).toEqual(["older-prefix-v1.0.0", "old-prefix-v1.40.0"]);
  });

  it("deduplicates versions returning preferred tag", () => {
    const tags = ["old-prefix-v1.40.0", "v1.40.0"];
    const sorted = sortTagsBySemver(tags);

    expect(sorted).toEqual(["v1.40.0"]);
  });
});

describe("isPreRelease", () => {
  it("returns true for pre-release versions", () => {
    expect(isPreRelease("1.0.0-alpha")).toBe(true);
    expect(isPreRelease("1.0.0-beta")).toBe(true);
    expect(isPreRelease("1.0.0-rc.1")).toBe(true);
    expect(isPreRelease("1.0.0-alpha.1")).toBe(true);
  });

  it("returns false for stable versions", () => {
    expect(isPreRelease("1.0.0")).toBe(false);
    expect(isPreRelease("2.3.4")).toBe(false);
  });
});

describe("normalizeCommit", () => {
  it("normalizes commit with scope", () => {
    const commit = {
      hash: "abc",
      type: "feat",
      scope: "api",
      subject: "Add Endpoint",
      raw: "feat(api): Add Endpoint",
      breaking: false,
    };

    expect(normalizeCommit(commit)).toBe("feat(api): add endpoint");
  });

  it("normalizes commit without scope", () => {
    const commit = {
      hash: "abc",
      type: "fix",
      scope: null,
      subject: "Fix Bug",
      raw: "fix: Fix Bug",
      breaking: false,
    };

    expect(normalizeCommit(commit)).toBe("fix: fix bug");
  });
});

describe("isVisibleType", () => {
  it("returns true for visible types in non-verbose mode", () => {
    expect(isVisibleType("feat", false)).toBe(true);
    expect(isVisibleType("fix", false)).toBe(true);
    expect(isVisibleType("perf", false)).toBe(true);
    expect(isVisibleType("revert", false)).toBe(true);
  });

  it("returns false for non-visible types in non-verbose mode", () => {
    expect(isVisibleType("chore", false)).toBe(false);
    expect(isVisibleType("docs", false)).toBe(false);
    expect(isVisibleType("ci", false)).toBe(false);
  });

  it("returns true for all types in verbose mode", () => {
    expect(isVisibleType("feat", true)).toBe(true);
    expect(isVisibleType("chore", true)).toBe(true);
    expect(isVisibleType("docs", true)).toBe(true);
    expect(isVisibleType("custom", true)).toBe(true);
  });
});
