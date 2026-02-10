#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parseDotenv } from "./dotenv.js";
import { classifyEnvForGondolin } from "./integration.js";

interface CliOptions {
  mode: "env" | "file";
  filePath?: string;
  json: boolean;
  showSafe: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  let mode: "env" | "file" = "env";
  let filePath: string | undefined;
  let json = false;
  let showSafe = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "inspect") {
      continue;
    }

    if (arg === "--env") {
      mode = "env";
      continue;
    }

    if (arg === "--file") {
      mode = "file";
      filePath = argv[i + 1];
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

    if (arg === "-h" || arg === "--help") {
      printHelp(0);
    }

    throw new Error(`unknown argument: ${arg}`);
  }

  if (mode === "file" && !filePath) {
    throw new Error("--file requires a path");
  }

  return {
    mode,
    filePath,
    json,
    showSafe,
  };
}

function printHelp(exitCode: number): never {
  const text = `envwise CLI

Usage:
  envwise inspect --env [--json] [--show-safe]
  envwise inspect --file .env [--json] [--show-safe]

Options:
  --env         inspect current process env (default)
  --file PATH   inspect dotenv file
  --json        print machine-readable JSON
  --show-safe   include safe variable names in text output
  -h, --help    show this help
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

    const content = await readFile(resolve(filePath), "utf8");
    const parsed = parseDotenv(content);
    env = parsed.values;
    parseErrors = parsed.errors;
  } else {
    env = toStringEnv(process.env);
  }

  const result = classifyEnvForGondolin(env);

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          source: options.mode,
          file: options.filePath,
          parseErrors,
          ...result,
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

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
