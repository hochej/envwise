import { describe, expect, it } from "vitest";

import { compilePattern, normalizeRegexForJs } from "../src/regex";

const hasScopedModifiers = (() => {
  try {
    // biome-ignore lint/complexity/useRegexLiterals: literal would be a syntax error on Node <23
    new RegExp("(?i:a)");
    return true;
  } catch {
    return false;
  }
})();

describe("regex normalization", () => {
  it.skipIf(!hasScopedModifiers)("preserves scoped case sensitivity boundaries", () => {
    const regex = compilePattern("(?i)foo(?-i:BAR)");

    expect(regex.test("fooBAR")).toBe(true);
    expect(regex.test("FOOBAR")).toBe(true);
    expect(regex.test("fooBar")).toBe(false);
  });

  it.skipIf(!hasScopedModifiers)("applies bare inline modifiers from token position", () => {
    const regex = compilePattern("prefix(?i)suf");

    expect(regex.test("prefixSUF")).toBe(true);
    expect(regex.test("PREFIXSUF")).toBe(false);
  });

  it.skipIf(!hasScopedModifiers)("supports bare inline modifiers inside capturing groups", () => {
    const regex = compilePattern("\\b(p8e-(?i)[a-z0-9]{4})\\b");

    expect(regex.test("p8e-AbC1")).toBe(true);
    expect(regex.test("P8E-AbC1")).toBe(false);
  });

  it.skipIf(hasScopedModifiers)(
    "falls back to global flags when scoped modifiers are not supported",
    () => {
      // On older runtimes, (?i:...) is stripped to (?:...) with global `i` flag.
      const regex = compilePattern("(?i)foo");

      expect(regex.flags).toContain("i");
      expect(regex.test("FOO")).toBe(true);
      expect(regex.test("foo")).toBe(true);
    },
  );

  it("normalizes python-style named groups", () => {
    const normalized = normalizeRegexForJs("(?P<alg>abc)");

    expect(normalized.pattern).toBe("(?<alg>abc)");
    expect(normalized.flags).toBe("");
  });

  it("compiles patterns with inline (?i) on any runtime", () => {
    // This must not throw regardless of Node version.
    const regex = compilePattern("(?i:[a-z]{4})suffix");

    expect(regex.test("ABCDsuffix")).toBe(true);
  });
});
