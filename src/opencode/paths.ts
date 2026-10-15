import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

/**
 * Inputs used to resolve OpenCode configuration locations.
 *
 * The environment is injectable so path logic stays pure and testable: no
 * function in this module touches the filesystem or `process` directly.
 */
export interface PathEnvironment {
  env: Record<string, string | undefined>;
  home: string;
  cwd: string;
}

/** Resolves an environment, falling back to the running process for each field. */
export function resolvePathEnvironment(overrides?: Partial<PathEnvironment>): PathEnvironment {
  return {
    env: overrides?.env ?? process.env,
    home: overrides?.home ?? homedir(),
    cwd: overrides?.cwd ?? process.cwd(),
  };
}

/**
 * Global OpenCode configuration directory: `$XDG_CONFIG_HOME/opencode` when
 * the variable is set to an absolute path, `<home>/.config/opencode`
 * otherwise. Relative `$XDG_CONFIG_HOME` values are ignored, as the XDG base
 * directory specification requires.
 */
export function globalConfigDir(environment: PathEnvironment): string {
  const xdgConfigHome = environment.env.XDG_CONFIG_HOME;
  if (xdgConfigHome !== undefined && isAbsolute(xdgConfigHome)) {
    return join(xdgConfigHome, "opencode");
  }
  return join(environment.home, ".config", "opencode");
}

const PROJECT_CONFIG_FILE_CANDIDATES = [
  "opencode.jsonc",
  "opencode.json",
  join(".opencode", "opencode.jsonc"),
  join(".opencode", "opencode.json"),
] as const;

/**
 * Project configuration files to probe, in precedence order: a JSONC file
 * wins over a JSON file, and a file at the project root wins over the same
 * file inside `.opencode/`.
 */
export function projectConfigCandidates(root: string): readonly string[] {
  return PROJECT_CONFIG_FILE_CANDIDATES.map((candidate) => join(root, candidate));
}

/** File created when a project does not have a configuration file yet. */
export function defaultProjectConfigPath(root: string): string {
  return join(root, "opencode.json");
}

/** File created when the global configuration does not exist yet. */
export function defaultGlobalConfigPath(environment: PathEnvironment): string {
  return join(globalConfigDir(environment), "opencode.json");
}
