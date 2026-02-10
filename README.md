# envwise

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

# machine-readable output
envwise inspect --file .env --json
```

## Optional integration helper

For consumers that need a `Record<name, { hosts, value }>` shape, use:

```ts
import { classifyEnvForGondolin } from "@hochej/envwise";

const { secretsMap } = classifyEnvForGondolin(process.env as Record<string, string>);
```

## Development

```bash
pnpm install
pnpm mapping:update -- --latest
pnpm fixtures:curate
pnpm fixtures:check
pnpm test
pnpm typecheck
pnpm build
```
