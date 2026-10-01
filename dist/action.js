import {
  generateChangelog,
  suggestVersion,
  writeOutput
} from "./chunk-QT3ENQQJ.js";

// src/action-core.ts
import { getInput, setOutput, setFailed } from "@actions/core";
import { resolve } from "path";
async function runAction() {
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

// src/action.ts
runAction().catch((error) => {
  console.error("Unexpected error:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
//# sourceMappingURL=action.js.map