import { describe, expect, it } from "vitest";

import { compilePattern, normalizeRegexForJs } from "../src/regex";

describe("regex normalization", () => {
  it("preserves scoped case sensitivity boundaries", () => {
    const regex = compilePattern("(?i)foo(?-i:BAR)");

    expect(regex.test("fooBAR")).toBe(true);
    expect(regex.test("FOOBAR")).toBe(true);
    expect(regex.test("fooBar")).toBe(false);
  });

  it("applies bare inline modifiers from token position", () => {
    const regex = compilePattern("prefix(?i)suf");

    expect(regex.test("prefixSUF")).toBe(true);
    expect(regex.test("PREFIXSUF")).toBe(false);
  });

  it("supports bare inline modifiers inside capturing groups", () => {
    const regex = compilePattern("\\b(p8e-(?i)[a-z0-9]{4})\\b");

    expect(regex.test("p8e-AbC1")).toBe(true);
    expect(regex.test("P8E-AbC1")).toBe(false);
  });

  it("normalizes python-style named groups", () => {
    const normalized = normalizeRegexForJs("(?P<alg>abc)");

    expect(normalized.pattern).toBe("(?<alg>abc)");
    expect(normalized.flags).toBe("");
  });
});
