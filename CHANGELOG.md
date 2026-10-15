# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
