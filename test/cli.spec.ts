import { describe, expect, it } from "vitest";

import { parseArgs } from "../src/cli";

describe("cli argument parsing", () => {
  it("parses env mode flags", () => {
    const options = parseArgs(["inspect", "--env", "--json", "--show-safe"]);

    expect(options).toEqual({
      mode: "env",
      filePath: undefined,
      json: true,
      showSafe: true,
      includeSecretValues: false,
      expand: false,
    });
  });

  it("parses file mode with explicit path", () => {
    const options = parseArgs(["inspect", "--file", ".env", "--json"]);

    expect(options).toEqual({
      mode: "file",
      filePath: ".env",
      json: true,
      showSafe: false,
      includeSecretValues: false,
      expand: false,
    });
  });

  it("parses file mode with expansion enabled", () => {
    const options = parseArgs(["inspect", "--file", ".env", "--expand"]);

    expect(options).toEqual({
      mode: "file",
      filePath: ".env",
      json: false,
      showSafe: false,
      includeSecretValues: false,
      expand: true,
    });
  });

  it("rejects missing file path", () => {
    expect(() => parseArgs(["inspect", "--file"])).toThrowError("--file requires a non-flag path");
  });

  it("rejects flag passed as file path", () => {
    expect(() => parseArgs(["inspect", "--file", "--json"])).toThrowError(
      "--file requires a non-flag path",
    );
  });

  it("rejects conflicting source modes", () => {
    expect(() => parseArgs(["inspect", "--file", ".env", "--env"])).toThrowError(
      "--env cannot be combined with --file",
    );
    expect(() => parseArgs(["inspect", "--env", "--file", ".env"])).toThrowError(
      "--file cannot be combined with --env",
    );
  });

  it("rejects --expand without --file", () => {
    expect(() => parseArgs(["inspect", "--expand"])).toThrowError(
      "--expand can only be used with --file",
    );
  });

  it("rejects unknown arguments", () => {
    expect(() => parseArgs(["inspect", "--wat"])).toThrowError("unknown argument: --wat");
  });
});
