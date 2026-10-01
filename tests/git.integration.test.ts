import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getLastTag } from "../src/git.js";

const repositories: string[] = [];

function createRepository(): string {
  const cwd = mkdtempSync(join(tmpdir(), "mscl-git-"));
  repositories.push(cwd);
  execFileSync("git", ["init", "-b", "main"], { cwd, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd });
  execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd });
  execFileSync("git", ["config", "tag.gpgsign", "false"], { cwd });
  return cwd;
}

function commit(cwd: string, message: string): void {
  writeFileSync(join(cwd, "file.txt"), message);
  execFileSync("git", ["add", "file.txt"], { cwd });
  execFileSync("git", ["commit", "-m", message], { cwd, stdio: "ignore" });
}

afterEach(() => {
  for (const cwd of repositories.splice(0)) rmSync(cwd, { recursive: true, force: true });
});

describe("getLastTag", () => {
  it("chooses the highest SemVer tag reachable from HEAD and ignores unrelated tags", () => {
    const cwd = createRepository();
    commit(cwd, "feat: main baseline");
    execFileSync("git", ["tag", "v1.0.0"], { cwd });
    execFileSync("git", ["checkout", "--orphan", "unrelated"], { cwd, stdio: "ignore" });
    commit(cwd, "feat: unrelated release");
    execFileSync("git", ["tag", "v9.0.0"], { cwd });
    execFileSync("git", ["checkout", "main"], { cwd, stdio: "ignore" });
    commit(cwd, "fix: current change");

    expect(getLastTag(cwd)).toBe("v1.0.0");
  });

  it("selects the highest reachable SemVer from a prefixed tag set", () => {
    const cwd = createRepository();
    commit(cwd, "feat: first release");
    execFileSync("git", ["tag", "release-v1.0.0"], { cwd });
    commit(cwd, "feat: second release");
    execFileSync("git", ["tag", "v1.2.0"], { cwd });
    commit(cwd, "fix: unreleased patch");

    expect(getLastTag(cwd)).toBe("v1.2.0");
  });
});
