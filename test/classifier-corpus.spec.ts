import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { classify } from "../src";
import { extractEnvAssignments } from "./utils/env";

const CURATED_DIR = resolve(process.cwd(), "test/fixtures");

async function loadAssignments(fileName: string): Promise<Array<{ name: string; value: string }>> {
  const content = await readFile(resolve(CURATED_DIR, fileName), "utf8");
  return extractEnvAssignments(content).map(({ name, value }) => ({ name, value }));
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

describe("classifier corpus evaluation (curated fixtures)", () => {
  it("detects and maps curated valid secrets at high coverage", async () => {
    const valid = await loadAssignments("valid-secrets.env");

    expect(valid.length).toBeGreaterThanOrEqual(90);

    let detected = 0;
    let mapped = 0;
    let dropped = 0;

    for (const sample of valid) {
      const result = classify(sample.name, sample.value);
      if (result.isSecret) {
        detected += 1;
      }
      if (!result.dropped && result.hosts.length > 0) {
        mapped += 1;
      }
      if (result.dropped) {
        dropped += 1;
      }
    }

    const detectionRate = ratio(detected, valid.length);
    const mappingRate = ratio(mapped, valid.length);

    console.info("[classifier-curated:valid]", {
      total: valid.length,
      detected,
      mapped,
      dropped,
      detectionRate,
      mappingRate,
    });

    expect(detectionRate).toBeGreaterThanOrEqual(0.98);
    expect(mappingRate).toBeGreaterThanOrEqual(0.9);
    expect(mapped).toBeGreaterThanOrEqual(90);
    expect(dropped).toBeLessThanOrEqual(10);
  });

  it("keeps curated invalid vars mostly non-secret", async () => {
    const invalid = await loadAssignments("invalid-vars.env");

    expect(invalid.length).toBeGreaterThanOrEqual(90);

    let flagged = 0;
    let mapped = 0;

    for (const sample of invalid) {
      const result = classify(sample.name, sample.value);
      if (result.isSecret) {
        flagged += 1;
      }
      if (!result.dropped && result.hosts.length > 0) {
        mapped += 1;
      }
    }

    const flaggedRate = ratio(flagged, invalid.length);

    console.info("[classifier-curated:invalid]", {
      total: invalid.length,
      flagged,
      mapped,
      flaggedRate,
    });

    expect(flaggedRate).toBeLessThanOrEqual(0.02);
    expect(mapped).toBe(0);
  });
});
