export interface EnvAssignment {
  name: string;
  value: string;
}

// Mirrors dotenv's assignment grammar so parse warnings align with dotenv.parse().
const ASSIGNMENT_RE =
  /^(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?$/;

export function isIgnorableEnvLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length === 0 || trimmed.startsWith("#");
}

export function parseEnvAssignmentLine(line: string): EnvAssignment | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const match = ASSIGNMENT_RE.exec(trimmed);
  if (!match) {
    return null;
  }

  const [, name, rawValue] = match;

  // Keep value normalization aligned with dotenv.parse().
  let value = (rawValue ?? "").trim();
  const maybeQuote = value[0];
  value = value.replace(/^(['"`])([\s\S]*)\1$/m, "$2");

  if (maybeQuote === '"') {
    value = value.replace(/\\n/g, "\n");
    value = value.replace(/\\r/g, "\r");
  }

  return { name, value };
}
