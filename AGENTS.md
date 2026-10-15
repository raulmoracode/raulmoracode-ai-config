# AGENTS.md

Guidance for AI agents (and humans) working in this repository.

## What this project is

`@raulmoracode/ai-config` is a small personal CLI (`raulmoracode-ai-config`) that
configures and diagnoses OpenCode's access to a centralized library of remotely hosted
skills. OpenCode itself performs native remote skill discovery, download, caching and
refresh; this CLI never re-implements any of that.

## Hard rules

- Do NOT implement skill installation, synchronization, caching, version databases or
  upgrade workflows. OpenCode owns those responsibilities.
- Never copy skill definitions into target projects. Never write outside the OpenCode
  configuration locations the user explicitly authorized.
- Preserve unknown or unrelated OpenCode configuration fields and JSONC comments. Edit
  configuration with `jsonc-parser`; never by naive string replacement or by
  re-serializing a parsed object.
- `doctor` is read-only. `--help` and `--version` must work without network access.
- Production dependencies are kept to a minimum: currently only `jsonc-parser` (safe
  JSONC editing). Adding another requires a clear technical justification.
- Never execute content downloaded from the remote catalog.
- Treat remote catalog responses as untrusted input: validate shape, types and paths
  before using them.

## Verified OpenCode contract (v2.0.29)

- The `skills` config key is an array of strings (local paths or `http(s)` catalog base
  URLs) in `opencode.json(c)`. Global config lives in `$XDG_CONFIG_HOME/opencode/` or
  `~/.config/opencode/`; project config in `opencode.json(c)` or
  `.opencode/opencode.json(c)`.
- Catalog: `GET <base>/index.json` returns
  `{"skills":[{"name":string,"version"?:string,"files":string[]}]}`. OpenCode downloads
  `GET <base>/<encodeURIComponent(name)>/<file>` (same origin, safe relative paths only).
- `files` must include `<name>.md` (preferred) or `SKILL.md`. A skill is only
  re-downloaded when its `version` changes. Cache lives in
  `~/.cache/opencode/skills/<sha1(base)>/`.
- Refresh is triggered by `opencode reload` or an OpenCode restart; a failed index fetch
  at startup yields no skills for that source.
- Minimum supported OpenCode version: v2.0.0.
- Reference: https://dev.opencode.ai/v2/docs/skills/

## Repository layout

- `src/index.ts` — bin entry (shebang and process wiring).
- `src/cli/` — argument parsing, dispatch, help text and error types.
- `src/opencode/` — OpenCode config path detection and JSONC-safe reading/editing.
- `src/catalog/` — HTTP client and strict validation for the remote catalog.
- `src/commands/` — one module per CLI command (`init`, `skills`, `doctor`, menu).
- `test/` — Vitest suites mirroring `src/`.

## Commands

- `npm run check` — lint + typecheck + tests + build. Run before every commit.
- `npm run lint` / `npm run lint:fix` — Biome lint and format check (fix).
- `npm run format` / `npm run format:check` — Biome formatter.
- `npm run typecheck` — strict `tsc` over `src` and `test`.
- `npm test` / `npm run test:watch` — Vitest.
- `npm run build` — emits `dist/` using `tsconfig.build.json`.
- Smoke-test the built CLI: `node dist/index.js --help`.

## Workflow conventions

- Branches: `feat/…`, `fix/…`, `chore/…`, `docs/…`, `test/…`, `release/…` — one cohesive
  change per branch.
- Conventional Commits. Pull request descriptions in English with the standard sections:
  Summary, Context and motivation, Implementation details, Scope of changes, Testing and
  validation, Acceptance criteria, Security and compatibility, Risks and limitations,
  Related work.
- Tests must not hit the network: stub `fetch` with `vi.stubGlobal` and use temporary
  directories (`fs.mkdtemp`) for filesystem cases.
- TypeScript: strict mode, no `any`, no type assertions used to silence errors. Validate
  untrusted input at boundaries with narrowing.

## Release

Versions follow SemVer. The first public release is `0.0.1`, published to npm only when:
all checks are green, `npm pack --dry-run` output has been inspected, a clean-install
test has passed, the README matches the shipped behavior, and the release has explicit
authorization.
