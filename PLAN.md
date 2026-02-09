# envwise — Design Plan

## The Problem

Gondolin (see ~/dev/oss/gondolin) sandboxes run untrusted code in isolated VMs.
Today, host environment variables (including API keys, tokens, passwords) get
forwarded into the guest as-is — breaking isolation. Gondolin already has
`createHttpHooks({ secrets })` which keeps real secrets on the host and injects
them into outbound HTTP headers only. However, wiring it up is currently manual.

**envwise** has the goal to make it automatic: given an environment, classify
each variable as secret or safe, resolve which API host(s) it belongs to, and
hand that mapping to Gondolin's existing hook mechanism. The guest never sees
the real value.

## Non-Goals

- We are **not** building a general-purpose secret scanner (that's
  Gitleaks/TruffleHog/detect-secrets).
- We don't need to identify _which exact type_ of secret something is. "It's a
  secret for stripe.com" is enough.
- We don't need to validate secrets (check if they're live/expired).
- We don't need to support every secret format on earth. Covering the common
  services that developers actually use in env vars is the 80/20.

## Architecture: Two Repos

```
hogwash (Go, exists)                    envwise (TypeScript, this repo)
┌──────────────────────┐                ┌──────────────────────────────┐
│ Scrapes TruffleHog   │  JSON artifact │ Consumes gondolin JSON       │
│ + Gitleaks upstream  │ ──────────────>│ at build/publish time        │
│                      │  (weekly CI)   │                              │
│ Publishes:           │                │ Exports:                     │
│  - full.json         │                │  - classify(name, value)     │
│  - gondolin.json     │                │  - classifyEnv(env)          │
│                      │                │                              │
│ Own release cadence  │                │ Own release cadence           │
└──────────────────────┘                │ npm package                  │
                                        └──────────────────────────────┘
```

**hogwash** owns data extraction. It runs weekly, scrapes upstream, publishes
JSON artifacts to GitHub releases. It's scrappy and internal-facing.

**envwise** owns the runtime library. It bundles a snapshot of the hogwash
gondolin JSON at publish time (no runtime fetching, no internet dependency).
This is what developers depend on. Code quality and API design matter here.

## Detection Strategy

Two passes, in order of confidence:

### Pass 1: Value-based detection (high precision)

Match the env var **value** against known token format regexes. If
`ghp_[0-9a-zA-Z]{36}` matches, we know it's a GitHub PAT regardless of what the
variable is called. We also know the host: `api.github.com`.

- Source: `value_patterns[]` from gondolin JSON (221 patterns, 76 with host
  linkage)
- Precision: very high — token prefixes are distinctive by design
- Recall: limited to services with known formats

### Pass 2: Name-based detection (high recall)

Match the env var **name** against two maps:

1. **Exact name → hosts** (e.g. `DD_API_KEY` → `api.datadoghq.com`)

   - Source: `exact_name_host_map` from gondolin JSON (9 entries)
   - For variables where the name doesn't contain the service keyword

2. **Keyword substring → hosts** (e.g. name contains `stripe` →
   `api.stripe.com`)

   - Source: `keyword_host_map` from gondolin JSON (79 entries)
   - Case-insensitive substring match, longest keyword wins

3. **Generic secret name pattern** (catch-all)
   - Regex:
     `/(?:^|_)(KEY|TOKEN|SECRET|PASSWORD|CREDENTIALS?|AUTH|PASS|PASSPHRASE|PRIVATE_KEY)(?:$|_)/i`
   - Catches secrets that don't match any known service
   - No host mapping available — these get flagged but can't be routed

### Result categories

| Value match? | Name match?             | Result                                    |
| ------------ | ----------------------- | ----------------------------------------- |
| ✅ regex hit | (any)                   | Secret, host from value pattern's keyword |
| ❌           | ✅ keyword/exact        | Secret, host from name map                |
| ❌           | ✅ generic pattern only | Secret, **no host** — warn + drop         |
| ❌           | ❌                      | Not a secret — forward as-is              |

If both value and name match, value wins for host resolution (higher
confidence).

## API Surface (Draft)

