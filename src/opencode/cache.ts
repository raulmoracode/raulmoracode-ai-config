import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { normalizeBaseUrl } from "../catalog/client.js";
import type { PathEnvironment } from "./paths.js";

/**
 * Global OpenCode cache directory: `$XDG_CACHE_HOME/opencode` when the
 * variable is set to an absolute path, `<home>/.cache/opencode` otherwise
 * (the same XDG rule the config directory follows).
 */
export function globalCacheDir(environment: PathEnvironment): string {
  const xdgCacheHome = environment.env.XDG_CACHE_HOME;
  if (xdgCacheHome !== undefined && isAbsolute(xdgCacheHome)) {
    return join(xdgCacheHome, "opencode");
  }
  return join(environment.home, ".cache", "opencode");
}

/**
 * Directory where OpenCode caches the skills downloaded from `baseUrl`: the
 * sha1 of the normalized base URL (trailing slash ensured) under
 * `<cache>/opencode/skills/`. The exact scheme was verified against OpenCode
 * v2.0.29: configuring the URL with or without a trailing slash produces the
 * same cache directory.
 */
export function skillsCacheDir(environment: PathEnvironment, baseUrl: string): string {
  const key = createHash("sha1").update(normalizeBaseUrl(baseUrl)).digest("hex");
  return join(globalCacheDir(environment), "skills", key);
}

export interface CachedSkill {
  name: string;
  version?: string;
}

/**
 * Skills currently present in a cache directory, read from its skill
 * subdirectories and their `.opencode-version` markers. A missing directory
 * means nothing has been cached yet and yields an empty list.
 */
export async function readCachedSkills(directory: string): Promise<CachedSkill[]> {
  const entries = await readDirectory(directory);

  const skills: CachedSkill[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const version = await readVersionMarker(join(directory, entry.name));
    if (version === undefined) {
      skills.push({ name: entry.name });
    } else {
      skills.push({ name: entry.name, version });
    }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

async function readDirectory(directory: string): Promise<Dirent[]> {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isEnoentError(error)) {
      return [];
    }
    throw error;
  }
}

async function readVersionMarker(skillDir: string): Promise<string | undefined> {
  try {
    const text = await readFile(join(skillDir, ".opencode-version"), "utf8");
    const version = text.trim();
    return version.length > 0 ? version : undefined;
  } catch {
    return undefined;
  }
}

function isEnoentError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
