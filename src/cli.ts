#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseDotenv } from "./dotenv.js";
import { classifyEnvForGondolin } from "./integration.js";

interface CliOptions {
  mode: "env" | "file";
  filePath?: string;
  json: boolean;
  showSafe: boolean;
  includeSecretValues: boolean;
  expand: boolean;
}

function isFlag(value: string | undefined): boolean {
  return typeof value === "string" && value.startsWith("-");
}

export function parseArgs(argv: string[]): CliOptions {
  let mode: "env" | "file" = "env";
  let explicitMode: "env" | "file" | null = null;
  let filePath: string | undefined;
  let json = false;
  let showSafe = false;
  let includeSecretValues = false;
  let expand = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "inspect") {
      continue;
    }

    if (arg === "--env") {
      if (explicitMode === "file") {
        throw new Error("--env cannot be combined with --file");
      }

      mode = "env";
      explicitMode = "env";
      continue;
    }

    if (arg === "--file") {
      if (explicitMode === "env") {
        throw new Error("--file cannot be combined with --env");
      }

      const next = argv[i + 1];
      if (!next || isFlag(next)) {
        throw new Error("--file requires a non-flag path");
      }

      mode = "file";
      explicitMode = "file";
      filePath = next;
      i += 1;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--show-safe") {
      showSafe = true;
      continue;
    }

    if (arg === "--include-secret-values") {
      includeSecretValues = true;
      continue;
    }

    if (arg === "--expand" || arg === "--exapnd") {
      expand = true;
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      printHelp(0);
    }

    throw new Error(`unknown argument: ${arg}`);
  }

  if (mode === "file" && !filePath) {
    throw new Error("--file requires a path");
  }

  if (expand && mode !== "file") {
    throw new Error("--expand can only be used with --file");
  }

  return {
    mode,
    filePath,
    json,
    showSafe,
    includeSecretValues,
    expand,
  };
}

function printHelp(exitCode: number): never {
  const text = `envwise CLI

Usage:
  envwise inspect --env [--json] [--show-safe] [--include-secret-values]
  envwise inspect --file .env [--expand] [--json] [--show-safe] [--include-secret-values]

Options:
  --env                   inspect current process env (default)
  --file PATH             inspect dotenv file
  --expand                enable dotenv-expand interpolation (off by default)
  --json                  print machine-readable JSON
  --show-safe             include safe variable names in text output
  --include-secret-values include plaintext secret values in JSON output (dangerous)
  -h, --help              show this help
`;

  if (exitCode === 0) {
    process.stdout.write(text);
  } else {
    process.stderr.write(text);
  }

  process.exit(exitCode);
}

function toStringEnv(input: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [name, value] of Object.entries(input)) {
    if (typeof value === "string") {
      out[name] = value;
    }
  }

  return out;
}

function redactSecretsMap(
  secretsMap: ReturnType<typeof classifyEnvForGondolin>["secretsMap"],
): ReturnType<typeof classifyEnvForGondolin>["secretsMap"] {
  const redacted: ReturnType<typeof classifyEnvForGondolin>["secretsMap"] = {};

  for (const [name, secret] of Object.entries(secretsMap)) {
    redacted[name] = {
      hosts: secret.hosts,
      value: "[REDACTED]",
    };
  }

  return redacted;
}

function printTextResult(
  result: ReturnType<typeof classifyEnvForGondolin>,
  showSafe: boolean,
): void {
  console.log(`mapped secrets: ${result.secrets.length}`);
  for (const entry of result.secrets) {
    const by = entry.matchedBy ? ` (${entry.matchedBy})` : "";
    console.log(`  - ${entry.name}${by} -> ${entry.hosts.join(", ")}`);
  }

  console.log(`\ndropped secrets: ${result.dropped.length}`);
  for (const entry of result.dropped) {
    const by = entry.matchedBy ? ` (${entry.matchedBy})` : "";
    const reason = entry.reason ? `: ${entry.reason}` : "";
    console.log(`  - ${entry.name}${by}${reason}`);
  }

  console.log(`\nsafe vars: ${result.safe.length}`);
  if (showSafe) {
    for (const name of result.safe) {
      console.log(`  - ${name}`);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printHelp(0);
  }

  let options: CliOptions;
  try {
    options = parseArgs(args);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n`);
    printHelp(1);
  }

  let env: Record<string, string>;
  let parseErrors: string[] = [];

  if (options.mode === "file") {
    const filePath = options.filePath;
    if (!filePath) {
      throw new Error("--file requires a path");
    }

    if (options.expand) {
      process.stderr.write(
        "warning: --expand uses dotenv-expand and may be O(n²) on large dotenv files\n",
      );
    }

    const content = await readFile(resolve(filePath), "utf8");
    const parsed = parseDotenv(content, { expand: options.expand });
    env = parsed.values;
    parseErrors = parsed.errors;
  } else {
    env = toStringEnv(process.env);
  }

  const result = classifyEnvForGondolin(env);

  if (options.json) {
    const secretsMap = options.includeSecretValues
      ? result.secretsMap
      : redactSecretsMap(result.secretsMap);

    process.stdout.write(
      `${JSON.stringify(
        {
          source: options.mode,
          file: options.filePath,
          parseErrors,
          dotenvExpandEnabled: options.expand,
          secretValuesIncluded: options.includeSecretValues,
          ...result,
          secretsMap,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  if (options.mode === "file") {
    console.log(`source: ${options.filePath}`);
    if (parseErrors.length > 0) {
      console.log(`parse warnings: ${parseErrors.length}`);
      for (const warning of parseErrors.slice(0, 10)) {
        console.log(`  - ${warning}`);
      }
      if (parseErrors.length > 10) {
        console.log(`  ... and ${parseErrors.length - 10} more`);
      }
      console.log();
    }
  }

  printTextResult(result, options.showSafe);
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  try {
    const entryPath = realpathSync(entry);
    const selfPath = realpathSync(fileURLToPath(import.meta.url));
    return entryPath === selfPath;
  } catch {
    return import.meta.url === pathToFileURL(entry).href;
  }
}

if (isMainModule()) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
