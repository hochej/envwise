# Curated classifier fixtures

These two files are the primary evaluation set for classifier behavior:

- `valid-secrets.env`: variables that should be classified as secret and mapped.
- `invalid-vars.env`: variables that should stay non-secret.

Rules:

1. Keep entries as plain `NAME=value` lines.
2. One assignment per line.
3. Prefer realistic env var names used in real systems.
4. Keep this set small, readable, and intentionally maintained.

Regenerate baseline files from mapping data (then manually review):

```bash
pnpm fixtures:curate
```
