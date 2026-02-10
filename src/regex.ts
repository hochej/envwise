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

// Scoped modifiers like `(?i:...)` landed in V8 12.x / Node 23+.
// Detect once at load time so we can fall back on older runtimes.
let _scopedModifiersSupported: boolean | null = null;

function scopedModifiersSupported(): boolean {
  if (_scopedModifiersSupported === null) {
    try {
      // biome-ignore lint/complexity/useRegexLiterals: literal `/(?i:a)/` would be a syntax error on Node <23 at parse time
      new RegExp("(?i:a)");
      _scopedModifiersSupported = true;
    } catch {
      _scopedModifiersSupported = false;
    }
  }

  return _scopedModifiersSupported;
}

/**
 * Rewrite bare inline modifiers (e.g. `(?i)`) into scoped groups
 * (e.g. `(?i:...)`) that extend to the end of the current group depth.
 *
 * This is the path used on Node 23+ where the engine natively supports
 * scoped modifiers.
 */
function normalizeInlineFlags(pattern: string): string {
  let out = "";
  let escaped = false;
  let inCharClass = false;
  let depth = 0;

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

/**
 * Fallback for runtimes that do not support scoped modifiers (Node < 23).
 *
 * Strips both bare `(?i)` and scoped `(?i:...)` groups and collects the
 * flags so the caller can apply them globally.  This is slightly broader
 * than the original pattern intent (a global `i` flag makes the *entire*
 * regex case-insensitive), but for secret-detection patterns that is
 * acceptable — being more permissive only increases recall.
 */
function stripInlineFlags(pattern: string): { pattern: string; flags: string } {
  const collectedFlags = new Set<string>();

  // 1. Strip scoped modifiers: `(?i:` / `(?-i:` → `(?:`, collecting positive flags.
  const SCOPED_RE = /\(\?(-?)([ims]+):/g;
  let stripped = pattern.replace(SCOPED_RE, (_match, neg: string, flags: string) => {
    if (!neg) {
      for (const ch of flags) {
        collectedFlags.add(ch);
      }
    }

    // Both `(?i:` and `(?-i:` become plain non-capturing groups.
    return "(?:";
  });

  // 2. Strip bare modifiers: `(?i)` / `(?-i)` → `` (empty string).
  const BARE_RE = /\(\?(-?)([ims]+)\)/g;
  stripped = stripped.replace(BARE_RE, (_match, neg: string, flags: string) => {
    if (!neg) {
      for (const ch of flags) {
        collectedFlags.add(ch);
      }
    }

    return "";
  });

  return {
    pattern: stripped,
    flags: [...collectedFlags].sort().join(""),
  };
}

export function normalizeRegexForJs(input: string): { pattern: string; flags: string } {
  let pattern = input;

  // Go-compatible end anchor.
  pattern = pattern.replace(/\\z/g, "$");

  // POSIX classes used by upstream patterns.
  for (const [source, target] of POSIX_CLASS_REPLACEMENTS) {
    pattern = pattern.replace(source, target);
  }

  // Some upstream patterns use Python-style named groups (`(?P<name>...)`).
  // JavaScript uses `(?<name>...)`.
  pattern = pattern.replace(/\(\?P<([A-Za-z][A-Za-z0-9_]*)>/g, "(?<$1>");

  if (scopedModifiersSupported()) {
    // Rewrite bare inline flags (`(?i)`) into scoped groups (`(?i:...)`).
    // Existing scoped groups pass through untouched.
    pattern = normalizeInlineFlags(pattern);
    return { pattern, flags: "" };
  }

  // Fallback: strip all inline flags and promote to global flags.
  const result = stripInlineFlags(pattern);
  return result;
}

export function compilePattern(input: string): RegExp {
  const normalized = normalizeRegexForJs(input);
  return new RegExp(normalized.pattern, normalized.flags);
}
