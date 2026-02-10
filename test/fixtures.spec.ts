import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { extractEnvAssignments } from "./utils/env";

const CURATED_DIR = resolve(process.cwd(), "test/fixtures");

function findDuplicates(names: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const name of names) {
    if (seen.has(name)) {
      duplicates.add(name);
      continue;
    }

    seen.add(name);
  }

  return [...duplicates].sort();
}

describe("curated fixture quality", () => {
  it("has unique keys in valid-secrets.env", async () => {
    const content = await readFile(resolve(CURATED_DIR, "valid-secrets.env"), "utf8");
    const assignments = extractEnvAssignments(content);
    const duplicates = findDuplicates(assignments.map((entry) => entry.name));

    expect(duplicates).toEqual([]);
  });

  it("has unique keys in invalid-vars.env", async () => {
    const content = await readFile(resolve(CURATED_DIR, "invalid-vars.env"), "utf8");
    const assignments = extractEnvAssignments(content);
    const duplicates = findDuplicates(assignments.map((entry) => entry.name));

    expect(duplicates).toEqual([]);
  });
});
