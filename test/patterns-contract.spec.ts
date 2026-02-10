import { describe, expect, it } from "vitest";

import { getPatternStore } from "../src";

describe("gondolin mapping contract", () => {
  it("loads non-empty top-level mapping data", () => {
    const store = getPatternStore();

    expect(Object.keys(store.raw.keyword_host_map).length).toBeGreaterThan(0);
    expect(Object.keys(store.raw.exact_name_host_map).length).toBeGreaterThan(0);
    expect(store.raw.value_patterns.length).toBeGreaterThan(0);
  });

  it("compiles all value patterns for runtime matching", () => {
    const store = getPatternStore();

    expect(store.compiledValuePatterns.length).toBe(store.raw.value_patterns.length);
    expect(store.failedValuePatterns).toHaveLength(0);

    for (const [keyword, hosts] of Object.entries(store.raw.keyword_host_map)) {
      expect(keyword.length).toBeGreaterThan(0);
      expect(hosts.length).toBeGreaterThan(0);
      for (const host of hosts) {
        expect(host.length).toBeGreaterThan(0);
      }
    }
  });

  it("returns an immutable cached pattern store", () => {
    const store = getPatternStore();

    expect(Object.isFrozen(store)).toBe(true);
    expect(Object.isFrozen(store.raw)).toBe(true);
    expect(Object.isFrozen(store.raw.keyword_host_map)).toBe(true);
    expect(Object.isFrozen(store.raw.value_patterns)).toBe(true);
  });
});
