import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { classify } from "../src";
import { extractEnvAssignments } from "./utils/env";

const CURATED_DIR = resolve(process.cwd(), "test/fixtures");

const VALUE_PATTERN_EXPECTATIONS: Record<
  string,
  { patternId: string; hosts: string[]; keyword: string }
> = {
  VP_GITHUB_PAT: {
    patternId: "github-pat",
    hosts: ["api.github.com"],
    keyword: "github",
  },
  VP_GITHUB_FINE_GRAINED: {
    patternId: "github-fine-grained-pat",
    hosts: ["api.github.com"],
    keyword: "github",
  },
  VP_DIGITALOCEAN_PAT: {
    patternId: "digitalocean-pat",
    hosts: ["api.digitalocean.com", "cloud.digitalocean.com"],
    keyword: "digitalocean",
  },
  VP_DIGITALOCEAN_ACCESS: {
    patternId: "digitalocean-access-token",
    hosts: ["api.digitalocean.com", "cloud.digitalocean.com"],
    keyword: "digitalocean",
  },
  VP_GCP_API_KEY: {
    patternId: "gcp-api-key",
    hosts: ["iam.googleapis.com", "www.googleapis.com"],
    keyword: "gcp",
  },
  VP_SLACK_APP: {
    patternId: "slack-app-token",
    hosts: ["slack.com"],
    keyword: "slack",
  },
  VP_TWILIO_API_KEY: {
    patternId: "twilio-api-key",
    hosts: ["verify.twilio.com"],
    keyword: "twilio",
  },
  VP_ANTHROPIC_API_KEY: {
    patternId: "anthropic-api-key",
    hosts: ["api.anthropic.com"],
    keyword: "anthropic",
  },
};

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
    let matchedByValue = 0;

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
      if (result.matchedBy === "value") {
        matchedByValue += 1;
      }
    }

    const detectionRate = ratio(detected, valid.length);
    const mappingRate = ratio(mapped, valid.length);

    console.info("[classifier-curated:valid]", {
      total: valid.length,
      detected,
      mapped,
      dropped,
      matchedByValue,
      detectionRate,
      mappingRate,
    });

    expect(detectionRate).toBeGreaterThanOrEqual(0.98);
    expect(mappingRate).toBeGreaterThanOrEqual(0.9);
    expect(mapped).toBeGreaterThanOrEqual(90);
    expect(dropped).toBeLessThanOrEqual(10);
    expect(matchedByValue).toBeGreaterThanOrEqual(Object.keys(VALUE_PATTERN_EXPECTATIONS).length);
  });

  it("matches realistic token fixtures by expected value patterns", async () => {
    const valid = await loadAssignments("valid-secrets.env");

    const validByName = new Map(valid.map((entry) => [entry.name, entry.value]));

    for (const [name, expectation] of Object.entries(VALUE_PATTERN_EXPECTATIONS)) {
      const value = validByName.get(name);
      expect(value, `missing fixture: ${name}`).toBeDefined();

      const result = classify(name, value as string);
      expect(result.isSecret, `${name} should be detected`).toBe(true);
      expect(result.matchedBy, `${name} should match by value`).toBe("value");
      expect(result.patternId, `${name} should hit expected pattern`).toBe(expectation.patternId);
      expect(result.keyword, `${name} should map expected keyword`).toBe(expectation.keyword);
      expect(result.dropped, `${name} should be mapped`).toBe(false);
      expect(result.hosts.sort()).toEqual(expectation.hosts.slice().sort());
    }
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
