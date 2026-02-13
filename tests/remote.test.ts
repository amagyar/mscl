import { describe, it, expect } from "vitest";
import {
  parseRemoteUrl,
  buildCommitUrl,
  buildIssueUrl,
  buildPullRequestUrl,
} from "../src/remote.js";

describe("parseRemoteUrl", () => {
  describe("SSH format (git@)", () => {
    it("parses git@github.com:owner/repo.git", () => {
      const result = parseRemoteUrl("git@github.com:acme/my-lib.git");

      expect(result).toEqual({
        host: "github.com",
        owner: "acme",
        repo: "my-lib",
      });
    });

    it("parses git@gitlab.com:owner/repo without .git suffix", () => {
      const result = parseRemoteUrl("git@gitlab.com:acme/my-lib");

      expect(result).toEqual({
        host: "gitlab.com",
        owner: "acme",
        repo: "my-lib",
      });
    });

    it("parses repos with nested paths", () => {
      const result = parseRemoteUrl("git@github.com:acme/group/my-lib.git");

      expect(result).toEqual({
        host: "github.com",
        owner: "acme",
        repo: "group/my-lib",
      });
    });
  });

  describe("HTTPS format", () => {
    it("parses https://github.com/owner/repo.git", () => {
      const result = parseRemoteUrl("https://github.com/acme/my-lib.git");

      expect(result).toEqual({
        host: "github.com",
        owner: "acme",
        repo: "my-lib",
      });
    });

    it("parses https://github.com/owner/repo without .git", () => {
      const result = parseRemoteUrl("https://github.com/acme/my-lib");

      expect(result).toEqual({
        host: "github.com",
        owner: "acme",
        repo: "my-lib",
      });
    });

    it("parses gitlab URLs", () => {
      const result = parseRemoteUrl("https://gitlab.com/acme/my-lib");

      expect(result).toEqual({
        host: "gitlab.com",
        owner: "acme",
        repo: "my-lib",
      });
    });
  });

  describe("invalid URLs", () => {
    it("returns null for invalid format", () => {
      expect(parseRemoteUrl("not-a-url")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseRemoteUrl("")).toBeNull();
    });
  });
});

describe("buildCommitUrl", () => {
  it("builds commit URL", () => {
    const remote = { host: "github.com", owner: "acme", repo: "my-lib" };

    expect(buildCommitUrl(remote, "abc123")).toBe(
      "https://github.com/acme/my-lib/commit/abc123"
    );
  });

  it("works with gitlab", () => {
    const remote = { host: "gitlab.com", owner: "acme", repo: "my-lib" };

    expect(buildCommitUrl(remote, "def456")).toBe(
      "https://gitlab.com/acme/my-lib/commit/def456"
    );
  });
});

describe("buildIssueUrl", () => {
  it("builds issue URL", () => {
    const remote = { host: "github.com", owner: "acme", repo: "my-lib" };

    expect(buildIssueUrl(remote, "123")).toBe(
      "https://github.com/acme/my-lib/issues/123"
    );
  });
});

describe("buildPullRequestUrl", () => {
  it("builds pull request URL", () => {
    const remote = { host: "github.com", owner: "acme", repo: "my-lib" };

    expect(buildPullRequestUrl(remote, "42")).toBe(
      "https://github.com/acme/my-lib/pull/42"
    );
  });
});
