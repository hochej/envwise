import { readFileSync } from "node:fs";

import { compilePattern } from "./regex.js";
import type { SecretMappingData, ValuePattern } from "./types.js";

export interface CompiledPattern {
  id: string;
  keyword?: string;
  regex: RegExp;
  keywords: string[];
}

export interface PatternStore {
  raw: SecretMappingData;
  compiledValuePatterns: CompiledPattern[];
  failedValuePatterns: Array<{ id: string; error: string }>;
  keywordEntries: Array<{ keyword: string; hosts: string[]; normalized: string }>;
}

const PATTERN_COMPILE_ERROR_CODE = "ENVWISE_PATTERN_COMPILE_FAILED";

export class PatternCompilationError extends Error {
  readonly code = PATTERN_COMPILE_ERROR_CODE;
  readonly failures: Array<{ id: string; error: string }>;

  constructor(failures: Array<{ id: string; error: string }>) {
    const ids = failures.map((failure) => failure.id).join(", ");
    super(`Failed to compile ${failures.length} value pattern(s): ${ids}`);
    this.name = "PatternCompilationError";
    this.failures = failures;
  }
}

const DATA_PATH = new URL("../data/gondolin/secret-mapping.gondolin.json", import.meta.url);

let cached: PatternStore | null = null;

function uniqueHosts(hosts: string[]): string[] {
  return [...new Set(hosts)];
}

function normalizeKeyword(token: string): string {
  return token.toLowerCase().replace(/[-_\s]/g, "");
}

function compileValuePatterns(valuePatterns: ValuePattern[]): {
  compiledValuePatterns: CompiledPattern[];
  failedValuePatterns: Array<{ id: string; error: string }>;
} {
  const compiledValuePatterns: CompiledPattern[] = [];
  const failedValuePatterns: Array<{ id: string; error: string }> = [];

  for (const vp of valuePatterns) {
    try {
      compiledValuePatterns.push({
        id: vp.id,
        keyword: vp.keyword,
        regex: compilePattern(vp.regex),
        keywords: vp.keywords ?? [],
      });
    } catch (error) {
      failedValuePatterns.push({
        id: vp.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { compiledValuePatterns, failedValuePatterns };
}

export function getPatternStore(): PatternStore {
  if (cached) {
    return cached;
  }

  const raw = JSON.parse(readFileSync(DATA_PATH, "utf8")) as SecretMappingData;
  const { compiledValuePatterns, failedValuePatterns } = compileValuePatterns(raw.value_patterns);

  if (failedValuePatterns.length > 0) {
    throw new PatternCompilationError(failedValuePatterns);
  }

  const keywordEntries = Object.entries(raw.keyword_host_map)
    .map(([keyword, hosts]) => ({
      keyword,
      hosts: uniqueHosts(hosts),
      normalized: normalizeKeyword(keyword),
    }))
    .sort(
      (a, b) => b.normalized.length - a.normalized.length || a.keyword.localeCompare(b.keyword),
    );

  cached = {
    raw,
    compiledValuePatterns,
    failedValuePatterns,
    keywordEntries,
  };

  return cached;
}
