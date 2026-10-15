import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { globalCacheDir, readCachedSkills, skillsCacheDir } from "../../src/opencode/cache.js";
import type { PathEnvironment } from "../../src/opencode/paths.js";

const DEFAULT_CATALOG_URL = "https://raulmoracode.github.io/raulmoracode-skills/";

/** sha1 of the normalized default catalog URL, observed in OpenCode v2.0.29. */
const DEFAULT_CACHE_KEY = "6ac0bac284e5ab60e7fc4ac36b544809797b89fc";

function environment(overrides: Partial<PathEnvironment> = {}): PathEnvironment {
  return {
    env: {},
    home: "/home/user",
    cwd: "/projects/app",
    ...overrides,
  };
}

describe("globalCacheDir", () => {
  it("honors an absolute $XDG_CACHE_HOME", () => {
    const dir = globalCacheDir(environment({ env: { XDG_CACHE_HOME: "/xdg/cache" } }));

    expect(dir).toBe(join("/xdg/cache", "opencode"));
  });

  it("ignores a relative $XDG_CACHE_HOME", () => {
    const dir = globalCacheDir(environment({ env: { XDG_CACHE_HOME: "relative/cache" } }));

    expect(dir).toBe(join("/home/user", ".cache", "opencode"));
  });

  it("falls back to <home>/.cache when the variable is unset", () => {
    expect(globalCacheDir(environment())).toBe(join("/home/user", ".cache", "opencode"));
  });
});

describe("skillsCacheDir", () => {
  it("uses the sha1 of the normalized base URL", () => {
    const dir = skillsCacheDir(environment(), DEFAULT_CATALOG_URL);

    expect(dir).toBe(join("/home/user", ".cache", "opencode", "skills", DEFAULT_CACHE_KEY));
  });

  it("produces the same directory with or without a trailing slash", () => {
    const withSlash = skillsCacheDir(environment(), DEFAULT_CATALOG_URL);
    const withoutSlash = skillsCacheDir(
      environment(),
      "https://raulmoracode.github.io/raulmoracode-skills",
    );

    expect(withoutSlash).toBe(withSlash);
  });

  it("places the cache under $XDG_CACHE_HOME when absolute", () => {
    const dir = skillsCacheDir(
      environment({ env: { XDG_CACHE_HOME: "/xdg/cache" } }),
      DEFAULT_CATALOG_URL,
    );

    expect(dir).toBe(join("/xdg/cache", "opencode", "skills", DEFAULT_CACHE_KEY));
  });
});

describe("readCachedSkills", () => {
  it("reads skill directories with their version markers, sorted by name", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cache-test-"));
    await mkdir(join(dir, "beta"));
    await mkdir(join(dir, "alpha"));
    await writeFile(join(dir, "alpha", ".opencode-version"), "1.0.0\n");
    await writeFile(join(dir, "stray-file"), "not a skill\n");

    expect(await readCachedSkills(dir)).toEqual([
      { name: "alpha", version: "1.0.0" },
      { name: "beta" },
    ]);
  });

  it("returns an empty list when the cache directory does not exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cache-test-"));

    expect(await readCachedSkills(join(dir, "missing"))).toEqual([]);
  });
});
