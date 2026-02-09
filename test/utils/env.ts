export interface EnvAssignment {
  name: string;
  value: string;
  lineNumber: number;
}

const ASSIGNMENT_RE = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

function stripInlineComment(input: string): string {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (ch === "#" && !inSingle && !inDouble) {
      const prev = i === 0 ? "" : input[i - 1];
      if (prev === "" || /\s/.test(prev)) {
        return input.slice(0, i).trim();
      }
    }
  }

  return input.trim();
}

function unquote(input: string): string {
  if (input.length >= 2) {
    const first = input[0];
    const last = input[input.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return input.slice(1, -1);
    }
  }

  return input;
}

export function extractEnvAssignments(content: string): EnvAssignment[] {
  const pairs: EnvAssignment[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const match = ASSIGNMENT_RE.exec(trimmed);
    if (!match) {
      return;
    }

    const [, name, rawValue] = match;
    const withoutComment = stripInlineComment(rawValue);
    const value = unquote(withoutComment.trim());

    if (!value) {
      return;
    }

    pairs.push({
      name,
      value,
      lineNumber: index + 1,
    });
  });

  return pairs;
}
