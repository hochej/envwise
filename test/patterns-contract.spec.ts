import { describe, expect, it } from "vitest";

import { getPatternStore } from "../src";

describe("gondolin mapping contract", () => {
  it("loads expected top-level mapping sizes", () => {
    const store = getPatternStore();

    expect(Object.keys(store.raw.keyword_host_map)).toHaveLength(79);
    expect(Object.keys(store.raw.exact_name_host_map)).toHaveLength(17);
    expect(store.raw.value_patterns).toHaveLength(221);
  });

  it("compiles all value patterns for runtime matching", () => {
    const store = getPatternStore();

    expect(store.compiledValuePatterns.length).toBe(store.raw.value_patterns.length);
    expect(store.failedValuePatterns).toHaveLength(0);
  });
});
