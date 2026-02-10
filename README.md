# envwise

<p align="center">
  <a href="https://github.com/hochej/envwise/actions/workflows/ci.yml"><img alt="CI status" src="https://img.shields.io/github/actions/workflow/status/hochej/envwise/ci.yml?style=flat-square&branch=main" /></a>
  <a href="https://github.com/hochej/envwise/actions/workflows/publish.yml"><img alt="Publish status" src="https://img.shields.io/github/actions/workflow/status/hochej/envwise/publish.yml?style=flat-square&label=publish" /></a>
  <a href="https://www.npmjs.com/package/@hochej/envwise"><img alt="npm version" src="https://img.shields.io/npm/v/%40hochej%2Fenvwise?style=flat-square" /></a>
</p>

<p align="center">
  <img src="assets/envwise-hero.png" alt="envwise — classify environment variables" width="720" />
</p>

`envwise` classifies environment variables into three groups:

- **mapped secrets**: secret + known host(s)
- **dropped secrets**: secret-like but no host mapping
- **safe vars**: not classified as secret

Primary use is as a **TypeScript library**. A CLI is also included for local inspection.

## Library usage

```ts
import { classify, classifyEnv } from "@hochej/envwise";

classify("GITHUB_TOKEN", "ghp_...");
// => { isSecret: true, hosts: ["api.github.com"], matchedBy: "value", ... }

classifyEnv(process.env as Record<string, string>);
// => { secrets: [...], dropped: [...], safe: [...] }

import { parseDotenv } from "@hochej/envwise";

parseDotenv("API_HOST=api.example.com\nAPI_URL=https://${API_HOST}\n");
// => interpolation disabled by default

parseDotenv("API_HOST=api.example.com\nAPI_URL=https://${API_HOST}\n", { expand: true });
// => enable dotenv-expand interpolation (opt-in)
```

### Matching order

1. `overrides[name]`
2. value regex (`value_patterns`)
3. exact name map (`exact_name_host_map`)
4. keyword name map (`keyword_host_map`, longest keyword wins)
5. generic secret-name pattern (`KEY|TOKEN|SECRET|PASSWORD|...`)

If value and name both match, value wins.
If value matches but has no host mapping, name mapping is used as fallback.

## CLI usage

```bash
# inspect current process env
envwise inspect --env

# inspect dotenv file
envwise inspect --file .env

# opt-in dotenv variable interpolation (can be slow on very large files)
envwise inspect --file .env --expand

# machine-readable output (secret values redacted by default)
envwise inspect --file .env --json

# include plaintext secret values (dangerous; use with care)
envwise inspect --file .env --json --include-secret-values
```

## Optional integration helper

For consumers that need a `Record<name, { hosts, value }>` shape, use:

```ts
import { classifyEnvForGondolin } from "@hochej/envwise";

const { secretsMap } = classifyEnvForGondolin(process.env as Record<string, string>);
```

## Development

`envwise` ships with a bundled mapping file (`src/generated/secret-mapping.ts`). End users do **not** need to run mapping update tooling.

Raw `secret-mapping.gondolin.json`/`.sha256` files are not stored in this repo; CI fetches from `hochej/hogwash` when regenerating the bundled module.

```bash
# prereq: install uv (https://docs.astral.sh/uv/)
pnpm install

# maintainer workflow: pull latest mapping from hogwash via GitHub API
pnpm mapping:update -- --latest
# optional integrity pin: pnpm mapping:update -- --tag vX.Y.Z --sha256 <expected_sha>

pnpm fixtures:curate
pnpm fixtures:check
pnpm test
pnpm typecheck
pnpm build
```

> Maintainer tooling uses `uv` to run Python scripts (in CI and package scripts).
