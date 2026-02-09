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
import { classify, classifyEnv } from "envwise";

classify("GITHUB_TOKEN", "ghp_...");
// => { isSecret: true, matchedBy: "value", hosts: ["api.github.com"], ... }

classifyEnv(process.env as Record<string, string>);
// => { secrets: [...], dropped: [...], safe: [...] }
```

### Matching order

1. `overrides[name]`
2. value regex (`value_patterns`)
3. exact name map (`exact_name_host_map`)
4. keyword name map (`keyword_host_map`, longest keyword wins)
5. generic secret-name pattern (`KEY|TOKEN|SECRET|PASSWORD|...`)

If value and name both match, value decides the host.
If value matches but has no host mapping, envwise falls back to name mapping.

## Data layout

- Runtime input: `data/gondolin/secret-mapping.gondolin.json`
- Curated classifier fixtures: `test/fixtures/{valid-secrets.env,invalid-vars.env}`

## Commands

```bash
pnpm install
pnpm fixtures:curate
pnpm fixtures:check
pnpm test
pnpm typecheck
```
