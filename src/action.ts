import { getInput, setOutput, setFailed } from "@actions/core";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

async function runAction(): Promise<void> {
  const bump = getInput("bump") === "true";
  const prefix = getInput("prefix") || "";
  const suffix = getInput("suffix") || "";
  const file = getInput("file") || "CHANGELOG.md";
  const verbose = getInput("verbose") === "true";
  const workingDirectory = getInput("working-directory") || ".";

  const cwd = resolve(workingDirectory);

  try {
    if (bump) {
      let cmd = "node dist/index.js -b";
      if (prefix) cmd += ` --prefix "${prefix}"`;
      if (suffix) cmd += ` --suffix "${suffix}"`;

      const output = execSync(cmd, { cwd, encoding: "utf-8" }).trim();
      setOutput("version", output);
    } else {
      let cmd = `node dist/index.js -f "${file}"`;
      if (verbose) cmd += " -a";

      const output = execSync(cmd, { cwd, encoding: "utf-8" });
      writeFileSync(resolve(cwd, file), output);
      setOutput("changelog", file);
    }
  } catch (error) {
    setFailed(error instanceof Error ? error.message : String(error));
  }
}

runAction();
