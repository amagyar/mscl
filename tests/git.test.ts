import { describe, it, expect, vi, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import { isGitRepository, getTags, getCommits, getRemoteUrl, getTagDate, getLastTag, getCommitsSince } from "../src/git.js";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

const mockedExecFileSync = vi.mocked(execFileSync);

describe("isGitRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when inside a git repository", () => {
    mockedExecFileSync.mockReturnValue("true");

    const result = isGitRepository("/some/path");

    expect(result).toBe(true);
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "git",
      ["rev-parse", "--is-inside-work-tree"],
      expect.objectContaining({ cwd: "/some/path" })
    );
  });

  it("returns false when not a git repository", () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error("Not a git repository");
    });

    const result = isGitRepository("/not/a/repo");

    expect(result).toBe(false);
  });
});

describe("getTags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns array of tags", () => {
    mockedExecFileSync.mockReturnValue("v1.0.0\nv1.1.0\nv2.0.0\n");

    const result = getTags("/repo");

    expect(result).toEqual(["v1.0.0", "v1.1.0", "v2.0.0"]);
  });

  it("returns empty array when no tags exist", () => {
    mockedExecFileSync.mockReturnValue("");

    const result = getTags("/repo");

    expect(result).toEqual([]);
  });

  it("filters empty lines from output", () => {
    mockedExecFileSync.mockReturnValue("v1.0.0\n\nv1.1.0\n\n");

    const result = getTags("/repo");

    expect(result).toEqual(["v1.0.0", "v1.1.0"]);
  });
});

describe("getCommits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses commit output with body", () => {
    mockedExecFileSync.mockReturnValue(
      "abc123\0feat: add feature\0Some body text\0"
    );

    const result = getCommits("v1.0.0", "/repo");

    expect(result).toEqual([
      { hash: "abc123", subject: "feat: add feature", body: "Some body text" },
    ]);
  });

  it("handles commits with empty body", () => {
    mockedExecFileSync.mockReturnValue("abc123\0feat: add feature\0\0");

    const result = getCommits("v1.0.0", "/repo");

    expect(result).toEqual([
      { hash: "abc123", subject: "feat: add feature", body: "" },
    ]);
  });

  it("preserves pipes in subjects and multiline bodies", () => {
    mockedExecFileSync.mockReturnValue("abc123\0feat: support | in title\0body | text\nBREAKING CHANGE: keep | intact\0");

    const result = getCommits("v1.0.0", "/repo");

    expect(result).toEqual([
      {
        hash: "abc123",
        subject: "feat: support | in title",
        body: "body | text\nBREAKING CHANGE: keep | intact",
      },
    ]);
  });

  it("includes --no-merges flag", () => {
    mockedExecFileSync.mockReturnValue("");

    getCommits("v1.0.0", "/repo");

    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["--no-merges"]),
      expect.any(Object)
    );
  });

  it("returns empty array for no commits", () => {
    mockedExecFileSync.mockReturnValue("");

    const result = getCommits("v1.0.0", "/repo");

    expect(result).toEqual([]);
  });

  it("parses multiple commits", () => {
    mockedExecFileSync.mockReturnValue(
      "abc123\0feat: first\0body1\0def456\0fix: second\0body2\0"
    );

    const result = getCommits("v1.0.0", "/repo");

    expect(result).toEqual([
      { hash: "abc123", subject: "feat: first", body: "body1" },
      { hash: "def456", subject: "fix: second", body: "body2" },
    ]);
  });

  it("handles multiline body", () => {
    mockedExecFileSync.mockReturnValue(
      "abc123\0feat: add feature\0first line\nsecond line\nthird line\0"
    );

    const result = getCommits("v1.0.0", "/repo");

    expect(result).toEqual([
      { hash: "abc123", subject: "feat: add feature", body: "first line\nsecond line\nthird line" },
    ]);
  });

  it("handles commit without body separator", () => {
    mockedExecFileSync.mockReturnValue("abc123\0feat: add feature\0\0");

    const result = getCommits("v1.0.0", "/repo");

    expect(result).toEqual([
      { hash: "abc123", subject: "feat: add feature", body: "" },
    ]);
  });

  it("uses correct git log command with tag", () => {
    mockedExecFileSync.mockReturnValue("");

    getCommits("v2.0.0", "/repo");

    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "git",
      ["log", "-z", "--format=%H%x00%s%x00%b", "--no-merges", "--end-of-options", "v2.0.0"],
      expect.objectContaining({ cwd: "/repo" })
    );
  });
});

describe("getRemoteUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns remote url when origin exists", () => {
    mockedExecFileSync.mockReturnValue("git@github.com:acme/repo.git\n");

    const result = getRemoteUrl("/repo");

    expect(result).toBe("git@github.com:acme/repo.git");
  });

  it("returns null when no origin remote", () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error("No remote");
    });

    const result = getRemoteUrl("/repo");

    expect(result).toBeNull();
  });
});

describe("getTagDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tag date in ISO format", () => {
    mockedExecFileSync.mockReturnValue("2025-10-28\n");

    const result = getTagDate("v1.0.0", "/repo");

    expect(result).toBe("2025-10-28");
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "git",
      ["log", "-1", "--format=%as", "--end-of-options", "v1.0.0"],
      expect.objectContaining({ cwd: "/repo" })
    );
  });

  it("returns empty string on error", () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error("Tag not found");
    });

    const result = getTagDate("invalid-tag", "/repo");

    expect(result).toBe("");
  });
});

describe("getLastTag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the last tag on current branch", () => {
    mockedExecFileSync.mockReturnValue("v1.2.3\n");

    const result = getLastTag("/repo");

    expect(result).toBe("v1.2.3");
    expect(mockedExecFileSync).toHaveBeenNthCalledWith(
      1,
      "git",
      ["tag"],
      expect.objectContaining({ cwd: "/repo" })
    );
    expect(mockedExecFileSync).toHaveBeenNthCalledWith(
      2,
      "git",
      ["merge-base", "--is-ancestor", "refs/tags/v1.2.3", "HEAD"],
      expect.objectContaining({ cwd: "/repo" })
    );
  });

  it("returns null when no tags exist", () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error("No tags");
    });

    const result = getLastTag("/repo");

    expect(result).toBeNull();
  });
});

describe("getCommitsSince", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns commits since a ref", () => {
    mockedExecFileSync.mockReturnValue("abc123\0feat: new feature\0\0");

    const result = getCommitsSince("v1.0.0", "/repo");

    expect(result).toEqual([
      { hash: "abc123", subject: "feat: new feature", body: "" },
    ]);
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "git",
      ["log", "-z", "--format=%H%x00%s%x00%b", "--no-merges", "--end-of-options", "v1.0.0..HEAD"],
      expect.objectContaining({ cwd: "/repo" })
    );
  });

  it("passes refs containing shell syntax as a single argument", () => {
    mockedExecFileSync.mockReturnValue("");

    getCommitsSince("v1.0.0; touch /tmp/injected..HEAD", "/repo");

    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "git",
      ["log", "-z", "--format=%H%x00%s%x00%b", "--no-merges", "--end-of-options", "v1.0.0; touch /tmp/injected..HEAD..HEAD"],
      expect.objectContaining({ cwd: "/repo" })
    );
  });

  it("returns empty array when no new commits", () => {
    mockedExecFileSync.mockReturnValue("");

    const result = getCommitsSince("v1.0.0", "/repo");

    expect(result).toEqual([]);
  });
});
