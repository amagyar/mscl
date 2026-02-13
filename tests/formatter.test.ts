import { describe, it, expect } from "vitest";
import { formatChangelog, type TagChangelog } from "../src/formatter.js";
import type { ConventionalCommit } from "../src/parser.js";
import type { RemoteInfo } from "../src/remote.js";

function createCommit(
  type: string,
  subject: string,
  scope?: string,
  hash = "abc123def456",
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

function createChangelog(
  tag: string,
  commits: ConventionalCommit[],
  options: { originalTag?: string; date?: string } = {}
): TagChangelog {
  return {
    tag,
    displayTag: tag.startsWith("v") ? tag : `v${tag}`,
    originalTag: options.originalTag ?? tag,
    date: options.date ?? "2025-01-15",
    commits,
  };
}

const mockRemote: RemoteInfo = {
  host: "github.com",
  owner: "acme",
  repo: "my-lib",
};

describe("formatChangelog", () => {
  it("generates markdown with header", () => {
    const changelogs: TagChangelog[] = [
      createChangelog("v1.0.0", [createCommit("feat", "initial feature")]),
    ];

    const result = formatChangelog(changelogs);

    expect(result).toContain("# Changelog");
    expect(result).toContain("## v1.0.0 (2025-01-15)");
  });

  it("includes date in header", () => {
    const changelogs: TagChangelog[] = [
      createChangelog("v1.0.0", [createCommit("feat", "test")], { date: "2025-10-28" }),
    ];

    const result = formatChangelog(changelogs);

    expect(result).toContain("(2025-10-28)");
  });

  it("groups commits by type", () => {
    const changelogs: TagChangelog[] = [
      createChangelog("v1.0.0", [
        createCommit("feat", "feature a"),
        createCommit("fix", "bug b"),
        createCommit("feat", "feature c"),
      ]),
    ];

    const result = formatChangelog(changelogs);

    expect(result).toContain("### Features");
    expect(result).toContain("### Bug Fixes");
  });

  it("formats commits with scope in bold", () => {
    const changelogs: TagChangelog[] = [
      createChangelog("v1.0.0", [createCommit("fix", "resolve issue", "ui")]),
    ];

    const result = formatChangelog(changelogs);

    expect(result).toContain("**ui**:");
  });

  it("includes short commit hash", () => {
    const changelogs: TagChangelog[] = [
      createChangelog("v1.0.0", [createCommit("feat", "test", undefined, "abcdef123456")]),
    ];

    const result = formatChangelog(changelogs);

    expect(result).toContain("(abcdef1)");
  });

  it("outputs tags in reverse order (newest first)", () => {
    const changelogs: TagChangelog[] = [
      createChangelog("v1.0.0", [createCommit("feat", "a")]),
      createChangelog("v1.1.0", [createCommit("feat", "b")]),
      createChangelog("v2.0.0", [createCommit("feat", "c")]),
    ];

    const result = formatChangelog(changelogs);
    const v200Index = result.indexOf("## v2.0.0");
    const v110Index = result.indexOf("## v1.1.0");
    const v100Index = result.indexOf("## v1.0.0");

    expect(v200Index).toBeLessThan(v110Index);
    expect(v110Index).toBeLessThan(v100Index);
  });

  it("skips tags with no commits", () => {
    const changelogs: TagChangelog[] = [
      createChangelog("v1.0.0", [createCommit("feat", "test")]),
      { tag: "1.1.0", displayTag: "v1.1.0", originalTag: "v1.1.0", date: "2025-01-15", commits: [] },
    ];

    const result = formatChangelog(changelogs);

    expect(result).toContain("## v1.0.0");
    expect(result).not.toContain("## v1.1.0");
  });

  it("handles empty changelogs", () => {
    const result = formatChangelog([]);

    expect(result).toBe("# Changelog\n");
  });

  it("orders commit types consistently", () => {
    const changelogs: TagChangelog[] = [
      createChangelog("v1.0.0", [
        createCommit("chore", "chore"),
        createCommit("feat", "feature"),
        createCommit("fix", "fix"),
      ]),
    ];

    const result = formatChangelog(changelogs, { verbose: true });
    const featIndex = result.indexOf("### Features");
    const fixIndex = result.indexOf("### Bug Fixes");
    const choreIndex = result.indexOf("### Chores");

    expect(featIndex).toBeLessThan(fixIndex);
    expect(fixIndex).toBeLessThan(choreIndex);
  });

  it("formats header without date", () => {
    const changelogs: TagChangelog[] = [
      createChangelog("v1.0.0", [createCommit("feat", "test")], { date: "" }),
    ];

    const result = formatChangelog(changelogs);

    expect(result).toContain("## v1.0.0\n");
    expect(result).not.toContain("## v1.0.0 (");
  });

  describe("smart filtering", () => {
    it("hides chore/ci/docs types by default", () => {
      const changelogs: TagChangelog[] = [
        createChangelog("v1.0.0", [
          createCommit("feat", "feature"),
          createCommit("chore", "chore"),
          createCommit("ci", "ci"),
          createCommit("docs", "docs"),
        ]),
      ];

      const result = formatChangelog(changelogs, { verbose: false });

      expect(result).toContain("feature");
      expect(result).not.toContain("chore");
      expect(result).not.toContain("### Chores");
    });

    it("shows all types in verbose mode", () => {
      const changelogs: TagChangelog[] = [
        createChangelog("v1.0.0", [
          createCommit("feat", "feature"),
          createCommit("chore", "chore"),
          createCommit("ci", "ci"),
        ]),
      ];

      const result = formatChangelog(changelogs, { verbose: true });

      expect(result).toContain("feature");
      expect(result).toContain("chore");
      expect(result).toContain("### Chores");
    });
  });

  describe("breaking changes", () => {
    it("rolls up multiple pre-release commits into stable release", () => {
      const changelogs: TagChangelog[] = [
        {
          tag: "0.1.0",
          displayTag: "v0.1.0",
          originalTag: "v0.1.0",
          date: "2025-01-15",
          commits: [
            createCommit("fix", "bug 123", undefined, "a1"),
            createCommit("fix", "bug 234", undefined, "a2"),
            createCommit("feat", "feature 123", undefined, "b1"),
            createCommit("feat", "feature 234", undefined, "b2"),
          ],
        },
      ];

      const result = formatChangelog(changelogs);

      expect(result).toContain("### Features");
      expect(result).toContain("feature 123");
      expect(result).toContain("feature 234");
      expect(result).toContain("### Bug Fixes");
      expect(result).toContain("bug 123");
      expect(result).toContain("bug 234");
    });

    it("creates breaking changes section at top of version", () => {
      const changelogs: TagChangelog[] = [
        createChangelog("v1.0.0", [
          createCommit("feat", "breaking feature", undefined, "abc", true),
          createCommit("feat", "normal feature"),
        ]),
      ];

      const result = formatChangelog(changelogs);

      expect(result).toContain("### ⚠ BREAKING CHANGES");
      expect(result).toContain("breaking feature");

      const breakingIndex = result.indexOf("### ⚠ BREAKING CHANGES");
      const featuresIndex = result.indexOf("### Features");
      expect(breakingIndex).toBeLessThan(featuresIndex);
    });

    it("shows breaking commit in both breaking section and its type section", () => {
      const changelogs: TagChangelog[] = [
        createChangelog("v1.0.0", [createCommit("feat", "breaking", undefined, "abc", true)]),
      ];

      const result = formatChangelog(changelogs);

      expect(result).toContain("### ⚠ BREAKING CHANGES");
      expect(result).toContain("### Features");
    });

    it("formats breaking commit with scope", () => {
      const changelogs: TagChangelog[] = [
        createChangelog("v1.0.0", [createCommit("feat", "breaking change", "api", "abc", true)]),
      ];

      const result = formatChangelog(changelogs);

      expect(result).toContain("**api**:");
    });
  });

  describe("rich linking", () => {
    it("creates commit links when remote is provided", () => {
      const changelogs: TagChangelog[] = [
        createChangelog("v1.0.0", [createCommit("feat", "test", undefined, "abcdef123456789")]),
      ];

      const result = formatChangelog(changelogs, { remote: mockRemote });

      expect(result).toContain(
        "[abcdef1](https://github.com/acme/my-lib/commit/abcdef123456789)"
      );
    });

    it("links issue references in subject", () => {
      const changelogs: TagChangelog[] = [
        createChangelog("v1.0.0", [createCommit("fix", "resolves #123 and #456")]),
      ];

      const result = formatChangelog(changelogs, { remote: mockRemote });

      expect(result).toContain("[#123](https://github.com/acme/my-lib/issues/123)");
      expect(result).toContain("[#456](https://github.com/acme/my-lib/issues/456)");
    });

    it("does not link issues when no remote", () => {
      const changelogs: TagChangelog[] = [
        createChangelog("v1.0.0", [createCommit("fix", "resolves #123")]),
      ];

      const result = formatChangelog(changelogs);

      expect(result).toContain("#123");
      expect(result).not.toContain("issues/123");
    });
  });

  describe("compare links", () => {
    it("creates release link for first tag", () => {
      const changelogs: TagChangelog[] = [
        createChangelog("v1.0.0", [createCommit("feat", "test")], {
          originalTag: "old-prefix-v1.0.0",
        }),
      ];

      const result = formatChangelog(changelogs, { remote: mockRemote });

      expect(result).toContain(
        "https://github.com/acme/my-lib/releases/tag/old-prefix-v1.0.0"
      );
    });

    it("creates compare link between tags", () => {
      const changelogs: TagChangelog[] = [
        createChangelog("v1.0.0", [createCommit("feat", "a")], {
          originalTag: "v1.0.0",
        }),
        createChangelog("v1.1.0", [createCommit("feat", "b")], {
          originalTag: "old-prefix-v1.1.0",
        }),
      ];

      const result = formatChangelog(changelogs, { remote: mockRemote });

      expect(result).toContain(
        "https://github.com/acme/my-lib/compare/v1.0.0...old-prefix-v1.1.0"
      );
    });

    it("encodes special characters in tag names", () => {
      const changelogs: TagChangelog[] = [
        createChangelog("v1.0.0", [createCommit("feat", "a")], {
          originalTag: "release/v1.0.0",
        }),
        createChangelog("v1.1.0", [createCommit("feat", "b")], {
          originalTag: "release/v1.1.0",
        }),
      ];

      const result = formatChangelog(changelogs, { remote: mockRemote });

      expect(result).toContain(
        "https://github.com/acme/my-lib/compare/release%2Fv1.0.0...release%2Fv1.1.0"
      );
    });

    it("does not include links when no remote", () => {
      const changelogs: TagChangelog[] = [
        createChangelog("v1.0.0", [createCommit("feat", "test")]),
      ];

      const result = formatChangelog(changelogs);

      expect(result).not.toContain("github.com");
      expect(result).toContain("## v1.0.0 (2025-01-15)");
    });
  });
});
