import { describe, it, expect } from "vitest";
import { suggestNextVersion, getNextPrereleaseVersion } from "../src/bump.js";
import type { RawCommit } from "../src/git.js";

function createRawCommit(subject: string, hash = "abc123", body = ""): RawCommit {
  return { hash, subject, body };
}

describe("suggestNextVersion", () => {
  describe("with existing tag", () => {
    it("returns patch bump for fix commits", () => {
      const commits = [createRawCommit("fix: resolve bug")];
      const result = suggestNextVersion(commits, "v1.0.0");

      expect(result.currentVersion).toBe("1.0.0");
      expect(result.nextVersion).toBe("1.0.1");
      expect(result.bumpType).toBe("patch");
      expect(result.hasFixes).toBe(true);
    });

    it("returns minor bump for feat commits", () => {
      const commits = [createRawCommit("feat: add feature")];
      const result = suggestNextVersion(commits, "v1.0.0");

      expect(result.nextVersion).toBe("1.1.0");
      expect(result.bumpType).toBe("minor");
      expect(result.hasFeatures).toBe(true);
    });

    it("returns major bump for breaking changes", () => {
      const commits = [createRawCommit("feat!: breaking change")];
      const result = suggestNextVersion(commits, "v1.0.0");

      expect(result.nextVersion).toBe("2.0.0");
      expect(result.bumpType).toBe("major");
      expect(result.hasBreaking).toBe(true);
    });

    it("returns minor bump for breaking changes in 0.x version", () => {
      const commits = [createRawCommit("feat!: breaking change")];
      const result = suggestNextVersion(commits, "v0.1.0");

      expect(result.nextVersion).toBe("0.2.0");
      expect(result.bumpType).toBe("minor");
    });

    it("returns no bump for chore commits", () => {
      const commits = [createRawCommit("chore: update deps")];
      const result = suggestNextVersion(commits, "v1.0.0");

      expect(result.nextVersion).toBe("1.0.0");
      expect(result.bumpType).toBe("none");
    });

    it("returns patch bump for perf commits", () => {
      const commits = [createRawCommit("perf: optimize loop")];
      const result = suggestNextVersion(commits, "v1.0.0");

      expect(result.nextVersion).toBe("1.0.1");
      expect(result.bumpType).toBe("patch");
    });

    it("handles tag without v prefix", () => {
      const commits = [createRawCommit("feat: add feature")];
      const result = suggestNextVersion(commits, "1.0.0");

      expect(result.currentVersion).toBe("1.0.0");
      expect(result.nextVersion).toBe("1.1.0");
    });

    it("breaking takes precedence over feat and fix", () => {
      const commits = [
        createRawCommit("feat: add feature"),
        createRawCommit("fix: fix bug"),
        createRawCommit("feat!: breaking change"),
      ];
      const result = suggestNextVersion(commits, "v1.0.0");

      expect(result.bumpType).toBe("major");
      expect(result.nextVersion).toBe("2.0.0");
    });

    it("feat takes precedence over fix", () => {
      const commits = [
        createRawCommit("fix: fix bug"),
        createRawCommit("feat: add feature"),
      ];
      const result = suggestNextVersion(commits, "v1.0.0");

      expect(result.bumpType).toBe("minor");
      expect(result.nextVersion).toBe("1.1.0");
    });
  });

  describe("without existing tag", () => {
    it("assumes 0.0.0 as base version", () => {
      const commits = [createRawCommit("feat: initial feature")];
      const result = suggestNextVersion(commits, null);

      expect(result.currentVersion).toBe("0.0.0");
      expect(result.nextVersion).toBe("0.1.0");
      expect(result.bumpType).toBe("minor");
    });

    it("returns 0.1.0 for feat commits", () => {
      const commits = [createRawCommit("feat: initial feature")];
      const result = suggestNextVersion(commits, null);

      expect(result.nextVersion).toBe("0.1.0");
    });

    it("returns 0.0.1 for fix commits", () => {
      const commits = [createRawCommit("fix: fix bug")];
      const result = suggestNextVersion(commits, null);

      expect(result.nextVersion).toBe("0.0.1");
    });
  });
});

