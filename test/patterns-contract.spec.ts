import { describe, expect, it } from "vitest";

import { getPatternStore } from "../src";

describe("gondolin mapping contract", () => {
  it("loads expected top-level mapping sizes", () => {
    const store = getPatternStore();

    expect(Object.keys(store.raw.keyword_host_map)).toHaveLength(79);
    expect(Object.keys(store.raw.exact_name_host_map)).toHaveLength(17);
    expect(store.raw.value_patterns).toHaveLength(221);
  });

  it("compiles most value patterns for runtime matching", () => {
    const store = getPatternStore();

    // We should compile nearly all patterns after normalization.
    expect(store.compiledValuePatterns.length).toBeGreaterThanOrEqual(210);
    expect(store.failedValuePatterns.length).toBeLessThanOrEqual(11);
  });
});
