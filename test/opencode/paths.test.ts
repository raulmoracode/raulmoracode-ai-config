import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultGlobalConfigPath,
  defaultProjectConfigPath,
  globalConfigDir,
  type PathEnvironment,
  projectConfigCandidates,
  resolvePathEnvironment,
} from "../../src/opencode/paths.js";

function environment(overrides: Partial<PathEnvironment> = {}): PathEnvironment {
  return {
    env: {},
    home: "/home/tester",
    cwd: "/work/project",
    ...overrides,
  };
}

describe("resolvePathEnvironment", () => {
  it("falls back to the running process", () => {
    const resolved = resolvePathEnvironment();

    expect(resolved.env).toBe(process.env);
    expect(resolved.home).toBe(homedir());
    expect(resolved.cwd).toBe(process.cwd());
  });

  it("applies the provided overrides", () => {
    const env = { XDG_CONFIG_HOME: "/custom/config" };

    const resolved = resolvePathEnvironment({ env, home: "/home/other", cwd: "/work/other" });

    expect(resolved).toEqual({ env, home: "/home/other", cwd: "/work/other" });
  });
});

describe("globalConfigDir", () => {
  it("honors an absolute XDG_CONFIG_HOME", () => {
    const dir = globalConfigDir(environment({ env: { XDG_CONFIG_HOME: "/custom/config" } }));

    expect(dir).toBe(join("/custom/config", "opencode"));
  });

  it("ignores a relative XDG_CONFIG_HOME", () => {
    const dir = globalConfigDir(environment({ env: { XDG_CONFIG_HOME: "relative/config" } }));

    expect(dir).toBe(join("/home/tester", ".config", "opencode"));
  });

  it("ignores an empty XDG_CONFIG_HOME", () => {
    const dir = globalConfigDir(environment({ env: { XDG_CONFIG_HOME: "" } }));

    expect(dir).toBe(join("/home/tester", ".config", "opencode"));
  });

  it("defaults to ~/.config/opencode", () => {
    const dir = globalConfigDir(environment());

    expect(dir).toBe(join("/home/tester", ".config", "opencode"));
  });
});

describe("projectConfigCandidates", () => {
  it("lists the candidate files in precedence order", () => {
    const root = "/work/project";

    expect(projectConfigCandidates(root)).toEqual([
      join(root, "opencode.jsonc"),
      join(root, "opencode.json"),
      join(root, ".opencode", "opencode.jsonc"),
      join(root, ".opencode", "opencode.json"),
    ]);
  });
});

describe("default config paths", () => {
  it("uses opencode.json at the project root", () => {
    expect(defaultProjectConfigPath("/work/project")).toBe(join("/work/project", "opencode.json"));
  });

  it("uses opencode.json inside the global configuration directory", () => {
    const resolved = defaultGlobalConfigPath(environment({ env: { XDG_CONFIG_HOME: "/custom" } }));

    expect(resolved).toBe(join("/custom", "opencode", "opencode.json"));
  });
});
