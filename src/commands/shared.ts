import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { normalizeBaseUrl } from "../catalog/client.js";
import { DEFAULT_CATALOG_URL } from "../catalog/default.js";
import type { CommandContext } from "../cli/command.js";
import { CliError } from "../cli/errors.js";
import { findExistingConfigFile, readConfigFile } from "../opencode/config-file.js";
import { findProjectRoot } from "../opencode/discovery.js";
import {
  defaultGlobalConfigPath,
  defaultProjectConfigPath,
  type PathEnvironment,
  projectConfigCandidates,
  resolvePathEnvironment,
} from "../opencode/paths.js";

export interface ParsedOptions {
  url: string;
  global: boolean;
  json: boolean;
  version?: string;
}

export function parseOptions(
  argv: readonly string[],
  allowed: {
    global?: boolean;
    json?: boolean;
    version?: boolean;
  } = {},
): ParsedOptions {
  let url = DEFAULT_CATALOG_URL;
  let global = false;
  let json = false;
  let version: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--url" || argument === "--catalog-url") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new CliError(`${argument} requires a URL`, 2);
      }
      url = normalizeBaseUrl(value);
      index += 1;
      continue;
    }
    if (argument === "--global") {
      if (!allowed.global) {
        throw new CliError("Option '--global' is not supported for this command", 2);
      }
      global = true;
      continue;
    }
    if (argument === "--json") {
      if (!allowed.json) {
        throw new CliError("Option '--json' is not supported for this command", 2);
      }
      json = true;
      continue;
    }
    if (argument === "--version") {
      if (!allowed.version) {
        throw new CliError("Option '--version' is not supported for this command", 2);
      }
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new CliError("--version requires a value", 2);
      }
      version = value;
      index += 1;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      throw new CliError("Command help is shown in the top-level help; see --help", 0);
    }
    throw new CliError(`Unknown option '${argument}'`, 2);
  }

  return version === undefined ? { url, global, json } : { url, global, json, version };
}

export async function configTarget(
  context: CommandContext,
  useGlobal: boolean,
): Promise<{ path: string; environment: PathEnvironment; projectRoot?: string }> {
  const runtime = context.writers.runtime;
  const overrides =
    runtime === undefined
      ? undefined
      : {
          ...(runtime.env === undefined ? {} : { env: runtime.env }),
          ...(runtime.home === undefined ? {} : { home: runtime.home }),
          ...(runtime.cwd === undefined ? {} : { cwd: runtime.cwd }),
        };
  const environment = resolvePathEnvironment(overrides);

  if (useGlobal) {
    return { path: defaultGlobalConfigPath(environment), environment };
  }

  const projectRoot = await findProjectRoot(environment.cwd);
  const existing = await findExistingConfigFile(projectConfigCandidates(projectRoot));
  return { path: existing ?? defaultProjectConfigPath(projectRoot), environment, projectRoot };
}

export async function readTargetConfig(
  context: CommandContext,
  useGlobal: boolean,
): Promise<
  | { path: string; environment: PathEnvironment; projectRoot?: string; exists: false }
  | {
      path: string;
      environment: PathEnvironment;
      projectRoot?: string;
      exists: true;
      text: string;
    }
> {
  const target = await configTarget(context, useGlobal);
  const file = await readConfigFile(target.path);
  return { ...target, ...file };
}

export async function ensureParentDirectory(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export function formatList(items: readonly string[]): string {
  return items.length === 0 ? "(none)" : items.map((item) => `- ${item}`).join("\n");
}

export function configScopeLabel(useGlobal: boolean): string {
  return useGlobal ? "global config" : "project config";
}
