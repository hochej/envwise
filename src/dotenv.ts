import { parse as parseWithDotenv } from "dotenv";
import { expand } from "dotenv-expand";

import { isIgnorableEnvLine, parseEnvAssignmentLine } from "./env-assignment.js";

export interface ParseDotenvOptions {
  /**
   * Enable dotenv-expand variable interpolation. Disabled by default because
   * dotenv-expand may be quadratic on large files.
   */
  expand?: boolean;
}

export interface DotenvParseResult {
  values: Record<string, string>;
  errors: string[];
}

function collectSyntaxErrors(content: string): string[] {
  const errors: string[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (isIgnorableEnvLine(line)) {
      return;
    }

    if (!parseEnvAssignmentLine(line)) {
      errors.push(`line ${index + 1}: not a valid assignment`);
    }
  });

  return errors;
}

export function parseDotenv(content: string, options: ParseDotenvOptions = {}): DotenvParseResult {
  const parsed = parseWithDotenv(content);

  let values = parsed;
  if (options.expand && content.includes("$")) {
    values = expand({ parsed: { ...parsed }, processEnv: {} }).parsed ?? parsed;
  }

  return {
    values,
    errors: collectSyntaxErrors(content),
  };
}