```typescript
interface ClassifyResult {
  name: string;
  isSecret: boolean;
  host: string[]; // API hosts this secret talks to (needs to be known)
  matchedBy?: "value" | "name-exact" | "name-keyword" | "name-pattern";
  patternId?: string; // e.g. "github-pat", "stripe-access-token"
}

// Classify a single env var
function classify(name: string, value: string): ClassifyResult;

// Classify a full environment, split into secrets vs. safe
function classifyEnv(env: Record<string, string>): {
  secrets: ClassifyResult[]; // variables identified as secrets (with hosts)
  dropped: ClassifyResult[]; // secrets without host mapping (warn + drop)
  safe: string[]; // variable names safe to forward
};
```

That's it. Small surface, obvious behavior. Gondolin calls
`classifyEnv(process.env)` and hands the result to `createHttpHooks`.

## Data Flow at Build Time

```
hogwash CI (weekly)
  → publishes secret-mapping.gondolin.json to GitHub release

envwise CI (on release / periodically)
  → downloads latest gondolin JSON from hogwash release
  → bundles it as embedded data in the npm package
  → publishes to npm
```

No runtime internet access. The JSON is ~47 KB — trivial for an npm package.
Consumers get pattern updates by bumping the envwise version.

## Open Design Questions

### 1. What about secrets with no host mapping?

Generic pattern catches `CUSTOM_AUTH_TOKEN` but we don't know where it goes.
Options:

- **a)** Drop it + warn (current design doc approach) — safe but lossy
- **b)** Forward as-is + warn — risky but doesn't break workflows
- **c)** Let the consumer decide via config

Leaning toward **(a)** as default with consumer override. Better to break loudly
than leak silently.

### 2. User-supplied overrides

The design doc defines user config:

```json
{ "DATABASE_URL": { "hosts": ["db.example.com"] } }
```

Should envwise own this, or should the consumer (e.g. pi-gondolin.ts) handle it?

**Recommendation**: envwise accepts optional overrides in `classifyEnv`:

```typescript
classifyEnv(env, { overrides: { DATABASE_URL: ["db.example.com"] } });
```

This keeps envwise useful standalone while letting consumers inject config.
Overrides take highest precedence (before value and name matching).

### 3. Wildcard host patterns

The design doc uses patterns like `*.openai.azure.com`, `*.supabase.co`. Does
envwise resolve these to concrete patterns, or pass them through for Gondolin's
`createHttpHooks` to handle?

**Recommendation**: pass through as-is. Gondolin already handles wildcards in
allowedHosts. Don't duplicate that logic.

### 4. Value heuristics for URLs/PEM blocks

The design doc also treats credential-bearing URLs (`://...@`) and PEM blocks
(`-----BEGIN`) as secrets. These aren't Gitleaks patterns — they're simple value
heuristics. Should envwise include them?

**Recommendation**: yes, as a small hardcoded set alongside the regex patterns.
These are stable, high-value checks that don't need upstream data.

### 5. How to handle the Go→JS regex gap

25 of 221 patterns use Go-specific regex syntax (`(?i)` inline, `\z`). The
scan.py already has fixups. We need equivalent fixups in the TS library, or we
pre-process the gondolin JSON at build time to emit JS-compatible regexes.

**Recommendation**: pre-process at build time. Ship clean JS regexes in the
bundled data so the runtime has zero fixup overhead.

## Next Steps

### Phase 1: Repo scaffold + core classifier

- [ ] Initialize envwise as a proper TypeScript project (tsconfig, vitest,
      eslint)
- [ ] Implement `classify(name, value)` with value-based matching
- [ ] Implement `classify(name, value)` with name-based matching (exact +
      keyword + generic)
- [ ] Implement `classifyEnv(env)` on top
- [ ] Build-time script to fetch + preprocess gondolin JSON (fix regexes for JS)
- [ ] Tests using the existing fake-leaks + detect-secrets corpus

### Phase 2: API refinement + edge cases

- [ ] User override support in classifyEnv
- [ ] URL credential and PEM heuristics
- [ ] Longest-keyword-wins logic for name matching
- [ ] Handle conflicting value vs. name matches
- [ ] Error handling for malformed regex patterns

### Phase 3: Packaging + integration

- [ ] npm package setup
- [ ] CI pipeline: fetch hogwash JSON → preprocess → test → publish
- [ ] Integration test with Gondolin's createHttpHooks (mock or real)
- [ ] Documentation / README

### Phase 4: Validation (ongoing, uses existing analysis/ tooling)

- [ ] Expand test corpus (TruffleHog fixtures, synthetic cases for gaps)
- [ ] Measure precision/recall against labeled data
- [ ] Identify false positive patterns that need tuning or exclusion
