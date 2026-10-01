import { getInput, setOutput, setFailed } from "@actions/core";
import { resolve } from "node:path";
import { writeOutput } from "./writer.js";
import { generateChangelog, suggestVersion } from "./core.js";

export async function runAction(): Promise<void> {
  const bump = getInput("bump") === "true";
  const prefix = getInput("prefix") || "";
  const suffix = getInput("suffix") || "";
  const file = getInput("file") || "CHANGELOG.md";
  const verbose = getInput("verbose") === "true";
  const workingDirectory = getInput("working-directory") || ".";
  const cwd = resolve(workingDirectory);

  try {
    if (bump) {
      setOutput("version", suggestVersion(cwd, prefix, suffix));
    } else {
      await writeOutput(generateChangelog(cwd, verbose), resolve(cwd, file));
      setOutput("changelog", file);
    }
  } catch (error) {
    setFailed(error instanceof Error ? error.message : String(error));
  }
}
