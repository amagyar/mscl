import { writeFile } from "node:fs/promises";

export async function writeOutput(content: string, filePath?: string): Promise<void> {
  if (filePath) {
    await writeFile(filePath, content, "utf-8");
  } else {
    process.stdout.write(content);
  }
}
