# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- End-to-end `init`, `skills`, and read-only `doctor` commands for configuring
  and diagnosing OpenCode's HTTPS skills catalog integration.
- Catalog version metadata validation and reporting through
  `catalog-version.json`.
- English CLI usage documentation and JSON output for scriptable inspection.
- Project scaffold: TypeScript 7 (strict, NodeNext), Biome, Vitest and npm scripts for
  lint, format, typecheck, test, build and a combined check.
- CLI entry point with `--help` and `--version`, usage-error exit codes and automated
  tests.
- Interactive terminal UI layer built on `@clack/prompts` with a plain-text fallback for
  non-interactive environments; commands receive it through their execution context.
- Repository guides: `AGENTS.md` and this changelog.

### Changed

- Command handling now uses a registry-based dispatcher; commands are self-contained
  modules with their own argument parsing, and the help text is derived from the
  registry.

## [0.0.1] - 2026-10-16

### Added

- First npm release of `@raulmoracode/ai-config`.
- Publish-safe package contents containing the built CLI and release metadata.
