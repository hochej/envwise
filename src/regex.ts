const POSIX_CLASS_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\[\[:alnum:\]\]/g, "[A-Za-z0-9]"],
  [/\[\[:alpha:\]\]/g, "[A-Za-z]"],
  [/\[\[:digit:\]\]/g, "[0-9]"],
  [/\[\[:xdigit:\]\]/g, "[A-Fa-f0-9]"],
  [/\[\[:lower:\]\]/g, "[a-z]"],
  [/\[\[:upper:\]\]/g, "[A-Z]"],
  [/\[\[:space:\]\]/g, "[\\t\\r\\n\\f\\v ]"],
];

export function normalizeRegexForJs(input: string): { pattern: string; flags: string } {
  let pattern = input;

  // Go-compatible end anchor.
  pattern = pattern.replace(/\\z/g, "$");

  // POSIX classes used by upstream patterns.
  for (const [source, target] of POSIX_CLASS_REPLACEMENTS) {
    pattern = pattern.replace(source, target);
  }

  // JavaScript does not support inline flag groups from RE2/PCRE style.
  // We conservatively hoist case-insensitive / dotall behavior to top-level flags.
  const hasCaseInsensitive = pattern.includes("(?i)") || pattern.includes("(?i:");
  const hasDotAll = pattern.includes("(?s)");

  pattern = pattern.replace(/\(\?i\)/g, "");
  pattern = pattern.replace(/\(\?i:/g, "(?:");
  pattern = pattern.replace(/\(\?-i:/g, "(?:");

  // RE2-style scoped dotall tokens used by some upstream rules.
  pattern = pattern.replace(/\(\?s:\.\)/g, "[\\s\\S]");
  pattern = pattern.replace(/\(\?s\)/g, "");

  // Some upstream patterns use Python-style named groups (`(?P<name>...)`).
  // JavaScript uses `(?<name>...)`.
  pattern = pattern.replace(/\(\?P<([A-Za-z][A-Za-z0-9_]*)>/g, "(?<$1>");

  const flags = `${hasCaseInsensitive ? "i" : ""}${hasDotAll ? "s" : ""}`;

  return {
    pattern,
    flags,
  };
}

export function compilePattern(input: string): RegExp {
  const normalized = normalizeRegexForJs(input);
  return new RegExp(normalized.pattern, normalized.flags);
}
