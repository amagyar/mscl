import { program } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeOutput } from "./writer.js";
import { generateChangelog, suggestVersion } from "./core.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  const pkgPath = join(__dirname, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  return pkg.version;
}

export async function run(): Promise<void> {
  program
    .name("mscl")
    .description("Generate changelogs from Git tags using Conventional Commits")
    .version(getVersion(), "-v, --version", "output the current version")
    .option("-f, --file <path>", "output file path (defaults to stdout)")
    .option("-a, --all", "include all commit types (not just feat/fix/perf/revert)")
    .option("-b, --bump", "suggest next version based on unreleased commits")
    .option("--prefix <prefix>", "prefix for bump output (e.g., 'v' for v1.2.3)")
    .option("--suffix <suffix>", "suffix for bump output (e.g., '-rc.1')")
    .action(async (options) => {
      const cwd = process.cwd();

      if (options.bump) {
        console.log(suggestVersion(cwd, options.prefix || "", options.suffix || ""));
        return;
      }

      const markdown = generateChangelog(cwd, options.all || false);
      await writeOutput(markdown, options.file);
    });

  await program.parseAsync();
}
