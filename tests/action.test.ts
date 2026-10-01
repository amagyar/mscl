import { beforeEach, describe, expect, it, vi } from "vitest";
import { getInput, setFailed, setOutput } from "@actions/core";
import { generateChangelog, suggestVersion } from "../src/core.js";
import { writeOutput } from "../src/writer.js";
import { runAction } from "../src/action-core.js";

vi.mock("@actions/core", () => ({
  getInput: vi.fn(),
  setFailed: vi.fn(),
  setOutput: vi.fn(),
}));
vi.mock("../src/core.js", () => ({
  generateChangelog: vi.fn(),
  suggestVersion: vi.fn(),
}));
vi.mock("../src/writer.js", () => ({
  writeOutput: vi.fn(),
}));

const mockedGetInput = vi.mocked(getInput);
const mockedSetOutput = vi.mocked(setOutput);
const mockedSetFailed = vi.mocked(setFailed);
const mockedGenerateChangelog = vi.mocked(generateChangelog);
const mockedSuggestVersion = vi.mocked(suggestVersion);
const mockedWriteOutput = vi.mocked(writeOutput);

function setInputs(inputs: Record<string, string>): void {
  mockedGetInput.mockImplementation((name) => inputs[name] || "");
}

describe("runAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setInputs({ "working-directory": "/repo" });
  });

  it("writes the generated changelog and sets its output path", async () => {
    setInputs({
      "working-directory": "/repo",
      file: "docs/CHANGELOG.md",
      verbose: "true",
    });
    mockedGenerateChangelog.mockReturnValue("# Changelog\n");

    await runAction();

    expect(mockedGenerateChangelog).toHaveBeenCalledWith("/repo", true);
    expect(mockedWriteOutput).toHaveBeenCalledWith("# Changelog\n", "/repo/docs/CHANGELOG.md");
    expect(mockedSetOutput).toHaveBeenCalledWith("changelog", "docs/CHANGELOG.md");
    expect(mockedSetFailed).not.toHaveBeenCalled();
  });

  it("suggests a version and sets the version output", async () => {
    setInputs({
      "working-directory": "/repo",
      bump: "true",
      prefix: "v",
      suffix: "-rc",
    });
    mockedSuggestVersion.mockReturnValue("v1.2.0-rc.1");

    await runAction();

    expect(mockedSuggestVersion).toHaveBeenCalledWith("/repo", "v", "-rc");
    expect(mockedSetOutput).toHaveBeenCalledWith("version", "v1.2.0-rc.1");
    expect(mockedWriteOutput).not.toHaveBeenCalled();
    expect(mockedSetFailed).not.toHaveBeenCalled();
  });

  it("reports generation failures through the Action API", async () => {
    mockedGenerateChangelog.mockImplementation(() => {
      throw new Error("No valid semver tags found in repository");
    });

    await runAction();

    expect(mockedSetFailed).toHaveBeenCalledWith("No valid semver tags found in repository");
  });
});
