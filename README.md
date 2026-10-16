# raulmoracode-ai-config

Configure OpenCode to consume the centralized
[raulmoracode-skills](https://github.com/raulmoracode/raulmoracode-skills) catalog.
OpenCode remains responsible for downloading, caching, refreshing, and loading
skills; this CLI only edits OpenCode configuration and inspects the catalog.

## Usage

```sh
# Add the default HTTPS catalog to the project OpenCode config.
npx raulmoracode-ai-config init

# Configure the global OpenCode config instead.
npx raulmoracode-ai-config init --global

# Use another explicitly selected catalog URL.
npx raulmoracode-ai-config init --url https://example.com/skills/

# Inspect available, configured, and cached skills.
npx raulmoracode-ai-config skills
npx raulmoracode-ai-config skills --json
npx raulmoracode-ai-config skills --version 1.2.0

# Run read-only diagnostics.
npx raulmoracode-ai-config doctor
npx raulmoracode-ai-config doctor --global --json
```

The default catalog URL is
`https://raulmoracode.github.io/raulmoracode-skills/`. Catalog indexes are
validated strictly before they are displayed. The CLI also reads and validates
the catalog's `catalog-version.json` metadata (`{ "version": "1.0.1" }`) and
reports that published catalog version in `skills --json` and `doctor`.
Only `http` and `https` URLs are accepted, and catalog file paths must be safe
relative paths. The CLI never copies or executes skill files.

`init` preserves JSONC comments, formatting, unknown fields, and existing local
skill paths. It adds the URL to the existing `skills` array (or the deprecated
`skills.urls` form) and creates a missing configuration file when necessary.
`doctor` never writes configuration or cache files.

## Development

```sh
npm ci
npm run check
```
