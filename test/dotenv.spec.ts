import { describe, expect, it } from "vitest";

import { parseDotenv } from "../src/dotenv";

describe("dotenv parser", () => {
  it("parses simple assignments", () => {
    const content = `FOO=bar\nBAZ=qux\n`;
    const parsed = parseDotenv(content);

    expect(parsed.errors).toEqual([]);
    expect(parsed.values).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("handles export prefix, quotes, and comments", () => {
    const content = `
export API_KEY="value-1" # inline comment
PASSWORD='value-2'
# full-line comment
PLAIN=value-3
`;

    const parsed = parseDotenv(content);

    expect(parsed.errors).toEqual([]);
    expect(parsed.values).toEqual({
      API_KEY: "value-1",
      PASSWORD: "value-2",
      PLAIN: "value-3",
    });
  });

  it("does not expand dotenv interpolation by default", () => {
    const content = `API_HOST=api.example.com\nAPI_URL=https://\${API_HOST}/v1\n`;
    const parsed = parseDotenv(content);

    expect(parsed.errors).toEqual([]);
    expect(parsed.values).toEqual({
      API_HOST: "api.example.com",
      API_URL: "https://$" + "{API_HOST}/v1",
    });
  });

  it("expands dotenv interpolation when enabled", () => {
    const content = `API_HOST=api.example.com\nAPI_URL=https://\${API_HOST}/v1\n`;
    const parsed = parseDotenv(content, { expand: true });

    expect(parsed.errors).toEqual([]);
    expect(parsed.values).toEqual({
      API_HOST: "api.example.com",
      API_URL: "https://api.example.com/v1",
    });
  });

  it("accepts dotenv-compatible key names", () => {
    const content = `123INVALID_NAME=value\nNAME.WITH.DOTS=ok\nNAME-WITH-DASH=ok\n`;
    const parsed = parseDotenv(content);

    expect(parsed.errors).toEqual([]);
    expect(parsed.values).toEqual({
      "123INVALID_NAME": "value",
      "NAME.WITH.DOTS": "ok",
      "NAME-WITH-DASH": "ok",
    });
  });

  it("reports malformed lines", () => {
    const content = `GOOD=value\nnot an assignment\nANOTHER=ok\n`;
    const parsed = parseDotenv(content);

    expect(parsed.values).toEqual({ GOOD: "value", ANOTHER: "ok" });
    expect(parsed.errors).toEqual(["line 2: not a valid assignment"]);
  });
});