describe("getNextPrereleaseVersion", () => {
  it("starts at .1 when no previous prerelease tags exist", () => {
    const result = getNextPrereleaseVersion("1.0.0", "-rc", []);
    expect(result).toBe("1.0.0-rc.1");
  });

  it("starts at .1 when different version prereleases exist", () => {
    const tags = ["v0.9.0-rc.1", "v0.9.0-rc.2"];
    const result = getNextPrereleaseVersion("1.0.0", "-rc", tags);
    expect(result).toBe("1.0.0-rc.1");
  });

  it("increments from highest existing prerelease", () => {
    const tags = ["v1.0.0-rc.1", "v1.0.0-rc.2"];
    const result = getNextPrereleaseVersion("1.0.0", "-rc", tags);
    expect(result).toBe("1.0.0-rc.3");
  });

  it("handles non-sequential prerelease numbers", () => {
    const tags = ["v1.0.0-rc.1", "v1.0.0-rc.5"];
    const result = getNextPrereleaseVersion("1.0.0", "-rc", tags);
    expect(result).toBe("1.0.0-rc.6");
  });

  it("strips number from suffix and auto-increments", () => {
    const tags = ["v1.0.0-rc.2"];
    const result = getNextPrereleaseVersion("1.0.0", "-rc.5", tags);
    expect(result).toBe("1.0.0-rc.3");
  });

  it("handles tags without v prefix", () => {
    const tags = ["1.0.0-rc.1", "1.0.0-rc.2"];
    const result = getNextPrereleaseVersion("1.0.0", "-rc", tags);
    expect(result).toBe("1.0.0-rc.3");
  });

  it("handles mixed v prefix and no prefix tags", () => {
    const tags = ["v1.0.0-rc.1", "1.0.0-rc.3"];
    const result = getNextPrereleaseVersion("1.0.0", "-rc", tags);
    expect(result).toBe("1.0.0-rc.4");
  });

  it("ignores prereleases with different suffix", () => {
    const tags = ["v1.0.0-beta.1", "v1.0.0-rc.2"];
    const result = getNextPrereleaseVersion("1.0.0", "-beta", tags);
    expect(result).toBe("1.0.0-beta.2");
  });

  it("handles complex suffix names", () => {
    const tags = ["v1.0.0-alpha.beta.1"];
    const result = getNextPrereleaseVersion("1.0.0", "-alpha.beta", tags);
    expect(result).toBe("1.0.0-alpha.beta.2");
  });

  describe("semver bump resets prerelease counter", () => {
    it("bumps to new minor version starts at rc.1", () => {
      const tags = ["v0.0.1-rc.1", "v0.0.1-rc.2"];
      const result = getNextPrereleaseVersion("0.1.0", "-rc", tags);
      expect(result).toBe("0.1.0-rc.1");
    });

    it("bumps to new major version starts at rc.1", () => {
      const tags = ["v1.0.0-rc.1", "v1.0.0-rc.5", "v1.1.0-rc.2"];
      const result = getNextPrereleaseVersion("2.0.0", "-rc", tags);
      expect(result).toBe("2.0.0-rc.1");
    });

    it("continues from existing prerelease for same version", () => {
      const tags = ["v0.1.0-rc.1", "v0.1.0-rc.2"];
      const result = getNextPrereleaseVersion("0.1.0", "-rc", tags);
      expect(result).toBe("0.1.0-rc.3");
    });
  });

  describe("prerelease workflow", () => {
    it("fix after 0.1.0-rc.1 stays on 0.1.0-rc.2", () => {
      const commits = [createRawCommit("fix: another bug")];
      const result = suggestNextVersion(commits, "v0.1.0-rc.1");
      expect(result.nextVersion).toBe("0.1.0");
    });

    it("feat after 0.1.0-rc.1 bumps to 0.2.0", () => {
      const commits = [createRawCommit("feat: new feature")];
      const result = suggestNextVersion(commits, "v0.1.0-rc.1");
      expect(result.nextVersion).toBe("0.2.0");
    });

    it("full workflow: fix -> fix -> feat -> fix", () => {
      const tags: string[] = [];

      // fix -> 0.0.1-rc.1
      let result = suggestNextVersion([createRawCommit("fix: bug 1")], null);
      let version = getNextPrereleaseVersion(result.nextVersion, "-rc", tags);
      expect(version).toBe("0.0.1-rc.1");
      tags.push("v" + version);

      // fix -> 0.0.1-rc.2
      result = suggestNextVersion([createRawCommit("fix: bug 2")], "v0.0.1-rc.1");
      version = getNextPrereleaseVersion(result.nextVersion, "-rc", tags);
      expect(version).toBe("0.0.1-rc.2");
      tags.push("v" + version);

      // feat -> 0.1.0-rc.1
      result = suggestNextVersion([createRawCommit("feat: feature 1")], "v0.0.1-rc.2");
      version = getNextPrereleaseVersion(result.nextVersion, "-rc", tags);
      expect(version).toBe("0.1.0-rc.1");
      tags.push("v" + version);

      // fix -> 0.1.0-rc.2 (stays on 0.1.0, just bumps rc)
      result = suggestNextVersion([createRawCommit("fix: bug 3")], "v0.1.0-rc.1");
      version = getNextPrereleaseVersion(result.nextVersion, "-rc", tags);
      expect(version).toBe("0.1.0-rc.2");
    });
  });
});
