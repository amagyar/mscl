import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const root = process.cwd();
let fixtureRoot: string;
let repository: string;

function git(args: string[], cwd = repository): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

function commit(message: string): void {
  writeFileSync(join(repository, "file.txt"), message);
  git(["add", "file.txt"]);
  git(["commit", "-m", message]);
}

function runAction(inputs: Record<string, string>): { status: number | null; output: string } {
  const outputFile = join(fixtureRoot, `output-${Math.random()}.txt`);
  writeFileSync(outputFile, "");
  const result = spawnSync("node", [join(root, "dist/action.js")], {
    cwd: repository,
    encoding: "utf-8",
    env: {
      ...process.env,
      GITHUB_ACTIONS: "true",
      GITHUB_OUTPUT: outputFile,
      INPUT_WORKING_DIRECTORY: repository,
      ...Object.fromEntries(Object.entries(inputs).map(([key, value]) => [`INPUT_${key.replaceAll("-", "_").toUpperCase()}`, value])),
    },
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30000,
  });
  const output = existsSync(outputFile) ? readFileSync(outputFile, "utf-8") : "";
  return { status: result.status, output: `${result.stdout}${result.stderr}${output}` };
}

beforeAll(() => {
  execFileSync("npm", ["run", "build"], { cwd: root, stdio: "ignore" });
  fixtureRoot = mkdtempSync(join(tmpdir(), "mscl-action-"));
  repository = join(fixtureRoot, "repo");
  mkdirSync(repository);
  git(["init", "-b", "main"]);
  git(["config", "user.name", "Test User"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "commit.gpgsign", "false"]);
  git(["config", "tag.gpgsign", "false"]);

  commit("feat: first release");
  git(["tag", "v1.0.0"]);
  git(["checkout", "--orphan", "unrelated"]);
  commit("feat: unrelated release");
  git(["tag", "v9.0.0"]);
  git(["checkout", "main"]);
  commit("fix: current change");
});

afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("built GitHub Action", () => {
  it("generates a changelog file and sets the path output", () => {
    mkdirSync(join(repository, "docs"));
    const result = runAction({ file: "docs/CHANGELOG.md" });

    expect(result.status, result.output).toBe(0);
    expect(readFileSync(join(repository, "docs/CHANGELOG.md"), "utf-8")).toContain("unrelated release");
    expect(result.output).toMatch(/changelog<<[^\n]+\ndocs\/CHANGELOG\.md\n/);
  });

  it("suggests a version from reachable tags, not an unrelated higher tag", () => {
    const result = runAction({ bump: "true", prefix: "v" });

    expect(result.status, result.output).toBe(0);
    expect(result.output).toMatch(/version<<[^\n]+\nv1\.0\.1\n/);
  });
});
