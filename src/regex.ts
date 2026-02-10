const POSIX_CLASS_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\[\[:alnum:\]\]/g, "[A-Za-z0-9]"],
  [/\[\[:alpha:\]\]/g, "[A-Za-z]"],
  [/\[\[:digit:\]\]/g, "[0-9]"],
  [/\[\[:xdigit:\]\]/g, "[A-Fa-f0-9]"],
  [/\[\[:lower:\]\]/g, "[a-z]"],
  [/\[\[:upper:\]\]/g, "[A-Z]"],
  [/\[\[:space:\]\]/g, "[\\t\\r\\n\\f\\v ]"],
];

const INLINE_FLAG_TOKEN_RE = /^\(\?([A-Za-z-]+)\)/;
const SUPPORTED_INLINE_FLAGS_RE = /^-?[ims]+$/;

function normalizeInlineFlags(pattern: string): string {
  let out = "";
  let escaped = false;
  let inCharClass = false;
  let depth = 0;

  // Bare inline modifiers (e.g. `(?i)`) are not supported by JavaScript,
  // but scoped modifiers (e.g. `(?i:...)`) are. We rewrite bare modifiers
  // into scoped groups that extend to the end of the current group depth.
  const pendingClosures = new Map<number, number>();

  const queueClosure = (groupDepth: number): void => {
    pendingClosures.set(groupDepth, (pendingClosures.get(groupDepth) ?? 0) + 1);
  };

  const flushClosures = (groupDepth: number): void => {
    const count = pendingClosures.get(groupDepth) ?? 0;
    if (count > 0) {
      out += ")".repeat(count);
      pendingClosures.delete(groupDepth);
    }
  };

  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];

    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }

    if (inCharClass) {
      out += ch;
      if (ch === "]") {
        inCharClass = false;
      }
      continue;
    }

    if (ch === "[") {
      out += ch;
      inCharClass = true;
      continue;
    }

    if (ch === "(" && pattern[i + 1] === "?") {
      const tokenMatch = INLINE_FLAG_TOKEN_RE.exec(pattern.slice(i));
      const flags = tokenMatch?.[1];

      if (tokenMatch && flags && SUPPORTED_INLINE_FLAGS_RE.test(flags)) {
        out += `(?${flags}:`;
        queueClosure(depth);
        i += tokenMatch[0].length - 1;
        continue;
      }

      depth += 1;
      out += ch;
      continue;
    }

    if (ch === ")") {
      flushClosures(depth);
      if (depth > 0) {
        depth -= 1;
      }
      out += ch;
      continue;
    }

    out += ch;
  }

  flushClosures(depth);

  if (pendingClosures.size > 0) {
    for (const [, count] of [...pendingClosures.entries()].sort((a, b) => b[0] - a[0])) {
      out += ")".repeat(count);
    }
  }

  return out;
}

export function normalizeRegexForJs(input: string): { pattern: string; flags: string } {
  let pattern = input;

  // Go-compatible end anchor.
  pattern = pattern.replace(/\\z/g, "$");

  // POSIX classes used by upstream patterns.
  for (const [source, target] of POSIX_CLASS_REPLACEMENTS) {
    pattern = pattern.replace(source, target);
  }

  // Rewrite bare inline flags (`(?i)`, `(?s)`, `(?m)`) into scoped groups.
  pattern = normalizeInlineFlags(pattern);

  // Some upstream patterns use Python-style named groups (`(?P<name>...)`).
  // JavaScript uses `(?<name>...)`.
  pattern = pattern.replace(/\(\?P<([A-Za-z][A-Za-z0-9_]*)>/g, "(?<$1>");

  return {
    pattern,
    flags: "",
  };
}

export function compilePattern(input: string): RegExp {
  const normalized = normalizeRegexForJs(input);
  return new RegExp(normalized.pattern, normalized.flags);
}
