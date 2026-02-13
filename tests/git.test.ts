import { describe, it, expect, vi, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { isGitRepository, getTags, getCommits, getRemoteUrl, getTagDate, getLastTag, getCommitsSince } from "../src/git.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(execSync);

describe("isGitRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when inside a git repository", () => {
    mockedExecSync.mockReturnValue("true");

    const result = isGitRepository("/some/path");

    expect(result).toBe(true);
    expect(mockedExecSync).toHaveBeenCalledWith(
      "git rev-parse --is-inside-work-tree",
      expect.objectContaining({ cwd: "/some/path" })
    );
  });

  it("returns false when not a git repository", () => {
    mockedExecSync.mockImplementation(() => {
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
    mockedExecSync.mockReturnValue("v1.0.0\nv1.1.0\nv2.0.0\n");

    const result = getTags("/repo");

    expect(result).toEqual(["v1.0.0", "v1.1.0", "v2.0.0"]);
  });

  it("returns empty array when no tags exist", () => {
    mockedExecSync.mockReturnValue("");

    const result = getTags("/repo");

    expect(result).toEqual([]);
  });

  it("filters empty lines from output", () => {
    mockedExecSync.mockReturnValue("v1.0.0\n\nv1.1.0\n\n");

    const result = getTags("/repo");

    expect(result).toEqual(["v1.0.0", "v1.1.0"]);
  });
});

describe("getCommits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses commit output with body", () => {
    mockedExecSync.mockReturnValue(
      "abc123|feat: add feature|Some body text\n"
    );

    const result = getCommits("v1.0.0", "/repo");

    expect(result).toEqual([
      { hash: "abc123", subject: "feat: add feature", body: "Some body text" },
    ]);
  });

  it("handles commits with empty body", () => {
    mockedExecSync.mockReturnValue("abc123|feat: add feature|\n");

    const result = getCommits("v1.0.0", "/repo");

    expect(result).toEqual([
      { hash: "abc123", subject: "feat: add feature", body: "" },
    ]);
  });

  it("includes --no-merges flag", () => {
    mockedExecSync.mockReturnValue("");

    getCommits("v1.0.0", "/repo");

    expect(mockedExecSync).toHaveBeenCalledWith(
      expect.stringContaining("--no-merges"),
      expect.any(Object)
    );
  });

  it("returns empty array for no commits", () => {
    mockedExecSync.mockReturnValue("");

    const result = getCommits("v1.0.0", "/repo");

    expect(result).toEqual([]);
  });

  it("parses multiple commits", () => {
    mockedExecSync.mockReturnValue(
      "abc123|feat: first|body1\ndef456|fix: second|body2\n"
    );

    const result = getCommits("v1.0.0", "/repo");

    expect(result).toEqual([
      { hash: "abc123", subject: "feat: first", body: "body1" },
      { hash: "def456", subject: "fix: second", body: "body2" },
    ]);
  });

  it("handles multiline body", () => {
    mockedExecSync.mockReturnValue(
      "abc123|feat: add feature|first line\nsecond line\nthird line\n"
    );

    const result = getCommits("v1.0.0", "/repo");

    expect(result).toEqual([
      { hash: "abc123", subject: "feat: add feature", body: "first line\nsecond line\nthird line" },
    ]);
  });

  it("handles commit without body separator", () => {
    mockedExecSync.mockReturnValue("abc123|feat: add feature\n");

    const result = getCommits("v1.0.0", "/repo");

    expect(result).toEqual([
      { hash: "abc123", subject: "feat: add feature", body: "" },
    ]);
  });

  it("uses correct git log command with tag", () => {
    mockedExecSync.mockReturnValue("");

    getCommits("v2.0.0", "/repo");

    expect(mockedExecSync).toHaveBeenCalledWith(
      'git log v2.0.0 --format="%H|%s|%b" --no-merges',
      expect.objectContaining({ cwd: "/repo" })
    );
  });
});

describe("getRemoteUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns remote url when origin exists", () => {
    mockedExecSync.mockReturnValue("git@github.com:acme/repo.git\n");

    const result = getRemoteUrl("/repo");

    expect(result).toBe("git@github.com:acme/repo.git");
  });

  it("returns null when no origin remote", () => {
    mockedExecSync.mockImplementation(() => {
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
    mockedExecSync.mockReturnValue("2025-10-28\n");

    const result = getTagDate("v1.0.0", "/repo");

    expect(result).toBe("2025-10-28");
    expect(mockedExecSync).toHaveBeenCalledWith(
      "git log -1 --format=%as v1.0.0",
      expect.objectContaining({ cwd: "/repo" })
    );
  });

  it("returns empty string on error", () => {
    mockedExecSync.mockImplementation(() => {
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
    mockedExecSync.mockReturnValue("v1.2.3\n");

    const result = getLastTag("/repo");

    expect(result).toBe("v1.2.3");
    expect(mockedExecSync).toHaveBeenCalledWith(
      "git describe --tags --abbrev=0",
      expect.objectContaining({ cwd: "/repo" })
    );
  });

  it("returns null when no tags exist", () => {
    mockedExecSync.mockImplementation(() => {
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
    mockedExecSync.mockReturnValue("abc123|feat: new feature|\n");

    const result = getCommitsSince("v1.0.0", "/repo");

    expect(result).toEqual([
      { hash: "abc123", subject: "feat: new feature", body: "" },
    ]);
    expect(mockedExecSync).toHaveBeenCalledWith(
      'git log v1.0.0..HEAD --format="%H|%s|%b" --no-merges',
      expect.objectContaining({ cwd: "/repo" })
    );
  });

  it("returns empty array when no new commits", () => {
    mockedExecSync.mockReturnValue("");

    const result = getCommitsSince("v1.0.0", "/repo");

    expect(result).toEqual([]);
  });
});
