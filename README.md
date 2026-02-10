# envwise

<p align="center">
  <img src="assets/envwise-hero.png" alt="envwise — the wise companion for your environment variables" width="720" />
</p>

Classify environment variables for Gondolin:
- forward safe vars
- route known secrets to host-side HTTP hooks by API host
- drop secret-looking vars with no host mapping

## API (MVP)

```ts
import { classify, classifyEnv, classifyEnvForGondolin } from "envwise";

classify("GITHUB_TOKEN", "ghp_...");
// => { isSecret: true, matchedBy: "value", hosts: ["api.github.com"], ... }

classifyEnv(process.env as Record<string, string>);
// => { secrets: [...], dropped: [...], safe: [...] }

classifyEnvForGondolin(process.env as Record<string, string>);
// => { secretsMap: { GITHUB_TOKEN: { hosts: ["api.github.com"], value: "..." } }, ... }
```

### Matching order

1. `overrides[name]`
2. value regex (`value_patterns`)
3. exact name map (`exact_name_host_map`)
4. keyword name map (`keyword_host_map`, longest keyword wins)
5. generic secret-name pattern (`KEY|TOKEN|SECRET|PASSWORD|...`)

If value and name both match, value decides the host.
If value matches but has no host mapping, envwise falls back to name mapping.

## Gondolin handoff

```ts
import { createHttpHooks } from "@earendil-works/gondolin/host";
import { classifyEnvForGondolin } from "@hochej/envwise";

const { secretsMap } = classifyEnvForGondolin(process.env as Record<string, string>);
const { httpHooks, env } = createHttpHooks({ secrets: secretsMap });
```

## CLI

```bash
# inspect current process environment
envwise inspect --env

# inspect dotenv file
envwise inspect --file .env

# machine-readable output
envwise inspect --file .env --json
```

## Data layout

- Runtime input: `data/gondolin/secret-mapping.gondolin.json`
- Curated classifier fixtures: `test/fixtures/{valid-secrets.env,invalid-vars.env}`

## Commands

```bash
pnpm install
pnpm mapping:update -- --tag v0.1.4  # or: --latest
pnpm fixtures:curate
pnpm fixtures:check
pnpm test
pnpm typecheck
pnpm build
```
